import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRuntimeSemanticHashDomain,
  assertApprovedIsmsPRuntimeIdentityBridge,
  classifyCurrentMainRevisionReplay,
  createIsmsPRuntimeMaterializationService,
  dryRunIsmsPRuntimeMaterialization,
  getApprovedIsmsPAuthoringAuthority,
  getApprovedIsmsPRuntimeIdentityBridge,
  IsmsPMaterializationError,
  materializeGovernedIsmsPRevision,
  validateIsmsPMaterializationPlan,
} from "../lib/materialization/isms-p-runtime-materialization.ts";

test("current-main registry projects exactly 12 explicit subjects", () => {
  const authority = getApprovedIsmsPAuthoringAuthority();
  const bridge = getApprovedIsmsPRuntimeIdentityBridge();
  assert.equal(authority.subjects.length, 12);
  assert.equal(bridge.length, 12);
  assert.equal(new Set(bridge.map((entry) => entry.authoringId)).size, 12);
  assert.equal(new Set(bridge.map((entry) => entry.runtimeContentId)).size, 12);
  assert.equal(authority.provenanceClosure, 84);
  assert.equal(authority.currentnessClosure, 101);
});

test("dry-run is deterministic and contains no persistence capability", () => {
  const first = dryRunIsmsPRuntimeMaterialization();
  const second = dryRunIsmsPRuntimeMaterialization();
  assert.deepEqual(first, second);
  assert.equal(first.subjectCount, 12);
  assert.equal(first.rows.every((row) => row.receipt === "NOT_READY"), true);
  assert.equal(first.rows.every((row) => row.runtimeSemanticHash === null), true);
  assert.equal(first.status, "WAIT_FOR_AUTHENTICATED_HUMAN_GOVERNANCE");
});

test("plan validation rejects mutation", () => {
  const plan = dryRunIsmsPRuntimeMaterialization();
  const mutated = Object.freeze({ ...plan, planHash: "0".repeat(64) });
  const result = validateIsmsPMaterializationPlan(mutated);
  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === "PLAN_HASH_MISMATCH"), true);
});

test("canonical plan validation rejects structural tampering with the original planHash", () => {
  const plan = dryRunIsmsPRuntimeMaterialization();
  const mutateRow = (index: number, patch: Record<string, unknown>) => Object.freeze({
    ...plan,
    rows: Object.freeze(plan.rows.map((row, rowIndex) => rowIndex === index ? Object.freeze({ ...row, ...patch }) : row)),
  }) as typeof plan;
  const cases: Record<string, typeof plan> = {
    extraRow: Object.freeze({ ...plan, rows: Object.freeze([...plan.rows, plan.rows[0]]) }),
    missingRow: Object.freeze({ ...plan, rows: Object.freeze(plan.rows.slice(0, -1)) }),
    reorderedRows: Object.freeze({ ...plan, rows: Object.freeze([plan.rows[1], plan.rows[0], ...plan.rows.slice(2)]) }),
    runtimeContentId: mutateRow(0, { runtimeContentId: "attacker-content" }),
    sourceBinding: mutateRow(0, { sourceBinding: "attacker-source" }),
    semanticHash: mutateRow(0, { runtimeSemanticHash: "attacker-hash" }),
    governance: mutateRow(0, { governance: "attacker-governance" }),
    auditBoundReceiptState: mutateRow(0, { receipt: "READY" }),
    status: Object.freeze({ ...plan, status: "AUTHORIZED" as never }),
    contract: Object.freeze({ ...plan, contract: "ATTACKER_CONTRACT" as never }),
    identity: mutateRow(0, { authoringId: "attacker-authoring" }),
    revisionIdentity: mutateRow(0, { revisionReplayKey: "attacker-revision" }),
    currentness: Object.freeze({ ...plan, currentnessClosure: 0 as never }),
  };
  for (const [name, candidate] of Object.entries(cases)) {
    const result = validateIsmsPMaterializationPlan(candidate);
    assert.equal(result.valid, false, `${name} mutation must fail closed`);
    assert.equal(result.errors.some((error) => error.code === "PLAN_TAMPERED"), true, `${name} must be classified as plan tampering`);
  }
  assert.equal(validateIsmsPMaterializationPlan(plan).valid, true);
});

test("persistent materialization remains governance-blocked in reconciliation", () => {
  const plan = dryRunIsmsPRuntimeMaterialization();
  assert.throws(
    () => materializeGovernedIsmsPRevision(plan),
    (error: unknown) => error instanceof IsmsPMaterializationError && error.code === "PERSISTENCE_NOT_AVAILABLE_IN_REVIEW_GATE",
  );
});

test("production service exposes no structural authority ports", () => {
  const service = createIsmsPRuntimeMaterializationService();
  assert.deepEqual(Object.keys(service).sort(), ["dryRun", "materializeGovernedRevision", "validatePlan"]);
  assert.equal("persistAtomic" in service, false);
  assert.equal("governanceResolver" in service, false);
  assert.equal("sourceResolver" in service, false);
  assert.equal("auditResolver" in service, false);
});

test("revision replay preserves immutable history", () => {
  const candidate = { contentId: "content-a", version: "3.0.0", semanticHash: "a", snapshotJson: "{}" };
  assert.equal(classifyCurrentMainRevisionReplay({ existing: null, candidate }), "CREATE");
  assert.equal(classifyCurrentMainRevisionReplay({ existing: candidate, candidate }), "EXACT_REPLAY");
  assert.equal(classifyCurrentMainRevisionReplay({ existing: candidate, candidate: { ...candidate, version: "4.0.0" } }), "NEW_IMMUTABLE_REVISION_REQUIRED");
  assert.equal(classifyCurrentMainRevisionReplay({ existing: candidate, candidate: { ...candidate, contentId: "content-b" } }), "CONFLICT");
});

test("foreign hash domains cannot become runtime semantic_hash", () => {
  assert.throws(() => assertRuntimeSemanticHashDomain({ runtimeSemanticHash: "a", authoringRevisionHash: "a" }), /non-runtime hash/);
  assert.throws(() => assertRuntimeSemanticHashDomain({ runtimeSemanticHash: "b", sourceSha256: "b" }), /non-runtime hash/);
  assert.throws(() => assertRuntimeSemanticHashDomain({ runtimeSemanticHash: "c", assessmentSemanticHash: "c" }), /non-runtime hash/);
  assert.doesNotThrow(() => assertRuntimeSemanticHashDomain({ runtimeSemanticHash: "runtime" }));
});

test("current-main authority does not accept arbitrary identity bridges", () => {
  const bridge = getApprovedIsmsPRuntimeIdentityBridge();
  const fake = bridge.map((entry) => ({ ...entry, runtimeContentId: `${entry.runtimeContentId}-fake` }));
  assert.notDeepEqual(fake, bridge);
  assert.throws(() => assertApprovedIsmsPRuntimeIdentityBridge(fake), /Only the current-main registry identity bridge/);
});
