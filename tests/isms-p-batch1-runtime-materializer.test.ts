import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import type {
  DatabaseStatement,
  DatabaseValue,
} from "../db/provider/database-provider.ts";
import {
  ISMS_P_BATCH1_WRITE_CONFIRMATION,
  applyIsmsPBatch1Materialization,
  assertNonProductionWriteContext,
  buildIsmsPBatch1MaterializationManifest,
  planIsmsPBatch1Materialization,
  rollbackIsmsPBatch1Materialization,
  verifyIsmsPBatch1Materialization,
} from "../lib/data/isms-p-theory-batch1-materializer.mjs";
import {
  ISMS_P_BATCH1_PRODUCTION_TARGET_CONFIRMATION,
  createIsmsPBatch1ApprovalDigest,
  createIsmsPBatch1ProductionPreflight,
  validateIsmsPBatch1ProductionApproval,
} from "../lib/data/isms-p-theory-batch1-production-executor.mjs";

const isolatedContext = {
  target: "isolated-d1",
  environment: "test",
  confirmation: ISMS_P_BATCH1_WRITE_CONFIRMATION,
};

test("Batch 1 runtime manifest preserves the exact approved 12 and 36-slot model", () => {
  const manifest = buildIsmsPBatch1MaterializationManifest();
  assert.equal(manifest.length, 12);
  assert.equal(new Set(manifest.map((entry) => entry.code)).size, 12);
  assert.equal(new Set(manifest.map((entry) => entry.content.id)).size, 12);
  assert.equal(new Set(manifest.map((entry) => entry.courseLesson.id)).size, 12);
  assert.equal(new Set(manifest.map((entry) => entry.extension.id)).size, 12);
  assert.equal(manifest.every((entry) => entry.courseLesson.lesson_id === null), true);
  assert.equal(
    manifest.every((entry) => entry.courseLesson.curriculum_node_id === null),
    true,
  );
});

test("production-like APPLY and ROLLBACK contexts fail closed without a write probe", async () => {
  const { provider, dispose } = await createIsolatedD1();
  try {
    assert.throws(
      () =>
        assertNonProductionWriteContext(provider, {
          ...isolatedContext,
          environment: "production",
        }),
      (error: { code?: string }) =>
        error.code === "ISMS_P_BATCH1_PRODUCTION_WRITE_REFUSED",
    );
    assert.throws(
      () =>
        assertNonProductionWriteContext(provider, {
          target: "isolated-d1",
          environment: "test",
          confirmation: "wrong",
        }),
      (error: { code?: string }) =>
        error.code === "ISMS_P_BATCH1_PRODUCTION_WRITE_REFUSED",
    );
  } finally {
    await dispose();
  }
});

test("isolated D1 validates the approval-bound Production executor contract without weakening its guard", async () => {
  const { provider, dispose } = await createIsolatedD1();
  const releaseSha = "a".repeat(40);
  const targetFingerprint = "b".repeat(64);
  try {
    const preflight = await createIsmsPBatch1ProductionPreflight(provider, {
      mainSha: releaseSha,
      targetFingerprint,
      capturedAt: "2026-08-13T00:00:00.000Z",
    });
    assert.deepEqual(preflight.plan.counts, { CREATE: 36, NOOP: 0, CONFLICT: 0 });
    const approvalString =
      `APPROVE SECURIUM BATCH1 PRODUCTION MATERIALIZATION ${preflight.operationCount}`;
    const input = {
      approvalString,
      expectedMainSha: releaseSha,
      expectedPreflightSha: preflight.preflightSha,
      expectedOperationCount: 36,
      expectedConflictCount: 0,
      expectedHoldOperations: 0,
      expectedFreshDiffHash: preflight.freshDiffHash,
      approvalDigest: createIsmsPBatch1ApprovalDigest({
        approvalString,
        mainSha: releaseSha,
        preflightSha: preflight.preflightSha,
        operationCount: 36,
        freshDiffHash: preflight.freshDiffHash,
      }),
      confirmProductionTarget: ISMS_P_BATCH1_PRODUCTION_TARGET_CONFIRMATION,
    };
    assert.equal(
      validateIsmsPBatch1ProductionApproval(preflight, input, {
        releaseSha,
        targetFingerprint,
      }).valid,
      true,
    );
    for (const invalid of [
      { ...input, approvalString: "" },
      { ...input, approvalString: "APPROVE WRONG BATCH" },
      { ...input, expectedMainSha: "c".repeat(40) },
      { ...input, expectedPreflightSha: "d".repeat(64) },
      { ...input, expectedOperationCount: 35 },
      { ...input, expectedConflictCount: 1 },
      { ...input, expectedHoldOperations: 1 },
      { ...input, expectedFreshDiffHash: "e".repeat(64) },
      { ...input, approvalDigest: "f".repeat(64) },
    ]) {
      assert.throws(() =>
        validateIsmsPBatch1ProductionApproval(preflight, invalid, {
          releaseSha,
          targetFingerprint,
        }),
      );
    }

    const applied = await applyIsmsPBatch1Materialization(provider, isolatedContext);
    assert.equal(applied.created, 36);
    assert.equal(applied.verification.verified, true);
    const replayPreflight = await createIsmsPBatch1ProductionPreflight(provider, {
      mainSha: releaseSha,
      targetFingerprint,
    });
    assert.throws(
      () => validateIsmsPBatch1ProductionApproval(replayPreflight, input, { releaseSha, targetFingerprint }),
      (error: { code?: string }) =>
        error.code === "ISMS_P_BATCH1_PRODUCTION_APPROVAL_INVALIDATED" ||
        error.code === "ISMS_P_BATCH1_PRODUCTION_NOOP",
    );
  } finally {
    await dispose();
  }
});

test("isolated D1 PLAN/APPLY/VERIFY/reapply/rollback is exact and idempotent", async () => {
  const { provider, dispose } = await createIsolatedD1();
  try {
    const before = await publishedCount(provider);
    const plan = await planIsmsPBatch1Materialization(provider);
    assert.deepEqual(plan.counts, { CREATE: 36, NOOP: 0, CONFLICT: 0 });
    assert.equal(plan.operationSlots, 36);
    assert.equal(plan.holdOperationCount, 0);
    assert.equal(plan.course.valid, true);

    const applied = await applyIsmsPBatch1Materialization(
      provider,
      isolatedContext,
    );
    assert.equal(applied.created, 36);
    assert.equal(
      applied.verification.verified,
      true,
      JSON.stringify(applied.verification.plan),
    );
    assert.equal((await publishedCount(provider)) - before, 12);

    const reapplied = await applyIsmsPBatch1Materialization(
      provider,
      isolatedContext,
    );
    assert.equal(reapplied.created, 0);
    assert.deepEqual(reapplied.plan.counts, {
      CREATE: 0,
      NOOP: 36,
      CONFLICT: 0,
    });
    assert.equal((await publishedCount(provider)) - before, 12);

    const verified = await verifyIsmsPBatch1Materialization(provider);
    assert.equal(verified.verified, true);
    const rollback = await rollbackIsmsPBatch1Materialization(
      provider,
      isolatedContext,
      applied.createdOperationIds,
    );
    assert.deepEqual(rollback, {
      mode: "ROLLBACK",
      status: "ROLLED_BACK",
      deleted: 36,
    });
    assert.deepEqual(
      (await planIsmsPBatch1Materialization(provider)).counts,
      { CREATE: 36, NOOP: 0, CONFLICT: 0 },
    );
    assert.equal(await publishedCount(provider), before);
  } finally {
    await dispose();
  }
});

test("isolated D1 conflict detection is fail-closed and causes no partial Batch write", async () => {
  const { provider, dispose } = await createIsolatedD1();
  try {
    const first = buildIsmsPBatch1MaterializationManifest()[0];
    await provider.execute({
      sql: "INSERT INTO contents (id, slug, canonical_key, title, summary, body, body_format, learning_objectives_json, core_concepts_json, practical_examples_json, diagrams_json, media_json, version, status) VALUES (?, ?, ?, ?, '', '{}', 'STRUCTURED_JSON', '[]', '[]', '[]', '[]', '[]', '3.0.0', 'PUBLISHED')",
      parameters: [
        "fixture-conflicting-content",
        first.content.slug,
        "fixture.conflict",
        "Conflict fixture",
      ],
    });
    const plan = await planIsmsPBatch1Materialization(provider);
    assert.equal(plan.counts.CONFLICT, 1);
    await assert.rejects(
      applyIsmsPBatch1Materialization(provider, isolatedContext),
      (error: { code?: string }) => error.code === "ISMS_P_BATCH1_CONFLICT",
    );
    const row = await provider.queryOne<{ count: number }>({
      sql: "SELECT count(*) AS count FROM course_lessons",
    });
    assert.equal(Number(row?.count ?? -1), 0);
    const fixture = await provider.queryOne<{ title: string }>({
      sql: "SELECT title FROM contents WHERE id = ?",
      parameters: ["fixture-conflicting-content"],
    });
    assert.equal(fixture?.title, "Conflict fixture");
  } finally {
    await dispose();
  }
});

test("isolated rollback refuses hard deletion after user progress exists", async () => {
  const { provider, dispose } = await createIsolatedD1();
  try {
    const applied = await applyIsmsPBatch1Materialization(
      provider,
      isolatedContext,
    );
    const courseLessonId =
      buildIsmsPBatch1MaterializationManifest()[0].courseLesson.id;
    await provider.execute({
      sql: "INSERT INTO user_course_lesson_progress (id, course_lesson_id, status) VALUES (?, ?, 'IN_PROGRESS')",
      parameters: ["isolated-progress", courseLessonId],
    });
    const rollback = await rollbackIsmsPBatch1Materialization(
      provider,
      isolatedContext,
      applied.createdOperationIds,
    );
    assert.equal(rollback.status, "REFUSED_USER_ACTIVITY");
    assert.equal(rollback.deleted, 0);
    assert.ok(rollback.archivePlan);
    assert.equal(rollback.archivePlan.length, 12);
    assert.equal((await verifyIsmsPBatch1Materialization(provider)).verified, true);
  } finally {
    await dispose();
  }
});

test("Learn overview uses the generic published CourseLesson listing", () => {
  const source = readFileSync("db/shared-content-repositories.ts", "utf8");
  const summaryFunction = source.slice(
    source.indexOf("export async function getPublishedCourseLessonProgressSummary"),
    source.indexOf("export async function getPublishedCourseLessonForUser"),
  );
  assert.match(
    summaryFunction,
    /listPublishedCourseLessonsForUser\(userId, courseId\)/,
  );
  assert.match(summaryFunction, /lessons: lessonList\.lessons/);
  assert.doesNotMatch(summaryFunction, /lessons:\s*\[\]/);
});

async function createIsolatedD1() {
  const persistTo = await mkdtemp(join(tmpdir(), "securium-batch1-d1-"));
  const provider = new WranglerD1Provider(persistTo);
  await provider.initialize(ISOLATED_SCHEMA);
  return {
    provider,
    dispose: () => rm(persistTo, { recursive: true, force: true }),
  };
}

async function publishedCount(provider: WranglerD1Provider) {
  const row = await provider.queryOne<{ count: number }>({
    sql: "SELECT count(*) AS count FROM course_lessons cl JOIN contents c ON c.id = cl.content_id WHERE cl.course_id = 'course-isms-p' AND cl.status = 'PUBLISHED' AND cl.deleted_at IS NULL AND c.status = 'PUBLISHED' AND c.deleted_at IS NULL",
  });
  return Number(row?.count ?? 0);
}

class WranglerD1Provider {
  readonly kind = "d1" as const;
  readonly persistTo: string;
  private fileSequence = 0;

  constructor(persistTo: string) {
    this.persistTo = persistTo;
  }

  async initialize(sql: string) {
    await this.executeFile(sql);
  }

  async query<Row extends Record<string, unknown>>(statement: DatabaseStatement) {
    const result = await this.runSql(renderStatement(statement));
    const rows = (result.results ?? []) as Row[];
    return {
      rows,
      rowCount: rows.length,
      metadata: { provider: this.kind },
    };
  }

  async queryOne<Row extends Record<string, unknown>>(
    statement: DatabaseStatement,
  ) {
    return (await this.query<Row>(statement)).rows[0] ?? null;
  }

  async execute(statement: DatabaseStatement) {
    const result = await this.runSql(renderStatement(statement));
    return {
      affectedRows: Number(result.meta?.changes ?? 0),
      returnedRows: [],
      metadata: { provider: this.kind },
    };
  }

  async transaction(statements: readonly DatabaseStatement[]) {
    if (!statements.length) return [];
    const sql = `${statements
      .map((statement) => `${renderStatement(statement)};`)
      .join("\n")}\n`;
    await this.executeFile(sql);
    return statements.map(() => ({
      affectedRows: 1,
      returnedRows: [],
      metadata: { provider: this.kind },
    }));
  }

  async healthCheck() {
    return (await this.queryOne<{ ok: number }>({ sql: "SELECT 1 AS ok" }))?.ok === 1;
  }

  private async executeFile(sql: string) {
    this.fileSequence += 1;
    const path = join(this.persistTo, `batch-${this.fileSequence}.sql`);
    await writeFile(path, sql, "utf8");
    return this.run(["--file", path]);
  }

  private runSql(sql: string) {
    return this.run(["--command", sql]);
  }

  private async run(input: string[]) {
    const output = await capture(process.execPath, [
      "scripts/run-wrangler.mjs",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "wrangler.local.jsonc",
      "--persist-to",
      this.persistTo,
      ...input,
      "--json",
    ]);
    if (output.code !== 0) {
      throw new Error(
        `ISOLATED_D1_COMMAND_FAILED:${`${output.stderr}\n${output.stdout}`.slice(-2400)}`,
      );
    }
    const parsed = JSON.parse(output.stdout);
    const first = parsed[0];
    if (!first?.success) throw new Error("ISOLATED_D1_RESULT_FAILED");
    return first;
  }
}

function renderStatement(statement: DatabaseStatement) {
  let index = 0;
  const sql = statement.sql.replace(/\?/g, () => {
    const value = statement.parameters?.[index];
    index += 1;
    return sqlLiteral(value ?? null);
  });
  assert.equal(index, statement.parameters?.length ?? 0);
  return sql;
}

function sqlLiteral(value: DatabaseValue) {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Uint8Array) {
    return `X'${Buffer.from(value).toString("hex")}'`;
  }
  return `CAST(X'${Buffer.from(value, "utf8").toString("hex")}' AS TEXT)`;
}

function capture(executable: string, args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (resolvePromise) => {
      const child = spawn(executable, args, {
        cwd: resolve("."),
        env: {
          ...process.env,
          APP_BUILD_TARGET: "cloudflare",
          DB_PROVIDER: "d1",
          CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("close", (code) =>
        resolvePromise({ code: code ?? 1, stdout, stderr }),
      );
      child.on("error", (error) =>
        resolvePromise({ code: 1, stdout, stderr: String(error) }),
      );
    },
  );
}

const ISOLATED_SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE courses (
  id text PRIMARY KEY NOT NULL,
  active integer NOT NULL,
  published integer NOT NULL,
  deleted_at text
);
INSERT INTO courses (id, active, published, deleted_at)
VALUES ('course-isms-p', 1, 1, NULL);
CREATE TABLE contents (
  id text PRIMARY KEY NOT NULL,
  slug text NOT NULL UNIQUE,
  canonical_key text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  body text NOT NULL,
  body_format text NOT NULL DEFAULT 'MARKDOWN',
  learning_objectives_json text NOT NULL DEFAULT '[]',
  core_concepts_json text NOT NULL DEFAULT '[]',
  practical_examples_json text NOT NULL DEFAULT '[]',
  diagrams_json text NOT NULL DEFAULT '[]',
  media_json text NOT NULL DEFAULT '[]',
  version text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL DEFAULT 'DRAFT',
  created_by text,
  deleted_at text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE course_lessons (
  id text PRIMARY KEY NOT NULL,
  course_id text NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  curriculum_node_id text,
  content_id text NOT NULL REFERENCES contents(id) ON DELETE RESTRICT,
  lesson_id text,
  display_title text NOT NULL,
  sort_order integer NOT NULL,
  difficulty text,
  importance integer,
  estimated_minutes integer NOT NULL,
  is_required integer NOT NULL,
  unlock_condition text,
  completion_rule text NOT NULL,
  status text NOT NULL,
  deleted_at text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX course_lessons_course_null_node_content_unique
  ON course_lessons(course_id, content_id) WHERE curriculum_node_id IS NULL;
CREATE UNIQUE INDEX course_lessons_course_null_node_order_unique
  ON course_lessons(course_id, sort_order) WHERE curriculum_node_id IS NULL;
CREATE TABLE course_lesson_extensions (
  id text PRIMARY KEY NOT NULL,
  course_lesson_id text NOT NULL UNIQUE REFERENCES course_lessons(id) ON DELETE RESTRICT,
  learning_objectives_override_json text,
  additional_body text,
  exam_points_json text NOT NULL DEFAULT '[]',
  practical_notes text NOT NULL DEFAULT '',
  legal_notes text NOT NULL DEFAULT '',
  standard_notes text NOT NULL DEFAULT '',
  evidence_notes text NOT NULL DEFAULT '',
  common_mistakes text NOT NULL DEFAULT '',
  instructor_notes text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL DEFAULT 'DRAFT',
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE user_course_lesson_progress (
  id text PRIMARY KEY NOT NULL,
  course_lesson_id text NOT NULL REFERENCES course_lessons(id) ON DELETE RESTRICT,
  status text NOT NULL
);
`;
