import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { register } from "node:module";
import { after, test } from "node:test";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { saveGovernedQuestionCandidate } from "../db/question-governance-repository.ts";
import {
  cleanupOwnedPostgresContainer,
  createOwnedPostgresContainer,
  getPublishedPostgresPort,
  inspectOwnedPostgresContainer,
} from "../scripts/owned-postgres-container.mjs";

const actor = "b0000000-0000-4000-8000-000000000001";
const group = "pg-group-sw";
const course = "pg-course-sw";
const concept = "pg-concept-sw";
let createdContainer;
let client;

after(async () => {
  await client?.end({ timeout: 5 }).catch(() => {});
  if (createdContainer) {
    try {
      console.log(`OWNED_POSTGRES_TEST_CLEANUP ${await cleanupOwnedPostgresContainer(createdContainer)}`);
    } catch (error) {
      console.error(`OWNED_POSTGRES_TEST_CLEANUP_ERROR ${error?.message || "FAILED"}`);
      process.exitCode ||= 1;
    }
  }
});

test("disposable PostgreSQL 17 proves governed NEW_SUCCESS and EXACT_REPLAY", async () => {
  createdContainer = await createOwnedPostgresContainer({
    name: process.env.SECURIUM_QUESTION_GOVERNANCE_POSTGRES_CONTAINER?.trim()
      || `securium-question-governance-${randomUUID()}`,
    ownerToken: process.env.SECURIUM_QUESTION_GOVERNANCE_POSTGRES_OWNER?.trim()
      || `question-governance-owner-${randomUUID()}`,
    password: "question-governance-test-password",
    receiptPath: process.env.SECURIUM_QUESTION_GOVERNANCE_POSTGRES_RECEIPT,
  });
  assert.deepEqual(await inspectOwnedPostgresContainer(createdContainer), {
    id: createdContainer.containerId,
    name: `/${createdContainer.containerName}`,
    running: true,
    ownerToken: createdContainer.ownerToken,
  });
  console.log(`OWNED_POSTGRES_TEST_CONTAINER id=${createdContainer.containerId} owner=${createdContainer.ownerToken}`);
  const port = await getPublishedPostgresPort(createdContainer);
  const password = "question-governance-test-password";
  const postgres = (await import("postgres")).default;
  client = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
  await waitForConnection();
  await client.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;");
  // Mirror the baseline contract expected by post-baseline migrations such as 0058.
  await client.unsafe(`CREATE TABLE public.app_schema_baseline_receipts (
    baseline_id text PRIMARY KEY,
    baseline_version text NOT NULL,
    schema_boundary text NOT NULL,
    artifact_sha256 text NOT NULL,
    schema_sha256 text NOT NULL,
    security_sha256 text NOT NULL,
    created_from_main_sha text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  // Existing 0002 references later tables and 0009 validates seed taxonomy
  // data. The disposable question schema proof excludes those pre-existing
  // environment-dependent files; migration syntax/guards remain validated
  // separately.
  const migrations = (await readdir("db/postgres/migrations")).filter((name) => /^\d{4}_.+\.sql$/.test(name) && !["0002_server_only_rls_lockdown.sql", "0009_security_certification_taxonomy_cleanup.sql"].includes(name)).sort();
  for (const name of migrations) await client.unsafe(await readFile(`db/postgres/migrations/${name}`, "utf8"));
  await client.unsafe("INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3)", [actor, "pg-actor@example.invalid", "PG Actor"]);
  await client.unsafe("INSERT INTO course_groups (id, code, name, description) VALUES ($1, $2, $3, $4)", [group, "PG-SW", "PG SW", "PG SW"]);
  await client.unsafe("INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description) VALUES ($1, $2, $3, $4, $5, $6, $7)", [course, group, "PG-SW", "pg-sw", "PG SW", "PG SW", "PG SW"]);
  await client.unsafe("INSERT INTO ontology_concepts (id, concept_key, namespace, label, normalized_label, category) VALUES ($1, $2, 'securium', $3, $4, 'secure-coding')", [concept, "pg.swsec.test", "PG SW", "pg sw"]);
  const provider = makeProvider();
  const candidate = { id: "pg-swsec-question-001", version: 1, title: "PG governed question", content: "Which control applies?", type: "SINGLE_CHOICE", difficulty: "EASY", explanation: "The control is required.", wrongAnswerExplanation: "The alternative is insufficient.", answerConfigJson: "{}", source: "OFFICIAL_SOURCE_PROPOSITION", sourceDate: "2026-08-21", choices: [{ content: "Required control", displayOrder: 1, isCorrect: true, explanation: "" }, { content: "Insufficient control", displayOrder: 2, isCorrect: false, explanation: "" }], courseIds: [course], conceptMappings: [{ conceptId: concept, mappingStatus: "SUGGESTED", qualificationJson: JSON.stringify({ track: "SW" }), provenanceJson: JSON.stringify({ source: "OFFICIAL" }) }], governance: { blueprintId: "bp.pg.test", qualificationJson: JSON.stringify({ track: "SW" }), provenanceJson: JSON.stringify({ propositionIds: ["prop.pg.test"] }), governanceJson: JSON.stringify({ authoringOrigin: "ORIGINAL_AI_ASSISTED_AUTHORING", rightsStatus: "PASS", similarityStatus: "PASS_LOW_SIMILARITY" }) } };
  assert.equal((await saveGovernedQuestionCandidate(candidate, actor, provider)).outcome, "NEW_SUCCESS");
  assert.equal((await saveGovernedQuestionCandidate(candidate, actor, provider)).outcome, "EXACT_REPLAY");
  const counts = await client.unsafe("SELECT (SELECT count(*) FROM questions WHERE id = $1) AS questions, (SELECT count(*) FROM question_versions WHERE question_id = $1) AS versions, (SELECT count(*) FROM question_concepts qc JOIN question_versions qv ON qv.id = qc.question_version_id WHERE qv.question_id = $1) AS concepts", [candidate.id]);
  assert.equal(Number(counts[0].questions), 1);
  assert.equal(Number(counts[0].versions), 1);
  assert.equal(Number(counts[0].concepts), 1);
  const [storedVersion] = await client.unsafe("SELECT snapshot_json FROM question_versions WHERE question_id = $1 AND version = $2", [candidate.id, candidate.version]);
  const storedChoices = await client.unsafe("SELECT id, display_order FROM question_choices WHERE question_id = $1 ORDER BY display_order", [candidate.id]);
  const snapshotChoices = JSON.parse(storedVersion.snapshot_json).choices;
  assert.deepEqual(
    snapshotChoices.map((choice) => [choice.id, choice.displayOrder]),
    storedChoices.map((choice) => [choice.id, Number(choice.display_order)]),
  );

  const failureStages = [
    ["F2", 1], ["F3", 2], ["F4", 3], ["F5", 4], ["F6", 5], ["F7", 6], ["F8", 8],
  ];
  for (const [stage, failAt] of failureStages) {
    const failureCandidate = { ...candidate, id: `pg-failure-${stage}` };
    await assert.rejects(saveGovernedQuestionCandidate(failureCandidate, actor, makeProvider(failAt)));
    const rows = await client.unsafe("SELECT (SELECT count(*) FROM questions WHERE id = $1) AS questions, (SELECT count(*) FROM question_versions WHERE question_id = $1) AS versions, (SELECT count(*) FROM question_choices WHERE question_id = $1) AS choices, (SELECT count(*) FROM question_concepts qc JOIN question_versions qv ON qv.id = qc.question_version_id WHERE qv.question_id = $1) AS concepts", [failureCandidate.id]);
    assert.deepEqual(Object.values(rows[0]).map(Number), [0, 0, 0, 0], `${stage} left partial rows`);
  }
});

test("canonical PostgreSQL rejects legacy publication without changing published question authority or superseding prior revision", async () => {
  assert.ok(client && createdContainer, "The owned PostgreSQL fixture must be initialized");
  const questionId = "pg-swsec-question-001";
  // Synthetic approval metadata for this disposable database only.
  await client.unsafe("UPDATE questions SET status = 'PUBLISHED', reviewed_by = $1, published_at = '2026-10-01T00:00:00.000Z' WHERE id = $2", [actor, questionId]);
  await client.unsafe("UPDATE question_versions SET human_review_hash = $1, human_reviewed_by = $2, human_reviewed_at = '2026-10-01T00:00:00.000Z', governance_json = $3 WHERE question_id = $4", ["b".repeat(64), actor, JSON.stringify({ rightsStatus: "PASS", similarityStatus: "PASS_LOW_SIMILARITY", reviewedSemanticHash: (await client.unsafe("SELECT semantic_hash FROM question_versions WHERE question_id = $1", [questionId]))[0].semantic_hash }), questionId]);
  await client.unsafe("INSERT INTO content_revisions (id, content_type, content_id, title, content_date, version, revision_status, snapshot_json, reviewed_by, reviewed_at, published_at, is_latest, created_by) VALUES ('synthetic-pg-prior-question-revision', 'QUESTION_EXPLANATION', $1, 'Prior synthetic revision', '2026-10-01', 'legacy-1', 'published', '{}', $2, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 1, $2)", [questionId, actor]);

  const environment = {
    APP_ENV: "development", DB_PROVIDER: "supabase", DATABASE_URL: `postgres://postgres:question-governance-test-password@127.0.0.1:${await getPublishedPostgresPort(createdContainer)}/postgres`,
    POSTGRES_SSL_MODE: "disable", POSTGRES_MAX_CONNECTIONS: "1", POSTGRES_QUERY_TIMEOUT_MS: "5000",
  };
  const previous = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]));
  Object.assign(process.env, environment);
  register("./support/node-runtime-loader.mjs", import.meta.url);
  const { createContentRevisionDraft, publishContentRevision } = await import("../db/content-revision-repositories.ts");
  const { disconnectRuntimePostgresExecutor } = await import("../db/postgres/postgres-js-executor.ts");
  try {
    const changes = [
      { title: "Changed title" }, { explanation: "Changed explanation" },
      { wrongAnswerExplanation: "Changed feedback" }, { source: "synthetic:changed" },
      { sourceDate: "2026-10-06" }, undefined,
    ];
    for (const [index, snapshot] of changes.entries()) {
      const revisionId = await createContentRevisionDraft({
        contentType: "QUESTION_EXPLANATION", contentId: questionId, contentDate: "2026-10-07",
        version: `synthetic-legacy-${index + 2}`, changeSummary: "Synthetic version-boundary regression",
        snapshotJson: snapshot === undefined ? undefined : JSON.stringify(snapshot), userId: actor,
      });
      const before = await questionAuthorityState(questionId);
      await assert.rejects(publishContentRevision(revisionId, actor), (error) => error?.code === "QUESTION_GOVERNED_VERSION_REQUIRED");
      assert.deepEqual(await questionAuthorityState(questionId), before);
      const [draft] = await client.unsafe("SELECT revision_status, is_latest, reviewed_by, published_at FROM content_revisions WHERE id = $1", [revisionId]);
      assert.deepEqual({ ...draft }, { revision_status: "draft", is_latest: 0, reviewed_by: null, published_at: null });
    }
  } finally {
    await disconnectRuntimePostgresExecutor();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

async function questionAuthorityState(questionId) {
  return Promise.all([
    client.unsafe("SELECT * FROM questions WHERE id = $1", [questionId]),
    client.unsafe("SELECT * FROM question_versions WHERE question_id = $1 ORDER BY version", [questionId]),
    client.unsafe("SELECT * FROM question_concepts WHERE question_version_id IN (SELECT id FROM question_versions WHERE question_id = $1) ORDER BY id", [questionId]),
    client.unsafe("SELECT * FROM content_revisions WHERE content_id = $1 ORDER BY id", [questionId]),
    client.unsafe("SELECT * FROM question_choices WHERE question_id = $1 ORDER BY id", [questionId]),
  ]);
}

function makeProvider(failAt = null) {
  return new PostgresDatabaseProvider({
    query: async (query, parameters) => { const rows = await client.unsafe(query, parameters); return { rows, rowCount: rows.count ?? rows.length }; },
    transaction: async (callback) => client.begin(async (tx) => {
      let count = 0;
      const result = await callback({ query: async (query, parameters) => { count += 1; if (failAt === count) throw new Error(`failure injection ${failAt}`); const rows = await tx.unsafe(query, parameters); return { rows, rowCount: rows.count ?? rows.length }; } });
      if (failAt === 8) throw new Error("failure injection before commit");
      return result;
    }),
  });
}

async function waitForConnection() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { await client`SELECT 1`; return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}
