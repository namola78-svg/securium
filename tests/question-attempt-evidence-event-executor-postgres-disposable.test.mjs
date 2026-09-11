import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import postgres from "postgres";
import { DatabaseEvidenceSourceResolver } from "../db/evidence-source-adapters.ts";
import { EvidenceProjectionRepository, createRecomputeRequest } from "../db/evidence-projection-repository.ts";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { EvidenceRecomputeService } from "../lib/services/evidence-recompute.ts";
import { EvidenceRecomputeLifecycleExecutor, QuestionAttemptEvidenceEventExecutor } from "../lib/services/evidence-recompute-executor.ts";
import { computeConceptMappingSetHash } from "../lib/services/learning-event-contracts.ts";

const execFile = promisify(execFileCallback);
const container = process.env.SECURIUM_EVIDENCE_EXECUTOR_PG_CONTAINER?.trim()
  || `securium-question-attempt-evidence-executor-${randomUUID()}`;
const password = "question-attempt-evidence-executor-disposable-password";
let client;
let repository;
let resolver;
let service;
let executor;
let mappingHash;

before(async () => {
  await execFile("docker", [
    "run", "--detach", "--rm", "--name", container,
    "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6",
  ]);
  const { stdout } = await execFile("docker", ["port", container, "5432/tcp"]);
  const port = stdout.trim().match(/:(\d+)$/)?.[1];
  assert.ok(port);
  client = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, {
    max: 1, prepare: false, ssl: false, onnotice: false,
  });
  await waitForConnection();
  mappingHash = await computeConceptMappingSetHash([
    { conceptIdentity: "concept:one", mappingVersion: 1, qualification: null, provenance: null, status: "APPROVED" },
  ]);
  await client.unsafe(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE TABLE app_schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE users (id text PRIMARY KEY);
    CREATE TABLE ontology_concepts (id text PRIMARY KEY, concept_key text NOT NULL, status text NOT NULL);
    CREATE TABLE question_versions (id text PRIMARY KEY, question_id text NOT NULL, semantic_hash text NOT NULL);
    CREATE TABLE question_attempts (
      id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), question_id text,
      foundation_question_binding_id text, question_version_id text,
      concept_mapping_set_hash text, is_correct boolean, score real, attempted_at text
    );
    CREATE TABLE question_concepts (
      id text PRIMARY KEY, question_version_id text NOT NULL, concept_id text NOT NULL,
      mapping_version integer NOT NULL, qualification_json text, provenance_json text, mapping_status text NOT NULL
    );
    CREATE TABLE learning_event_revisions (
      id text PRIMARY KEY, source_type text NOT NULL, source_event_id text NOT NULL,
      sequence integer NOT NULL, action text NOT NULL, semantic_hash text NOT NULL, correction_payload_json text
    );
    INSERT INTO users VALUES ('user-1'), ('user-2');
    INSERT INTO ontology_concepts VALUES ('concept-1', 'concept:one', 'ACTIVE');
    INSERT INTO question_versions VALUES ('question-version-1', 'question-1', '${"e".repeat(64)}');
    INSERT INTO question_concepts VALUES ('mapping-1', 'question-version-1', 'concept-1', 1, NULL, NULL, 'APPROVED');`);
  await client.unsafe(await readFile("db/postgres/migrations/0015_evidence_projection_foundation.sql", "utf8"));
  await client.unsafe(await readFile("db/postgres/migrations/0019_evidence_e2_a_recompute_operations.sql", "utf8"));
  await client.unsafe(`ALTER TABLE evidence_projections ADD COLUMN source_lineage_identity text;
    ALTER TABLE evidence_projections ALTER COLUMN source_lineage_identity SET NOT NULL;
    CREATE UNIQUE INDEX evidence_projections_active_lineage_unique
      ON evidence_projections (user_id, source_type, source_lineage_identity, evidence_type, concept_id, projection_version)
      WHERE lifecycle = 'ACTIVE';`);
  const provider = makeProvider(client);
  repository = new EvidenceProjectionRepository(provider);
  resolver = new DatabaseEvidenceSourceResolver(provider);
  service = new EvidenceRecomputeService(repository, resolver);
  executor = new QuestionAttemptEvidenceEventExecutor(
    new EvidenceRecomputeLifecycleExecutor(repository),
    service,
  );
});

after(async () => {
  await client?.end({ timeout: 5 }).catch(() => {});
  await execFile("docker", ["rm", "--force", container]).catch(() => {});
});

test("PostgreSQL claim, canonical resolution, projection transaction, and completion are bounded to QuestionAttempt events", async () => {
  const id = "pg-attempt-executor-1";
  await client.unsafe(`INSERT INTO question_attempts
    (id, user_id, question_id, foundation_question_binding_id, question_version_id, concept_mapping_set_hash, is_correct, score, attempted_at)
    VALUES ('${id}', 'user-1', 'question-1', NULL, 'question-version-1', '${mappingHash}', true, 100, '2026-09-11T00:00:00.000Z')`);
  const request = await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
    scopeType: "EVENT",
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: id,
    sourceRevisionIdentity: id,
    userId: "user-1",
    projectionVersion: "EVIDENCE_V1",
    reasonCode: "QUESTION_ATTEMPT_CREATED",
  });
  assert.equal(await repository.enqueue(request), "NEW_SUCCESS");
  assert.equal(await repository.enqueue(await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
    scopeType: "USER",
    userId: "user-1",
    projectionVersion: "EVIDENCE_V1",
    reasonCode: "UNSUPPORTED_SCOPE",
  })), "NEW_SUCCESS");

  const result = await executor.processNext("postgres-executor");

  assert.equal(result.outcome, "COMPLETED");
  assert.equal(result.projectionOutcome, "NEW_SUCCESS");
  assert.equal(await scalar(`SELECT status FROM evidence_recompute_requests WHERE id = '${request.id}'`), "COMPLETED");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${id}' AND lifecycle = 'ACTIVE'`), "1");
  assert.equal(await scalar("SELECT count(*) FROM evidence_recompute_requests WHERE scope_type = 'USER' AND status = 'PENDING'"), "1");
  assert.equal(await scalar(`SELECT source_revision_identity FROM evidence_projections WHERE source_event_id = '${id}'`), id);
});

test("PostgreSQL skips the SW identity path while claiming ordinary events", async () => {
  const ordinaryId = "pg-attempt-executor-boundary-ordinary";
  const swId = "pg-attempt-executor-boundary-sw";
  await client.unsafe(`INSERT INTO question_attempts
    (id, user_id, question_id, foundation_question_binding_id, question_version_id, concept_mapping_set_hash, is_correct, score, attempted_at)
    VALUES ('${ordinaryId}', 'user-1', 'question-1', NULL, 'question-version-1', '${mappingHash}', true, 100, '2026-09-11T00:00:00.000Z'),
      ('${swId}', 'user-1', NULL, 'foundation-binding-1', NULL, NULL, true, 100, '2026-09-11T00:00:00.000Z')`);
  const ordinaryRequest = await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED", scopeType: "EVENT", sourceType: "QUESTION_ATTEMPT",
    sourceEventId: ordinaryId, sourceRevisionIdentity: ordinaryId, userId: "user-1",
    projectionVersion: "EVIDENCE_V1", reasonCode: "QUESTION_ATTEMPT_CREATED",
  });
  const swRequest = await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED", scopeType: "EVENT", sourceType: "QUESTION_ATTEMPT",
    sourceEventId: swId, sourceRevisionIdentity: swId, userId: "user-1",
    projectionVersion: "EVIDENCE_V1", reasonCode: "SW_ATTEMPT_CREATED",
  });
  assert.equal(await repository.enqueue(swRequest), "NEW_SUCCESS");
  assert.equal(await repository.enqueue(ordinaryRequest), "NEW_SUCCESS");

  const result = await executor.processNext("postgres-ordinary-boundary");

  assert.equal(result.outcome, "COMPLETED");
  assert.equal(await scalar(`SELECT status FROM evidence_recompute_requests WHERE id = '${ordinaryRequest.id}'`), "COMPLETED");
  assert.equal(await scalar(`SELECT status FROM evidence_recompute_requests WHERE id = '${swRequest.id}'`), "PENDING");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${swId}'`), "0");
});

test("PostgreSQL lease fencing blocks stale projection and handoff writes", async () => {
  const id = "pg-attempt-executor-lease-fencing";
  await client.unsafe(`INSERT INTO question_attempts
    (id, user_id, question_id, foundation_question_binding_id, question_version_id, concept_mapping_set_hash, is_correct, score, attempted_at)
    VALUES ('${id}', 'user-1', 'question-1', NULL, 'question-version-1', '${mappingHash}', true, 100, '2026-09-11T00:00:00.000Z')`);
  const request = await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED", scopeType: "EVENT", sourceType: "QUESTION_ATTEMPT",
    sourceEventId: id, sourceRevisionIdentity: id, userId: "user-1",
    projectionVersion: "EVIDENCE_V1", reasonCode: "QUESTION_ATTEMPT_CREATED",
  });
  assert.equal(await repository.enqueue(request), "NEW_SUCCESS");

  const lifecycle = new EvidenceRecomputeLifecycleExecutor(repository);
  const claimA = await lifecycle.claimQuestionAttemptEvent("postgres-worker-a");
  assert.equal(claimA?.id, request.id);

  const staleGate = gateFirstSourceResolution(resolver);
  const staleExecutor = new QuestionAttemptEvidenceEventExecutor(
    new EvidenceRecomputeLifecycleExecutor(repository),
    new EvidenceRecomputeService(repository, staleGate.resolver),
  );
  const stalePromise = staleExecutor.processClaimed(claimA);
  await staleGate.reached;

  await client.unsafe(`UPDATE evidence_recompute_requests
    SET lease_expires_at = '2000-01-01T00:00:00.000Z' WHERE id = '${request.id}'`);
  const claimB = await lifecycle.claimQuestionAttemptEvent("postgres-worker-b");
  assert.equal(claimB?.id, request.id);
  assert.notEqual(claimA?.claimToken, claimB?.claimToken);

  const recoveredGate = gateFirstSourceResolution(resolver);
  const recoveredExecutor = new QuestionAttemptEvidenceEventExecutor(
    new EvidenceRecomputeLifecycleExecutor(repository),
    new EvidenceRecomputeService(repository, recoveredGate.resolver),
  );
  const recoveredPromise = recoveredExecutor.processClaimed(claimB);
  await recoveredGate.reached;

  staleGate.release();
  const stale = await stalePromise;
  assert.equal(stale.outcome, "CLAIM_LOST");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${id}'`), "0");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_recompute_requests WHERE source_event_id = '${id}' AND request_type = 'MASTERY_RECOMPUTE_REQUIRED'`), "0");

  recoveredGate.release();
  const recovered = await recoveredPromise;
  assert.equal(recovered.outcome, "COMPLETED");
  assert.equal(recovered.projectionOutcome, "NEW_SUCCESS");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${id}' AND lifecycle = 'ACTIVE'`), "1");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_recompute_requests WHERE source_event_id = '${id}' AND request_type = 'MASTERY_RECOMPUTE_REQUIRED'`), "1");
});

function makeProvider(databaseClient) {
  return new PostgresDatabaseProvider({
    query: async (query, parameters) => {
      const rows = await databaseClient.unsafe(query, parameters);
      return { rows, rowCount: rows.count ?? rows.length };
    },
    transaction: async (callback) => databaseClient.begin(async (tx) => callback({
      query: async (query, parameters) => {
        const rows = await tx.unsafe(query, parameters);
        return { rows, rowCount: rows.count ?? rows.length };
      },
    })),
  });
}

function gateFirstSourceResolution(baseResolver) {
  let signalReached;
  const reached = new Promise((resolve) => { signalReached = resolve; });
  let release;
  const released = new Promise((resolve) => { release = resolve; });
  let pause = true;
  return {
    reached,
    release: () => release(),
    resolver: {
      resolveEvent: async (input) => {
        const source = await baseResolver.resolveEvent(input);
        if (pause) {
          pause = false;
          signalReached();
          await released;
        }
        return source;
      },
    },
  };
}

async function scalar(sql) {
  const rows = await client.unsafe(sql);
  return String(rows[0] ? Object.values(rows[0])[0] : "");
}

async function waitForConnection() {
  for (let index = 0; index < 40; index += 1) {
    try {
      await client`SELECT 1`;
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("PostgreSQL unavailable");
}
