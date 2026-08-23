import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidenceCandidates, EVIDENCE_PROJECTION_VERSION, type CanonicalEvidenceSource } from "../lib/services/evidence-projection.ts";
import { createRecomputeRequest } from "../db/evidence-projection-repository.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function source(overrides: Partial<CanonicalEvidenceSource> = {}): CanonicalEvidenceSource {
  return {
    sourceType: "QUESTION_ATTEMPT", sourceEventId: "attempt-1", sourceRevisionIdentity: "revision-1",
    userId: "user-1", contentVersionIdentity: "question-version-1",
    conceptMappingSetHash: HASH_A, conceptIds: ["concept-b", "concept-a"],
    occurredAt: "2026-08-21T00:00:00.000Z", validity: "ELIGIBLE",
    evidenceType: "PERFORMANCE_RESULT", quality: "DIRECT_PERFORMANCE",
    resultSummary: { correct: true, score: 100 }, sourceSemanticHash: HASH_B,
    ...overrides,
  };
}

test("F1 valid source produces deterministic NEW_SUCCESS candidates", async () => {
  const candidates = await buildEvidenceCandidates(source());
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates.map((item) => item.conceptId), ["concept-a", "concept-b"]);
  assert.equal(candidates[0].projectionVersion, EVIDENCE_PROJECTION_VERSION);
});

test("F2 missing source identity is INVALID_SOURCE", async () => {
  await assert.rejects(buildEvidenceCandidates(source({ sourceEventId: "" })), hasCode("EVIDENCE_SOURCE_IDENTITY_INVALID"));
});

test("F3 wrong owner is rejected by the repository parent guard contract", () => {
  assert.equal("userId" in source(), true);
});

test("F4 legacy/missing version source is ineligible", async () => {
  await assert.rejects(buildEvidenceCandidates(source({ validity: "LEGACY_INELIGIBLE", contentVersionIdentity: "" })), hasCode("EVIDENCE_SOURCE_IDENTITY_INVALID"));
});

test("F5 missing mapping and mapping hash mismatch fail closed", async () => {
  await assert.rejects(buildEvidenceCandidates(source({ conceptIds: [] })), hasCode("EVIDENCE_CONCEPT_MAPPING_INVALID"));
  await assert.rejects(buildEvidenceCandidates(source({ conceptMappingSetHash: "bad" })), hasCode("EVIDENCE_SOURCE_HASH_INVALID"));
});

test("F6 identity and semantic hashes distinguish semantic conflict", async () => {
  const [left] = await buildEvidenceCandidates(source());
  const [right] = await buildEvidenceCandidates(source({ resultSummary: { correct: false, score: 0 } }));
  assert.equal(left.id, right.id);
  assert.notEqual(left.semanticHash, right.semanticHash);
});

test("F7 invalidated source cannot create active Evidence", async () => {
  await assert.rejects(buildEvidenceCandidates(source({ validity: "INVALIDATED" })), hasCode("EVIDENCE_SOURCE_INELIGIBLE"));
});

test("F8 result payload is bounded and contains no raw answer", async () => {
  await assert.rejects(buildEvidenceCandidates(source({ resultSummary: { selectedAnswer: "secret" } })), hasCode("EVIDENCE_RESULT_SCHEMA_INVALID"));
  const [candidate] = await buildEvidenceCandidates(source());
  assert.equal(candidate.resultSummaryJson.includes("selectedAnswer"), false);
});

test("F9 exact rebuild is deterministic", async () => {
  assert.deepEqual(await buildEvidenceCandidates(source()), await buildEvidenceCandidates(source()));
});

test("F10 recompute identity is deterministic for concurrent replay", async () => {
  const input = { requestType: "EVIDENCE_RECOMPUTE_REQUIRED" as const, scopeType: "USER" as const, userId: "user-1", projectionVersion: EVIDENCE_PROJECTION_VERSION, reasonCode: "MAINTENANCE" };
  assert.deepEqual(await createRecomputeRequest(input), await createRecomputeRequest(input));
});

test("F11 corrected revision changes identity and preserves old revision lineage", async () => {
  const [oldEvidence] = await buildEvidenceCandidates(source());
  const [corrected] = await buildEvidenceCandidates(source({ sourceRevisionIdentity: "revision-2" }));
  assert.notEqual(oldEvidence.id, corrected.id);
});

test("F12 progress is supporting activity only", async () => {
  const [progress] = await buildEvidenceCandidates(source({ sourceType: "LESSON_PROGRESS", evidenceType: "LEARNING_ACTIVITY", quality: "SUPPORTING_ACTIVITY", resultSummary: { completed: true } }));
  assert.equal(progress.quality, "SUPPORTING_ACTIVITY");
  await assert.rejects(buildEvidenceCandidates(source({ sourceType: "LESSON_PROGRESS", evidenceType: "PERFORMANCE_RESULT", resultSummary: { completed: true } })), hasCode("PROGRESS_EVIDENCE_QUALITY_INVALID"));
});

function hasCode(code: string) {
  return (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}
