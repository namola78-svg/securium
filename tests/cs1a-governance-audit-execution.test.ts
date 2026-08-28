import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  executeCs1aGovernanceAudit,
  type Cs1aGovernanceAuditExecutionDependencies,
  type Cs1aGovernanceAuditExecutionInput,
} from "../lib/services/cs1a-governance-audit-execution.ts";
import { computeHumanDecisionHash } from "../lib/policy/cs1a-human-decision.ts";
import type { VerifiedCs1aGovernanceExecutionContext } from "../lib/services/cs1a-governance-execution.ts";

const fixture = JSON.parse(
  readFileSync("tests/fixtures/cs1a-pia-first-clean-human-decision-v1.json", "utf8"),
);
const hash = computeHumanDecisionHash({
  contractVersion: fixture.projection.contractVersion,
  subjects: fixture.projection.subjects,
});
const actor = {
  id: "existing-user",
  email: "reviewer@example.test",
  displayName: "Reviewer",
  status: "ACTIVE",
  roles: ["CONTENT_REVIEWER"],
} as const;
const context: VerifiedCs1aGovernanceExecutionContext = {
  semantic: {
    artifactSource: "ARTIFACT_SUPPLIED",
    projectionSource: "RECOMPUTED",
    contractVersion: fixture.contractVersion,
    projection: fixture.projection,
    humanDecisionHash: hash,
    subjectCount: 8,
    governanceScopes: ["PIA"],
    decision: "ALLOW_CANONICAL",
    reasonCodes: ["LEGACY_REVIEW_REQUIRED"],
    publicationAuthority: "NOT_GRANTED",
  },
  actorSource: "SERVER_AUTHENTICATED",
  authorizationSource: "SERVER_DATABASE_AUTHORITY",
  applicationUser: actor,
  authorizedRoles: ["CONTENT_REVIEWER"],
};

function input(
  overrides: Partial<Cs1aGovernanceAuditExecutionInput> = {},
): Cs1aGovernanceAuditExecutionInput {
  return {
    verification: {
      artifact: fixture,
      expectedDecisionSet: {
        contractVersion: fixture.projection.contractVersion,
        subjects: fixture.projection.subjects,
      },
      expectedDecision: "ALLOW_CANONICAL",
      expectedPublicationAuthority: "NOT_GRANTED",
    },
    confirmation: { confirmed: true, humanDecisionHash: hash },
    ...overrides,
  };
}

function deps(
  overrides: Partial<Cs1aGovernanceAuditExecutionDependencies> = {},
): Cs1aGovernanceAuditExecutionDependencies {
  const base: Cs1aGovernanceAuditExecutionDependencies = {
    verifyExecution: async () => context,
    findDuplicate: async () => false,
    buildAuditExpectation: () => ({
      resourceType: "CONTENT_REVISION",
      resourceId: "content-revision:pia:pia.control.001",
      resourceRevisionId: "content-revision:pia:pia.control.001:revision:1",
      revisionHash: fixture.projection.subjects[0].revisionHash,
      policyVersion: "CS1A_POLICY_V1",
      sourceSetHash: hash,
      humanDecisionHash: hash,
      decision: "ALLOW_CANONICAL",
      reasonCode: "LEGACY_REVIEW_REQUIRED",
      rightsDisposition: "REVIEW_REQUIRED",
      currentnessDisposition: "CURRENT",
      contentClass: "LEGACY_REVIEW_REQUIRED",
      publicationAuthority: "NOT_GRANTED",
    }),
    createAudit: async (receivedActor, expected) => ({
      actorAuditLogId: "server-generated-audit-id",
      event: {
        id: "server-generated-audit-id",
        actorUserId: receivedActor.id,
        action: "CS1A_GOVERNANCE_DECISION_CONFIRMED",
        result: "SUCCESS",
        metadata: expected,
      },
    }),
  };
  return { ...base, ...overrides };
}

test("valid generic V1 context reaches audit adapter once", async () => {
  let createCount = 0;
  const result = await executeCs1aGovernanceAudit(input(), deps({
    createAudit: async (receivedActor, expected, request) => {
      createCount += 1;
      return deps().createAudit!(receivedActor, expected, request);
    },
  }));
  assert.equal(createCount, 1);
  assert.equal(result.actorAuditLogId, "server-generated-audit-id");
  assert.equal(result.context.semantic.subjectCount, 8);
});

test("missing explicit confirmation fails before audit", async () => {
  let createCount = 0;
  await assert.rejects(
    executeCs1aGovernanceAudit(input({ confirmation: { confirmed: false, humanDecisionHash: hash } }), deps({
      createAudit: async () => {
        createCount += 1;
        throw new Error("must not run");
      },
    })),
    /Explicit human governance confirmation is required/,
  );
  assert.equal(createCount, 0);
});

test("confirmation hash mismatch fails before audit", async () => {
  let createCount = 0;
  await assert.rejects(
    executeCs1aGovernanceAudit(input({ confirmation: { confirmed: true, humanDecisionHash: "f".repeat(64) } }), deps({
      createAudit: async () => {
        createCount += 1;
        throw new Error("must not run");
      },
    })),
    /does not match/,
  );
  assert.equal(createCount, 0);
});

test("exact duplicate fails closed before audit", async () => {
  let createCount = 0;
  await assert.rejects(
    executeCs1aGovernanceAudit(input(), deps({
      findDuplicate: async () => true,
      createAudit: async () => {
        createCount += 1;
        throw new Error("must not run");
      },
    })),
    /already exists/,
  );
  assert.equal(createCount, 0);
});

test("actor and role authority come only from verified server context", async () => {
  let receivedActor: Readonly<{ id: string; roles: readonly string[] }> | undefined;
  const result = await executeCs1aGovernanceAudit(input(), deps({
    createAudit: async (actorValue, expected) => {
      receivedActor = actorValue;
      return {
        actorAuditLogId: "server-generated-audit-id",
        event: {
          id: "server-generated-audit-id",
          actorUserId: actor.id,
          action: "CS1A_GOVERNANCE_DECISION_CONFIRMED",
          result: "SUCCESS",
          metadata: expected,
        },
      };
    },
  }));
  assert.deepEqual(receivedActor, { id: actor.id, roles: ["CONTENT_REVIEWER"] });
  assert.equal(result.context.actorSource, "SERVER_AUTHENTICATED");
  assert.equal(result.context.authorizationSource, "SERVER_DATABASE_AUTHORITY");
});

test("receipt and canonical persistence are unreachable from the path", async () => {
  const result = await executeCs1aGovernanceAudit(input(), deps());
  assert.equal("receiptId" in result, false);
  assert.equal(result.event.canonicalWrite, undefined);
});

test("verification failures prevent the audit adapter from running", async () => {
  let createCount = 0;
  await assert.rejects(
    executeCs1aGovernanceAudit(input(), deps({
      verifyExecution: async () => {
        throw new Error("verification failed");
      },
      createAudit: async () => {
        createCount += 1;
        throw new Error("must not run");
      },
    })),
    /verification failed/,
  );
  assert.equal(createCount, 0);
});

test("audit adapter failure or missing read-back prevents binding", async () => {
  await assert.rejects(
    executeCs1aGovernanceAudit(input(), deps({
      createAudit: async () => {
        throw new Error("read-back validation failed");
      },
    })),
    /read-back validation failed/,
  );

  await assert.rejects(
    executeCs1aGovernanceAudit(input(), deps({
      createAudit: async () => ({ actorAuditLogId: "server-id", event: null }),
    })),
    /read-back was not found/,
  );
});
