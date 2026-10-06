import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTOMATED_EVIDENCE_CONTRACT_VERSION, REQUIRED_ORIGINALITY_CHECKS,
  assertVerifiedProvenanceEvidenceDigest, compareAutomatedEvidenceMemberSet,
  compareAutomatedEvidenceToExpectedCandidate, computeAutomatedIndependentAuthoringEvidenceIdentity,
  computeVerifiedProvenanceEvidenceDigest, evaluateIndependentAuthoringEvidence,
  evaluateVerifiedIndependentAuthoringEvidence, normalizeAutomatedIndependentAuthoringEvidence,
} from "../lib/policy/automated-independent-authoring-evidence.ts";

const h = (char: string) => char.repeat(64);
const json = (value: unknown) => JSON.stringify(value);
function fixture() {
  const provenanceStatement = { status: "VERIFIED" as const, authoringOrigin: "SECURIUM_INDEPENDENT_AUTHORING" as const, verifierIdentity: "claimed-resolver", statementIdentity: "statement-1" };
  return {
    contractVersion: AUTOMATED_EVIDENCE_CONTRACT_VERSION,
    approvalMode: "INDEPENDENT_AUTHORING_AUTOMATED",
    policyVersion: "SECURIUM_AUTOMATED_INDEPENDENT_AUTHORING_POLICY_V1",
    evaluatorIdentity: "claimed-evaluator", evaluatorVersion: "1", evaluatedAt: "2026-10-06T00:00:00.000Z",
    // These raw claims are intentionally ignored by normalization and evaluation.
    evaluationResult: "ALLOW", reasonCodes: [],
    candidate: { type: "QUESTION", resource: "python-8h", identity: "candidate-1", version: "2", semanticHash: h("a") },
    package: { identity: "package-1", semanticHash: h("b") },
    subject: { identity: "subject-1", hash: h("c") },
    provenance: { identity: "provenance-1", claimedAuthoringOrigin: "SECURIUM_INDEPENDENT_AUTHORING", verifiedEvidence: { ...provenanceStatement, evidenceDigest: computeVerifiedProvenanceEvidenceDigest(json(provenanceStatement)) } },
    sourceSet: { identity: "sources-1", digest: h("d"), completeness: "COMPLETE", expressionReuse: "NOT_USED", facts: [{ sourceIdentity: "fact-source", sourceDigest: h("e"), use: "FACT_VERIFICATION", verificationResult: "PASS" }] },
    publicationAuthority: "NOT_GRANTED",
    members: [
      { memberIdentity: "m1", memberVersion: "1", semanticHash: h("f"), semanticOrdinal: 0 },
      { memberIdentity: "m2", memberVersion: "1", semanticHash: h("0"), semanticOrdinal: 1 },
      { memberIdentity: "m3", memberVersion: "1", semanticHash: h("9"), semanticOrdinal: 2 },
    ],
    originalityChecks: REQUIRED_ORIGINALITY_CHECKS.map(checkType => ({ checkType, checkVersion: "1", result: "PASS", evidenceDigest: h("1"), corpusIdentity: "corpus-v1" })),
  };
}

test("fully PASS-looking raw evidence never produces ALLOW", () => {
  assert.deepEqual(evaluateIndependentAuthoringEvidence(json(fixture())), { result: "DENY", reasonCodes: ["AUTOMATED_VERIFICATION_REQUIRED"] });
});
test("caller verified flag and correct digest remain untrusted; digest proves consistency only", () => {
  const evidence = fixture().provenance.verifiedEvidence;
  assertVerifiedProvenanceEvidenceDigest(json(evidence));
  assert.deepEqual(evaluateIndependentAuthoringEvidence(json(fixture())).result, "DENY");
  assert.throws(() => assertVerifiedProvenanceEvidenceDigest(json({ ...evidence, evidenceDigest: h("8") })), /AUTOMATED_PROVENANCE_EVIDENCE_DIGEST_MISMATCH/);
});
test("forged object, including a structurally typed verified-looking object, fails the runtime guard", () => {
  assert.deepEqual(evaluateVerifiedIndependentAuthoringEvidence(fixture()), { result: "DENY", reasonCodes: ["AUTOMATED_VERIFICATION_REQUIRED"] });
  assert.deepEqual(evaluateVerifiedIndependentAuthoringEvidence({ ...fixture(), verificationState: "VERIFIED" }), { result: "DENY", reasonCodes: ["AUTOMATED_VERIFICATION_REQUIRED"] });
});
test("normalization is unverified and caller-supplied result and reason codes are ignored", () => {
  const normalized = normalizeAutomatedIndependentAuthoringEvidence(json({ ...fixture(), evaluationResult: "ALLOW", reasonCodes: ["caller-reason"] }));
  assert.equal(normalized.verificationState, "UNVERIFIED");
  assert.equal(normalized.evaluationResult, "DENY");
  assert.deepEqual(normalized.reasonCodes, ["AUTOMATED_VERIFICATION_REQUIRED"]);
  assert.deepEqual(evaluateIndependentAuthoringEvidence(json({ ...fixture(), evaluationResult: "DENY", reasonCodes: [] })).result, "DENY");
});
test("a self-declared internally valid subset does not establish complete membership", () => {
  const raw = { ...fixture(), members: fixture().members.slice(0, 2) };
  const normalized = normalizeAutomatedIndependentAuthoringEvidence(json(raw));
  assert.equal(normalized.members.length, 2);
  assert.equal(normalized.verificationState, "UNVERIFIED");
  assert.equal(evaluateIndependentAuthoringEvidence(json(raw)).result, "DENY");
});
test("member comparator rejects subset, additions, reorder, hash/version changes and duplicates", () => {
  const expected = fixture().members;
  assert.equal(compareAutomatedEvidenceMemberSet(json(expected.slice(0, 2)), json(expected)).result, "MISMATCH");
  assert.equal(compareAutomatedEvidenceMemberSet(json([...expected, { ...expected[0] }]), json(expected)).result, "MISMATCH");
  assert.equal(compareAutomatedEvidenceMemberSet(json([...expected].reverse()), json(expected)).result, "MISMATCH");
  assert.equal(compareAutomatedEvidenceMemberSet(json(expected.map((m, i) => i ? m : { ...m, semanticHash: h("8") })), json(expected)).result, "MISMATCH");
  assert.equal(compareAutomatedEvidenceMemberSet(json(expected.map((m, i) => i ? m : { ...m, memberVersion: "2" })), json(expected)).result, "MISMATCH");
});
test("exact full member comparison returns MATCH only and grants no trust", () => {
  const members = fixture().members;
  assert.deepEqual(compareAutomatedEvidenceMemberSet(json(members), json(members)), { result: "MATCH" });
  assert.deepEqual(evaluateIndependentAuthoringEvidence(json(fixture())).result, "DENY");
});
test("expected candidate comparison checks exact fields and does not authenticate expected data", () => {
  const evidence = fixture();
  const expected = { candidate: evidence.candidate, packageIdentity: evidence.package.identity, packageSemanticHash: evidence.package.semanticHash, subjectIdentity: evidence.subject.identity, subjectHash: evidence.subject.hash, completeOrderedMembers: evidence.members };
  assert.equal(compareAutomatedEvidenceToExpectedCandidate(json(evidence), json(expected)), true);
  assert.equal(compareAutomatedEvidenceToExpectedCandidate(json({ ...evidence, members: evidence.members.slice(0, 2) }), json(expected)), false);
  assert.equal(compareAutomatedEvidenceToExpectedCandidate(json(evidence), json({ ...expected, candidate: { ...expected.candidate, version: "3" } })), false);
  assert.equal(compareAutomatedEvidenceToExpectedCandidate(json(evidence), json({ ...expected, packageIdentity: "other-package" })), false);
  assert.equal(evaluateIndependentAuthoringEvidence(json(evidence)).result, "DENY");
});
test("normalization copies nested input and freezes only its own snapshot", () => {
  const input = fixture();
  const member = input.members[0]; const provenance = input.provenance;
  const normalized = normalizeAutomatedIndependentAuthoringEvidence(json(input));
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(input.members), false);
  assert.equal(Object.isFrozen(member), false);
  assert.equal(Object.isFrozen(provenance), false);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.members), true);
  assert.notEqual(normalized.members[0], member);
  assert.notEqual(normalized.provenance, provenance);
});
test("object key insertion order does not change identity", () => {
  const raw = fixture();
  const reordered = Object.fromEntries(Object.entries(raw).reverse());
  assert.equal(computeAutomatedIndependentAuthoringEvidenceIdentity(json(raw)), computeAutomatedIndependentAuthoringEvidenceIdentity(json(reordered)));
});
test("contract, policy, evaluator and authority-bearing semantic mutations change identity", () => {
  const raw = fixture(); const base = computeAutomatedIndependentAuthoringEvidenceIdentity(json(raw));
  const mutations = [
    { ...raw, contractVersion: "SECURIUM_AUTOMATED_INDEPENDENT_AUTHORING_EVIDENCE_V2" },
    { ...raw, policyVersion: "SECURIUM_AUTOMATED_INDEPENDENT_AUTHORING_POLICY_V2" },
    { ...raw, evaluatorVersion: "2" },
    { ...raw, evaluatedAt: "2026-10-07T00:00:00.000Z" },
    { ...raw, package: { ...raw.package, semanticHash: h("8") } },
    { ...raw, subject: { ...raw.subject, hash: h("8") } },
    { ...raw, candidate: { ...raw.candidate, identity: "candidate-2" } },
    { ...raw, sourceSet: { ...raw.sourceSet, expressionReuse: "USED" } },
    { ...raw, sourceSet: { ...raw.sourceSet, facts: raw.sourceSet.facts.map((f, i) => i ? f : { ...f, verificationResult: "FAIL" }) } },
    { ...raw, originalityChecks: raw.originalityChecks.map((c, i) => i ? c : { ...c, evidenceDigest: h("8") }) },
    { ...raw, members: raw.members.map((m, i) => i ? m : { ...m, semanticHash: h("8") }) },
  ];
  for (const changed of mutations) assert.notEqual(computeAutomatedIndependentAuthoringEvidenceIdentity(json(changed)), base);
  assert.throws(() => computeAutomatedIndependentAuthoringEvidenceIdentity(json({ ...raw, publicationAuthority: "GRANTED" })), /AUTOMATED_PUBLICATION_AUTHORITY_NOT_GRANTED_REQUIRED/);
  assert.equal(computeAutomatedIndependentAuthoringEvidenceIdentity(json({ ...raw, evaluationResult: "DENY", reasonCodes: ["caller-reason"] })), base);
});
test("expression reuse other than NOT_USED never becomes eligible", () => {
  for (const expressionReuse of ["USED", "UNKNOWN", "UNVERIFIED", "PARTIAL", ""]) {
    assert.equal(evaluateIndependentAuthoringEvidence(json({ ...fixture(), sourceSet: { ...fixture().sourceSet, expressionReuse } })).result, "DENY");
  }
});
test("missing, duplicate, and non-PASS originality checks fail closed during normalization", () => {
  const raw = fixture();
  assert.throws(() => normalizeAutomatedIndependentAuthoringEvidence(json({ ...raw, originalityChecks: raw.originalityChecks.slice(1) })), /AUTOMATED_ORIGINALITY_CHECK_MISSING/);
  assert.throws(() => normalizeAutomatedIndependentAuthoringEvidence(json({ ...raw, originalityChecks: [...raw.originalityChecks, raw.originalityChecks[0]] })), /AUTOMATED_ORIGINALITY_CHECK_DUPLICATE/);
  for (const result of ["FAIL", "INCOMPLETE", "UNCERTAIN", "UNSUPPORTED"]) {
    assert.equal(evaluateIndependentAuthoringEvidence(json({ ...raw, originalityChecks: raw.originalityChecks.map((c, i) => i ? c : { ...c, result }) })).result, "DENY");
  }
});
test("factual verification does not imply expression reuse permission", () => {
  const raw = fixture();
  assert.equal(raw.sourceSet.facts[0]?.use, "FACT_VERIFICATION");
  assert.equal(raw.sourceSet.expressionReuse, "NOT_USED");
  assert.equal(evaluateIndependentAuthoringEvidence(json({ ...raw, sourceSet: { ...raw.sourceSet, expressionReuse: "USED" } })).result, "DENY");
});
test("invalid hashes and incomplete provenance structure fail closed", () => {
  const raw = fixture();
  assert.throws(() => normalizeAutomatedIndependentAuthoringEvidence(json({ ...raw, candidate: { ...raw.candidate, semanticHash: " BAD " } })), /AUTOMATED_HASH_INVALID/);
  assert.throws(() => normalizeAutomatedIndependentAuthoringEvidence(json({ ...raw, provenance: { identity: "p", verifiedEvidence: { status: "VERIFIED" } } })), /AUTOMATED_EVIDENCE_MALFORMED/);
});
test("non-string getter input is rejected before its getter runs", () => {
  let getterCalls = 0;
  const malicious = { get contractVersion() { getterCalls += 1; throw new Error("getter executed"); } };
  assert.throws(() => normalizeAutomatedIndependentAuthoringEvidence(malicious as unknown as string), /AUTOMATED_JSON_INPUT_REQUIRED/);
  assert.equal(getterCalls, 0);
});
test("non-string Proxy input is rejected without invoking any Proxy traps", () => {
  const trapCalls = { get: 0, ownKeys: 0, getPrototypeOf: 0, getOwnPropertyDescriptor: 0 };
  const proxy = new Proxy({}, {
    get() { trapCalls.get += 1; throw new Error("get trap executed"); },
    ownKeys() { trapCalls.ownKeys += 1; throw new Error("ownKeys trap executed"); },
    getPrototypeOf() { trapCalls.getPrototypeOf += 1; throw new Error("getPrototypeOf trap executed"); },
    getOwnPropertyDescriptor() { trapCalls.getOwnPropertyDescriptor += 1; throw new Error("descriptor trap executed"); },
  });
  assert.throws(() => normalizeAutomatedIndependentAuthoringEvidence(proxy as unknown as string), /AUTOMATED_JSON_INPUT_REQUIRED/);
  assert.deepEqual(trapCalls, { get: 0, ownKeys: 0, getPrototypeOf: 0, getOwnPropertyDescriptor: 0 });
});
test("malformed JSON and non-object JSON roots are rejected with stable codes", () => {
  for (const malformed of ["{", "", "undefined", "NaN", '{"a":1} trailing']) {
    assert.throws(() => normalizeAutomatedIndependentAuthoringEvidence(malformed), /AUTOMATED_JSON_MALFORMED/);
  }
  for (const wrongRoot of ["null", "[]", '"text"', "1", "true"]) {
    assert.throws(() => normalizeAutomatedIndependentAuthoringEvidence(wrongRoot), /AUTOMATED_JSON_ROOT_INVALID/);
  }
});
test("valid serialized JSON normalizes to an independent unverified snapshot and remains DENY", () => {
  const serialized = json(fixture());
  const normalized = normalizeAutomatedIndependentAuthoringEvidence(serialized);
  assert.equal(normalized.verificationState, "UNVERIFIED");
  assert.equal(normalized.evaluationResult, "DENY");
  assert.equal(evaluateIndependentAuthoringEvidence(serialized).result, "DENY");
  assert.equal(computeAutomatedIndependentAuthoringEvidenceIdentity(serialized), computeAutomatedIndependentAuthoringEvidenceIdentity(JSON.stringify(JSON.parse(serialized) as unknown)));
});
