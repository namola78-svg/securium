import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceRecomputeService } from "../lib/services/evidence-recompute.ts";
import type { CanonicalEvidenceSource } from "../lib/services/evidence-projection.ts";

const source: CanonicalEvidenceSource = {
  sourceType: "QUESTION_ATTEMPT", sourceEventId: "attempt", sourceRevisionIdentity: "revision",
  sourceLineageIdentity: "attempt",
  userId: "user", contentVersionIdentity: "version", conceptMappingSetHash: "a".repeat(64),
  conceptIds: ["concept"], occurredAt: "2026-08-21T00:00:00Z", validity: "ELIGIBLE",
  evidenceType: "PERFORMANCE_RESULT", quality: "DIRECT_PERFORMANCE",
  resultSummary: { correct: true, score: 100 }, sourceSemanticHash: "b".repeat(64),
  mappingTransition: "PRESERVE_EVENT_TIME",
  mappingGuard: {
    kind: "QUESTION_VERSION", parentIdentity: "version",
    members: [{ mappingId: "mapping", conceptId: "concept", conceptIdentity: "concept:key", mappingVersion: 1, qualificationJson: null, provenanceJson: null }],
  },
};

test("per-event rebuild projects eligible source and exact replay", async () => {
  const outcomes: string[] = [];
  const repository = fakeRepository({ reconcileEventProjectionSet: async () => outcomes.length++ ? "EXACT_REPLAY" : "NEW_SUCCESS" });
  const service = new EvidenceRecomputeService(repository, { resolveEvent: async () => source });
  assert.equal((await service.recomputeEvent({ sourceType: "QUESTION_ATTEMPT", sourceEventId: "attempt", sourceRevisionIdentity: "revision" })).outcome, "NEW_SUCCESS");
  assert.equal((await service.recomputeEvent({ sourceType: "QUESTION_ATTEMPT", sourceEventId: "attempt", sourceRevisionIdentity: "revision" })).outcome, "EXACT_REPLAY");
});

test("invalidated source invokes lifecycle invalidation without projection", async () => {
  let invalidated = 0;
  const repository = fakeRepository({ invalidateEventSource: async () => { invalidated += 1; return "NEW_SUCCESS"; } });
  const service = new EvidenceRecomputeService(repository, { resolveEvent: async () => ({ ...source, validity: "INVALIDATED" }) });
  assert.equal((await service.recomputeEvent({ sourceType: "QUESTION_ATTEMPT", sourceEventId: "attempt", sourceRevisionIdentity: "revision" })).outcome, "NEW_SUCCESS");
  assert.equal(invalidated, 1);
});

test("per-user, per-Concept, and resumable full rebuild requests are deterministic", async () => {
  const requests: unknown[] = [];
  const repository = fakeRepository({ enqueue: async (request: unknown) => { requests.push(request); return "NEW_SUCCESS"; } });
  const service = new EvidenceRecomputeService(repository, { resolveEvent: async () => null });
  await service.requestRebuild({ scopeType: "USER", userId: "user", reasonCode: "MAINTENANCE" });
  await service.requestRebuild({ scopeType: "CONCEPT", conceptId: "concept", reasonCode: "MAPPING_CORRECTION" });
  await service.requestRebuild({ scopeType: "FULL", reasonCode: "PROJECTION_VERSION_REBUILD", cursor: "page-10" });
  assert.deepEqual(requests.map((item) => (item as { scopeType: string }).scopeType), ["USER", "CONCEPT", "FULL"]);
  assert.equal((requests[2] as { cursor: string }).cursor, "page-10");
});

function fakeRepository(overrides: Record<string, unknown>) {
  return {
    reconcileEventProjectionSet: async () => "NEW_SUCCESS",
    invalidateEventSource: async () => "EXACT_REPLAY",
    invalidateLineage: async () => "EXACT_REPLAY",
    enqueue: async () => "NEW_SUCCESS", listPending: async () => ({ rows: [] }),
    completeRequest: async () => ({}), ...overrides,
  } as never;
}
