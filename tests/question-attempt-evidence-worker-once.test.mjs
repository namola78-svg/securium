import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, test } from "node:test";
import { Miniflare } from "miniflare";
import { computeConceptMappingSetHash } from "../lib/services/learning-event-contracts.ts";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { EvidenceProjectionRepository, createRecomputeRequest } from "../db/evidence-projection-repository.ts";
import {
  createD1FixtureMetadata,
  D1_FIXTURE_MARKER,
  presentResult,
  resultExitCode,
} from "../scripts/run-question-attempt-evidence-once.mjs";

const execFile = promisify(execFileCallback);
const runnerScript = "scripts/run-question-attempt-evidence-once.mjs";
const tempFixtures = new Set();

test("once result mapping preserves the existing exact-replay outcome", () => {
  assert.deepEqual(
    presentResult({
      outcome: "COMPLETED",
      requestId: "replay-request",
      projectionOutcome: "EXACT_REPLAY",
      projectionCount: 0,
    }),
    {
      status: "REPLAY",
      requestId: "replay-request",
      projectionOutcome: "EXACT_REPLAY",
      projectionCount: 0,
      errorClass: null,
    },
  );
  assert.equal(resultExitCode({ outcome: "COMPLETED" }), 0);
});

after(async () => {
  await Promise.all([...tempFixtures].map((path) => rm(path, { recursive: true, force: true })));
});

test("D1 subprocess processes at most one eligible request and leaves replay/no-work without duplicate writes", async () => {
  const fixture = await createD1Fixture();
  try {
    await insertAttempt(fixture, "once-attempt-a");
    await insertAttempt(fixture, "once-attempt-b");
    const unsupported = await fixture.repository.enqueue(await createRecomputeRequest({
      requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
      scopeType: "USER",
      userId: "user-1",
      projectionVersion: "EVIDENCE_V1",
      reasonCode: "UNSUPPORTED_SCOPE_BEFORE_EVENT",
    }));
    assert.equal(unsupported, "NEW_SUCCESS");
    const first = await enqueueEvent(fixture, "once-attempt-a");
    const second = await enqueueEvent(fixture, "once-attempt-b");
    await fixture.miniflare.dispose();

    const one = await runOnce(fixture);
    assert.equal(one.exitCode, 0);
    assert.equal(one.result.status, "COMPLETED");
    assert.equal(one.result.projectionCount, 2);

    const afterOne = await reopen(fixture);
    const firstStatus = await status(afterOne.database, first.id);
    const secondStatus = await status(afterOne.database, second.id);
    assert.equal([firstStatus, secondStatus].filter((value) => value === "COMPLETED").length, 1);
    assert.equal([firstStatus, secondStatus].filter((value) => value === "PENDING").length, 1);
    assert.equal(await scalar(afterOne.database, "SELECT count(*) FROM evidence_projections WHERE lifecycle = 'ACTIVE'"), "2");
    assert.equal(await scalar(afterOne.database, "SELECT count(*) FROM evidence_recompute_requests WHERE scope_type = 'USER' AND status = 'PENDING'"), "1");
    await afterOne.miniflare.dispose();

    const two = await runOnce(fixture);
    assert.equal(two.exitCode, 0);
    assert.equal(two.result.status, "COMPLETED");
    assert.equal(two.result.projectionCount, 2);

    const afterTwo = await reopen(fixture);
    assert.equal(await scalar(afterTwo.database, "SELECT count(*) FROM evidence_projections WHERE lifecycle = 'ACTIVE'"), "4");
    assert.equal(await scalar(afterTwo.database, "SELECT count(*) FROM evidence_recompute_requests WHERE request_type = 'MASTERY_RECOMPUTE_REQUIRED'"), "4");
    await afterTwo.miniflare.dispose();

    const three = await runOnce(fixture);
    assert.equal(three.exitCode, 0);
    assert.deepEqual(three.result, {
      status: "NO_REQUEST",
      requestId: null,
      projectionOutcome: null,
      projectionCount: 0,
      errorClass: null,
    });
    const afterThree = await reopen(fixture);
    assert.equal(await scalar(afterThree.database, "SELECT count(*) FROM evidence_projections WHERE lifecycle = 'ACTIVE'"), "4");
    await afterThree.miniflare.dispose();
  } finally {
    if (fixture.miniflare) await fixture.miniflare.dispose().catch(() => {});
  }
});

test("D1 subprocess exposes strict source failure and non-zero exit without projection mutation", async () => {
  const fixture = await createD1Fixture();
  try {
    await insertAttempt(fixture, "once-attempt-wrong-revision");
    await enqueueEvent(fixture, "once-attempt-wrong-revision", "explicit-wrong-revision");
    await fixture.miniflare.dispose();

    const result = await runOnce(fixture);
    assert.equal(result.exitCode, 1);
    assert.equal(result.result.status, "FAILED");
    assert.equal(result.result.errorClass, "SOURCE_INVALID");

    const reopened = await reopen(fixture);
    assert.equal(await scalar(reopened.database, "SELECT status FROM evidence_recompute_requests"), "FAILED");
    assert.equal(await scalar(reopened.database, "SELECT count(*) FROM evidence_projections"), "0");
    assert.equal(await scalar(reopened.database, "SELECT count(*) FROM evidence_recompute_requests WHERE request_type = 'MASTERY_RECOMPUTE_REQUIRED'"), "0");
    await reopened.miniflare.dispose();
  } finally {
    if (fixture.miniflare) await fixture.miniflare.dispose().catch(() => {});
  }
});

test("D1 subprocess reports retryable transaction failure after batch rollback", async () => {
  const fixture = await createD1Fixture({ failHandoff: true });
  try {
    await insertAttempt(fixture, "once-attempt-rollback");
    await enqueueEvent(fixture, "once-attempt-rollback");
    await fixture.miniflare.dispose();

    const result = await runOnce(fixture);
    assert.equal(result.exitCode, 75);
    assert.deepEqual(result.result.status, "RETRYABLE_FAILURE");
    assert.equal(result.result.errorClass, "TRANSIENT_DB");

    const reopened = await reopen(fixture);
    assert.equal(await scalar(reopened.database, "SELECT status FROM evidence_recompute_requests"), "RETRYABLE");
    assert.equal(await scalar(reopened.database, "SELECT count(*) FROM evidence_projections"), "0");
    assert.equal(await scalar(reopened.database, "SELECT count(*) FROM evidence_recompute_requests WHERE request_type = 'MASTERY_RECOMPUTE_REQUIRED'"), "0");
    await reopened.miniflare.dispose();
  } finally {
    if (fixture.miniflare) await fixture.miniflare.dispose().catch(() => {});
  }
});

test("once subprocess rejects an unspecified or non-disposable target", async () => {
  const result = await runRunner(["--provider=d1"]);
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /LOCAL_DISPOSABLE_TARGET_REQUIRED/);
});

test("once subprocess rejects an unowned synthetic D1 persistence before opening it", async () => {
  const persistPath = await mkdtemp(join(tmpdir(), "securium-evidence-once-unowned-d1-"));
  tempFixtures.add(persistPath);
  const databaseName = `unowned-${randomUUID()}`;
  const argumentsToRunner = [
    "--local-disposable",
    "--provider=d1",
    `--d1-persist-to=${persistPath}`,
    `--d1-database=${databaseName}`,
    "--d1-fixture-owner=caller-owner",
  ];
  const missingMarker = await runRunner(argumentsToRunner);
  assert.equal(missingMarker.exitCode, 2);
  assert.match(missingMarker.stderr, /D1_FIXTURE_MARKER_REQUIRED/);

  await writeFile(
    join(persistPath, D1_FIXTURE_MARKER),
    JSON.stringify(createD1FixtureMetadata({
      persistPath,
      databaseName,
      ownerToken: "different-owner",
    })),
  );
  const wrongOwner = await runRunner(argumentsToRunner);
  assert.equal(wrongOwner.exitCode, 2);
  assert.match(wrongOwner.stderr, /D1_FIXTURE_OWNERSHIP_INVALID/);
});

test("once subprocess rejects a missing synthetic PostgreSQL owner before connecting", async () => {
  const result = await runRunner(["--local-disposable", "--provider=postgres"], {
    SECURIUM_EVIDENCE_ONCE_POSTGRES_URL: "postgres://postgres:synthetic-password@127.0.0.1:65432/postgres",
    SECURIUM_EVIDENCE_ONCE_POSTGRES_CONTAINER: `missing-once-${randomUUID()}`,
    SECURIUM_EVIDENCE_ONCE_POSTGRES_OWNER: "synthetic-owner",
  });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /DISPOSABLE_POSTGRES_CONTAINER_UNAVAILABLE/);
});

async function createD1Fixture({ failHandoff = false } = {}) {
  const persistPath = await mkdtemp(join(tmpdir(), "securium-evidence-once-d1-"));
  tempFixtures.add(persistPath);
  const databaseName = `evidence-once-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ownerToken = `d1-owner-${randomUUID()}`;
  await writeFile(
    join(persistPath, D1_FIXTURE_MARKER),
    JSON.stringify(createD1FixtureMetadata({ persistPath, databaseName, ownerToken })),
  );
  const miniflare = await openMiniflare(persistPath, databaseName);
  const database = await miniflare.getD1Database("DB");
  await execSql(database, `PRAGMA foreign_keys=ON;
    CREATE TABLE users (id text PRIMARY KEY);
    CREATE TABLE ontology_concepts (id text PRIMARY KEY, concept_key text NOT NULL, status text NOT NULL);
    CREATE TABLE question_versions (id text PRIMARY KEY, question_id text NOT NULL, semantic_hash text NOT NULL);
    CREATE TABLE question_attempts (
      id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), question_id text,
      foundation_question_binding_id text, question_version_id text,
      concept_mapping_set_hash text, is_correct integer, score real, attempted_at text
    );
    CREATE TABLE question_concepts (
      id text PRIMARY KEY, question_version_id text NOT NULL, concept_id text NOT NULL,
      mapping_version integer NOT NULL, qualification_json text, provenance_json text,
      mapping_status text NOT NULL
    );
    CREATE TABLE learning_event_revisions (
      id text PRIMARY KEY, source_type text NOT NULL, source_event_id text NOT NULL,
      sequence integer NOT NULL, action text NOT NULL, semantic_hash text NOT NULL,
      correction_payload_json text
    );
    INSERT INTO users VALUES ('user-1');
    INSERT INTO ontology_concepts VALUES ('concept-1', 'concept:one', 'ACTIVE'), ('concept-2', 'concept:two', 'ACTIVE');
    INSERT INTO question_versions VALUES ('question-version-1', 'question-1', '${"d".repeat(64)}');
    INSERT INTO question_concepts VALUES
      ('mapping-1', 'question-version-1', 'concept-1', 1, NULL, NULL, 'APPROVED'),
      ('mapping-2', 'question-version-1', 'concept-2', 1, NULL, NULL, 'APPROVED');`);
  await apply(database, "drizzle/0027_evidence_projection_foundation.sql");
  await execSql(database, "ALTER TABLE evidence_projections ADD COLUMN source_lineage_identity text");
  await execSql(database, `CREATE UNIQUE INDEX evidence_projections_active_lineage_unique
    ON evidence_projections (user_id, source_type, source_lineage_identity, evidence_type, concept_id, projection_version)
    WHERE lifecycle = 'ACTIVE'`);
  await apply(database, "drizzle/0031_evidence_e2_a_recompute_operations.sql");
  if (failHandoff) {
    await execSql(database, `CREATE TRIGGER fail_evidence_once_handoff
      BEFORE INSERT ON evidence_recompute_requests
      WHEN NEW.request_type = 'MASTERY_RECOMPUTE_REQUIRED'
      BEGIN SELECT RAISE(ABORT, 'forced once transaction failure'); END`);
  }
  const mappingHash = await computeConceptMappingSetHash([
    { conceptIdentity: "concept:one", mappingVersion: 1, qualification: null, provenance: null, status: "APPROVED" },
    { conceptIdentity: "concept:two", mappingVersion: 1, qualification: null, provenance: null, status: "APPROVED" },
  ]);
  return {
    persistPath,
    databaseName,
    miniflare,
    database,
    repository: new EvidenceProjectionRepository(new D1DatabaseProvider(database)),
    mappingHash,
    ownerToken,
  };
}

async function insertAttempt(fixture, id) {
  await fixture.database.prepare(`INSERT INTO question_attempts
    (id, user_id, question_id, foundation_question_binding_id, question_version_id,
     concept_mapping_set_hash, is_correct, score, attempted_at)
    VALUES (?, 'user-1', 'question-1', NULL, 'question-version-1', ?, 1, 100, '2026-09-11T00:00:00.000Z')`)
    .bind(id, fixture.mappingHash).run();
}

async function enqueueEvent(fixture, sourceEventId, sourceRevisionIdentity = sourceEventId) {
  const request = await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
    scopeType: "EVENT",
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId,
    sourceRevisionIdentity,
    userId: "user-1",
    projectionVersion: "EVIDENCE_V1",
    reasonCode: "QUESTION_ATTEMPT_CREATED",
  });
  assert.equal(await fixture.repository.enqueue(request), "NEW_SUCCESS");
  return request;
}

async function openMiniflare(persistPath, databaseName) {
  return new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: databaseName },
    d1Persist: persistPath,
  });
}

async function reopen(fixture) {
  const miniflare = await openMiniflare(fixture.persistPath, fixture.databaseName);
  return { miniflare, database: await miniflare.getD1Database("DB") };
}

async function apply(database, file) {
  const sql = await readFile(file, "utf8");
  for (const statement of sql.split(/--> statement-breakpoint/).map((value) => value.trim()).filter(Boolean)) {
    await execSql(database, statement);
  }
}

async function execSql(database, sql) {
  return database.prepare(sql).run();
}

async function status(database, id) {
  return scalar(database, "SELECT status FROM evidence_recompute_requests WHERE id = ?", [id]);
}

async function scalar(database, sql, parameters = []) {
  const row = await database.prepare(sql).bind(...parameters).first();
  return String(row?.value ?? (row ? Object.values(row)[0] : ""));
}

async function runOnce(fixture) {
  return runRunner([
    "--local-disposable",
    "--provider=d1",
    `--d1-persist-to=${fixture.persistPath}`,
    `--d1-database=${fixture.databaseName}`,
    `--d1-fixture-owner=${fixture.ownerToken}`,
  ]);
}

async function runRunner(argumentsToRunner, environment = {}) {
  try {
    const result = await execFile(process.execPath, ["node_modules/tsx/dist/cli.mjs", runnerScript, ...argumentsToRunner], {
      cwd: process.cwd(),
      env: { ...process.env, DB_PROVIDER: "supabase", DATABASE_URL: "postgres://managed.invalid/never-used", ...environment },
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return parseRunnerResult(0, result.stdout, result.stderr);
  } catch (error) {
    return parseRunnerResult(Number(error.code ?? 1), error.stdout ?? "", error.stderr ?? "");
  }
}

function parseRunnerResult(exitCode, stdout, stderr) {
  const line = stdout.trim().split(/\r?\n/).reverse().find((value) => value.trim().startsWith("{"));
  return { exitCode, result: line ? JSON.parse(line) : null, stdout, stderr };
}
