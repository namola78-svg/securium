import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import postgres from "postgres";
import {
  PostgresJsExecutor,
  type PostgresJsClient,
} from "../db/postgres/postgres-js-executor.ts";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import {
  ISMS_P_BATCH1_WRITE_CONFIRMATION,
  applyIsmsPBatch1Materialization,
  buildIsmsPBatch1MaterializationManifest,
  planIsmsPBatch1Materialization,
  rollbackIsmsPBatch1Materialization,
  verifyIsmsPBatch1Materialization,
} from "../lib/data/isms-p-theory-batch1-materializer.mjs";

const databaseUrl = requiredEnvironment("POSTGRES_PARITY_DATABASE_URL");
const nonProduction = requiredEnvironment("POSTGRES_PARITY_NON_PRODUCTION");
const appEnvironment = requiredEnvironment("APP_ENV");
const parsedUrl = new URL(databaseUrl);

assert.equal(nonProduction, "true", "NON_PRODUCTION must be explicitly true");
assert.equal(appEnvironment, "test", "PostgreSQL parity requires APP_ENV=test");
assert.equal(parsedUrl.hostname, "127.0.0.1", "Parity DB host must be loopback");
assert.equal(parsedUrl.pathname, "/securium_test", "Unexpected parity database");
assert.equal(decodeURIComponent(parsedUrl.username), "test", "Unexpected parity user");

const rawClient = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
  prepare: false,
  ssl: false,
  onnotice: () => {},
  debug: false,
  connection: { application_name: "securium-postgres-parity-ci" },
});
const executor = new PostgresJsExecutor(
  rawClient as unknown as PostgresJsClient,
  30_000,
);
const provider = new PostgresDatabaseProvider(executor);
const isolatedContext = {
  target: "disposable-postgres",
  environment: "test",
  production: false,
  confirmation: ISMS_P_BATCH1_WRITE_CONFIRMATION,
};
const d1Reference = {
  plan: { CREATE: 36, NOOP: 0, CONFLICT: 0 },
  firstApplyCreated: 36,
  reapply: { CREATE: 0, NOOP: 36, CONFLICT: 0 },
  conflict: "PASS_FAIL_CLOSED_ZERO_BATCH_WRITES",
  rollbackPreUser: "PASS_36_REMOVED",
  rollbackPostUser: "PASS_HARD_DELETE_REFUSED",
};

test("ephemeral PostgreSQL has full D1 runtime-link parity", async (context) => {
  let artifact: Record<string, unknown> = {
    schema_version: "1.0.0",
    status: "POSTGRES_PARITY_CI_FAILED",
    non_production: true,
    production_secret_referenced: false,
  };
  context.after(async () => {
    await writeArtifact(artifact);
    await executor.close();
  });

  const identity = await assertDisposableDatabaseIdentity();
  await applyTrackedPostgresMigrations();
  await prepareMinimalFixture();
  const fixtureBefore = await fixtureSnapshot();
  const manifest = buildIsmsPBatch1MaterializationManifest();
  const expectedOperationIds = manifest.flatMap((entry) => [
    `content:${entry.code}`,
    `courseLesson:${entry.code}`,
    `extension:${entry.code}`,
  ]);

  const freshPlan = await planIsmsPBatch1Materialization(provider);
  assert.deepEqual(freshPlan.counts, d1Reference.plan);
  assertEntityCounts(freshPlan.operations, { content: 12, courseLesson: 12, extension: 12 }, "CREATE");
  assert.equal(freshPlan.operationSlots, 36);
  assert.equal(freshPlan.holdOperationCount, 0);
  assert.equal(freshPlan.conflictGate, "PASS");
  assert.deepEqual(
    freshPlan.operations.map((operation) => operation.operationId).sort(),
    expectedOperationIds.sort(),
  );

  const firstApply = await applyIsmsPBatch1Materialization(provider, isolatedContext);
  assert.equal(firstApply.created, d1Reference.firstApplyCreated);
  assert.equal(firstApply.verification.verified, true);
  assert.deepEqual(firstApply.createdOperationIds.sort(), expectedOperationIds.sort());
  await assertExactReadBack(manifest);
  const appliedCounts = await batchRowCounts(manifest);
  assert.deepEqual(appliedCounts, { content: 12, courseLesson: 12, extension: 12 });

  const reapplied = await applyIsmsPBatch1Materialization(provider, isolatedContext);
  assert.equal(reapplied.created, 0);
  assert.deepEqual(reapplied.plan.counts, d1Reference.reapply);
  assert.deepEqual(await batchRowCounts(manifest), appliedCounts);
  assert.equal((await verifyIsmsPBatch1Materialization(provider)).verified, true);

  const rollback = await rollbackIsmsPBatch1Materialization(
    provider,
    isolatedContext,
    firstApply.createdOperationIds,
  );
  assert.deepEqual(rollback, { mode: "ROLLBACK", status: "ROLLED_BACK", deleted: 36 });
  assert.deepEqual(await batchRowCounts(manifest), { content: 0, courseLesson: 0, extension: 0 });
  assert.deepEqual(await fixtureSnapshot(), fixtureBefore);

  const first = manifest[0];
  await provider.execute({
    sql: "INSERT INTO contents (id, slug, canonical_key, title, summary, body, body_format, learning_objectives_json, core_concepts_json, practical_examples_json, diagrams_json, media_json, version, status) VALUES (?, ?, ?, ?, '', '{}', 'STRUCTURED_JSON', '[]', '[]', '[]', '[]', '[]', '3.0.0', 'PUBLISHED')",
    parameters: ["postgres-conflicting-content", first.content.slug, "fixture.postgres.conflict", "PostgreSQL conflict fixture"],
  });
  const conflictPlan = await planIsmsPBatch1Materialization(provider);
  assert.equal(conflictPlan.counts.CONFLICT, 1);
  assert.equal(conflictPlan.conflictGate, "FAIL");
  await assert.rejects(
    applyIsmsPBatch1Materialization(provider, isolatedContext),
    (error: { code?: string }) => error.code === "ISMS_P_BATCH1_CONFLICT",
  );
  assert.deepEqual(await batchRowCounts(manifest), { content: 0, courseLesson: 0, extension: 0 });
  assert.equal(
    (await provider.queryOne<{ title: string }>({ sql: "SELECT title FROM contents WHERE id = ?", parameters: ["postgres-conflicting-content"] }))?.title,
    "PostgreSQL conflict fixture",
  );
  await provider.execute({ sql: "DELETE FROM contents WHERE id = ?", parameters: ["postgres-conflicting-content"] });

  const postUserApply = await applyIsmsPBatch1Materialization(provider, isolatedContext);
  await provider.execute({
    sql: "INSERT INTO user_course_lesson_progress (id, user_id, course_id, course_lesson_id, status, progress_percent) VALUES (?, ?, ?, ?, 'IN_PROGRESS', 1)",
    parameters: ["postgres-parity-progress", "postgres-parity-user", "course-isms-p", first.courseLesson.id],
  });
  const postUserRollback = await rollbackIsmsPBatch1Materialization(
    provider,
    isolatedContext,
    postUserApply.createdOperationIds,
  );
  assert.equal(postUserRollback.status, "REFUSED_USER_ACTIVITY");
  assert.equal(postUserRollback.deleted, 0);
  assert.equal(postUserRollback.archivePlan?.length, 12);
  assert.equal((await verifyIsmsPBatch1Materialization(provider)).verified, true);
  assert.equal(
    Number((await provider.queryOne<{ count: number }>({ sql: "SELECT count(*) AS count FROM user_course_lesson_progress WHERE id = ?", parameters: ["postgres-parity-progress"] }))?.count ?? 0),
    1,
  );

  assert.deepEqual(
    {
      plan: freshPlan.counts,
      firstApplyCreated: firstApply.created,
      reapply: reapplied.plan.counts,
      conflict: "PASS_FAIL_CLOSED_ZERO_BATCH_WRITES",
      rollbackPreUser: "PASS_36_REMOVED",
      rollbackPostUser: "PASS_HARD_DELETE_REFUSED",
    },
    d1Reference,
  );

  artifact = {
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    status: "FULL_PARITY_PASS",
    non_production: true,
    production_secret_referenced: false,
    database: identity,
    postgres: {
      plan: freshPlan.counts,
      first_apply: { created: firstApply.created, rows: appliedCounts },
      reapply: reapplied.plan.counts,
      conflict: d1Reference.conflict,
      rollback_pre_user: d1Reference.rollbackPreUser,
      rollback_post_user: d1Reference.rollbackPostUser,
      hold_operation_count: freshPlan.holdOperationCount,
    },
    d1_reference: d1Reference,
    parity: "FULL_PARITY_PASS",
  };
});

async function assertDisposableDatabaseIdentity() {
  const rows = await rawClient<{
    database_name: string;
    database_user: string;
    server_address: string;
    server_version_num: string;
    transaction_read_only: string;
  }[]>`SELECT current_database() AS database_name,
             current_user AS database_user,
             inet_server_addr()::text AS server_address,
             current_setting('server_version_num') AS server_version_num,
             current_setting('transaction_read_only') AS transaction_read_only`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].database_name, "securium_test");
  assert.equal(rows[0].database_user, "test");
  assertPrivateServiceAddress(rows[0].server_address);
  assert.ok(Number(rows[0].server_version_num) >= 170000);
  assert.equal(rows[0].transaction_read_only, "off");
  return {
    host: parsedUrl.hostname,
    database: rows[0].database_name,
    user: rows[0].database_user,
    server_address: rows[0].server_address,
    server_version_num: Number(rows[0].server_version_num),
    environment: appEnvironment,
    non_production: true,
  };
}

function assertPrivateServiceAddress(address: string) {
  const privateAddress =
    address === "127.0.0.1" ||
    address === "::1" ||
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address);
  assert.equal(privateAddress, true, "PostgreSQL service address must be private");
}

async function applyTrackedPostgresMigrations() {
  await rawClient.unsafe(`DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  END $$;`);
  const directory = resolve("db/postgres/migrations");
  const discovered = (await readdir(directory))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  const lockdown = "0002_server_only_rls_lockdown.sql";
  const unrelatedDataCleanup =
    "0009_security_certification_taxonomy_cleanup.sql";
  assert.equal(discovered.includes(lockdown), true);
  assert.equal(discovered.includes(unrelatedDataCleanup), true);
  const migrations = [
    ...discovered.filter(
      (name) => name !== lockdown && name !== unrelatedDataCleanup,
    ),
    lockdown,
  ];
  assert.ok(migrations.length > 0);
  for (const migration of migrations) {
    await rawClient.unsafe(await readFile(resolve(directory, migration), "utf8"));
  }
  const applied = await rawClient<{ count: string }[]>`SELECT count(*)::text AS count FROM app_schema_migrations`;
  assert.equal(Number(applied[0]?.count ?? 0), migrations.length);
}

async function prepareMinimalFixture() {
  await rawClient.unsafe(
    "INSERT INTO course_groups (id, code, name, active) VALUES ($1, $2, $3, 1)",
    ["postgres-parity-group", "POSTGRES_PARITY", "PostgreSQL parity fixture"],
  );
  await rawClient.unsafe(
    "INSERT INTO courses (id, course_group_id, code, slug, name, short_name, active, published) VALUES ($1, $2, $3, $4, $5, $6, 1, 1)",
    ["course-isms-p", "postgres-parity-group", "ISMS_P_PARITY", "isms-p-parity", "ISMS-P parity", "ISMS-P"],
  );
  await rawClient.unsafe(
    "INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3)",
    ["postgres-parity-user", "postgres-parity@example.invalid", "PostgreSQL parity user"],
  );
}

async function fixtureSnapshot() {
  const rows = await rawClient<{ course_groups: string; courses: string; users: string }[]>`
    SELECT
      (SELECT count(*)::text FROM course_groups WHERE id = 'postgres-parity-group') AS course_groups,
      (SELECT count(*)::text FROM courses WHERE id = 'course-isms-p' AND active = 1 AND published = 1 AND deleted_at IS NULL) AS courses,
      (SELECT count(*)::text FROM users WHERE id = 'postgres-parity-user') AS users`;
  return {
    courseGroups: Number(rows[0].course_groups),
    courses: Number(rows[0].courses),
    users: Number(rows[0].users),
  };
}

async function assertExactReadBack(manifest: ReturnType<typeof buildIsmsPBatch1MaterializationManifest>) {
  for (const entry of manifest) {
    const content = await provider.queryOne<Record<string, unknown>>({ sql: "SELECT * FROM contents WHERE id = ?", parameters: [entry.content.id] });
    const courseLesson = await provider.queryOne<Record<string, unknown>>({ sql: "SELECT * FROM course_lessons WHERE id = ?", parameters: [entry.courseLesson.id] });
    const extension = await provider.queryOne<Record<string, unknown>>({ sql: "SELECT * FROM course_lesson_extensions WHERE id = ?", parameters: [entry.extension.id] });
    assert.ok(content && courseLesson && extension);
    assertRowMatches(content, entry.content);
    assertRowMatches(courseLesson, entry.courseLesson);
    assertRowMatches(extension, entry.extension);
    assert.equal(content.slug, entry.content.slug);
    assert.equal(Number(courseLesson.sort_order), entry.courseLesson.sort_order);
    assert.equal(courseLesson.lesson_id, null);
    assert.equal(courseLesson.curriculum_node_id, null);
    assert.equal(content.status, "PUBLISHED");
    assert.equal(courseLesson.status, "PUBLISHED");
    assert.equal(extension.status, "PUBLISHED");
    assert.equal(sha256(String(content.body)), entry.hashes.body);
    assert.equal(sha256(String(content.summary)), entry.hashes.summary);
    assert.equal(sha256(String(content.practical_examples_json)), entry.hashes.example);
    assert.equal(sha256(String(extension.exam_points_json)), entry.hashes.examPoint);
  }
}

function assertRowMatches(actual: Record<string, unknown>, expected: Record<string, unknown>) {
  for (const [key, value] of Object.entries(expected)) {
    if (key === "is_required") assert.equal(Number(actual[key]), Number(value), key);
    else assert.equal(actual[key] ?? null, value ?? null, key);
  }
}

async function batchRowCounts(manifest: ReturnType<typeof buildIsmsPBatch1MaterializationManifest>) {
  const contentIds = manifest.map((entry) => entry.content.id);
  const courseLessonIds = manifest.map((entry) => entry.courseLesson.id);
  const extensionIds = manifest.map((entry) => entry.extension.id);
  const rows = await rawClient<{ content: string; course_lesson: string; extension: string }[]>`
    SELECT
      (SELECT count(*)::text FROM contents WHERE id = ANY(${contentIds})) AS content,
      (SELECT count(*)::text FROM course_lessons WHERE id = ANY(${courseLessonIds})) AS course_lesson,
      (SELECT count(*)::text FROM course_lesson_extensions WHERE id = ANY(${extensionIds})) AS extension`;
  return {
    content: Number(rows[0].content),
    courseLesson: Number(rows[0].course_lesson),
    extension: Number(rows[0].extension),
  };
}

function assertEntityCounts(
  operations: Array<{ entity: string; classification: string }>,
  expected: Record<string, number>,
  classification: string,
) {
  for (const [entity, count] of Object.entries(expected)) {
    assert.equal(operations.filter((operation) => operation.entity === entity && operation.classification === classification).length, count);
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function writeArtifact(value: Record<string, unknown>) {
  const path = process.env.POSTGRES_PARITY_RESULT_PATH?.trim();
  if (!path) return;
  await writeFile(resolve(path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
