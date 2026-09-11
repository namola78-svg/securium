import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { DatabaseEvidenceSourceResolver } from "../db/evidence-source-adapters.ts";
import { EvidenceProjectionRepository, createRecomputeRequest } from "../db/evidence-projection-repository.ts";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { EvidenceRecomputeService } from "../lib/services/evidence-recompute.ts";
import { EvidenceRecomputeLifecycleExecutor, QuestionAttemptEvidenceEventExecutor } from "../lib/services/evidence-recompute-executor.ts";
import { computeConceptMappingSetHash } from "../lib/services/learning-event-contracts.ts";

let miniflare;
let database;
let provider;
let repository;
let resolver;
let service;
let lifecycle;
let executor;
let mappingHash;

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "question-attempt-evidence-event-executor" },
  });
  database = await miniflare.getD1Database("DB");
  mappingHash = await computeConceptMappingSetHash([
    { conceptIdentity: "concept:one", mappingVersion: 1, qualification: null, provenance: null, status: "APPROVED" },
    { conceptIdentity: "concept:two", mappingVersion: 1, qualification: null, provenance: null, status: "APPROVED" },
  ]);
  await exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users (id text PRIMARY KEY);
    CREATE TABLE ontology_concepts (id text PRIMARY KEY, concept_key text NOT NULL, status text NOT NULL);
    CREATE TABLE question_versions (id text PRIMARY KEY, question_id text NOT NULL, semantic_hash text NOT NULL);
    CREATE TABLE question_attempts (
      id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id),
      question_id text, foundation_question_binding_id text,
      question_version_id text, concept_mapping_set_hash text,
      is_correct integer, score real, attempted_at text
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
    INSERT INTO users VALUES ('user-1'), ('user-2');
    INSERT INTO ontology_concepts VALUES
      ('concept-1', 'concept:one', 'ACTIVE'), ('concept-2', 'concept:two', 'ACTIVE');
    INSERT INTO question_versions VALUES ('question-version-1', 'question-1', '${"d".repeat(64)}');
    INSERT INTO question_concepts VALUES
      ('mapping-1', 'question-version-1', 'concept-1', 1, NULL, NULL, 'APPROVED'),
      ('mapping-2', 'question-version-1', 'concept-2', 1, NULL, NULL, 'APPROVED');`);
  await apply("drizzle/0027_evidence_projection_foundation.sql");
  await exec("ALTER TABLE evidence_projections ADD COLUMN source_lineage_identity text");
  await exec(`CREATE UNIQUE INDEX evidence_projections_active_lineage_unique
    ON evidence_projections (user_id, source_type, source_lineage_identity, evidence_type, concept_id, projection_version)
    WHERE lifecycle = 'ACTIVE'`);
  await apply("drizzle/0031_evidence_e2_a_recompute_operations.sql");
  provider = new D1DatabaseProvider(database);
  repository = new EvidenceProjectionRepository(provider);
  resolver = new DatabaseEvidenceSourceResolver(provider);
  service = new EvidenceRecomputeService(repository, resolver);
  lifecycle = new EvidenceRecomputeLifecycleExecutor(repository);
  executor = new QuestionAttemptEvidenceEventExecutor(lifecycle, service);
});

after(() => miniflare?.dispose());

test("processes a stored governed question attempt into projections before completion", async () => {
  const id = "attempt-executor-success";
  await insertAttempt(id, "user-1");
  const request = await enqueueEvent(id, "user-1");

  const result = await executor.processNext("worker-success");

  assert.equal(result.outcome, "COMPLETED");
  assert.equal(result.projectionOutcome, "NEW_SUCCESS");
  assert.equal(result.projectionCount, 2);
  assert.equal(await status(request.id), "COMPLETED");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${id}' AND lifecycle = 'ACTIVE'`), "2");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${id}' AND user_id = 'user-2'`), "0");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_recompute_requests WHERE source_event_id = '${id}' AND request_type = 'MASTERY_RECOMPUTE_REQUIRED'`), "2");

  const replay = await service.recomputeEvent({
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: id,
    sourceRevisionIdentity: id,
    expectedUserId: "user-1",
  });
  assert.equal(replay.outcome, "EXACT_REPLAY");
});

test("concurrent bounded claims have one winner and leave unsupported requests pending", async () => {
  const id = "attempt-executor-concurrent";
  await insertAttempt(id, "user-1");
  const request = await enqueueEvent(id, "user-1");
  const unsupported = await repository.enqueue(await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
    scopeType: "USER",
    userId: "user-1",
    projectionVersion: "EVIDENCE_V1",
    reasonCode: "UNSUPPORTED_SCOPE_TEST",
  }));
  assert.equal(unsupported, "NEW_SUCCESS");

  const results = await Promise.all([
    executor.processNext("worker-a"),
    executor.processNext("worker-b"),
  ]);
  assert.equal(results.filter((item) => item.outcome === "COMPLETED").length, 1);
  assert.equal(results.filter((item) => item.outcome === "NO_REQUEST").length, 1);
  assert.equal(await status(request.id), "COMPLETED");
  assert.equal(await scalar("SELECT count(*) FROM evidence_recompute_requests WHERE scope_type = 'USER' AND status = 'PENDING'"), "1");
});

test("claims only ordinary question identity and skips SW, mock, and full requests", async () => {
  const ordinaryId = "attempt-executor-ordinary-boundary";
  const swId = "attempt-executor-sw-boundary";
  await insertAttempt(ordinaryId, "user-1");
  await insertSwAttempt(swId, "user-1");
  const swRequest = await enqueueEvent(swId, "user-1");
  const mockRequest = await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
    scopeType: "FULL",
    sourceType: "MOCK_ATTEMPT",
    sourceEventId: "mock-attempt-boundary",
    userId: "user-1",
    projectionVersion: "EVIDENCE_V1",
    reasonCode: "UNSUPPORTED_SOURCE_TEST",
  });
  assert.equal(await repository.enqueue(mockRequest), "NEW_SUCCESS");
  const fullRequest = await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
    scopeType: "FULL",
    projectionVersion: "EVIDENCE_V1",
    reasonCode: "UNSUPPORTED_SCOPE_TEST",
  });
  assert.equal(await repository.enqueue(fullRequest), "NEW_SUCCESS");
  const ordinaryRequest = await enqueueEvent(ordinaryId, "user-1");

  const result = await executor.processNext("worker-ordinary-boundary");

  assert.equal(result.outcome, "COMPLETED");
  assert.equal(await status(ordinaryRequest.id), "COMPLETED");
  assert.equal(await status(swRequest.id), "PENDING");
  assert.equal(await status(mockRequest.id), "PENDING");
  assert.equal(await status(fullRequest.id), "PENDING");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${swId}'`), "0");
});

test("rejects a request whose user binding disagrees with the canonical attempt", async () => {
  const id = "attempt-executor-cross-user";
  await insertAttempt(id, "user-1");
  const request = await enqueueEvent(id, "user-2");

  const result = await executor.processNext("worker-cross-user");

  assert.equal(result.outcome, "FAILED");
  assert.equal(result.errorClass, "SOURCE_INVALID");
  assert.equal(await status(request.id), "FAILED");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${id}'`), "0");
});

test("rejects a request whose revision identity disagrees with the canonical attempt", async () => {
  const id = "attempt-executor-revision-binding";
  await insertAttempt(id, "user-1");
  const request = await enqueueEvent(id, "user-1", "forged-revision-identity");

  const result = await executor.processNext("worker-revision-binding");

  assert.equal(result.outcome, "FAILED");
  assert.equal(result.errorClass, "SOURCE_INVALID");
  assert.equal(await status(request.id), "FAILED");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${id}'`), "0");
});

test("retries a calculation failure and then completes after the source is available", async () => {
  const id = "attempt-executor-retry";
  await insertAttempt(id, "user-1");
  const request = await enqueueEvent(id, "user-1");
  const failingResolver = { resolveEvent: async () => { throw new Error("disposable source failure"); } };
  const failingService = new EvidenceRecomputeService(repository, failingResolver);
  const failingExecutor = new QuestionAttemptEvidenceEventExecutor(
    new EvidenceRecomputeLifecycleExecutor(repository),
    failingService,
  );

  const failed = await failingExecutor.processNext("worker-retry");
  assert.equal(failed.outcome, "RETRYABLE");
  assert.equal(failed.errorClass, "TRANSIENT_DB");
  assert.equal(await status(request.id), "RETRYABLE");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${id}'`), "0");

  await exec(`UPDATE evidence_recompute_requests SET next_attempt_at = '2000-01-01T00:00:00.000Z' WHERE id = '${request.id}'`);
  const retried = await executor.processNext("worker-retry-after-failure");
  assert.equal(retried.outcome, "COMPLETED");
  assert.equal(await status(request.id), "COMPLETED");
});

test("does not complete before projection storage and recovers after a lost completion", async () => {
  const id = "attempt-executor-interrupted";
  await insertAttempt(id, "user-1");
  const request = await enqueueEvent(id, "user-1");
  const baseLifecycle = new EvidenceRecomputeLifecycleExecutor(repository);
  const interruptedLifecycle = {
    claimQuestionAttemptEvent: (workerId) => baseLifecycle.claimQuestionAttemptEvent(workerId),
    complete: async () => ({ affectedRows: 0 }),
    fail: (claimed, errorClass) => baseLifecycle.fail(claimed, errorClass),
  };
  const interruptedExecutor = new QuestionAttemptEvidenceEventExecutor(interruptedLifecycle, service);

  const interrupted = await interruptedExecutor.processNext("worker-interrupted");
  assert.equal(interrupted.outcome, "CLAIM_LOST");
  assert.equal(await status(request.id), "PROCESSING");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${id}' AND lifecycle = 'ACTIVE'`), "2");

  await exec(`UPDATE evidence_recompute_requests SET lease_expires_at = '2000-01-01T00:00:00.000Z' WHERE id = '${request.id}'`);
  const recovered = await executor.processNext("worker-recovered");
  assert.equal(recovered.outcome, "COMPLETED");
  assert.equal(recovered.projectionOutcome, "EXACT_REPLAY");
  assert.equal(await status(request.id), "COMPLETED");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${id}' AND lifecycle = 'ACTIVE'`), "2");
});

test("lease fencing prevents a stale worker from duplicating projections or handoffs", async () => {
  const id = "attempt-executor-lease-fencing";
  await insertAttempt(id, "user-1");
  const request = await enqueueEvent(id, "user-1");
  const baseLifecycle = new EvidenceRecomputeLifecycleExecutor(repository);
  const claimA = await baseLifecycle.claimQuestionAttemptEvent("worker-a");
  assert.equal(claimA?.id, request.id);

  const staleGate = gateFirstSourceResolution(resolver);
  const staleExecutor = new QuestionAttemptEvidenceEventExecutor(
    new EvidenceRecomputeLifecycleExecutor(repository),
    new EvidenceRecomputeService(repository, staleGate.resolver),
  );
  const stalePromise = staleExecutor.processClaimed(claimA);
  await staleGate.reached;

  await exec(`UPDATE evidence_recompute_requests SET lease_expires_at = '2000-01-01T00:00:00.000Z' WHERE id = '${request.id}'`);
  const claimB = await baseLifecycle.claimQuestionAttemptEvent("worker-b");
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
  assert.equal(await status(request.id), "COMPLETED");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${id}' AND lifecycle = 'ACTIVE'`), "2");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_recompute_requests WHERE source_event_id = '${id}' AND request_type = 'MASTERY_RECOMPUTE_REQUIRED'`), "2");
});

test("rolls back projection writes when the projection transaction fails", async () => {
  const id = "attempt-executor-storage-failure";
  await insertAttempt(id, "user-1");
  const request = await enqueueEvent(id, "user-1");
  const failingProvider = {
    kind: provider.kind,
    query: provider.query.bind(provider),
    queryOne: provider.queryOne.bind(provider),
    execute: provider.execute.bind(provider),
    transaction: async () => { throw new Error("forced transaction failure"); },
    healthCheck: provider.healthCheck.bind(provider),
  };
  const failingRepository = new EvidenceProjectionRepository(failingProvider);
  const failingExecutor = new QuestionAttemptEvidenceEventExecutor(
    new EvidenceRecomputeLifecycleExecutor(failingRepository),
    new EvidenceRecomputeService(failingRepository, resolver),
  );

  const result = await failingExecutor.processNext("worker-storage-failure");

  assert.equal(result.outcome, "RETRYABLE");
  assert.equal(await status(request.id), "RETRYABLE");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${id}'`), "0");
});

async function enqueueEvent(sourceEventId, userId, sourceRevisionIdentity = sourceEventId) {
  const request = await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
    scopeType: "EVENT",
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId,
    sourceRevisionIdentity,
    userId,
    projectionVersion: "EVIDENCE_V1",
    reasonCode: "QUESTION_ATTEMPT_CREATED",
  });
  assert.equal(await repository.enqueue(request), "NEW_SUCCESS");
  return request;
}

async function insertAttempt(id, userId) {
  await database.prepare(`INSERT INTO question_attempts
    (id, user_id, question_id, foundation_question_binding_id, question_version_id, concept_mapping_set_hash, is_correct, score, attempted_at)
    VALUES (?, ?, 'question-1', NULL, 'question-version-1', ?, 1, 100, '2026-09-11T00:00:00.000Z')`).bind(id, userId, mappingHash).run();
}

async function insertSwAttempt(id, userId) {
  await database.prepare(`INSERT INTO question_attempts
    (id, user_id, question_id, foundation_question_binding_id, question_version_id, concept_mapping_set_hash, is_correct, score, attempted_at)
    VALUES (?, ?, NULL, 'foundation-binding-1', NULL, NULL, 1, 100, '2026-09-11T00:00:00.000Z')`).bind(id, userId).run();
}

async function status(id) {
  return scalar(`SELECT status AS value FROM evidence_recompute_requests WHERE id = '${id}'`);
}

async function scalar(sql) {
  const row = await database.prepare(sql).first();
  return String(row?.value ?? (row ? Object.values(row)[0] : ""));
}

async function exec(sql) {
  return database.prepare(sql).run();
}

async function apply(file) {
  const text = await readFile(file, "utf8");
  for (const statement of text.split(/--> statement-breakpoint/).map((item) => item.trim()).filter(Boolean)) {
    await exec(statement);
  }
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
