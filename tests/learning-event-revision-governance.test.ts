import assert from "node:assert/strict";
import test from "node:test";
import {
  LearningEventGovernanceService,
  type LearningEventGovernanceRepositoryContract,
  type LearningEventRevision,
} from "../lib/services/learning-event-governance.ts";

function repository() {
  const rows = new Map<string, LearningEventRevision>();
  return {
    rows,
    async appendRevision(
      input: Parameters<LearningEventGovernanceRepositoryContract["appendRevision"]>[0],
    ) {
      const exact = [...rows.values()].find((row) => row.semanticHash === input.semanticHash);
      if (exact) return { outcome: "EXACT_REPLAY" as const, revision: exact };
      const sequence = rows.size + 1;
      const revision = Object.freeze({
        id: input.revisionId,
        sourceType: input.sourceType,
        sourceEventId: input.sourceEventId,
        sequence,
        previousRevisionId: input.expectedPreviousRevisionId,
        action: input.action,
        reasonCode: input.reasonCode,
        payloadSchemaVersion: 1 as const,
        correctionPayloadJson: input.correctionPayloadJson,
        semanticHash: input.semanticHash,
        actorUserId: input.actorUserId,
        createdAt: "2026-08-21T00:00:00.000Z",
      });
      rows.set(revision.id, revision);
      return { outcome: "NEW_SUCCESS" as const, revision };
    },
  };
}

const correction = {
  revisionId: "rev-1",
  sourceType: "QUESTION_ATTEMPT" as const,
  sourceEventId: "attempt-1",
  ownerUserId: "learner-1",
  actorUserId: "reviewer-1",
  action: "CORRECT" as const,
  reasonCode: "GRADING_CORRECTION",
  payload: { kind: "QUESTION_RESULT" as const, isCorrect: true, score: 100, questionVersionId: "qv-1", conceptMappingSetHash: "a".repeat(64) },
  expectedPreviousRevisionId: null,
};

test("correction is deterministic, replay-safe, and emits only a neutral recompute signal", async () => {
  const store = repository();
  const service = new LearningEventGovernanceService(store);
  const first = await service.appendRevision(correction);
  const replay = await service.appendRevision(correction);
  assert.equal(first.outcome, "NEW_SUCCESS");
  assert.equal(replay.outcome, "EXACT_REPLAY");
  assert.equal(store.rows.size, 1);
  assert.equal(first.recomputeSignal.type, "EVIDENCE_RECOMPUTE_REQUIRED");
});

test("typed validation rejects invalid payload/source combinations and spoofed hashes", async () => {
  const service = new LearningEventGovernanceService(repository());
  await assert.rejects(
    service.appendRevision({ ...correction, sourceType: "PRACTICAL_ATTEMPT", payload: correction.payload }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "EVENT_REVISION_PAYLOAD_INVALID",
  );
  await assert.rejects(
    service.appendRevision({ ...correction, payload: { ...correction.payload, conceptMappingSetHash: "spoof" } }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "EVENT_REVISION_HASH_INVALID",
  );
});
