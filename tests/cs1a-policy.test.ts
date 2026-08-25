import test from "node:test";
import assert from "node:assert/strict";
import {
  CS1A_AUTHORITY_HASH,
  CS1A_POLICY_VERSION,
  CS1A_CONTENT_CLASSES,
} from "../lib/policy/cs1a-contract.ts";
import { evaluateCs1aPolicy } from "../lib/policy/cs1a-policy.ts";

const valid = {
  policyVersion: CS1A_POLICY_VERSION,
  contentClass: "PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED" as const,
  operation: "DRAFT_MUTATION" as const,
  sourcePackageIdentity: "secure-coding-8h@1e01de3",
  sourceAuthority: "PR-55-MERGE-AUTHORITY",
  authorityHash: CS1A_AUTHORITY_HASH,
  rightsDisposition: "ORIGINAL_SECURIUM_AUTHORED",
  reviewStatus: "REVIEWED",
  provenance: { commit: "1e01de3a84832d80da4da0267aafb98987925ab6" },
};

test("CS1A-01 valid prospective original allows draft", () => {
  const decision = evaluateCs1aPolicy(valid);
  assert.equal(decision.decision, "ALLOW_DRAFT");
  assert.equal(decision.canonicalMutationAllowed, true);
  assert.equal(decision.publicationAllowed, false);
});

test("CS1A-02, CS1A-03, CS1A-04 deny missing, excluded, and unknown inputs", () => {
  assert.equal(evaluateCs1aPolicy({ ...valid, provenance: undefined }).decision, "DENY");
  assert.equal(evaluateCs1aPolicy({ ...valid, contentClass: "MUST_EXCLUDE" }).decision, "DENY");
  assert.equal(evaluateCs1aPolicy({ ...valid, contentClass: "NOT_A_CLASS" }).decision, "DENY");
});

test("CS1A-10, CS1A-11 reject version and provenance spoofing", () => {
  assert.equal(evaluateCs1aPolicy({ ...valid, policyVersion: "copyright-policy-v1" }).reasonCode, "POLICY_VERSION_UNSUPPORTED");
  assert.equal(evaluateCs1aPolicy({ ...valid, authorityHash: "spoofed" }).reasonCode, "AUTHORITY_HASH_INVALID");
});

test("CS1A-09 publication remains separately permissioned", () => {
  assert.equal(evaluateCs1aPolicy({ ...valid, operation: "PUBLICATION" }).decision, "DENY");
  assert.equal(evaluateCs1aPolicy({ ...valid, operation: "PUBLICATION", publicationPermission: true }).decision, "ALLOW_PUBLICATION");
});

test("CS1A taxonomy is exactly six approved classes", () => {
  assert.deepEqual(CS1A_CONTENT_CLASSES, [
    "PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED",
    "AUTHORIZED_EXTERNAL_SOURCE",
    "REVIEW_REQUIRED_EXTERNAL_SOURCE",
    "LEGACY_REVIEW_REQUIRED",
    "MUST_EXCLUDE",
    "UNKNOWN",
  ]);
});

