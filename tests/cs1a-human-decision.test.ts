import assert from "node:assert/strict";
import test from "node:test";
import {
  CS1A_HUMAN_DECISION_HASH_V1,
  buildCanonicalHumanDecisionProjection,
  buildHumanDecisionArtifact,
  computeHumanDecisionHash,
  verifyHumanDecisionArtifact,
  type Cs1aHumanDecisionSubject,
  type Cs1aHumanDecisionInput,
} from "../lib/policy/cs1a-human-decision.ts";
import { canonicalJson } from "../lib/policy/canonical-json.ts";

const hash = "a".repeat(64);

function subject(overrides: Partial<Cs1aHumanDecisionSubject> = {}): Cs1aHumanDecisionSubject {
  return {
    governanceScope: "TEST_SCOPE",
    resourceType: "CONTENT_REVISION" as const,
    resourceId: "resource-1",
    resourceRevisionId: "resource-1:revision:1",
    contentHash: hash,
    revisionHash: "b".repeat(64),
    policyVersion: "CS1A_POLICY_V1" as const,
    decision: "ALLOW_CANONICAL" as const,
    reasonCode: "AUTHORIZED_PROSPECTIVE_ORIGINAL" as const,
    rightsDisposition: "ORIGINAL_INTERNAL" as const,
    currentnessDisposition: "CURRENT" as const,
    authoringOrigin: "SECURIUM_ADMIN_CMS" as const,
    contentClass: "PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED" as const,
    sourceOrigin: "NONE_NOT_APPLICABLE" as const,
    publicationAuthority: "NOT_GRANTED" as const,
    ...overrides,
  };
}

function input(subjects = [subject()]): Cs1aHumanDecisionInput {
  return { contractVersion: CS1A_HUMAN_DECISION_HASH_V1, subjects };
}

test("V1 is deterministic and input order independent", () => {
  const a = input([subject({ resourceId: "b" }), subject({ resourceId: "a", resourceRevisionId: "a:revision:1" })]);
  const b = input([...a.subjects].reverse());
  assert.equal(computeHumanDecisionHash(a), computeHumanDecisionHash(b));
  assert.equal(canonicalJson(buildCanonicalHumanDecisionProjection(a)), canonicalJson(buildCanonicalHumanDecisionProjection(b)));
});

test("V1 rejects malformed sets and values", () => {
  assert.throws(() => buildCanonicalHumanDecisionProjection(input([])), /HumanDecisionHash/);
  assert.throws(() => buildCanonicalHumanDecisionProjection(input([subject(), subject()])), /HumanDecisionHash/);
  assert.throws(() => buildCanonicalHumanDecisionProjection(input([subject({ decision: "UNKNOWN" as never })])), /HumanDecisionHash/);
  assert.throws(() => buildCanonicalHumanDecisionProjection(input([subject({ revisionHash: "bad" })])), /HumanDecisionHash/);
  assert.throws(() => buildCanonicalHumanDecisionProjection(input([subject({ sourceOrigin: "KNOWN_EXTERNAL_SOURCE", sourceAuthority: null })])), /HumanDecisionHash/);
});

test("every governed semantic mutation changes the identity", () => {
  const base = input();
  const fields = [
    ["governanceScope", "OTHER_SCOPE"], ["resourceType", "QUESTION"], ["resourceId", "other"],
    ["resourceRevisionId", "other:revision:2"], ["contentHash", "c".repeat(64)], ["revisionHash", "d".repeat(64)],
    ["decision", "DENY"], ["reasonCode", "POLICY_DENY"], ["rightsDisposition", "REVIEW_REQUIRED"],
    ["currentnessDisposition", "HISTORICAL"], ["authoringOrigin", "LEGACY"], ["contentClass", "LEGACY_REVIEW_REQUIRED"],
    ["publicationAuthority", "NOT_APPLICABLE"],
  ] as const;
  for (const [field, value] of fields) {
    assert.notEqual(computeHumanDecisionHash(base), computeHumanDecisionHash(input([subject({ [field]: value })])));
  }
});

test("source fields, policy, subject cardinality, and scope are bound", () => {
  const sourced = subject({ sourceOrigin: "KNOWN_EXTERNAL_SOURCE", sourceAuthority: "Official authority", sourceManifestRef: "manifest-v1", sourceSetHash: "c".repeat(64) });
  assert.notEqual(computeHumanDecisionHash(input()), computeHumanDecisionHash(input([sourced])));
  assert.notEqual(computeHumanDecisionHash(input()), computeHumanDecisionHash(input([subject(), subject({ resourceId: "resource-2", resourceRevisionId: "resource-2:revision:1" })])));
});

test("artifact replay and non-semantic metadata separation work", () => {
  const first = buildHumanDecisionArtifact(input(), { generatedAt: "2026-08-27T00:00:00.000Z", legacyDecisionRef: "legacy-1" });
  const second = buildHumanDecisionArtifact(input(), { generatedAt: "2027-01-01T00:00:00.000Z", legacyDecisionRef: "legacy-2" });
  assert.equal(first.humanDecisionHash, second.humanDecisionHash);
  assert.equal(verifyHumanDecisionArtifact(first), first.humanDecisionHash);
  assert.throws(() => verifyHumanDecisionArtifact({ ...first, humanDecisionHash: "f".repeat(64) }));
});

test("ISE-like, PIA-like, and third-domain fixtures use one constructor", () => {
  const fixtures = [
    input([subject({ resourceId: "ise-1" }), subject({ resourceId: "ise-2", resourceRevisionId: "ise-2:revision:1" })]),
    input(Array.from({ length: 8 }, (_, index) => subject({ governanceScope: "PIA", resourceId: `pia-${index + 1}`, resourceRevisionId: `pia-${index + 1}:revision:1`, reasonCode: "REVIEW_REQUIRED", rightsDisposition: "REVIEW_REQUIRED", contentClass: "REVIEW_REQUIRED_EXTERNAL_SOURCE" }))),
    input([subject({ governanceScope: "THIRD_DOMAIN", resourceId: "third-1" })]),
  ];
  for (const fixture of fixtures) assert.match(computeHumanDecisionHash(fixture), /^[0-9a-f]{64}$/);
});
