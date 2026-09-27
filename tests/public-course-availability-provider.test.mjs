import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { Miniflare } from "miniflare";
import postgres from "postgres";
import {
  createOwnedPostgresContainer,
  getPublishedPostgresPort,
  cleanupOwnedPostgresContainer,
} from "../scripts/owned-postgres-container.mjs";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { RepositoryContext } from "../db/repository-adapter/repository-context.ts";
import {
  createPublicCourseAvailabilityRepository,
  listPublicCourseAvailability,
} from "../db/public-course-availability-repository.ts";

const runId = randomUUID();
const d1CourseIds = [
  "course-published-question",
  "course-draft-question",
  "course-published-lesson",
  "course-invalid-lesson",
  "course-outline-only",
  "course-sample-content",
  "course-other-content",
  "course-cross-course",
];
const nonPublicCourseIds = [
  "course-unpublished",
  "course-inactive",
  "course-deleted",
  "course-inactive-group",
];
const allPublicCourseIds = [...d1CourseIds];
const expectedAvailability = {
  "course-published-question": [true, false],
  "course-draft-question": [false, false],
  "course-published-lesson": [false, true],
  "course-invalid-lesson": [false, false],
  "course-outline-only": [false, false],
  "course-sample-content": [true, true],
  "course-other-content": [false, true],
  "course-cross-course": [false, false],
};

let d1;
let miniflare;
let d1PersistPath;
let postgresClient;
let postgresRecord;
let postgresQueryCount = 0;
let postgresReceiptDirectory;

before(async () => {
  await setupD1();
  await setupPostgres();
});

after(async () => {
  await postgresClient?.end({ timeout: 5 }).catch((error) => {
    console.error(`POSTGRES_FIXTURE_CLIENT_CLEANUP_FAIL ${error?.message ?? error}`);
  });
  if (postgresRecord) {
    try {
      const result = await cleanupOwnedPostgresContainer(postgresRecord);
      console.log(`POSTGRES_FIXTURE_CLEANUP ${result}`);
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
  if (postgresReceiptDirectory) {
    await rm(postgresReceiptDirectory, { recursive: true, force: true }).catch((error) => {
      console.error(`POSTGRES_RECEIPT_CLEANUP_FAIL ${error?.message ?? error}`);
    });
  }
});

test("D1 executes the separate availability repository against a disposable fixture", async () => {
  let queryCount = 0;
  const countedD1 = {
    prepare(sql) {
      queryCount += 1;
      return d1.prepare(sql);
    },
  };
  const provider = new D1DatabaseProvider(countedD1);
  const repository = createPublicCourseAvailabilityRepository(
    new RepositoryContext(provider),
  );

  const rows = await repository.listByCourseIds([
    "course-published-question",
    "course-published-question",
    ...d1CourseIds.slice(1),
    ...nonPublicCourseIds,
  ]);

  assert.deepEqual(normalizeRows(rows), expectedRows());
  assert.equal(queryCount, 1, "all fixture IDs must be answered by one set query");
  assert.deepEqual(
    await queryD1("SELECT COUNT(*) AS count FROM question_courses WHERE course_id = 'course-published-question'"),
    [{ count: 2 }],
  );
  assert.deepEqual(
    await queryD1("SELECT id FROM courses WHERE slug = 'published-question' AND active = 1 AND published = 1 AND deleted_at IS NULL"),
    [{ id: "course-published-question" }],
  );
});

test("PostgreSQL executes the same fixture and preserves provider parameter binding", async () => {
  postgresQueryCount = 0;
  const provider = new PostgresDatabaseProvider({
    async query(sql, parameters) {
      postgresQueryCount += 1;
      const rows = await postgresClient.unsafe(sql, parameters);
      return { rows, rowCount: rows.length };
    },
    async transaction(callback) {
      return postgresClient.begin(async (transactionClient) =>
        callback({
          query: async (sql, parameters) => {
            const rows = await transactionClient.unsafe(sql, parameters);
            return { rows, rowCount: rows.length };
          },
        }),
      );
    },
  });
  const repository = createPublicCourseAvailabilityRepository(
    new RepositoryContext(provider),
  );

  const rows = await repository.listByCourseIds([
    ...allPublicCourseIds,
    "course-sample-content",
    ...nonPublicCourseIds,
  ]);

  assert.deepEqual(normalizeRows(rows), expectedRows());
  assert.equal(postgresQueryCount, 1, "all fixture IDs must be answered by one set query");
  assert.deepEqual(
    Array.from(await postgresClient.unsafe("SELECT COUNT(*)::int AS count FROM question_courses WHERE course_id = 'course-published-question'")),
    [{ count: 2 }],
  );
  assert.deepEqual(
    Array.from(await postgresClient.unsafe("SELECT id FROM courses WHERE slug = 'published-question' AND active = 1 AND published = 1 AND deleted_at IS NULL")),
    [{ id: "course-published-question" }],
  );
});

test("empty and invalid availability inputs do not execute a query", async () => {
  const statements = [];
  const provider = {
    kind: "d1",
    async query(statement) {
      statements.push(statement);
      return { rows: [], rowCount: 0, metadata: { provider: "d1" } };
    },
    async queryOne() { return null; },
    async execute() { return { affectedRows: 0, returnedRows: [], metadata: { provider: "d1" } }; },
    async transaction() { return []; },
    async healthCheck() { return true; },
  };
  const context = new RepositoryContext(provider);

  assert.deepEqual(await listPublicCourseAvailability(context, []), []);
  assert.equal(statements.length, 0);
  await assert.rejects(listPublicCourseAvailability(context, ["", "course-1"]), /non-empty course IDs/);
});

async function setupD1() {
  d1PersistPath = await mkdtemp(join(tmpdir(), `securium-public-course-availability-d1-${runId}-`));
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: `public-course-availability-${runId}` },
    d1Persist: d1PersistPath,
  });
  d1 = await miniflare.getD1Database("DB");
  for (const statement of D1_SCHEMA) await d1.prepare(statement).run();
  for (const statement of FIXTURE_SQL) await d1.prepare(statement).run();
  console.log(`D1_FIXTURE_CREATED persistence=${d1PersistPath}`);
}

async function setupPostgres() {
  postgresReceiptDirectory = await mkdtemp(join(tmpdir(), `securium-public-course-availability-pg-${runId}-`));
  const receiptPath = join(postgresReceiptDirectory, "container-receipt.json");
  postgresRecord = await createOwnedPostgresContainer({
    name: `securium-public-course-availability-${runId}`,
    ownerToken: `public-course-availability-${runId}`,
    password: `public-course-availability-test-${runId}`,
    receiptPath,
  });
  const port = await getPublishedPostgresPort(postgresRecord);
  console.log(`POSTGRES_FIXTURE_CREATED id=${postgresRecord.containerId} owner=${postgresRecord.ownerToken} endpoint=127.0.0.1:${port}`);
  postgresClient = postgres(`postgres://postgres:public-course-availability-test-${runId}@127.0.0.1:${port}/postgres`, {
    max: 1,
    prepare: false,
    ssl: false,
    connect_timeout: 5,
    onnotice: false,
  });
  await waitForPostgres();
  await postgresClient.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;");
  const manifest = JSON.parse(await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.json", "utf8"));
  await postgresClient.unsafe(`SET securium.baseline_artifact_sha256 = '${manifest.artifactDigest}'; SET securium.baseline_schema_sha256 = '${manifest.schemaDigest}'; SET securium.baseline_security_sha256 = '${manifest.securityDigest}';`);
  await postgresClient.unsafe(await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.sql", "utf8"));
  for (const statement of FIXTURE_SQL) await postgresClient.unsafe(statement);
}

async function waitForPostgres() {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await withTimeout(postgresClient.unsafe("SELECT 1"), 3_000, "postgres readiness");
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Disposable PostgreSQL readiness timed out: ${lastError?.message ?? lastError}`);
}

async function queryD1(sql) {
  return (await d1.prepare(sql).all()).results;
}

function normalizeRows(rows) {
  return Object.fromEntries(
    rows.map((row) => [row.courseId, [row.hasPublishedQuestion, row.hasPublishedLessonContent]]),
  );
}

function expectedRows() {
  return Object.fromEntries(allPublicCourseIds.map((id) => [id, expectedAvailability[id]]));
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const D1_SCHEMA = [
  `CREATE TABLE course_groups (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, deleted_at TEXT, is_sample INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE courses (id TEXT PRIMARY KEY, course_group_id TEXT NOT NULL, code TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, short_name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', total_levels INTEGER NOT NULL DEFAULT 1, passing_score INTEGER NOT NULL DEFAULT 60, difficulty TEXT NOT NULL DEFAULT 'BEGINNER', active INTEGER NOT NULL DEFAULT 1, published INTEGER NOT NULL DEFAULT 0, display_order INTEGER NOT NULL DEFAULT 0, is_sample INTEGER NOT NULL DEFAULT 0, deleted_at TEXT)`,
  `CREATE TABLE subjects (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', display_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, is_sample INTEGER NOT NULL DEFAULT 0, deleted_at TEXT)`,
  `CREATE TABLE topics (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, parent_topic_id TEXT, code TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', display_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, is_sample INTEGER NOT NULL DEFAULT 0, deleted_at TEXT)`,
  `CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, display_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE')`,
  `CREATE TABLE questions (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, type TEXT NOT NULL, difficulty TEXT NOT NULL DEFAULT 'MEDIUM', explanation TEXT NOT NULL DEFAULT '', wrong_answer_explanation TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'DRAFT', version INTEGER NOT NULL DEFAULT 1, answer_config_json TEXT NOT NULL DEFAULT '{}', is_sample INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL)`,
  `CREATE TABLE question_courses (question_id TEXT NOT NULL, course_id TEXT NOT NULL, weight INTEGER NOT NULL DEFAULT 100, UNIQUE(question_id, course_id))`,
  `CREATE TABLE contents (id TEXT PRIMARY KEY, slug TEXT NOT NULL, canonical_key TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', body TEXT NOT NULL, body_format TEXT NOT NULL DEFAULT 'MARKDOWN', learning_objectives_json TEXT NOT NULL DEFAULT '[]', core_concepts_json TEXT NOT NULL DEFAULT '[]', practical_examples_json TEXT NOT NULL DEFAULT '[]', diagrams_json TEXT NOT NULL DEFAULT '[]', media_json TEXT NOT NULL DEFAULT '[]', version TEXT NOT NULL DEFAULT '1.0.0', status TEXT NOT NULL DEFAULT 'DRAFT', deleted_at TEXT)`,
  `CREATE TABLE course_lessons (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, content_id TEXT NOT NULL, display_title TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, estimated_minutes INTEGER NOT NULL DEFAULT 10, is_required INTEGER NOT NULL DEFAULT 1, completion_rule TEXT NOT NULL DEFAULT 'MANUAL', status TEXT NOT NULL DEFAULT 'DRAFT', deleted_at TEXT)`,
];

const FIXTURE_SQL = [
  `INSERT INTO course_groups (id, code, name, active, deleted_at, is_sample) VALUES ('group-public', 'PUBLIC', 'Public fixture group', 1, NULL, 0)`,
  `INSERT INTO course_groups (id, code, name, active, deleted_at, is_sample) VALUES ('group-inactive', 'INACTIVE', 'Inactive fixture group', 0, NULL, 0)`,
  `INSERT INTO users (id, email, display_name, status) VALUES ('fixture-author', 'fixture-author@example.invalid', 'Fixture Author', 'ACTIVE')`,
  ...courseRows(),
  `INSERT INTO subjects (id, course_id, code, name, description, display_order, active, is_sample, deleted_at) VALUES ('subject-outline', 'course-outline-only', 'OUTLINE', 'Outline subject', '', 1, 1, 0, NULL)`,
  `INSERT INTO topics (id, subject_id, parent_topic_id, code, name, description, display_order, active, is_sample, deleted_at) VALUES ('topic-outline', 'subject-outline', NULL, 'OUTLINE-1', 'Outline topic', '', 1, 1, 0, NULL)`,
  ...questionRows(),
  `INSERT INTO question_courses (question_id, course_id, weight) VALUES ('question-published', 'course-published-question', 100)`,
  `INSERT INTO question_courses (question_id, course_id, weight) VALUES ('question-draft', 'course-published-question', 100)`,
  `INSERT INTO question_courses (question_id, course_id, weight) VALUES ('question-draft-only', 'course-draft-question', 100)`,
  `INSERT INTO question_courses (question_id, course_id, weight) VALUES ('question-sample', 'course-sample-content', 100)`,
  `INSERT INTO question_courses (question_id, course_id, weight) VALUES ('question-nonpublic', 'course-unpublished', 100)`,
  `INSERT INTO question_courses (question_id, course_id, weight) VALUES ('question-inactive', 'course-inactive', 100)`,
  `INSERT INTO question_courses (question_id, course_id, weight) VALUES ('question-deleted-course', 'course-deleted', 100)`,
  `INSERT INTO question_courses (question_id, course_id, weight) VALUES ('question-inactive-group', 'course-inactive-group', 100)`,
  ...contentRows(),
  `INSERT INTO course_lessons (id, course_id, content_id, display_title, sort_order, status, deleted_at) VALUES ('lesson-published-1', 'course-published-lesson', 'content-published', 'Published lesson 1', 1, 'PUBLISHED', NULL)`,
  `INSERT INTO course_lessons (id, course_id, content_id, display_title, sort_order, status, deleted_at) VALUES ('lesson-published-2', 'course-published-lesson', 'content-published', 'Published lesson duplicate link', 2, 'PUBLISHED', NULL)`,
  `INSERT INTO course_lessons (id, course_id, content_id, display_title, sort_order, status, deleted_at) VALUES ('lesson-draft', 'course-invalid-lesson', 'content-published-invalid-bridge', 'Draft bridge', 1, 'DRAFT', NULL)`,
  `INSERT INTO course_lessons (id, course_id, content_id, display_title, sort_order, status, deleted_at) VALUES ('lesson-draft-content', 'course-invalid-lesson', 'content-draft', 'Draft content', 2, 'PUBLISHED', NULL)`,
  `INSERT INTO course_lessons (id, course_id, content_id, display_title, sort_order, status, deleted_at) VALUES ('lesson-deleted-content', 'course-invalid-lesson', 'content-deleted', 'Deleted content', 3, 'PUBLISHED', NULL)`,
  `INSERT INTO course_lessons (id, course_id, content_id, display_title, sort_order, status, deleted_at) VALUES ('lesson-deleted-link', 'course-invalid-lesson', 'content-valid-unlinked', 'Deleted link', 4, 'PUBLISHED', '2026-09-12')`,
  `INSERT INTO course_lessons (id, course_id, content_id, display_title, sort_order, status, deleted_at) VALUES ('lesson-sample', 'course-sample-content', 'content-sample', 'Published sample content', 1, 'PUBLISHED', NULL)`,
  `INSERT INTO course_lessons (id, course_id, content_id, display_title, sort_order, status, deleted_at) VALUES ('lesson-other', 'course-other-content', 'content-other', 'Other course content', 1, 'PUBLISHED', NULL)`,
];

function courseRows() {
  return [
    ...allPublicCourseIds.map((id, index) => `INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description, total_levels, passing_score, difficulty, active, published, display_order, is_sample, deleted_at) VALUES ('${id}', 'group-public', '${id.toUpperCase()}', '${id.replace("course-", "")}', '${id}', '${id}', '', 1, 60, 'BEGINNER', 1, 1, ${index + 1}, 0, NULL)`),
    `INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description, total_levels, passing_score, difficulty, active, published, display_order, is_sample, deleted_at) VALUES ('course-unpublished', 'group-public', 'UNPUBLISHED', 'unpublished', 'course-unpublished', 'course-unpublished', '', 1, 60, 'BEGINNER', 1, 0, 50, 0, NULL)`,
    `INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description, total_levels, passing_score, difficulty, active, published, display_order, is_sample, deleted_at) VALUES ('course-inactive', 'group-public', 'INACTIVE', 'inactive', 'course-inactive', 'course-inactive', '', 1, 60, 'BEGINNER', 0, 1, 51, 0, NULL)`,
    `INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description, total_levels, passing_score, difficulty, active, published, display_order, is_sample, deleted_at) VALUES ('course-deleted', 'group-public', 'DELETED', 'deleted', 'course-deleted', 'course-deleted', '', 1, 60, 'BEGINNER', 1, 1, 52, 0, '2026-09-12')`,
    `INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description, total_levels, passing_score, difficulty, active, published, display_order, is_sample, deleted_at) VALUES ('course-inactive-group', 'group-inactive', 'INACTIVE_GROUP', 'inactive-group', 'course-inactive-group', 'course-inactive-group', '', 1, 60, 'BEGINNER', 1, 1, 53, 0, NULL)`,
  ];
}

function questionRows() {
  return [
    questionRow("question-published", "PUBLISHED", 0),
    questionRow("question-draft", "DRAFT", 0),
    questionRow("question-draft-only", "DRAFT", 0),
    questionRow("question-sample", "PUBLISHED", 1),
    questionRow("question-nonpublic", "PUBLISHED", 0),
    questionRow("question-inactive", "PUBLISHED", 0),
    questionRow("question-deleted-course", "PUBLISHED", 0),
    questionRow("question-inactive-group", "PUBLISHED", 0),
  ];
}

function questionRow(id, status, isSample) {
  return `INSERT INTO questions (id, title, content, type, difficulty, explanation, wrong_answer_explanation, status, version, answer_config_json, is_sample, created_by) VALUES ('${id}', '${id}', 'synthetic question body', 'SINGLE_CHOICE', 'MEDIUM', '', '', '${status}', 1, '{}', ${isSample}, 'fixture-author')`;
}

function contentRows() {
  return [
    contentRow("content-published", "PUBLISHED", null, "fixture.published"),
    contentRow("content-published-invalid-bridge", "PUBLISHED", null, "fixture.invalid.bridge"),
    contentRow("content-draft", "DRAFT", null, "fixture.draft"),
    contentRow("content-deleted", "PUBLISHED", "2026-09-12", "fixture.deleted"),
    contentRow("content-valid-unlinked", "PUBLISHED", null, "fixture.valid.unlinked"),
    contentRow("content-sample", "PUBLISHED", null, "sample.shared.fixture-content"),
    contentRow("content-other", "PUBLISHED", null, "fixture.other-course"),
  ];
}

function contentRow(id, status, deletedAt, canonicalKey) {
  const deleted = deletedAt ? `'${deletedAt}'` : "NULL";
  return `INSERT INTO contents (id, slug, canonical_key, title, summary, body, body_format, learning_objectives_json, core_concepts_json, practical_examples_json, diagrams_json, media_json, version, status, deleted_at) VALUES ('${id}', '${id}', '${canonicalKey}', '${id}', '', 'synthetic content body', 'PLAIN_TEXT', '[]', '[]', '[]', '[]', '[]', '1.0.0', '${status}', ${deleted})`;
}
