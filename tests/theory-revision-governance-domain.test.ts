import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTheoryRevisionCandidate,
  computeTheoryRevisionSemanticHash,
  stableJson,
} from "../lib/services/content-revision-service.ts";

const base = {
  canonicalKey: "theory.swsec.test",
  contentId: "content-swsec-test",
  version: "1.0.0",
  title: "Governed Theory",
  body: "독립적으로 작성된 학습 본문입니다.",
  bodyFormat: "MARKDOWN" as const,
  learningObjectives: ["경계를 설명한다."],
  examples: [{ safe: true }],
  selfChecks: ["어떤 경계를 검토해야 하는가?"],
  conceptMappings: [{ conceptKey: "ontology:swsec:test", conceptId: null, qualificationJson: "{}", provenanceJson: "{}" }],
  governance: {
    blueprintId: "bp.swsec.test",
    humanReviewHash: "a".repeat(64),
    humanReviewedBy: "actor-1",
    humanReviewedAt: "2026-08-21T00:00:00.000Z",
    rightsStatus: "PASS_ORIGINAL" as const,
    authoringOrigin: "SECURIUM_ORIGINAL" as const,
    copyrightStatus: "PASS_ORIGINAL" as const,
    restrictedPdfGenerationInput: false as const,
    qualificationJson: "{}",
    provenanceJson: "{}",
    lifecycle: "CANONICAL_UNPUBLISHED" as const,
  },
};

test("Theory semantic JSON is deterministic and excludes operational identity", async () => {
  assert.equal(stableJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
  const first = await computeTheoryRevisionSemanticHash(base);
  const reordered = await computeTheoryRevisionSemanticHash({ ...base, governance: { ...base.governance } });
  assert.equal(first, reordered);
});

test("Theory governance rejects non-original or restricted authoring", () => {
  assert.doesNotThrow(() => assertTheoryRevisionCandidate(base, "actor-1"));
  assert.throws(() => assertTheoryRevisionCandidate({ ...base, governance: { ...base.governance, restrictedPdfGenerationInput: true } as never }, "actor-1"), /governance validation/);
  assert.throws(() => assertTheoryRevisionCandidate({ ...base, governance: { ...base.governance, rightsStatus: "REQUIRED" } as never }, "actor-1"), /governance validation/);
  assert.throws(() => assertTheoryRevisionCandidate({ ...base, governance: { ...base.governance, humanReviewHash: "" } as never }, "actor-1"), /governance validation/);
  assert.throws(() => assertTheoryRevisionCandidate({ ...base, governance: { ...base.governance, provenanceJson: "not-json" } as never }, "actor-1"), /governance validation/);
});
