import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { Miniflare } from "miniflare";
import postgres from "postgres";
import {
  getPublishedPostgresPort,
  readOwnedPostgresReceipt,
} from "../scripts/owned-postgres-container.mjs";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { RepositoryContext } from "../db/repository-adapter/repository-context.ts";
import { createPublicCourseOutlineProvider } from "../db/public-course-outline-provider.ts";
import {
  createPublicCourseOutlineAdapter,
  MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS,
  MAX_PUBLIC_COURSE_OUTLINE_TOPICS,
} from "../lib/services/public-course-outline-adapter.ts";

const runId = randomUUID();
const execFile = promisify(execFileCallback);
const DOCKER_TIMEOUT_MS = 30_000;
const POSTGRES_OWNER_LABEL = "com.securium.evidence-once.owner";
const QUERY_TIMEOUT_MS = 10_000;
const SETUP_TIMEOUT_MS = 60_000;

let d1;
let miniflare;
let d1PersistPath;
let postgresClient;
let postgresRecord;
let postgresReceiptDirectory;

before(async () => {
  await setupD1();
});

after(async () => {
  await postgresClient?.end({ timeout: 5 }).catch((error) => {
    console.error(`POSTGRES_FIXTURE_CLIENT_CLEANUP_FAIL ${error?.message ?? error}`);
  });

  let postgresCleanupComplete = false;
  if (postgresRecord) {
    try {
      const receipt = await readOwnedPostgresReceipt(
        join(postgresReceiptDirectory, "container-receipt.json"),
      );
      if (
        !receipt ||
        receipt.containerId !== postgresRecord.containerId ||
        receipt.ownerToken !== postgresRecord.ownerToken
      ) {
        throw new Error("POSTGRES_FIXTURE_RECEIPT_REVALIDATION_FAILED");
      }
      const result = await cleanupLocalOwnedPostgresContainer(receipt);
      console.log(`POSTGRES_FIXTURE_CLEANUP ${result}`);
      postgresCleanupComplete = true;
    } catch (error) {
      console.error(`POSTGRES_FIXTURE_CLEANUP_FAIL ${error?.message ?? error}`);
    }
  }

  await miniflare?.dispose().catch((error) => {
    console.error(`D1_FIXTURE_CLEANUP_FAIL ${error?.message ?? error}`);
  });
  if (d1PersistPath) {
    await rm(d1PersistPath, { recursive: true, force: true }).catch((error) => {
      console.error(`D1_PERSISTENCE_CLEANUP_FAIL ${error?.message ?? error}`);
    });
  }
  if (postgresReceiptDirectory && postgresCleanupComplete) {
    await rm(postgresReceiptDirectory, { recursive: true, force: true }).catch(
      (error) => {
        console.error(`POSTGRES_RECEIPT_CLEANUP_FAIL ${error?.message ?? error}`);
      },
    );
  }
});

test("D1 provider integration enforces the public outline contract in isolated D1", async () => {
  await assertProviderContract(createD1Runtime);
});

test("PostgreSQL provider integration enforces the public outline contract in an owned container", async () => {
  await setupPostgres();
  await assertProviderContract(createPostgresRuntime);
});

test("provider query failures remain repository errors and do not become empty outlines", async () => {
  const adapter = createPublicCourseOutlineAdapter({
    getPublicCourseBySlug: async () => {
      throw new Error("fixture database failure");
    },
    listCurriculum: async () => [],
  });

  assert.deepEqual(await adapter({ courseSlug: "public-course" }), {
    status: "UNAVAILABLE",
    reason: "PUBLIC_REPOSITORY_ERROR",
  });
});

async function assertProviderContract(createRuntime) {
  const normal = await invoke(createRuntime, "public-course");
  assert.equal(normal.result.status, "OK");
  assert.deepEqual(normal.result.course, {
    id: "course-public",
    slug: "public-course",
    code: "PUBLIC-COURSE",
    name: "Public Course",
    shortName: "Public",
    groupName: "Public Group",
    description: "Public course description",
    difficulty: "BEGINNER",
  });
  assert.deepEqual(normal.result.subjects.map((subject) => subject.id), [
    "subject-a",
    "subject-z",
    "subject-가",
  ]);
  assert.deepEqual(normal.result.subjects[0].topics.map((topic) => topic.id), [
    "topic-a",
    "topic-z",
    "topic-가",
  ]);
  assert.deepEqual(normal.result.subjects[1].topics.map((topic) => topic.id), [
    "topic-public-z",
  ]);
  assert.deepEqual(normal.metrics, {
    queryCount: 3,
    queryCountByKind: { course: 1, subjects: 1, topics: 1 },
    returnedRowsByKind: { course: 1, subjects: 3, topics: 4 },
  });
  assert.equal(JSON.stringify(normal.result).includes("private-thumbnail"), false);
  assert.equal(JSON.stringify(normal.result).includes("PRIVATE_GROUP_METADATA"), false);
  assert.equal(JSON.stringify(normal.result).includes("lesson-body"), false);
  assert.equal(JSON.stringify(normal.result).includes("learner-identity"), false);
  assert.deepEqual(Object.keys(normal.result.subjects[0]).sort(), [
    "code",
    "courseId",
    "description",
    "displayOrder",
    "id",
    "isSample",
    "name",
    "topics",
  ]);
  assert.deepEqual(Object.keys(normal.result.subjects[0].topics[0]).sort(), [
    "code",
    "description",
    "displayOrder",
    "id",
    "isSample",
    "name",
    "subjectId",
  ]);

  const empty = await invoke(createRuntime, "empty-course");
  assert.deepEqual(empty.result, {
    status: "OK",
    course: {
      id: "course-empty",
      slug: "empty-course",
      code: "EMPTY-COURSE",
      name: "Empty Course",
      shortName: "Empty",
      groupName: "Public Group",
      description: "Empty outline",
      difficulty: "BEGINNER",
    },
    subjects: [],
  });
  assert.deepEqual(empty.metrics, {
    queryCount: 3,
    queryCountByKind: { course: 1, subjects: 1, topics: 1 },
    returnedRowsByKind: { course: 1, subjects: 0, topics: 0 },
  });

  for (const slug of [
    "missing-course",
    "inactive-group-course",
    "deleted-group-course",
    "inactive-course",
    "unpublished-course",
    "deleted-course",
  ]) {
    const inaccessible = await invoke(createRuntime, slug);
    assert.deepEqual(inaccessible.result, { status: "NOT_FOUND" }, slug);
    assert.deepEqual(inaccessible.metrics, {
      queryCount: 1,
      queryCountByKind: { course: 1, subjects: 0, topics: 0 },
      returnedRowsByKind: { course: 0, subjects: 0, topics: 0 },
    }, slug);
  }

  const exactSubjects = await invoke(createRuntime, "exact-subjects-course");
  assert.equal(exactSubjects.result.status, "OK");
  assert.equal(exactSubjects.result.subjects.length, MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS);
  assert.deepEqual(exactSubjects.metrics.returnedRowsByKind, {
    course: 1,
    subjects: MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS,
    topics: 0,
  });

  const subjectOverflow = await invoke(createRuntime, "overflow-subjects-course");
  assert.deepEqual(subjectOverflow.result, {
    status: "UNAVAILABLE",
    reason: "OUTLINE_LIMIT_EXCEEDED",
  });
  assert.deepEqual(subjectOverflow.metrics.returnedRowsByKind, {
    course: 1,
    subjects: MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS + 1,
    topics: 0,
  });
  assert.equal(subjectOverflow.metrics.queryCount, 3);

  const exactTopics = await invoke(createRuntime, "exact-topics-course");
  assert.equal(exactTopics.result.status, "OK");
  assert.equal(
    exactTopics.result.subjects.reduce(
      (count, subject) => count + subject.topics.length,
      0,
    ),
    MAX_PUBLIC_COURSE_OUTLINE_TOPICS,
  );
  assert.deepEqual(exactTopics.metrics.returnedRowsByKind, {
    course: 1,
    subjects: 2,
    topics: MAX_PUBLIC_COURSE_OUTLINE_TOPICS,
  });

  const topicOverflow = await invoke(createRuntime, "overflow-topics-course");
  assert.deepEqual(topicOverflow.result, {
    status: "UNAVAILABLE",
    reason: "OUTLINE_LIMIT_EXCEEDED",
  });
  assert.deepEqual(topicOverflow.metrics.returnedRowsByKind, {
    course: 1,
    subjects: 2,
    topics: MAX_PUBLIC_COURSE_OUTLINE_TOPICS + 1,
  });
  assert.equal(topicOverflow.metrics.queryCount, 3);
  assert.equal("subjects" in topicOverflow.result, false);

  const otherCourse = await invoke(createRuntime, "public-course");
  assert.equal(otherCourse.result.status, "OK");
  assert.equal(
    JSON.stringify(otherCourse.result).includes("other-course-subject"),
    false,
  );
  assert.equal(
    JSON.stringify(otherCourse.result).includes("other-course-topic"),
    false,
  );

  const injection = await invoke(createRuntime, "public-course' OR 1=1 --");
  assert.deepEqual(injection.result, { status: "NOT_FOUND" });
  assert.equal(injection.metrics.queryCount, 1);
  if (injection.observedQueries) {
    assert.equal(injection.observedQueries[0].sql.includes("OR 1=1"), false);
    assert.equal(
      injection.observedQueries[0].parameters.includes("public-course' OR 1=1 --"),
      true,
    );
  }
}

async function invoke(createRuntime, slug) {
  const runtime = createRuntime();
  const result = await withTimeout(
    runtime.adapter({ courseSlug: slug }),
    QUERY_TIMEOUT_MS,
    `outline adapter ${slug}`,
  );
  return {
    result,
    metrics: runtime.provider.getMetrics(),
    observedQueries: runtime.observedQueries,
  };
}

function createD1Runtime() {
  const provider = createPublicCourseOutlineProvider(
    new RepositoryContext(new D1DatabaseProvider(d1)),
  );
  return {
    provider,
    adapter: createPublicCourseOutlineAdapter(provider),
  };
}

function createPostgresRuntime() {
  const observedQueries = [];
  const databaseProvider = new PostgresDatabaseProvider({
    async query(sql, parameters) {
      observedQueries.push({ sql, parameters: [...parameters] });
      const rows = Array.from(
        await withTimeout(
          postgresClient.unsafe(sql, parameters),
          QUERY_TIMEOUT_MS,
          "postgres provider query",
        ),
      );
      return { rows, rowCount: rows.length };
    },
    async transaction() {
      throw new Error("outline provider does not require a write transaction");
    },
  });
  const provider = createPublicCourseOutlineProvider(
    new RepositoryContext(databaseProvider),
  );
  return {
    provider,
    observedQueries,
    adapter: createPublicCourseOutlineAdapter(provider),
  };
}

async function setupD1() {
  d1PersistPath = await mkdtemp(
    join(tmpdir(), `securium-public-course-outline-d1-${runId}-`),
  );
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: `public-course-outline-${runId}` },
    d1Persist: d1PersistPath,
  });
  d1 = await withTimeout(
    miniflare.getD1Database("DB"),
    QUERY_TIMEOUT_MS,
    "D1 database creation",
  );

  for (const name of await migrationNames("drizzle")) {
    const source = await readFile(join("drizzle", name), "utf8");
    const statements = adaptMigrationForD1(source, name)
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (let index = 0; index < statements.length; index += 40) {
      await withTimeout(
        d1.batch(
          statements
            .slice(index, index + 40)
            .map((statement) => d1.prepare(statement)),
        ),
        SETUP_TIMEOUT_MS,
        `D1 migration ${name}`,
      );
    }
  }
  await executeD1Fixtures();
  console.log(`D1_FIXTURE_CREATED persistence=${d1PersistPath}`);
}

async function setupPostgres() {
  postgresReceiptDirectory = await mkdtemp(
    join(tmpdir(), `securium-public-course-outline-pg-${runId}-`),
  );
  const receiptPath = join(postgresReceiptDirectory, "container-receipt.json");
  postgresRecord = await createLocalOwnedPostgresContainer({
    name: `securium-public-course-outline-${runId}`,
    ownerToken: `public-course-outline-${runId}`,
    password: `public-course-outline-test-${runId}`,
    receiptPath,
  });
  const port = await getPublishedPostgresPort(postgresRecord);
  console.log(
    `POSTGRES_FIXTURE_CREATED id=${postgresRecord.containerId} owner=${postgresRecord.ownerToken} endpoint=127.0.0.1:${port}`,
  );
  postgresClient = postgres(
    `postgres://postgres:public-course-outline-test-${runId}@127.0.0.1:${port}/postgres`,
    {
      max: 1,
      prepare: false,
      ssl: false,
      connect_timeout: 5,
      onnotice: false,
    },
  );
  await waitForPostgres();
  await executePostgres(
    "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;",
  );

  const manifest = JSON.parse(
    await readFile(
      "db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.json",
      "utf8",
    ),
  );
  await executePostgres(
    `SET securium.baseline_artifact_sha256 = '${manifest.artifactDigest}'; SET securium.baseline_schema_sha256 = '${manifest.schemaDigest}'; SET securium.baseline_security_sha256 = '${manifest.securityDigest}';`,
  );
  await executePostgres(
    await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.sql", "utf8"),
  );
  for (const name of await migrationNames("db/postgres/migrations")) {
    if (Number(name.slice(0, 4)) < 20) continue;
    await executePostgres(await readFile(join("db/postgres/migrations", name), "utf8"));
  }
  await executePostgresFixtures();
}

async function createLocalOwnedPostgresContainer({
  name,
  ownerToken,
  password,
  receiptPath,
  image = "postgres:17.6",
}) {
  const record = {
    kind: "securium.owned-postgres-container",
    version: 1,
    containerName: name,
    ownerToken,
    containerId: null,
    receiptPath,
  };
  await writeFile(receiptPath, `${JSON.stringify(record)}\n`, "utf8");
  if (await inspectLocalContainer(record.containerName)) {
    throw new Error("OWNED_POSTGRES_CONTAINER_NAME_IN_USE");
  }

  try {
    const { stdout } = await docker([
      "run",
      "--detach",
      "--rm",
      "--name",
      record.containerName,
      "--label",
      `${POSTGRES_OWNER_LABEL}=${record.ownerToken}`,
      "--env",
      `POSTGRES_PASSWORD=${password}`,
      "--publish",
      "127.0.0.1::5432",
      image,
    ]);
    const containerId = stdout.trim().split(/\r?\n/).at(-1)?.trim();
    if (!/^[0-9a-f]{12,64}$/i.test(containerId || "")) {
      throw new Error("OWNED_POSTGRES_CONTAINER_ID_INVALID");
    }
    record.containerId = containerId;
    await writeFile(receiptPath, `${JSON.stringify(record)}\n`, "utf8");
    const actual = await inspectLocalContainer(record.containerId);
    assertLocalOwnership(record, actual);
    if (!actual.running) {
      throw new Error("OWNED_POSTGRES_CONTAINER_NOT_RUNNING");
    }
    return record;
  } catch {
    if (record.containerId) await cleanupLocalOwnedPostgresContainer(record).catch(() => {});
    throw new Error("OWNED_POSTGRES_CONTAINER_CREATE_FAILED");
  }
}

async function cleanupLocalOwnedPostgresContainer(record) {
  if (!record?.containerId) return "NO_CREATED_CONTAINER";
  const actual = await inspectLocalContainer(record.containerId);
  if (!actual) return "ALREADY_REMOVED";
  assertLocalOwnership(record, actual);
  try {
    await docker(["rm", "--force", record.containerId]);
  } catch {
    throw new Error("OWNED_POSTGRES_CONTAINER_REMOVE_FAILED");
  }
  if (await inspectLocalContainer(record.containerId)) {
    throw new Error("OWNED_POSTGRES_CONTAINER_NOT_REMOVED");
  }
  return "REMOVED";
}

async function inspectLocalContainer(identifier) {
  try {
    const { stdout } = await docker(["inspect", identifier]);
    const [container] = JSON.parse(stdout);
    return {
      id: container?.Id,
      name: container?.Name,
      running: container?.State?.Running === true,
      ownerToken: container?.Config?.Labels?.[POSTGRES_OWNER_LABEL],
    };
  } catch (error) {
    if (isMissingDockerObject(error)) return null;
    throw new Error("OWNED_POSTGRES_CONTAINER_INSPECT_FAILED");
  }
}

function assertLocalOwnership(record, actual) {
  if (
    !actual ||
    actual.id?.toLowerCase() !== record.containerId?.toLowerCase() ||
    actual.name !== `/${record.containerName}` ||
    actual.ownerToken !== record.ownerToken
  ) {
    throw new Error("OWNED_POSTGRES_CONTAINER_OWNERSHIP_MISMATCH");
  }
}

async function docker(argumentsToDocker) {
  return execFile("docker", argumentsToDocker, {
    windowsHide: true,
    timeout: DOCKER_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
}

function isMissingDockerObject(error) {
  if (error?.code !== 1) return false;
  const output = `${error?.stdout || ""} ${error?.stderr || ""}`.toLowerCase();
  return output.includes("no such object") || output.includes("no such container") || output.includes("does not exist");
}

async function executeD1Fixtures() {
  for (const statement of FIXTURE_STATEMENTS) {
    await withTimeout(
      d1.prepare(statement).run(),
      QUERY_TIMEOUT_MS,
      "D1 fixture insert",
    );
  }
}

async function executePostgresFixtures() {
  for (const statement of FIXTURE_STATEMENTS) {
    await executePostgres(statement);
  }
}

async function executePostgres(sql, parameters = []) {
  return withTimeout(
    postgresClient.unsafe(sql, parameters),
    SETUP_TIMEOUT_MS,
    "PostgreSQL fixture setup",
  );
}

async function waitForPostgres() {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await withTimeout(
        postgresClient.unsafe("SELECT 1"),
        3_000,
        "PostgreSQL readiness",
      );
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(
    `Disposable PostgreSQL readiness timed out: ${lastError?.message ?? lastError}`,
  );
}

async function migrationNames(directory) {
  return (await readdir(directory))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

function adaptMigrationForD1(sql, migrationName) {
  const source = String(sql).trim();
  const prefix = /^PRAGMA\s+foreign_keys\s*=\s*OFF\s*;\s*BEGIN\s+TRANSACTION\s*;\s*/i;
  const suffix = /\s*COMMIT\s*;\s*PRAGMA\s+foreign_keys\s*=\s*ON\s*;\s*$/i;
  const hasOuterPrefix = prefix.test(source);
  const hasOuterSuffix = suffix.test(source);
  const startsWithUnsupportedTransaction = /^\s*(?:BEGIN(?:\s+TRANSACTION)?|START\s+TRANSACTION)\s*;/i.test(source);
  if (!hasOuterPrefix && !hasOuterSuffix && !startsWithUnsupportedTransaction) {
    return source;
  }
  if (!hasOuterPrefix || !hasOuterSuffix) {
    throw new Error(`UNSUPPORTED_D1_TRANSACTION_WRAPPER:${migrationName}`);
  }
  return source
    .replace(prefix, "PRAGMA foreign_keys=OFF;\n")
    .replace(suffix, "\nPRAGMA foreign_keys=ON;");
}

function insertMany(table, columns, rows) {
  return `INSERT INTO ${quoteIdentifier(table)} (${columns
    .map(quoteIdentifier)
    .join(", ")}) VALUES ${rows
    .map((row) => `(${row.map(sqlValue).join(", ")})`)
    .join(", ")}`;
}

function sqlValue(value) {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function quoteIdentifier(value) {
  return `"${value}"`;
}

const FIXTURE_STATEMENTS = buildFixtureStatements();

function buildFixtureStatements() {
  const groups = [
    ["group-public", "OUTLINE_PUBLIC", "Public Group", "PUBLIC_GROUP_METADATA", 1, 1, 0, null],
    ["group-inactive", "OUTLINE_INACTIVE", "Inactive Group", "", 1, 0, 0, null],
    ["group-deleted", "OUTLINE_DELETED", "Deleted Group", "", 1, 1, 0, "2026-09-01"],
  ];
  const courses = [
    ["course-public", "group-public", "PUBLIC-COURSE", "public-course", "Public Course", "Public", "Public course description", "private-thumbnail", 1, 1, 1, 0, null],
    ["course-empty", "group-public", "EMPTY-COURSE", "empty-course", "Empty Course", "Empty", "Empty outline", null, 1, 1, 2, 0, null],
    ["course-exact-subjects", "group-public", "EXACT-SUBJECTS", "exact-subjects-course", "Exact Subjects", "Subjects", "", null, 1, 1, 3, 0, null],
    ["course-overflow-subjects", "group-public", "OVERFLOW-SUBJECTS", "overflow-subjects-course", "Overflow Subjects", "Subjects", "", null, 1, 1, 4, 0, null],
    ["course-exact-topics", "group-public", "EXACT-TOPICS", "exact-topics-course", "Exact Topics", "Topics", "", null, 1, 1, 5, 0, null],
    ["course-overflow-topics", "group-public", "OVERFLOW-TOPICS", "overflow-topics-course", "Overflow Topics", "Topics", "", null, 1, 1, 6, 0, null],
    ["course-inactive-group", "group-inactive", "INACTIVE-GROUP", "inactive-group-course", "Inactive Group Course", "Inactive", "", null, 1, 1, 7, 0, null],
    ["course-deleted-group", "group-deleted", "DELETED-GROUP", "deleted-group-course", "Deleted Group Course", "Deleted", "", null, 1, 1, 8, 0, null],
    ["course-inactive", "group-public", "INACTIVE-COURSE", "inactive-course", "Inactive Course", "Inactive", "", null, 0, 1, 9, 0, null],
    ["course-unpublished", "group-public", "UNPUBLISHED-COURSE", "unpublished-course", "Unpublished Course", "Draft", "", null, 1, 0, 10, 0, null],
    ["course-deleted", "group-public", "DELETED-COURSE", "deleted-course", "Deleted Course", "Deleted", "", null, 1, 1, 11, 0, "2026-09-02"],
    ["course-other", "group-public", "OTHER-COURSE", "other-course", "Other Course", "Other", "", null, 1, 1, 12, 0, null],
  ];

  const subjects = [
    ["subject-z", "course-public", "SUBJECT-Z", "Subject Z", "Subject Z description", 1, 1, 0, null],
    ["subject-a", "course-public", "SUBJECT-A", "Subject A", "Subject A description", 1, 1, 0, null],
    ["subject-가", "course-public", "SUBJECT-GA", "Subject 가", "Unicode subject description", 1, 1, 0, null],
    ["subject-hidden", "course-public", "SUBJECT-HIDDEN", "Hidden Subject", "", 2, 0, 0, null],
    ["subject-deleted", "course-public", "SUBJECT-DELETED", "Deleted Subject", "", 3, 1, 0, "2026-09-03"],
    ["other-course-subject", "course-other", "OTHER-SUBJECT", "Other Subject", "", 1, 1, 0, null],
    ["exact-topic-subject-a", "course-exact-topics", "EXACT-A", "Exact Topic A", "", 1, 1, 0, null],
    ["exact-topic-subject-b", "course-exact-topics", "EXACT-B", "Exact Topic B", "", 2, 1, 0, null],
    ["overflow-topic-subject-a", "course-overflow-topics", "OVERFLOW-A", "Overflow Topic A", "", 1, 1, 0, null],
    ["overflow-topic-subject-b", "course-overflow-topics", "OVERFLOW-B", "Overflow Topic B", "", 2, 1, 0, null],
  ];
  for (let index = 0; index < MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS; index += 1) {
    subjects.push([
      `exact-subject-${String(index).padStart(2, "0")}`,
      "course-exact-subjects",
      `EXACT-${String(index).padStart(2, "0")}`,
      `Exact Subject ${index}`,
      "",
      index,
      1,
      0,
      null,
    ]);
    subjects.push([
      `overflow-subject-${String(index).padStart(2, "0")}`,
      "course-overflow-subjects",
      `OVERFLOW-${String(index).padStart(2, "0")}`,
      `Overflow Subject ${index}`,
      "",
      index,
      1,
      0,
      null,
    ]);
  }
  subjects.push([
    "overflow-subject-50",
    "course-overflow-subjects",
    "OVERFLOW-50",
    "Overflow Subject 50",
    "",
    50,
    1,
    0,
    null,
  ]);

  const topics = [
    ["topic-public-z", "subject-z", "TOPIC-PUBLIC-Z", "Public Z", "Public Z description", 1, 1, 0, null],
    ["topic-z", "subject-a", "TOPIC-Z", "Topic Z", "Topic Z description", 1, 1, 0, null],
    ["topic-a", "subject-a", "TOPIC-A", "Topic A", "Topic A description", 1, 1, 0, null],
    ["topic-가", "subject-a", "TOPIC-GA", "Topic 가", "Unicode topic description", 1, 1, 0, null],
    ["topic-hidden", "subject-a", "TOPIC-HIDDEN", "Hidden Topic", "", 2, 0, 0, null],
    ["topic-deleted", "subject-a", "TOPIC-DELETED", "Deleted Topic", "", 3, 1, 0, "2026-09-04"],
    ["other-course-topic", "other-course-subject", "OTHER-TOPIC", "Other Topic", "", 1, 1, 0, null],
  ];
  for (let index = 0; index < 100; index += 1) {
    topics.push([
      `exact-topic-a-${String(index).padStart(3, "0")}`,
      "exact-topic-subject-a",
      `EXACT-A-${String(index).padStart(3, "0")}`,
      `Exact Topic A ${index}`,
      "",
      index,
      1,
      0,
      null,
    ]);
    topics.push([
      `exact-topic-b-${String(index).padStart(3, "0")}`,
      "exact-topic-subject-b",
      `EXACT-B-${String(index).padStart(3, "0")}`,
      `Exact Topic B ${index}`,
      "",
      index,
      1,
      0,
      null,
    ]);
    topics.push([
      `overflow-topic-a-${String(index).padStart(3, "0")}`,
      "overflow-topic-subject-a",
      `OVERFLOW-A-${String(index).padStart(3, "0")}`,
      `Overflow Topic A ${index}`,
      "",
      index,
      1,
      0,
      null,
    ]);
  }
  topics.push([
    "overflow-topic-b-100",
    "overflow-topic-subject-b",
    "OVERFLOW-B-100",
    "Overflow Topic B 100",
    "",
    100,
    1,
    0,
    null,
  ]);
  for (let index = 0; index < 100; index += 1) {
    topics.push([
      `overflow-topic-b-${String(index).padStart(3, "0")}`,
      "overflow-topic-subject-b",
      `OVERFLOW-B-${String(index).padStart(3, "0")}`,
      `Overflow Topic B ${index}`,
      "",
      index,
      1,
      0,
      null,
    ]);
  }

  return [
    insertMany(
      "course_groups",
      ["id", "code", "name", "description", "display_order", "active", "is_sample", "deleted_at"],
      groups,
    ),
    insertMany(
      "courses",
      ["id", "course_group_id", "code", "slug", "name", "short_name", "description", "thumbnail_url", "active", "published", "display_order", "is_sample", "deleted_at"],
      courses,
    ),
    insertMany(
      "contents",
      ["id", "slug", "canonical_key", "title", "body", "status"],
      [["private-content", "private-content", "private-content-key", "Private lesson", "lesson-body: learner-identity", "DRAFT"]],
    ),
    insertMany(
      "course_lessons",
      ["id", "course_id", "content_id", "display_title", "sort_order", "status"],
      [["private-course-lesson", "course-public", "private-content", "Private lesson", 1, "DRAFT"]],
    ),
    insertMany(
      "subjects",
      ["id", "course_id", "code", "name", "description", "display_order", "active", "is_sample", "deleted_at"],
      subjects,
    ),
    insertMany(
      "topics",
      ["id", "subject_id", "code", "name", "description", "display_order", "active", "is_sample", "deleted_at"],
      topics,
    ),
  ];
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => {
        promise?.cancel?.();
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      },
      timeoutMs,
    );
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    clearTimeout(timer);
  });
}
