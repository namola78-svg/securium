import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import postgres from "postgres";
import {
  buildSecurityContentV3Plan,
  securityContentV3ContentProjection,
} from "../lib/data/security-content-upgrade-v3.mjs";
import {
  runPostgresSeedTransaction,
  verifyPostgresWithConnection,
} from "../scripts/security-content-upgrade-v3.mjs";

const execFileAsync = promisify(execFileCallback);
const EXEC_FILE_TIMEOUT_MS = 5 * 60 * 1_000;
const execFile = (file, args, options = {}) => execFileAsync(file, args, {
  timeout: EXEC_FILE_TIMEOUT_MS,
  ...options,
});
const runId = randomUUID();
const ownerLabelKey = "com.securium.evidence-once.owner";
const password = "standalone-postgres-atomic-test-password";
const migrationExclusions = new Set([
  "0002_server_only_rls_lockdown.sql",
  "0009_security_certification_taxonomy_cleanup.sql",
]);

let containerName;
let ownedContainerId;
let ownerLabel;
let postgresUrl;
let admin;

before(async () => {
  containerName = `securium-standalone-postgres-atomic-${runId}`;
  ownerLabel = `${ownerLabelKey}=${runId}`;
  const { stdout: containerIdOutput } = await execFile("docker", [
    "run", "--detach", "--rm", "--name", containerName,
    "--label", ownerLabel,
    "--env", `POSTGRES_PASSWORD=${password}`,
    "--publish", "127.0.0.1::5432", "postgres:17.6",
  ]);
  ownedContainerId = containerIdOutput.trim();
  assert.match(ownedContainerId, /^[0-9a-f]+$/i, "Disposable PostgreSQL container ID was not returned.");
  console.log(`SECURIUM_POSTGRES_FIXTURE_CREATED id=${ownedContainerId} owner=${runId}`);

  const { stdout: portOutput } = await execFile("docker", ["port", ownedContainerId, "5432/tcp"]);
  const portMatch = portOutput.trim().match(/^(127\.0\.0\.1|0\.0\.0\.0):([0-9]+)$/m);
  assert.ok(portMatch, "Disposable PostgreSQL loopback port was not published.");
  assert.equal(portMatch[1], "127.0.0.1", "Disposable PostgreSQL must be loopback-only.");
  postgresUrl = `postgres://postgres:${password}@127.0.0.1:${portMatch[2]}/postgres`;
  admin = postgres(postgresUrl, postgresOptions("fixture-admin"));
  await waitForConnection(admin);
  await admin.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;");
});

after(async () => {
  await admin?.end({ timeout: 5 }).catch(() => {});
  await cleanupOwnedContainer();
});

test("standalone PostgreSQL seed commits only after in-transaction verification and preserves replay", async () => {
  await withScenarioDatabase("commit-replay", async (client) => {
    const source = sourceFor("DNS security");
    const plan = buildSecurityContentV3Plan(source);

    const first = await runPostgresSeedTransaction(client, source, plan);
    assert.equal(first.metrics.contents, 1);
    assert.equal(first.metrics.course_lessons, 1);
    assert.equal(first.metrics.ontology_concepts, 32);
    const afterFirst = await generatedCounts(client);

    const second = await runPostgresSeedTransaction(client, source, plan);
    assert.deepEqual(second, first);
    assert.deepEqual(await generatedCounts(client), afterFirst);
  });
});

test("verification false result rolls back new rows and preserves an existing immutable row", async () => {
  await withScenarioDatabase("verification-false", async (client) => {
    const source = sourceFor("DNS security");
    const plan = buildSecurityContentV3Plan(source);
    await insertExistingContent(client, plan.contents[0]);

    await assert.rejects(
      runPostgresSeedTransaction(client, source, plan, {
        verify: async (transaction, currentPlan, options) => {
          const verified = await verifyPostgresWithConnection(transaction, currentPlan, options);
          assert.equal(verified.metrics.contents, 1);
          return false;
        },
      }),
      /SECURITY_CONTENT_V3_VERIFICATION_FAILED/,
    );

    assert.deepEqual(Array.from(await client`SELECT title, version FROM "contents" WHERE id = ${plan.contents[0].id}`), [
      { title: plan.contents[0].title, version: "3.0.0" },
    ]);
    const counts = await generatedCounts(client);
    assert.equal(counts.contents, 1);
    assert.equal(counts.course_lessons, 0);
    assert.equal(counts.ontology_concepts, 0);
    assert.equal(counts.ontology_edges, 0);
  });
});

test("verification query errors roll back the complete transaction", async () => {
  await withScenarioDatabase("verification-query-error", async (client) => {
    const source = sourceFor("DNS security");
    const plan = buildSecurityContentV3Plan(source);

    await assert.rejects(
      runPostgresSeedTransaction(client, source, plan, {
        verify: (transaction, currentPlan, options) => verifyPostgresWithConnection(transaction, currentPlan, {
          ...options,
          verificationStatement: 'SELECT * FROM "missing_security_content_v3_verification_relation";',
        }),
      }),
      (error) => error?.code === "42P01",
    );

    assert.deepEqual(await generatedCounts(client), zeroGeneratedCounts());
  });
});

test("verification mismatch rolls back writes and leaves no downstream mapping", async () => {
  await withScenarioDatabase("verification-mismatch", async (client) => {
    const source = sourceFor("DNS security");
    const plan = buildSecurityContentV3Plan(source);
    const courseLessonId = plan.courseLessons[0].id;

    await assert.rejects(
      runPostgresSeedTransaction(client, source, plan, {
        verify: async (transaction, currentPlan, options) => {
          await transaction.unsafe(`DELETE FROM "course_lessons" WHERE "id" = '${courseLessonId}'`);
          return verifyPostgresWithConnection(transaction, currentPlan, options);
        },
      }),
      /SECURITY_CONTENT_V3_COUNT_MISMATCH:course_lessons:0!=1/,
    );

    assert.deepEqual(await generatedCounts(client), zeroGeneratedCounts());
  });
});

test("divergent immutable payload is rejected before downstream mapping", async () => {
  await withScenarioDatabase("divergent-conflict", async (client) => {
    const source = sourceFor("DNS security");
    const plan = buildSecurityContentV3Plan(source);
    await insertExistingContent(client, plan.contents[0], { title: "Synthetic divergent payload" });

    await assert.rejects(
      runPostgresSeedTransaction(client, source, plan),
      /SECURITY_CONTENT_V3_CONTENT_REVISION_CONFLICT/,
    );

    assert.deepEqual(Array.from(await client`SELECT title, version FROM "contents" WHERE id = ${plan.contents[0].id}`), [
      { title: "Synthetic divergent payload", version: "3.0.0" },
    ]);
    assert.deepEqual(Array.from(await client`SELECT id FROM "course_lessons" WHERE id = ${plan.courseLessons[0].id}`), []);
  });
});

async function withScenarioDatabase(label, callback) {
  const databaseName = `boundary_${label}_${runId.replaceAll("-", "").slice(0, 12)}`;
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  const client = postgres(postgresUrl.replace(/\/postgres$/, `/${databaseName}`), postgresOptions(`scenario-${label}`));
  try {
    await waitForConnection(client);
    await applyMigrations(client);
    await seedBaseline(client);
    return await callback(client);
  } finally {
    await client.end({ timeout: 5 }).catch(() => {});
    await admin.unsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`).catch(() => {});
  }
}

async function applyMigrations(client) {
  const migrations = (await readdir("db/postgres/migrations"))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .filter((name) => !migrationExclusions.has(name))
    .sort();
  for (const name of migrations) await client.unsafe(await readFile(`db/postgres/migrations/${name}`, "utf8"));
}

async function seedBaseline(client) {
  await client.unsafe(`
    INSERT INTO "course_groups" ("id", "code", "name") VALUES
      ('boundary-group', 'BOUNDARY_GROUP', 'Synthetic boundary group');
    INSERT INTO "users" ("id", "email", "display_name") VALUES
      ('user-content-editor', 'boundary-editor@example.invalid', 'Synthetic Content Editor');
    INSERT INTO "courses" ("id", "course_group_id", "code", "slug", "name", "short_name", "description", "active", "published") VALUES
      ('course-ise', 'boundary-group', 'ISE', 'boundary-ise', 'Synthetic ISE', 'ISE', 'Synthetic ISE course', 1, 1),
      ('course-isie', 'boundary-group', 'ISIE', 'boundary-isie', 'Synthetic ISIE', 'ISIE', 'Synthetic ISIE course', 1, 1);
    INSERT INTO "subjects" ("id", "course_id", "code", "name") VALUES
      ('course-ise-subject-system_security', 'course-ise', 'SYSTEM_SECURITY', 'Synthetic System Security'),
      ('course-ise-subject-network_security', 'course-ise', 'NETWORK_SECURITY', 'Synthetic Network Security'),
      ('course-ise-subject-application_security', 'course-ise', 'APPLICATION_SECURITY', 'Synthetic Application Security'),
      ('course-ise-subject-security_foundation', 'course-ise', 'SECURITY_FOUNDATION', 'Synthetic Security Foundation'),
      ('course-ise-subject-security_law', 'course-ise', 'SECURITY_LAW', 'Synthetic Security Law');
    INSERT INTO "topics" ("id", "subject_id", "code", "name") VALUES
      ('course-ise-subject-system_security-topic-core', 'course-ise-subject-system_security', 'CORE', 'Synthetic Core'),
      ('course-ise-subject-network_security-topic-core', 'course-ise-subject-network_security', 'CORE', 'Synthetic Core'),
      ('course-ise-subject-application_security-topic-core', 'course-ise-subject-application_security', 'CORE', 'Synthetic Core'),
      ('course-ise-subject-security_foundation-topic-core', 'course-ise-subject-security_foundation', 'CORE', 'Synthetic Core'),
      ('course-ise-subject-security_law-topic-core', 'course-ise-subject-security_law', 'CORE', 'Synthetic Core');
    INSERT INTO "curriculum_trees" ("id", "course_id", "title", "version", "source_type", "status") VALUES
      ('curriculum-ise-2027-2029-official', 'course-ise', 'Synthetic ISE Curriculum', '2027-2029', 'SYNTHETIC_TEST', 'ACTIVE');
    INSERT INTO "curriculum_nodes" ("id", "curriculum_tree_id", "node_type", "title", "official_code", "sort_order", "depth", "path", "is_required", "is_practical", "status") VALUES
      ('curriculum-node-ise-2027-2029-01-03-01-04', 'curriculum-ise-2027-2029-official', 'SUB_ITEM', 'Synthetic DNS Node', 'SYNTHETIC-DNS', 1, 0, '/SYNTHETIC-DNS', 1, 0, 'ACTIVE');
  `);
}

function sourceFor(concept, { title = `Synthetic ${concept}` } = {}) {
  return {
    lessons: [{
      id: `sec-upgrade-lesson-${slug(concept)}`,
      title,
      concepts: [concept],
      source_refs: ["synthetic-disposable-postgres-fixture"],
      difficulty: 3,
      learningObjectives: ["Synthetic transaction boundary objective"],
      overview: "Synthetic transaction boundary overview",
      keyPoints: ["Synthetic transaction boundary key point"],
      practiceTip: "Synthetic transaction boundary practice tip",
      fieldExample: "Synthetic transaction boundary field example",
      relatedConcepts: [],
      provenance: { canonicalConcept: concept },
    }],
    writtenQuestions: [],
    practicalQuestions: [],
  };
}

async function insertExistingContent(client, row, { title = row.title } = {}) {
  const projection = securityContentV3ContentProjection(row);
  await client`
    INSERT INTO "contents"
      ("id", "slug", "canonical_key", "title", "summary", "body", "body_format",
       "learning_objectives_json", "core_concepts_json", "practical_examples_json",
       "diagrams_json", "media_json", "version", "status", "created_by")
    VALUES
      (${projection.id}, ${row.slug}, ${row.canonicalKey}, ${title}, ${projection.summary}, ${projection.body},
       'STRUCTURED_JSON', ${projection.learningObjectivesJson}, ${projection.coreConceptsJson},
       ${projection.practicalExamplesJson}, ${projection.diagramsJson}, ${projection.mediaJson},
       ${projection.version}, 'DRAFT', 'user-content-editor')
  `;
}

async function generatedCounts(client) {
  const [row] = await client`
    SELECT
      (SELECT COUNT(*) FROM "contents" WHERE id LIKE 'sec-upgrade-lesson-%')::int AS contents,
      (SELECT COUNT(*) FROM "course_lessons" WHERE id LIKE 'upgrade-course-lesson-%')::int AS course_lessons,
      (SELECT COUNT(*) FROM "ontology_concepts" WHERE source_id = 'SECURIUM_CONTENT_UPGRADE_V2')::int AS ontology_concepts,
      (SELECT COUNT(*) FROM "ontology_edges" WHERE course_id = 'course-ise' AND (from_id LIKE 'sec-upgrade-%' OR to_id LIKE 'sec-upgrade-%' OR from_id LIKE 'upgrade-course-lesson-%' OR to_id LIKE 'upgrade-course-lesson-%'))::int AS ontology_edges
  `;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

function zeroGeneratedCounts() {
  return { contents: 0, course_lessons: 0, ontology_concepts: 0, ontology_edges: 0 };
}

function postgresOptions(applicationName) {
  return {
    max: 1,
    prepare: false,
    ssl: false,
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => undefined,
    connection: { application_name: applicationName, statement_timeout: 30_000 },
  };
}

async function waitForConnection(client) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await client`SELECT 1`;
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Disposable PostgreSQL did not become ready within the readiness timeout.");
}

async function cleanupOwnedContainer() {
  if (!ownedContainerId) {
    console.log("SECURIUM_POSTGRES_FIXTURE_CLEANUP PASS owned_container=false");
    return;
  }
  const cleanupId = ownedContainerId;
  let inspectedOwner;
  try {
    const result = await execFile("docker", [
      "inspect", "--format", "{{json .Config.Labels}}", ownedContainerId,
    ]);
    const labels = JSON.parse(result.stdout.trim() || "{}");
    inspectedOwner = labels?.[ownerLabelKey];
  } catch (error) {
    const diagnostic = `${error?.stderr ?? ""} ${error?.message ?? ""}`;
    if (/No such object|No such container/i.test(diagnostic)) {
      ownedContainerId = undefined;
      console.log(`SECURIUM_POSTGRES_FIXTURE_CLEANUP PASS id=${cleanupId} already_absent=true`);
      return;
    }
    throw new Error(`Disposable PostgreSQL ownership inspection failed for ${cleanupId}.`);
  }
  if (inspectedOwner !== runId) throw new Error(`Refusing to remove PostgreSQL container ${cleanupId}: owner label mismatch.`);
  await execFile("docker", ["rm", "--force", cleanupId]);
  ownedContainerId = undefined;
  console.log(`SECURIUM_POSTGRES_FIXTURE_CLEANUP PASS id=${cleanupId} already_absent=false`);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
