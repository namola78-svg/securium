import assert from "node:assert/strict";
import test from "node:test";
import {
  computeConceptMappingSetHash,
  computeMockCompositionSemanticHash,
  legacyLearningEventEligibility,
} from "../lib/services/learning-event-contracts.ts";

const mappings = [
  { conceptIdentity: "audit.evidence", mappingVersion: 1, qualification: { level: "P0" }, provenance: { source: "S01" }, status: "APPROVED" as const },
  { conceptIdentity: "audit.methodology", mappingVersion: 2, qualification: { level: "P0" }, provenance: { source: "S02" }, status: "APPROVED" as const },
];

test("Concept mapping-set hash is deterministic and set ordered", async () => {
  const runA = await computeConceptMappingSetHash(mappings);
  const runB = await computeConceptMappingSetHash([...mappings].reverse());
  assert.equal(runA, runB);
  assert.match(runA, /^[0-9a-f]{64}$/);
  assert.notEqual(runA, await computeConceptMappingSetHash([{ ...mappings[0], mappingVersion: 3 }, mappings[1]]));
});

test("mock composition hash freezes ordered governed semantics", async () => {
  const input = {
    items: [
      { displayOrder: 2, questionIdentity: "q2", questionVersionSemanticHash: "b".repeat(64), possibleScore: 40, conceptMappingSetHash: "d".repeat(64) },
      { displayOrder: 1, questionIdentity: "q1", questionVersionSemanticHash: "a".repeat(64), possibleScore: 60, conceptMappingSetHash: "c".repeat(64) },
    ],
    passingScore: 70,
    questionCount: 2,
    randomizeQuestions: false,
    randomizeChoices: true,
  };
  assert.equal(
    await computeMockCompositionSemanticHash(input),
    await computeMockCompositionSemanticHash({ ...input, items: [...input.items].reverse() }),
  );
  assert.notEqual(
    await computeMockCompositionSemanticHash(input),
    await computeMockCompositionSemanticHash({ ...input, items: input.items.map((item) => ({ ...item, possibleScore: item.possibleScore + 1 })) }),
  );
});

test("legacy event rows remain formally ineligible without guessed backfill", () => {
  assert.equal(legacyLearningEventEligibility.questionAttempt, "LEGACY_VERSION_UNKNOWN_NOT_ELIGIBLE_FOR_FORMAL_EVIDENCE");
  assert.equal(legacyLearningEventEligibility.mockAttempt, "LEGACY_COMPOSITION_UNKNOWN_NOT_ELIGIBLE_FOR_FORMAL_EVIDENCE");
});
