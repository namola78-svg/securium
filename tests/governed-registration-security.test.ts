import assert from "node:assert/strict";
import test from "node:test";
import {
  GOVERNED_REGISTRATION_OPERATION,
  assertCapabilityPlanBinding,
  assertReadOnlyExactReplay,
  assertGovernedRegistrationPlanIntegrity,
  createGovernedRegistrationCapability,
  createGovernedRegistrationPlan,
  deriveGovernedRegistrationCapabilityDigest,
  deriveGovernedRegistrationPlanHash,
  serializeGovernedRegistrationCapability,
  transitionGovernedRegistrationCapability,
} from "../lib/security/governed-registration-security.ts";
import * as securityContract from "../lib/security/governed-registration-security.ts";
import type {
  CapabilityToken,
  GovernedRegistrationPlanInput,
} from "../lib/security/governed-registration-security.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const TOKEN = "A".repeat(64);

function planInput(overrides: Record<string, unknown> = {}): GovernedRegistrationPlanInput {
  return {
    canonicalizationVersion: 1,
    operation: GOVERNED_REGISTRATION_OPERATION,
    environment: "NONPROD",
    courseId: "course-digital-forensics-8h",
    items: [{
      practicalId: "practical:digital-forensics:df-l01",
      practicalVersionId: "practical-version:practical:digital-forensics:df-l01:v1",
      semanticHash: HASH_A,
      governanceHash: HASH_B,
      governanceDecisionId: "decision-df-l01-v1",
      canonicalConceptBindings: [{ canonicalConceptId: "concept:forensic-integrity", mappingSemanticHash: HASH_C }],
    }],
    governanceReferences: [{
      authorityId: "governance-authority:df",
      decisionId: "decision-df-l01-v1",
      decisionHash: HASH_B,
      currentnessKey: "decision-df-l01-v1:current",
    }],
    actorId: "actor:governance-service",
    auditId: "audit:registration-df-l01",
    expectedMutations: [
      { authorityKey: "practical_version_concept_bindings", operation: "INSERT", stableIdentity: "binding:df-l01:forensic-integrity" },
      { authorityKey: "canonical_practicals", operation: "INSERT", stableIdentity: "practical:digital-forensics:df-l01" },
    ],
    idempotencyKey: "registration-plan:df-l01:v1",
    ...overrides,
  } as GovernedRegistrationPlanInput;
}

async function makePlan(overrides: Record<string, unknown> = {}) {
  return createGovernedRegistrationPlan(planInput(overrides));
}

test("canonicalizes ordering and derives a domain-separated deterministic plan hash", async () => {
  const first = await makePlan();
  const reversed = await makePlan({
    expectedMutations: [
      { authorityKey: "canonical_practicals", operation: "INSERT", stableIdentity: "practical:digital-forensics:df-l01" },
      { authorityKey: "practical_version_concept_bindings", operation: "INSERT", stableIdentity: "binding:df-l01:forensic-integrity" },
    ],
  });
  assert.equal(first.planHash, reversed.planHash);
  assert.equal(first.planId, `governed-registration-plan:${first.planHash}`);
  assert.equal(first.canonicalPayloadJson.includes("SECURIUM_GOVERNED_REGISTRATION_PLAN_V1"), true);
  assert.equal(await deriveGovernedRegistrationPlanHash(planInput()), first.planHash);
  await assert.doesNotReject(() => assertGovernedRegistrationPlanIntegrity(first));
});

for (const [label, field, value] of [
  ["course", "courseId", "course-other"],
  ["practical", "items", [{ ...planInput().items[0], practicalId: "practical:other:df-l01" }]],
  ["version", "items", [{ ...planInput().items[0], practicalVersionId: "practical-version:other:v2" }]],
  ["concept", "items", [{ ...planInput().items[0], canonicalConceptBindings: [{ canonicalConceptId: "concept:other", mappingSemanticHash: HASH_C }] }]],
  ["governance", "governanceReferences", [{ ...planInput().governanceReferences[0], decisionHash: HASH_A }]],
  ["actor", "actorId", "actor:other"],
  ["audit", "audit:other", "audit:other"],
  ["environment", "environment", "PRODUCTION"],
  ["mutation-set", "expectedMutations", [{ authorityKey: "canonical_practicals", operation: "INSERT", stableIdentity: "different" }]],
] as const) {
  test(`security-relevant ${label} change does not replay the same plan`, async () => {
    const original = await makePlan();
    const changedInput = label === "audit"
      ? { ...planInput(), auditId: value }
      : { ...planInput(), [field]: value };
    const changed = await makePlan(changedInput);
    assert.notEqual(changed.planHash, original.planHash);
    assert.notEqual(changed.planId, original.planId);
  });
}

test("rejects duplicate semantic items, duplicate Concepts, unknown fields, and malformed identities", async () => {
  await assert.rejects(() => makePlan({ items: [planInput().items[0], planInput().items[0]] }), { code: "DUPLICATE_PLAN_ITEM_PRACTICAL" });
  await assert.rejects(() => makePlan({
    items: [{ ...planInput().items[0], canonicalConceptBindings: [
      { canonicalConceptId: "concept:forensic-integrity", mappingSemanticHash: HASH_C },
      { canonicalConceptId: "concept:forensic-integrity", mappingSemanticHash: HASH_A },
    ] }],
  }), { code: "DUPLICATE_PLAN_ITEM_CONCEPT" });
  await assert.rejects(() => makePlan({ trusted: true }), { code: "UNKNOWN_REGISTRATION_PLAN_FIELD" });
  await assert.rejects(() => makePlan({ courseId: "C:\\unsafe\\path" }), { code: "INVALID_COURSE_ID" });
});

test("uses canonical Concept IDs only and requires a governance reference", async () => {
  await assert.rejects(() => makePlan({
    items: [{ ...planInput().items[0], canonicalConceptBindings: [{ conceptAlias: "forensic integrity", mappingSemanticHash: HASH_C }] }],
  }), { code: "UNKNOWN_CONCEPT_BINDING_FIELD" });
  await assert.rejects(() => makePlan({ governanceReferences: [] }), { code: "INVALID_GOVERNANCE_REFERENCES" });
  await assert.rejects(() => makePlan({ items: [{ ...planInput().items[0], governanceDecisionId: "decision:missing" }] }), { code: "PLAN_ITEM_GOVERNANCE_REFERENCE_MISSING" });
});

test("keeps the plan contract generic across approved registration domains", async () => {
  const courses = [
    "course-digital-forensics-8h",
    "course-cppg-foundation",
    "course-information-systems-auditor",
  ];
  const plans = await Promise.all(courses.map((courseId) => makePlan({ courseId })));
  assert.equal(plans.length, 3);
  assert.equal(new Set(plans.map((plan) => plan.planHash)).size, 3);
  assert.ok(plans.every((plan) => plan.operation === GOVERNED_REGISTRATION_OPERATION));
});

test("derives capability digest without adding the raw token to the persisted capability", async () => {
  const digest = await deriveGovernedRegistrationCapabilityDigest(TOKEN as CapabilityToken);
  const plan = await makePlan();
  const capability = createGovernedRegistrationCapability({
    capabilityId: "capability:df-l01:v1",
    plan,
    capabilityDigest: digest,
    issuedToPrincipal: "principal:runtime-registrar",
    issuedByActorId: "actor:governance-service",
    issuedByAuditId: "audit:capability-issue-df-l01",
    issuedAt: "2026-09-09T00:00:00Z",
    expiresAt: "2026-09-10T00:00:00Z",
  });
  const serialized = serializeGovernedRegistrationCapability(capability);
  assert.equal(serialized.includes(TOKEN), false);
  assert.equal(serialized.includes("capabilityDigest"), true);
  assert.equal(JSON.stringify(capability).includes(TOKEN), false);
  assert.throws(
    () => serializeGovernedRegistrationCapability({ ...capability, token: TOKEN } as never),
    { code: "UNKNOWN_CAPABILITY_FIELD" },
  );
  assertCapabilityPlanBinding(capability, plan);
});

test("rejects structurally forged plans at the capability construction boundary", async () => {
  const plan = await makePlan();
  const forged = {
    ...plan,
    planId: `governed-registration-plan:${HASH_A}`,
    planHash: HASH_A,
    canonicalPayloadJson: "{}",
    courseId: "course-attacker",
    trusted: true,
  } as unknown as Awaited<ReturnType<typeof makePlan>>;

  assert.throws(
    () => createGovernedRegistrationCapability({
      capabilityId: "capability:forged",
      plan: forged,
      capabilityDigest: HASH_B,
      issuedToPrincipal: "principal:runtime-registrar",
      issuedByActorId: "actor:governance-service",
      issuedByAuditId: "audit:capability-issue-forged",
      issuedAt: "2026-09-09T00:00:00Z",
      expiresAt: null,
    }),
    { code: "UNVALIDATED_PLAN_AUTHORITY" },
  );
});

test("rejects unsafe-cast and plain-JavaScript plan objects", () => {
  const forged = {
    planId: `governed-registration-plan:${HASH_A}`,
    planHash: HASH_A,
  } as unknown as Awaited<ReturnType<typeof makePlan>>;

  assert.throws(
    () => createGovernedRegistrationCapability({
      capabilityId: "capability:plain-object",
      plan: forged,
      capabilityDigest: HASH_B,
      issuedToPrincipal: "principal:runtime-registrar",
      issuedByActorId: "actor:governance-service",
      issuedByAuditId: "audit:capability-issue-plain-object",
      issuedAt: "2026-09-09T00:00:00Z",
      expiresAt: null,
    }),
    { code: "UNVALIDATED_PLAN_AUTHORITY" },
  );
});

test("keeps validated plans immutable and does not export a branding bypass", async () => {
  const plan = await makePlan();
  assert.throws(() => {
    (plan as unknown as { courseId: string }).courseId = "course-attacker";
  });
  assert.equal("VALIDATED_PLAN_BRAND" in securityContract, false);
  assert.equal("VALIDATED_PLAN_OBJECTS" in securityContract, false);
  assert.equal("brandGovernedRegistrationPlan" in securityContract, false);
  await assert.doesNotReject(() => assertGovernedRegistrationPlanIntegrity(plan));
});

test("rejects a cross-plan hash swap even when the source plan was valid", async () => {
  const plan = await makePlan();
  const swapped = { ...plan, planHash: HASH_A } as unknown as Awaited<ReturnType<typeof makePlan>>;
  assert.throws(
    () => createGovernedRegistrationCapability({
      capabilityId: "capability:hash-swap",
      plan: swapped,
      capabilityDigest: HASH_B,
      issuedToPrincipal: "principal:runtime-registrar",
      issuedByActorId: "actor:governance-service",
      issuedByAuditId: "audit:capability-issue-hash-swap",
      issuedAt: "2026-09-09T00:00:00Z",
      expiresAt: null,
    }),
    { code: "UNVALIDATED_PLAN_AUTHORITY" },
  );
});

test("enforces the terminal capability lifecycle and exact replay distinction", async () => {
  const plan = await makePlan();
  const digest = await deriveGovernedRegistrationCapabilityDigest(TOKEN as CapabilityToken);
  const issued = createGovernedRegistrationCapability({
    capabilityId: "capability:df-l01:v1",
    plan,
    capabilityDigest: digest,
    issuedToPrincipal: "principal:runtime-registrar",
    issuedByActorId: "actor:governance-service",
    issuedByAuditId: "audit:capability-issue-df-l01",
    issuedAt: "2026-09-09T00:00:00Z",
    expiresAt: "2026-09-10T00:00:00Z",
  });
  const consumed = transitionGovernedRegistrationCapability(issued, { from: "ISSUED", to: "CONSUMED" }, "2026-09-09T01:00:00Z", HASH_A);
  assert.deepEqual(assertReadOnlyExactReplay(consumed, plan), {
    outcome: "READ_ONLY_EXACT_REPLAY",
    planId: plan.planId,
    planHash: plan.planHash,
    resultDigest: HASH_A,
  });
  assert.throws(() => transitionGovernedRegistrationCapability(consumed, { from: "CONSUMED", to: "ISSUED" }, "2026-09-09T02:00:00Z"), { code: "CAPABILITY_TERMINAL_STATE" });
  const differentPlan = await makePlan({ courseId: "course-cppg-foundation" });
  assert.throws(() => assertReadOnlyExactReplay(consumed, differentPlan), { code: "CAPABILITY_PLAN_BINDING_MISMATCH" });
});

test("supports revocation and expiry only from ISSUED", async () => {
  const plan = await makePlan();
  const base = {
    capabilityId: "capability:df-l01:v1",
    plan,
    capabilityDigest: HASH_A,
    issuedToPrincipal: "principal:runtime-registrar",
    issuedByActorId: "actor:governance-service",
    issuedByAuditId: "audit:capability-issue-df-l01",
    issuedAt: "2026-09-09T00:00:00Z",
    expiresAt: "2026-09-10T00:00:00Z",
  };
  const revoked = transitionGovernedRegistrationCapability(createGovernedRegistrationCapability(base), { from: "ISSUED", to: "REVOKED" }, "2026-09-09T01:00:00Z");
  assert.equal(revoked.state, "REVOKED");
  assert.throws(() => transitionGovernedRegistrationCapability(revoked, { from: "REVOKED", to: "CONSUMED" }, "2026-09-09T02:00:00Z"), { code: "CAPABILITY_TERMINAL_STATE" });
  const expired = transitionGovernedRegistrationCapability(createGovernedRegistrationCapability(base), { from: "ISSUED", to: "EXPIRED" }, "2026-09-10T00:00:00Z");
  assert.equal(expired.state, "EXPIRED");
  assert.throws(() => transitionGovernedRegistrationCapability(createGovernedRegistrationCapability(base), { from: "ISSUED", to: "EXPIRED" }, "2026-09-09T23:59:59Z"), { code: "CAPABILITY_NOT_EXPIRED" });
});
