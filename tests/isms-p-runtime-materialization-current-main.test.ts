import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { ismsPTheoryBatch1Records } from "../lib/data/isms-p-theory-batch1.mjs";
import {
  assertRuntimeSemanticHashDomain,
  assertApprovedIsmsPRuntimeIdentityBridge,
  classifyCurrentMainRevisionReplay,
  computeCanonicalRuntimeSemanticHash,
  createIsmsPRuntimeMaterializationService,
  dryRunIsmsPRuntimeMaterialization,
  getApprovedIsmsPAuthoringAuthority,
  getApprovedIsmsPRuntimeIdentityBridge,
  IsmsPMaterializationError,
  materializeGovernedIsmsPRevision,
  validateIsmsPMaterializationPlan,
  verifyCanonicalRuntimeSemanticHash,
} from "../lib/materialization/isms-p-runtime-materialization.ts";
import { stableJson } from "../lib/services/content-revision-service.ts";

const validRevisionCandidate = {
  canonicalKey: "theory.ismsp.test",
  contentId: "content-ismsp-test",
  version: "3.0.0",
  title: "Governed ISMS-P theory",
  body: "{\"sections\":{\"learning_objectives\":{\"value\":[\"Understand the control.\"]},\"verification_points\":{\"value\":[\"Can the control be evidenced?\"]}}}",
  bodyFormat: "STRUCTURED_JSON" as const,
  learningObjectives: ["Understand the control."],
  examples: [{ safe: true }],
  selfChecks: ["Can the control be evidenced?"],
  conceptMappings: [{ conceptKey: "ontology:ismsp:test", qualificationJson: "{}", provenanceJson: "{}" }],
  governance: {
    blueprintId: "bp.ismsp.test",
    humanReviewHash: "a".repeat(64),
    humanReviewedBy: "actor-1",
    humanReviewedAt: "2026-09-11T00:00:00.000Z",
    rightsStatus: "PASS_ORIGINAL" as const,
    authoringOrigin: "SECURIUM_ORIGINAL" as const,
    copyrightStatus: "PASS_ORIGINAL" as const,
    restrictedPdfGenerationInput: false as const,
    qualificationJson: "{}",
    provenanceJson: "{}",
    lifecycle: "CANONICAL_UNPUBLISHED" as const,
  },
};

type MutableRuntimeContent = Record<string, unknown> & { body: string; summary: string };
type MutableRuntimeRevision = Record<string, unknown> & { body: string };

type MutableRow = {
  [key: string]: unknown;
  runtimeContent: MutableRuntimeContent;
  runtimeRevision: MutableRuntimeRevision;
};

type MutableRegistryRecord = {
  content: { body: string; id: string };
  metadata: {
    currentness: string;
    approval: { humanSource: string };
    provenance: { approvedPreviewBodySha256: string };
  };
};

type MutablePlan = {
  [key: string]: unknown;
  rows: MutableRow[];
  canonicalSnapshot: {
    [key: string]: unknown;
    rows: MutableRow[];
    registryRecords: MutableRegistryRecord[];
    hashDomain: string;
    readiness: { currentness: { status: string } };
  };
};

function clonePlan(): MutablePlan {
  return structuredClone(dryRunIsmsPRuntimeMaterialization()) as unknown as MutablePlan;
}

function validateMutated(mutator: (plan: MutablePlan) => void) {
  const plan = clonePlan();
  mutator(plan);
  return validateIsmsPMaterializationPlan(plan);
}

test("canonical registry projects 12 subjects and derives readiness from actual records", () => {
  const authority = getApprovedIsmsPAuthoringAuthority();
  const bridge = getApprovedIsmsPRuntimeIdentityBridge();
  assert.equal(authority.subjects.length, 12);
  assert.equal(bridge.length, 12);
  assert.equal(new Set(bridge.map((entry) => entry.authoringId)).size, 12);
  assert.equal(new Set(bridge.map((entry) => entry.runtimeContentId)).size, 12);
  assert.deepEqual(authority.provenance, {
    status: "PARTIAL",
    approvedPreviewVerifiedRecordCount: 12,
    totalRecordCount: 12,
    sourceLessonHashVerification: {
      status: "UNRESOLVED",
      counts: {
        VERIFIED: 0,
        MISSING: 0,
        MISMATCH: 0,
        IDENTITY_MISMATCH: 0,
        UNRESOLVED: 12,
      },
    },
    unresolvedChecks: ["SOURCE_LESSONS_HASH_RECOMPUTATION_REQUIRED", "FULL_SOURCE_BINDING_VALIDATION_REQUIRED"],
  });
  assert.equal(authority.currentness.evaluatedRecordCount, 12);
  assert.equal(authority.currentness.counts.CURRENT, 1);
  assert.equal(authority.currentness.counts.UNKNOWN, 11);
  assert.equal(authority.currentness.status, "UNRESOLVED");
  assert.equal("provenanceClosure" in (authority as Record<string, unknown>), false);
  assert.equal("currentnessClosure" in (authority as Record<string, unknown>), false);
});

test("dry-run binds the full canonical snapshot deterministically and remains execution-blocked", () => {
  const first = dryRunIsmsPRuntimeMaterialization();
  const second = dryRunIsmsPRuntimeMaterialization();
  assert.deepEqual(first, second);
  assert.equal(first.planVersion, "2");
  assert.equal(first.subjectCount, 12);
  assert.equal(first.rows.every((row) => row.receipt === "NOT_READY"), true);
  assert.equal(first.rows.every((row) => row.runtimeSemanticHash === null), true);
  assert.equal(first.rows.every((row) => row.runtimeRevision.semanticHash === null), true);
  assert.equal(first.canonicalSnapshot.registryRecords.length, 12);
  assert.equal(first.canonicalSnapshot.materializationManifest.length, 12);
  assert.equal(first.canonicalSnapshot.readiness.currentness.status, "UNRESOLVED");
  assert.equal(first.canonicalSnapshot.readiness.sourceBinding.status, "UNRESOLVED");
  assert.equal(validateIsmsPMaterializationPlan(first).valid, true);
  assert.equal(validateIsmsPMaterializationPlan(first).executionReady, false);
  assert.equal(first.status, "WAIT_FOR_AUTHENTICATED_HUMAN_GOVERNANCE");
});

test("plan hash and structural binding reject payload, provenance, currentness, identity, and row tampering", () => {
  const cases: Record<string, ReturnType<typeof validateIsmsPMaterializationPlan>> = {
    body: validateMutated((plan) => { plan.rows[0].runtimeContent.body += " attacker"; }),
    summary: validateMutated((plan) => { plan.rows[0].runtimeContent.summary += " attacker"; }),
    payloadAndProvenance: validateMutated((plan) => {
      plan.rows[0].runtimeContent.body += " attacker";
      plan.canonicalSnapshot.registryRecords[0].metadata.provenance.approvedPreviewBodySha256 = "0".repeat(64);
    }),
    approval: validateMutated((plan) => { plan.canonicalSnapshot.registryRecords[0].metadata.approval.humanSource = "REJECT"; }),
    sourceBinding: validateMutated((plan) => { plan.rows[0].sourceBinding = "attacker"; }),
    currentness: validateMutated((plan) => { plan.canonicalSnapshot.readiness.currentness.status = "VERIFIED"; }),
    extraRow: validateMutated((plan) => { plan.rows.push(plan.rows[0]); }),
    missingRow: validateMutated((plan) => { plan.rows.pop(); }),
    reorderedRows: validateMutated((plan) => { [plan.rows[0], plan.rows[1]] = [plan.rows[1], plan.rows[0]]; }),
    identity: validateMutated((plan) => { plan.rows[0].authoringId = "attacker-authoring"; }),
    revisionIdentity: validateMutated((plan) => { plan.rows[0].revisionReplayKey = "attacker-revision"; }),
    arbitraryRuntimeHash: validateMutated((plan) => { plan.rows[0].runtimeSemanticHash = "attacker-hash"; }),
    receipt: validateMutated((plan) => { plan.rows[0].receipt = "READY"; }),
  };
  for (const [name, result] of Object.entries(cases)) {
    assert.equal(result.valid, false, `${name} mutation must fail closed`);
    assert.equal(result.errors.some((error) => error.code === "PLAN_TAMPERED"), true, `${name} must be structural tampering`);
  }
  assert.equal(validateIsmsPMaterializationPlan(dryRunIsmsPRuntimeMaterialization()).valid, true);
});

test("recomputed attacker plan hash does not become canonical authority", () => {
  const plan = clonePlan();
  plan.rows[0].runtimeRevision.body += " attacker";
  plan.canonicalSnapshot.rows[0].runtimeRevision.body += " attacker";
  plan.planHash = createHash("sha256").update(stableJson({
    domain: plan.canonicalSnapshot.hashDomain,
    contract: plan.contract,
    planVersion: plan.planVersion,
    snapshot: plan.canonicalSnapshot,
    rows: plan.rows,
    mode: plan.mode,
    subjectCount: plan.subjectCount,
    identityCollisionCount: plan.identityCollisionCount,
    status: plan.status,
  }), "utf8").digest("hex");
  const result = validateIsmsPMaterializationPlan(plan);
  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === "PLAN_TAMPERED"), true);
  assert.equal(result.errors.some((error) => error.code === "PLAN_HASH_MISMATCH"), true);
});

test("direct-JS non-JSON inputs are rejected before canonicalization", () => {
  for (const mutator of [
    (plan: MutablePlan) => { plan.unexpected = undefined; },
    (plan: MutablePlan) => { plan.rows[0].runtimeContent.sortOrder = Number.NaN; },
    (plan: MutablePlan) => { plan.rows[0].runtimeContent.sortOrder = Number.POSITIVE_INFINITY; },
    (plan: MutablePlan) => { plan.rows = new Array(12); },
    (plan: MutablePlan) => { plan.rows = Object.create({ ...plan.rows }); },
    (plan: MutablePlan) => { plan.rows = Object.create(null); },
  ]) {
    const result = validateMutated(mutator);
    assert.equal(result.valid, false);
    assert.equal(result.errors[0]?.code, "PLAN_INPUT_INVALID");
  }
  const cyclic = clonePlan();
  cyclic.cycle = cyclic;
  const cycleResult = validateIsmsPMaterializationPlan(cyclic);
  assert.equal(cycleResult.errors[0]?.code, "PLAN_INPUT_INVALID");
});

test("canonical registry changes invalidate an already-created plan", () => {
  const plan = dryRunIsmsPRuntimeMaterialization();
  const record = ismsPTheoryBatch1Records[0] as unknown as MutableRegistryRecord;
  const originalBody = record.content.body;
  const originalCurrentness = record.metadata.currentness;
  try {
    record.content.body = `${originalBody} changed`;
    const bodyResult = validateIsmsPMaterializationPlan(plan);
    assert.equal(bodyResult.valid, false);
    assert.equal(bodyResult.errors[0]?.code, "AUTHORING_AUTHORITY_INVALID");
  } finally {
    record.content.body = originalBody;
  }
  try {
    record.metadata.currentness = originalCurrentness === "CURRENT" ? "UNKNOWN" : "CURRENT";
    const currentnessResult = validateIsmsPMaterializationPlan(plan);
    assert.equal(currentnessResult.valid, false);
    assert.equal(currentnessResult.errors.some((error) => error.code === "PLAN_TAMPERED"), true);
  } finally {
    record.metadata.currentness = originalCurrentness;
  }
});

test("canonical approval and identity mutations are rejected by reused materializer/registry gates", () => {
  const record = ismsPTheoryBatch1Records[0] as unknown as MutableRegistryRecord;
  const originalApproval = record.metadata.approval.humanSource;
  const originalContentId = record.content.id;
  try {
    record.metadata.approval.humanSource = "REJECT";
    assert.throws(() => dryRunIsmsPRuntimeMaterialization(), (error: unknown) => error instanceof IsmsPMaterializationError && error.code === "AUTHORING_AUTHORITY_INVALID");
  } finally {
    record.metadata.approval.humanSource = originalApproval;
  }
  try {
    record.content.id = `${originalContentId}-attacker`;
    assert.throws(() => dryRunIsmsPRuntimeMaterialization(), (error: unknown) => error instanceof IsmsPMaterializationError && error.code === "IDENTITY_BRIDGE_INVALID");
  } finally {
    record.content.id = originalContentId;
  }
});

test("UNKNOWN currentness never becomes execution readiness", () => {
  const plan = dryRunIsmsPRuntimeMaterialization();
  const validation = validateIsmsPMaterializationPlan(plan);
  assert.equal(validation.valid, true);
  assert.equal(validation.executionReady, false);
  assert.ok(validation.unresolved.includes("CURRENTNESS_UNRESOLVED"));
  assert.ok(validation.unresolved.includes("PROVENANCE_CANONICAL_SOURCE_HASH_REQUIRED"));
  assert.ok(validation.unresolved.includes("AUTHENTICATED_HUMAN_GOVERNANCE_REQUIRED"));
  assert.throws(() => materializeGovernedIsmsPRevision(plan), (error: unknown) => error instanceof IsmsPMaterializationError && error.code === "PERSISTENCE_NOT_AVAILABLE_IN_REVIEW_GATE");
});

test("persistence and receipt authority remain absent from the production service", () => {
  const service = createIsmsPRuntimeMaterializationService();
  assert.deepEqual(Object.keys(service).sort(), ["dryRun", "materializeGovernedRevision", "validatePlan"]);
  assert.equal("persistAtomic" in service, false);
  assert.equal("receiptWriter" in service, false);
  assert.equal("governanceResolver" in service, false);
  assert.equal("sourceResolver" in service, false);
  assert.equal("auditResolver" in service, false);
});

test("revision replay requires non-null canonical runtime hashes", () => {
  const hash = "a".repeat(64);
  const candidate = { contentId: "content-a", version: "3.0.0", semanticHash: hash, snapshotJson: "{}" };
  assert.equal(classifyCurrentMainRevisionReplay({ existing: null, candidate }), "CREATE");
  assert.equal(classifyCurrentMainRevisionReplay({ existing: candidate, candidate }), "EXACT_REPLAY");
  assert.equal(classifyCurrentMainRevisionReplay({ existing: { ...candidate, semanticHash: null }, candidate: { ...candidate, semanticHash: null } }), "NEW_IMMUTABLE_REVISION_REQUIRED");
  assert.equal(classifyCurrentMainRevisionReplay({ existing: candidate, candidate: { ...candidate, snapshotJson: '{"body":"changed"}' } }), "NEW_IMMUTABLE_REVISION_REQUIRED");
  assert.equal(classifyCurrentMainRevisionReplay({ existing: candidate, candidate: { ...candidate, version: "4.0.0" } }), "NEW_IMMUTABLE_REVISION_REQUIRED");
  assert.equal(classifyCurrentMainRevisionReplay({ existing: candidate, candidate: { ...candidate, contentId: "content-b" } }), "CONFLICT");
});

test("runtime semantic hash is computed from and verified against the governed candidate", async () => {
  const canonicalHash = await computeCanonicalRuntimeSemanticHash(validRevisionCandidate);
  assert.match(canonicalHash, /^[a-f0-9]{64}$/);
  assert.equal(await computeCanonicalRuntimeSemanticHash({ ...validRevisionCandidate, contentId: "content-ismsp-other" }), canonicalHash);
  assert.equal(await verifyCanonicalRuntimeSemanticHash({ candidate: validRevisionCandidate, submittedHash: canonicalHash }), canonicalHash);
  await assert.rejects(
    () => verifyCanonicalRuntimeSemanticHash({ candidate: { ...validRevisionCandidate, body: `${validRevisionCandidate.body} changed` }, submittedHash: canonicalHash }),
    (error: unknown) => error instanceof IsmsPMaterializationError && error.code === "RUNTIME_SEMANTIC_HASH_INVALID",
  );
  await assert.rejects(
    () => verifyCanonicalRuntimeSemanticHash({ candidate: validRevisionCandidate, submittedHash: "f".repeat(64) }),
    (error: unknown) => error instanceof IsmsPMaterializationError && error.code === "RUNTIME_SEMANTIC_HASH_INVALID",
  );
});

test("foreign, arbitrary, and unverified runtime hash values are rejected", () => {
  assert.throws(() => assertRuntimeSemanticHashDomain({ runtimeSemanticHash: "runtime" }), /canonical SHA-256/);
  assert.throws(() => assertRuntimeSemanticHashDomain({ runtimeSemanticHash: "a".repeat(64), authoringRevisionHash: "a".repeat(64) }), /non-runtime hash/);
  assert.throws(() => assertRuntimeSemanticHashDomain({ runtimeSemanticHash: "b".repeat(64), sourceSha256: "b".repeat(64) }), /non-runtime hash/);
  assert.throws(() => assertRuntimeSemanticHashDomain({ runtimeSemanticHash: "c".repeat(64), assessmentSemanticHash: "c".repeat(64) }), /non-runtime hash/);
});

test("arbitrary identity bridges cannot be promoted to canonical authority", () => {
  const bridge = getApprovedIsmsPRuntimeIdentityBridge();
  const fake = bridge.map((entry) => ({ ...entry, runtimeContentId: `${entry.runtimeContentId}-fake` }));
  assert.notDeepEqual(fake, bridge);
  assert.throws(() => assertApprovedIsmsPRuntimeIdentityBridge(fake), /Only the current-main registry identity bridge/);
});
