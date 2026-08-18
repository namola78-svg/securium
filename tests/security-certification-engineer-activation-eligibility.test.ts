import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCurrentEngineerBetaActivationInput,
  ENGINEER_BETA_ACTIVATION_BLOCKER_CODES,
  evaluateEngineerBetaActivationEligibility,
} from "../lib/curriculum/security-certification-activation-eligibility.ts";

function currentInput() {
  return buildCurrentEngineerBetaActivationInput({ now: "2026-08-18" });
}

function codes(input = currentInput()) {
  return evaluateEngineerBetaActivationEligibility(input).blockers.map(
    (blocker) => blocker.code,
  );
}

test("accepts the exact authenticated Engineer registry identities structurally", () => {
  const input = currentInput();
  const result = evaluateEngineerBetaActivationEligibility(input);

  assert.equal(result.stats.expectedRegistryNodeCount, 81);
  assert.equal(result.stats.actualRegistryNodeCount, 81);
  assert.equal(result.stats.requiredLearningNodeCount, 79);
  assert.equal(codes(input).includes("REGISTRY_NODE_MISSING"), false);
  assert.equal(codes(input).includes("REGISTRY_NODE_DUPLICATE"), false);
  assert.equal(codes(input).includes("REGISTRY_PARENT_INVALID"), false);
  assert.equal(codes(input).includes("REGISTRY_COURSE_TREE_MISMATCH"), false);
});

test("fails closed when an official registry node is missing", () => {
  const input = currentInput();
  input.actual.nodes.pop();
  assert.equal(codes(input).includes("REGISTRY_NODE_MISSING"), true);
});

test("fails closed when stable keys or node IDs are duplicated", () => {
  const stableKeyInput = currentInput();
  stableKeyInput.actual.nodes.push({
    ...stableKeyInput.actual.nodes[0],
    id: "curriculum-node-ise-duplicate-for-test",
  });
  assert.equal(
    codes(stableKeyInput).includes("REGISTRY_STABLE_KEY_DUPLICATE"),
    true,
  );

  const nodeIdInput = currentInput();
  nodeIdInput.actual.nodes.push({ ...nodeIdInput.actual.nodes[0] });
  assert.equal(codes(nodeIdInput).includes("REGISTRY_NODE_DUPLICATE"), true);
});

test("fails closed for wrong Course, tree ownership, or parent identity", () => {
  const courseInput = currentInput();
  courseInput.actual.courseId = "course-isie";
  assert.equal(codes(courseInput).includes("REGISTRY_COURSE_TREE_MISMATCH"), true);

  const treeInput = currentInput();
  treeInput.actual.nodes[1].treeId = "curriculum-isie-2027-2029-official";
  assert.equal(codes(treeInput).includes("REGISTRY_COURSE_TREE_MISMATCH"), true);

  const parentInput = currentInput();
  parentInput.actual.nodes[1].parentId = null;
  assert.equal(codes(parentInput).includes("REGISTRY_PARENT_INVALID"), true);
});

test("unplaced required learning nodes make the current registry ineligible", () => {
  const result = evaluateEngineerBetaActivationEligibility(currentInput());
  const blocker = result.blockers.find(
    (candidate) => candidate.code === "REQUIRED_LEARNING_NODE_UNPLACED",
  );

  assert.ok(blocker);
  assert.deepEqual(blocker.entityIds, [
    "curriculum-node-ise-2027-2029-01-03-ec",
    "curriculum-node-ise-2027-2029-01-03-ec-01",
  ]);
  assert.equal(result.stats.unplacedRequiredNodeCount, 2);
});

test("zero and ambiguous required Question placement block Beta activation", () => {
  const result = evaluateEngineerBetaActivationEligibility(currentInput());
  const zero = result.blockers.find(
    (candidate) => candidate.code === "QUESTION_ZERO_TARGET",
  );
  const ambiguous = result.blockers.find(
    (candidate) => candidate.code === "QUESTION_AMBIGUOUS_TARGET",
  );

  assert.ok(zero);
  assert.deepEqual(zero.entityIds, ["practical-security-official-subitem-q09"]);
  assert.ok(ambiguous);
  assert.equal(ambiguous.entityIds.length, 49);
  assert.equal(result.stats.zeroTargetQuestionCount, 1);
  assert.equal(result.stats.ambiguousQuestionCount, 49);
});

test("legitimate shared Content is a warning, not cross-course contamination", () => {
  const result = evaluateEngineerBetaActivationEligibility(currentInput());

  assert.equal(result.stats.crossCourseSharedContentCount, 64);
  assert.equal(result.stats.crossCourseInvalidCount, 0);
  assert.equal(
    result.blockers.some(
      (blocker) => blocker.code === "CROSS_COURSE_PLACEMENT_INVALID",
    ),
    false,
  );
  assert.equal(
    result.warnings.some((warning) => warning.code === "LEGITIMATE_SHARED_CONTENT"),
    true,
  );
});

test("title drift remains a warning and stable IDs remain authoritative", () => {
  const result = evaluateEngineerBetaActivationEligibility(currentInput());
  const warning = result.warnings.find(
    (candidate) => candidate.code === "SEMANTIC_TITLE_DRIFT",
  );

  assert.ok(warning);
  assert.equal(warning.entityIds.length, 3);
  assert.equal(result.stats.titleDriftCount, 3);
  assert.equal(result.blockers.some((blocker) => blocker.code.includes("TITLE")), false);
});

test("future-dated source is bound correctly and warns without becoming the only blocker", () => {
  const result = evaluateEngineerBetaActivationEligibility(currentInput());

  assert.equal(
    result.blockers.some((blocker) => blocker.code === "SOURCE_BINDING_INVALID"),
    false,
  );
  assert.equal(
    result.blockers.some((blocker) => blocker.code === "EFFECTIVE_PERIOD_INVALID"),
    false,
  );
  assert.equal(
    result.warnings.some((warning) => warning.code === "SOURCE_NOT_YET_EFFECTIVE"),
    true,
  );
});

test("Page Provenance and rights remain explicit separately governed blockers", () => {
  const incomplete = codes(currentInput());
  assert.equal(incomplete.includes("PAGE_PROVENANCE_INCOMPLETE"), true);
  assert.equal(incomplete.includes("RIGHTS_REVIEW_INCOMPLETE"), true);

  const completeInput = buildCurrentEngineerBetaActivationInput({
    now: "2027-01-01",
    pageProvenance: "COMPLETE",
    rightsReview: "COMPLETE",
  });
  const completeEvidenceCodes = codes(completeInput);
  assert.equal(completeEvidenceCodes.includes("PAGE_PROVENANCE_INCOMPLETE"), false);
  assert.equal(completeEvidenceCodes.includes("RIGHTS_REVIEW_INCOMPLETE"), false);
});

test("unknown evidence fails closed", () => {
  const input = buildCurrentEngineerBetaActivationInput({
    now: "2026-08-18",
    pageProvenance: "UNKNOWN",
    rightsReview: "UNKNOWN",
  });
  assert.equal(codes(input).includes("UNKNOWN_VALIDATION_STATE"), true);
});

test("the current real Engineer tree remains ineligible for the exact blocker set", () => {
  const result = evaluateEngineerBetaActivationEligibility(currentInput());

  assert.equal(result.eligible, false);
  assert.deepEqual(
    result.blockers.map((blocker) => blocker.code),
    [
      "REQUIRED_LEARNING_NODE_UNPLACED",
      "QUESTION_ZERO_TARGET",
      "QUESTION_AMBIGUOUS_TARGET",
      "PAGE_PROVENANCE_INCOMPLETE",
      "RIGHTS_REVIEW_INCOMPLETE",
    ],
  );
  assert.equal(ENGINEER_BETA_ACTIVATION_BLOCKER_CODES.length, 15);
  assert.deepEqual(result.stats, {
    expectedRegistryNodeCount: 81,
    actualRegistryNodeCount: 81,
    requiredLearningNodeCount: 79,
    unplacedRequiredNodeCount: 2,
    courseLessonCount: 80,
    questionCount: 81,
    zeroTargetQuestionCount: 1,
    ambiguousQuestionCount: 49,
    crossCourseSharedContentCount: 64,
    crossCourseInvalidCount: 0,
    titleDriftCount: 3,
  });
});
