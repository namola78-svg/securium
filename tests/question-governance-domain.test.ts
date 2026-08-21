import assert from "node:assert/strict";
import test from "node:test";
import {
  assertGovernanceInput,
  computeQuestionSemanticHash,
  stableJson,
} from "../lib/services/question-governance.ts";

const governance = {
  blueprintId: "bp.swsec.input.sql-injection",
  qualificationJson: JSON.stringify({ context: "server-side SQL query" }),
  provenanceJson: JSON.stringify({ propositions: ["prop.swsec.input.validation"] }),
  governanceJson: JSON.stringify({
    authoringOrigin: "ORIGINAL_AI_ASSISTED_AUTHORING",
    rightsStatus: "PASS",
    similarityStatus: "PASS_LOW_SIMILARITY",
  }),
};

const projection = (reverse = false) => ({
  id: "swsec-test-identity",
  version: 1,
  title: "Governed question",
  content: "Which control is required?",
  type: "SINGLE_CHOICE",
  difficulty: "EASY",
  explanation: "The control binds the reviewed semantic version.",
  wrongAnswerExplanation: "The alternatives do not establish the required control.",
  answerConfigJson: {},
  source: null,
  sourceDate: null,
  choices: (reverse ? [2, 1] : [1, 2]).map((displayOrder) => ({
    content: `Choice ${displayOrder}`,
    displayOrder,
    isCorrect: displayOrder === 1,
    explanation: "",
  })),
  courseIds: reverse ? ["course-b", "course-a"] : ["course-a", "course-b"],
  conceptMappings: [{ conceptId: "concept-a", mappingStatus: "SUGGESTED" as const }],
  governance,
});

test("semantic serialization is stable for object-key order", () => {
  assert.equal(stableJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test("semantic hash preserves ordered choices while normalizing set-like course order", async () => {
  const first = await computeQuestionSemanticHash(projection());
  const reordered = await computeQuestionSemanticHash(projection(true));
  assert.notEqual(first, reordered, "choice order is semantic");
});

test("rights and similarity governance rejects missing or blocked state", () => {
  assert.doesNotThrow(() => assertGovernanceInput(governance));
  assert.throws(
    () => assertGovernanceInput({ ...governance, governanceJson: JSON.stringify({ ...JSON.parse(governance.governanceJson), rightsStatus: "REQUIRED" }) }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "RIGHTS_REVIEW_REQUIRED",
  );
});
