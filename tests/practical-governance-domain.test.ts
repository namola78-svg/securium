import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertReviewerOnlyVisibility,
  comparePracticalGovernanceReplay,
  hashPracticalGovernanceSemantics,
  validateLifecycleTransition,
  validatePracticalGovernanceInput,
} from "../lib/practical/practical-governance-validation.ts";

const digest = "a".repeat(64);
const base = {
  practicalId: "practical.swsec.input.command-resource",
  semanticKey: "practical.swsec.input.command-resource",
  practicalVersionId: "pv-1",
  version: 1,
  semanticHash: digest,
  humanReviewHash: "b".repeat(64),
  safetyReviewHash: "c".repeat(64),
  rightsBinding: "SECURIUM_ORIGINAL:PASS_ORIGINAL",
  provenanceBinding: "official:swsec:command-resource:v1",
  conceptMappingHash: "d".repeat(64),
  theoryDependencyJson: '{"state":"NO_HARD_THEORY_PREREQUISITE"}',
  currentnessReference: "source:current:swsec",
  lifecycle: "DRAFT" as const,
  createdBy: "actor-reviewer",
  rubricVersionId: "rv-1",
  rubricId: "rubric:swsec:command-resource",
  rubricVersion: 1,
  evaluationSemanticHash: "e".repeat(64),
  evaluationMethod: "HYBRID" as const,
  evidenceClassification: "ELIGIBLE_PERFORMANCE_EVIDENCE" as const,
  rubricSnapshotJson: "{}",
  rubricSnapshotDigest: "f".repeat(64),
  reviewerMaterialId: "rm-1",
  reviewerMaterialJson: '{"reference":"server-only"}',
  reviewerMaterialDigest: "1".repeat(64),
  conceptBindings: [{ id: "cb-1", conceptKey: "swsec.input.command-resource", mappingSemanticHash: "2".repeat(64), qualificationJson: "{}" }],
};

test("valid NEW_SUCCESS package is accepted", () => assert.equal(validatePracticalGovernanceInput(base).semanticKey, base.semanticKey));
test("EXACT_REPLAY compares every governed semantic hash", () => assert.equal(comparePracticalGovernanceReplay(base, base), "EXACT_REPLAY"));
test("CONFLICT rejects changed semantic hash", () => assert.equal(comparePracticalGovernanceReplay(base, { ...base, semanticHash: "3".repeat(64) }), "CONFLICT"));
test("NEW_VERSION_REQUIRED is represented by a higher immutable version", () => assert.equal(validatePracticalGovernanceInput({ ...base, version: 2, practicalVersionId: "pv-2", semanticHash: "4".repeat(64) }).version, 2));
test("missing human review fails closed", () => assert.throws(() => validatePracticalGovernanceInput({ ...base, humanReviewHash: "0".repeat(64) }), /HUMAN_REVIEW_BINDING_REQUIRED/));
test("missing safety review fails closed", () => assert.throws(() => validatePracticalGovernanceInput({ ...base, safetyReviewHash: "0".repeat(64) }), /SAFETY_REVIEW_BINDING_REQUIRED/));
test("missing rights fails closed", () => assert.throws(() => validatePracticalGovernanceInput({ ...base, rightsBinding: "" }), /GOVERNANCE_BINDING_REQUIRED/));
test("missing provenance fails closed", () => assert.throws(() => validatePracticalGovernanceInput({ ...base, provenanceBinding: "" }), /GOVERNANCE_BINDING_REQUIRED/));
test("invalid Concept mapping fails closed", () => assert.throws(() => validatePracticalGovernanceInput({ ...base, conceptBindings: [] }), /CONCEPT_MAPPING_REQUIRED/));
test("invalid Theory dependency fails closed", () => assert.throws(() => validatePracticalGovernanceInput({ ...base, theoryDependencyJson: "" }), /THEORY_DEPENDENCY_REQUIRED/));
test("legacy upgrade without binding is rejected", () => assert.throws(() => validatePracticalGovernanceInput({ ...base, humanReviewHash: "0".repeat(64) }), /HUMAN_REVIEW_BINDING_REQUIRED/));
test("invalid lifecycle transition fails closed", () => assert.throws(() => validateLifecycleTransition({ from: "DRAFT", to: "SUPERSEDED" }), /INVALID_PRACTICAL_GOVERNANCE_LIFECYCLE_TRANSITION/));
test("approved-unpublished transition is valid", () => validateLifecycleTransition({ from: "HUMAN_APPROVED", to: "CANONICAL_UNPUBLISHED" }));
test("supersession transition is valid", () => validateLifecycleTransition({ from: "CANONICAL_UNPUBLISHED", to: "SUPERSEDED" }));
test("reviewer visibility is fixed to server-only", () => assertReviewerOnlyVisibility("REVIEWER_ONLY"));
test("reviewer visibility bypass fails closed", () => assert.throws(() => assertReviewerOnlyVisibility("LEARNER"), /REVIEWER_MATERIAL_VISIBILITY_DENIED/));
test("semantic hash is deterministic", () => assert.equal(hashPracticalGovernanceSemantics({ b: 2, a: 1 }), hashPracticalGovernanceSemantics({ a: 1, b: 2 })));
