import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CS1A_HUMAN_DECISION_HASH_V1,
  buildHumanDecisionArtifact,
  computeHumanDecisionHash,
  type Cs1aHumanDecisionSubject,
} from "../lib/policy/cs1a-human-decision.ts";
import {
  verifyCs1aDecisionSemantics,
  type Cs1aExecutionVerificationInput,
} from "../lib/policy/cs1a-governance-execution.ts";
import { verifyCs1aGovernanceExecution } from "../lib/services/cs1a-governance-execution.ts";

const hash = "a".repeat(64);
function subject(overrides: Partial<Cs1aHumanDecisionSubject> = {}): Cs1aHumanDecisionSubject {
  return {
    governanceScope: "TEST_SCOPE", resourceType: "CONTENT_REVISION", resourceId: "resource-1",
    resourceRevisionId: "resource-1:revision:1", contentHash: hash, revisionHash: "b".repeat(64),
    policyVersion: "CS1A_POLICY_V1", decision: "ALLOW_CANONICAL", reasonCode: "AUTHORIZED_PROSPECTIVE_ORIGINAL",
    rightsDisposition: "ORIGINAL_INTERNAL", currentnessDisposition: "CURRENT", authoringOrigin: "SECURIUM_ADMIN_CMS",
    contentClass: "PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED", sourceOrigin: "NONE_NOT_APPLICABLE", publicationAuthority: "NOT_GRANTED", ...overrides,
  };
}
function verificationInput(): Cs1aExecutionVerificationInput {
  const subjects = [subject({ resourceId: "resource-1" }), subject({ resourceId: "resource-2", resourceRevisionId: "resource-2:revision:1" })];
  const decisionSet = { contractVersion: CS1A_HUMAN_DECISION_HASH_V1, subjects } as const;
  return { artifact: buildHumanDecisionArtifact(decisionSet), expectedDecisionSet: decisionSet, expectedDecision: "ALLOW_CANONICAL", expectedPublicationAuthority: "NOT_GRANTED" };
}

test("generic execution verification replays exact semantic state", async () => {
  const result = await verifyCs1aGovernanceExecution(verificationInput(), {
    resolveIdentity: async () => ({ email: "reviewer@example.invalid", displayName: "Reviewer" }),
    resolveApplicationUser: async (email) => ({ id: "user-1", email, displayName: "Reviewer", status: "ACTIVE", roles: ["CONTENT_REVIEWER"] }),
  });
  assert.equal(result.semantic.humanDecisionHash, computeHumanDecisionHash(verificationInput().expectedDecisionSet));
  assert.deepEqual(result.semantic.governanceScopes, ["TEST_SCOPE"]);
  assert.deepEqual(result.authorizedRoles, ["CONTENT_REVIEWER"]);
  assert.equal(result.actorSource, "SERVER_AUTHENTICATED");
  assert.equal(result.authorizationSource, "SERVER_DATABASE_AUTHORITY");
});

test("semantic verification rejects tampering, substitution, and publication escalation", () => {
  const base = verificationInput();
  for (const change of [
    { governanceScope: "OTHER_SCOPE" }, { resourceId: "other" }, { resourceRevisionId: "other:revision:2" },
    { revisionHash: "c".repeat(64) }, { decision: "DENY" }, { reasonCode: "POLICY_DENY" },
    { rightsDisposition: "REVIEW_REQUIRED" }, { currentnessDisposition: "HISTORICAL" },
    { publicationAuthority: "GRANTED_BY_SEPARATE_AUTHORITY" }, { policyVersion: "CS1A_POLICY_V2" },
  ]) {
    const subjects = base.expectedDecisionSet.subjects.map((item, index) => index === 0 ? { ...item, ...change } : item) as Cs1aHumanDecisionSubject[];
    assert.throws(() => verifyCs1aDecisionSemantics({ ...base, artifact: buildHumanDecisionArtifact({ ...base.expectedDecisionSet, subjects }) }));
  }
  assert.throws(() => verifyCs1aDecisionSemantics({ ...base, artifact: { ...(base.artifact as Record<string, unknown>), humanDecisionHash: "f".repeat(64) } }));
});

test("malformed sets and unsupported artifacts fail closed", async () => {
  const base = verificationInput();
  assert.throws(() => verifyCs1aDecisionSemantics({ ...base, expectedDecisionSet: { ...base.expectedDecisionSet, subjects: [] } as never }));
  assert.throws(() => verifyCs1aDecisionSemantics({ ...base, artifact: { ...(base.artifact as Record<string, unknown>), artifactVersion: "UNKNOWN" } }));
  await assert.rejects(() => verifyCs1aGovernanceExecution(base, { resolveIdentity: async () => { throw new Error("no session"); }, resolveApplicationUser: async () => null }));
  await assert.rejects(() => verifyCs1aGovernanceExecution(base, { resolveIdentity: async () => ({ email: "missing@example.invalid", displayName: "Missing" }), resolveApplicationUser: async () => null }));
  await assert.rejects(() => verifyCs1aGovernanceExecution(base, { resolveIdentity: async () => ({ email: "user@example.invalid", displayName: "User" }), resolveApplicationUser: async () => ({ id: "user-1", email: "user@example.invalid", displayName: "User", status: "ACTIVE", roles: ["USER"] }) }));
});

test("all generic governance roles authorize without client actor fields", async () => {
  for (const role of ["CONTENT_REVIEWER", "ADMIN", "SUPER_ADMIN"]) {
    const result = await verifyCs1aGovernanceExecution(verificationInput(), {
      resolveIdentity: async () => ({ email: "reviewer@example.invalid", displayName: "Reviewer" }),
      resolveApplicationUser: async (email) => ({ id: "user-1", email, displayName: "Reviewer", status: "ACTIVE", roles: [role] }),
    });
    assert.deepEqual(result.authorizedRoles, [role]);
    assert.equal("actorId" in (verificationInput() as object), false);
  }
});

test("PIA first-clean reference replays through the generic verifier", () => {
  const artifact = JSON.parse(readFileSync(new URL("./fixtures/cs1a-pia-first-clean-human-decision-v1.json", import.meta.url), "utf8")) as {
    projection: { contractVersion: typeof CS1A_HUMAN_DECISION_HASH_V1; subjects: Cs1aHumanDecisionSubject[] };
    humanDecisionHash: string;
  };
  const expectedIds = [
    "pia.foundation.001", "pia.scope.001", "pia.flow.001", "pia.risk.001",
    "pia.risk.002", "pia.control.001", "pia.report.001", "pia.followup.001",
  ];
  const expectedDecisionSet = { contractVersion: artifact.projection.contractVersion, subjects: artifact.projection.subjects } as const;
  const result = verifyCs1aDecisionSemantics({
    artifact,
    expectedDecisionSet,
    expectedDecision: "ALLOW_CANONICAL",
    expectedPublicationAuthority: "NOT_GRANTED",
  });

  assert.equal(result.humanDecisionHash, "d75b3cfe4d6ea98ff2b3a2911051e68021e01c238ebba667592938393006cf43");
  assert.deepEqual(result.governanceScopes, ["PIA"]);
  assert.deepEqual(result.projection.subjects.map((item) => String(item.resourceId).replace("content-revision:pia:", "")), [...expectedIds].sort());
  assert.equal(result.subjectCount, 8);
  assert.deepEqual(new Set(result.projection.subjects.map((item) => item.currentnessDisposition)), new Set(["CURRENT"]));
  assert.deepEqual(new Set(result.projection.subjects.map((item) => item.publicationAuthority)), new Set(["NOT_GRANTED"]));
  assert.equal(result.humanDecisionHash, artifact.humanDecisionHash);

  const tampered = {
    ...artifact,
    projection: {
      ...artifact.projection,
      subjects: artifact.projection.subjects.map((item, index) => index === 0 ? { ...item, governanceScope: "OTHER_SCOPE" } : item),
    },
  };
  assert.throws(() => verifyCs1aDecisionSemantics({ artifact: tampered, expectedDecisionSet, expectedDecision: "ALLOW_CANONICAL", expectedPublicationAuthority: "NOT_GRANTED" }));
});
