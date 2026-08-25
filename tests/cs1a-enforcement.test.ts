import test from "node:test";
import assert from "node:assert/strict";
import { assertCs1aMutationAllowed, assertCs1aPublicationAllowed } from "../lib/policy/cs1a-mutation-gate.ts";
import { CS1A_AUTHORITY_HASH, CS1A_POLICY_VERSION } from "../lib/policy/cs1a-contract.ts";

const valid = {
  policyVersion: CS1A_POLICY_VERSION,
  contentClass: "PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED" as const,
  operation: "DRAFT_MUTATION" as const,
  sourcePackageIdentity: "fixture",
  sourceAuthority: "fixture-authority",
  authorityHash: CS1A_AUTHORITY_HASH,
  rightsDisposition: "original",
  reviewStatus: "reviewed",
  provenance: { fixture: true },
};

test("CS1A-05/06/07/08 deny before mutation callback and preserve zero count", () => {
  let mutationCount = 0;
  assert.throws(() => {
    assertCs1aMutationAllowed(undefined, "CANONICAL_MUTATION");
    mutationCount += 1;
  }, (error: unknown) => (error as { code?: string }).code === "CS1A_POLICY_CONTEXT_MISSING");
  assert.equal(mutationCount, 0);
});

test("CS1A-03 MUST_EXCLUDE and CS1A-13 legacy transitions fail closed", () => {
  for (const contentClass of ["MUST_EXCLUDE", "LEGACY_REVIEW_REQUIRED"] as const) {
    assert.throws(() => assertCs1aMutationAllowed({ ...valid, contentClass }, "CANONICAL_MUTATION"), (error: unknown) => String((error as { code?: string }).code).startsWith("CS1A_"));
  }
});

test("CS1A-09 publication permission is distinct from draft permission", () => {
  assert.throws(() => assertCs1aPublicationAllowed(valid), (error: unknown) => (error as { code?: string }).code === "CS1A_PUBLICATION_PERMISSION_REQUIRED");
  assert.doesNotThrow(() => assertCs1aPublicationAllowed({ ...valid, operation: "PUBLICATION", publicationPermission: true }));
});

test("CS1A-15 valid decision is deterministic except evaluation timestamp", () => {
  const a = assertCs1aMutationAllowed(valid, "DRAFT_MUTATION");
  const b = assertCs1aMutationAllowed(valid, "DRAFT_MUTATION");
  assert.deepEqual({ ...a, evaluatedAt: "" }, { ...b, evaluatedAt: "" });
});
