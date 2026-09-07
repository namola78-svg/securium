import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { evaluateReviewerSeparation, CONTENT_REVIEWER_SEPARATION_POLICY_V1, isReviewerCompletenessSatisfied } from "../lib/policy/content-reviewer-separation.ts";

const base = {
  reviewedInputIdentity: "a".repeat(64), resourceType: "CONTENT_REVISION", resourceId: "revision-1",
  reviewer: { id: "reviewer-b", roles: ["CONTENT_REVIEWER"] }, authorUserId: "author-a", ownerUserId: null,
  materialEditorUserIds: [], provenanceClass: "KNOWN_AUTHOR" as const, riskClass: "STANDARD" as const,
  requiredReviewerCount: 1 as const,
};

test("policy version is server-owned and independent reviewer is allowed", () => {
  const result = evaluateReviewerSeparation({ ...base, policyVersion: CONTENT_REVIEWER_SEPARATION_POLICY_V1 });
  assert.equal(result.result, "ALLOW");
  assert.match(result.semanticIdentity, /^[a-f0-9]{64}$/);
});

test("author, owner, and material editor self-review fail closed", () => {
  assert.equal(evaluateReviewerSeparation({ ...base, reviewer: { id: "author-a", roles: ["ADMIN"] } }).result, "DENY");
  assert.equal(evaluateReviewerSeparation({ ...base, ownerUserId: "reviewer-b" }).result, "DENY");
  assert.equal(evaluateReviewerSeparation({ ...base, materialEditorUserIds: ["reviewer-b"] }).result, "DENY");
});

test("unknown author requires an owner attestation and high-risk review requires two reviewers", () => {
  const missingOwner = evaluateReviewerSeparation({ ...base, provenanceClass: "UNKNOWN_AUTHOR", requiredReviewerCount: 2 });
  assert.equal(missingOwner.result, "DENY");
  const complete = evaluateReviewerSeparation({ ...base, provenanceClass: "UNKNOWN_AUTHOR", ownerAttestationId: "owner-attestation-1", requiredReviewerCount: 2, reviewerSlot: 1 });
  assert.equal(complete.result, "ALLOW");
  assert.equal(complete.reviewerSlot, 1);
});

test("dual review requires two distinct policy-valid reviewers", () => {
  const first = evaluateReviewerSeparation({ ...base, provenanceClass: "UNKNOWN_AUTHOR", ownerAttestationId: "owner-attestation-1", requiredReviewerCount: 2, reviewer: { id: "reviewer-b", roles: ["CONTENT_REVIEWER"] } });
  const same = evaluateReviewerSeparation({ ...base, provenanceClass: "UNKNOWN_AUTHOR", ownerAttestationId: "owner-attestation-1", requiredReviewerCount: 2, reviewer: { id: "reviewer-b", roles: ["CONTENT_REVIEWER"] } });
  const second = evaluateReviewerSeparation({ ...base, provenanceClass: "UNKNOWN_AUTHOR", ownerAttestationId: "owner-attestation-1", requiredReviewerCount: 2, reviewer: { id: "reviewer-c", roles: ["CONTENT_REVIEWER"] } });
  assert.equal(isReviewerCompletenessSatisfied([first, same]), false);
  assert.equal(isReviewerCompletenessSatisfied([first, second]), true);
});

test("caller-controlled policy and emergency fields are not part of the evaluator contract", () => {
  const source = readFileSync("lib/policy/content-reviewer-separation.ts", "utf8");
  assert.doesNotMatch(source, /emergencyOverride|dualReviewSatisfied|independent\s*:/);
  assert.throws(() => evaluateReviewerSeparation({ ...base, policyVersion: "CONTENT_REVIEWER_SEPARATION_POLICY_V2" as never }), /Unsupported reviewer separation policy/);
});

test("schema and migrations define canonical append-only policy tables with restricted access", () => {
  const migration = readFileSync("db/postgres/migrations/0025_content_reviewer_separation_policy.sql", "utf8");
  assert.match(migration, /content_review_owner_attestations/);
  assert.match(migration, /content_review_policy_evaluations/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL PRIVILEGES/);
  assert.match(migration, /no_update/);
});

test("Secure Coding qualification closure is review-derived, not claim-count authority", () => {
  const evidence = readFileSync("lib/services/secure-coding-final-review-evidence.ts", "utf8");
  assert.match(evidence, /byDomain\.SUPPORT_QUALIFICATION/);
  assert.doesNotMatch(evidence, /qualificationClosed:\s*current\.snapshot\.qualificationRequired/);
});
