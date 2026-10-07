import assert from "node:assert/strict";
import { test } from "node:test";
import { PracticalGovernanceRepository } from "../db/practical-governance-repositories.ts";
import { evaluationSemanticHashV1, canonicalPersistedEvaluationPayloadV1, snapshotDigestV1 } from "../lib/practical/practical-evaluation-semantic-hash.ts";
import { replayGovernedEvaluationV1, validateGovernedEvaluationV1 } from "../lib/practical/practical-governance-validation.ts";
import { PRACTICAL_SERVER_AUTHORITY_REQUIRED } from "../lib/policy/practical-registration-authority.ts";
import { publicError } from "../lib/errors.ts";

const authorityDenial = { name: "AppError", code: PRACTICAL_SERVER_AUTHORITY_REQUIRED, status: 503 };

const row = { id: "pv-1", practical_id: "cp-1", version: 1, semantic_hash: "a".repeat(64), human_review_hash: "b".repeat(64), safety_review_hash: "c".repeat(64), concept_mapping_hash: "d".repeat(64), evaluation_semantic_hash: "e".repeat(64) };
const input = { practicalId: "cp-1", semanticKey: "practical.swsec.input.command-resource", practicalVersionId: "pv-1", version: 1, semanticHash: row.semantic_hash, humanReviewHash: row.human_review_hash, safetyReviewHash: row.safety_review_hash, rightsBinding: "SECURIUM_ORIGINAL", provenanceBinding: "official:swsec", conceptMappingHash: row.concept_mapping_hash, theoryDependencyJson: "{}", currentnessReference: "source:current", lifecycle: "DRAFT", createdBy: "actor", rubricVersionId: "rv-1", rubricId: "rubric:swsec:command-resource", rubricVersion: 1, evaluationSemanticHash: row.evaluation_semantic_hash, evaluationMethod: "HYBRID", evidenceClassification: "ELIGIBLE_PERFORMANCE_EVIDENCE", rubricSnapshotJson: "{}", rubricSnapshotDigest: "f".repeat(64), reviewerMaterialId: "rm-1", reviewerMaterialJson: "{}", reviewerMaterialDigest: "1".repeat(64), conceptBindings: [{ id: "cb-1", conceptKey: "swsec.input.command-resource", mappingSemanticHash: "2".repeat(64), qualificationJson: "{}" }] };

class FakeDatabase {
  constructor(existing = null) { this.existing = existing; this.transactions = []; this.executions = []; this.queries = []; }
  async queryOne(statement) {
    this.queries.push(statement);
    if (statement.sql.includes("FROM canonical_practicals") && this.existing) return this.existing;
    if (statement.sql.includes("FROM practical_reviewer_material_versions")) return { visibility: "REVIEWER_ONLY", payload_json: "{}" };
    return null;
  }
  async transaction(statements) { this.transactions.push(statements); return statements.map(() => ({ affectedRows: 1, returnedRows: [], metadata: { provider: "d1" } })); }
  async execute(statement) { this.executions.push(statement); return { affectedRows: 1, returnedRows: [], metadata: { provider: "d1" } }; }
  async query() { return { rows: [], rowCount: 0, metadata: { provider: "d1" } }; }
  async healthCheck() { return true; }
}

test("direct repository creation requires server authority before any persistence access", async () => {
  const db = new FakeDatabase();
  await assert.rejects(() => new PracticalGovernanceRepository(db).createGovernedPractical(input), authorityDenial);
  assertNoPersistenceAccess(db);
});
test("previously caller-supplied exact replay does not supply current authority", async () => {
  const db = new FakeDatabase({ ...row, practical_id: "cp-1", version_id: "pv-1" });
  const repository = new PracticalGovernanceRepository(db);
  await assert.rejects(() => repository.createGovernedPractical(input), authorityDenial);
  await assert.rejects(() => repository.createGovernedPractical(JSON.parse(JSON.stringify(input))), authorityDenial);
  assertNoPersistenceAccess(db);
});
test("changed semantics and new versions cannot bypass the same denial", async () => {
  const db = new FakeDatabase({ ...row, practical_id: "cp-1", version_id: "pv-1", semantic_hash: "9".repeat(64) });
  const repository = new PracticalGovernanceRepository(db);
  await assert.rejects(() => repository.createGovernedPractical(input), authorityDenial);
  await assert.rejects(() => repository.createGovernedPractical({ ...input, version: 2, practicalVersionId: "pv-2" }), authorityDenial);
  assertNoPersistenceAccess(db);
});
test("reviewer material is unavailable through learner version projection", async () => {
  const db = new FakeDatabase();
  const version = await new PracticalGovernanceRepository(db).getLearnerVisibleVersion("pv-1");
  assert.equal(version, null);
});

const evaluationModel = {
  modelVersion: "PRACTICAL_EVALUATION_MODEL_V1",
  hashContractVersion: "EVALUATION_SEMANTIC_HASH_V1",
  evaluationMethod: "HYBRID",
  criteria: [{ key: "criterion:one", statement: "Assess the governed behavior.", score: { minimum: "0", passing: "0.5", maximum: "1" } }],
  scoringScale: { minimum: "0", passing: "0.5", maximum: "1" }, aggregation: "EQUAL_WEIGHT", passFailRules: [], requiredOutputs: [], reviewerRules: [],
};

test("valid server-recomputed evaluation identities do not grant write authority", async () => {
  const db = new FakeDatabase();
  const hash = evaluationSemanticHashV1(evaluationModel);
  const validated = validateGovernedEvaluationV1(evaluationModel, hash);
  assert.equal(validated.canonicalPayload, canonicalPersistedEvaluationPayloadV1(evaluationModel));
  assert.equal(validated.snapshotDigest, snapshotDigestV1(evaluationModel));
  await assert.rejects(() => new PracticalGovernanceRepository(db).createGovernedPractical({ ...input, evaluationModel, evaluationSemanticHash: hash, rubricSnapshotJson: "caller supplied lossy text", rubricSnapshotDigest: "0".repeat(64) }), authorityDenial);
  assertNoPersistenceAccess(db);
});

test("caller semantic hash is assertion-only", async () => {
  await assert.rejects(() => new PracticalGovernanceRepository(new FakeDatabase()).createGovernedPractical({ ...input, evaluationModel, evaluationSemanticHash: "e".repeat(64) }), /EVALUATION_SEMANTIC_HASH_MISMATCH/);
});

test("V1 replay rejects all required corruption cases", () => {
  const payload = canonicalPersistedEvaluationPayloadV1(evaluationModel);
  const digest = snapshotDigestV1(evaluationModel);
  const hash = evaluationSemanticHashV1(evaluationModel);
  const cases = [
    undefined,
    "{",
    JSON.stringify({ ...evaluationModel, modelVersion: "UNKNOWN" }),
    JSON.stringify({ ...evaluationModel, hashContractVersion: "UNKNOWN" }),
    JSON.stringify(Object.fromEntries(Object.entries(evaluationModel).filter(([key]) => key !== "scoringScale"))),
    JSON.stringify({ ...evaluationModel, requiredOutputs: undefined }),
    JSON.stringify({ ...evaluationModel, reviewerRules: undefined }),
    payload.replace('"minimum":"0"', '"minimum":"0.00"'),
    payload,
    JSON.stringify({ ...evaluationModel, criteria: [evaluationModel.criteria[0], evaluationModel.criteria[0]] }),
    payload,
  ];
  const rejects = cases.map((candidate, index) => {
    try {
      replayGovernedEvaluationV1(candidate, index === 8 ? "0".repeat(64) : digest, index === 10 ? "0".repeat(64) : hash);
      return false;
    } catch {
      return true;
    }
  });
  assert.deepEqual(rejects, Array(11).fill(true));
});

test("concurrent equivalent or changed payloads all deny without canonical access", async () => {
  const db = new FakeDatabase();
  const repository = new PracticalGovernanceRepository(db);
  const payloads = [input, JSON.parse(JSON.stringify(input)), { ...input, semanticHash: "3".repeat(64) }];
  await Promise.all(payloads.map((payload) => assert.rejects(() => repository.createGovernedPractical(payload), authorityDenial)));
  assertNoPersistenceAccess(db);
});

for (const lifecycle of ["DRAFT", "HUMAN_APPROVED", "CANONICAL_UNPUBLISHED", "SUPERSEDED"]) {
  test(`direct repository ${lifecycle} claims cannot authorize a write`, async () => {
    const db = new FakeDatabase();
    await assert.rejects(() => new PracticalGovernanceRepository(db).createGovernedPractical({
      ...input, lifecycle,
      rightsBinding: "APPROVED:ORIGINAL", provenanceBinding: "APPROVED:CURRENT",
      conceptBindings: input.conceptBindings.map((binding) => ({ ...binding, mappingStatus: "APPROVED" })),
      mutationLabel: "CANONICAL_CONTENT_REGISTRATION", replay: { accepted: true }, capability: { authorized: true },
    }), authorityDenial);
    assertNoPersistenceAccess(db);
  });
}

for (const [from, to] of [
  ["DRAFT", "DRAFT"], ["DRAFT", "HUMAN_APPROVED"],
  ["HUMAN_APPROVED", "HUMAN_APPROVED"], ["HUMAN_APPROVED", "CANONICAL_UNPUBLISHED"],
  ["CANONICAL_UNPUBLISHED", "CANONICAL_UNPUBLISHED"], ["CANONICAL_UNPUBLISHED", "SUPERSEDED"],
  ["SUPERSEDED", "SUPERSEDED"],
]) {
  test(`lifecycle ${from} -> ${to} requires server authority`, async () => {
    const db = new FakeDatabase();
    await assert.rejects(() => new PracticalGovernanceRepository(db).transitionLifecycle("pv-1", from, to), authorityDenial);
    assertNoPersistenceAccess(db);
  });
}

test("invalid lifecycle and missing governance bindings retain validation errors", async () => {
  const db = new FakeDatabase();
  const repository = new PracticalGovernanceRepository(db);
  await assert.rejects(() => repository.transitionLifecycle("pv-1", "DRAFT", "SUPERSEDED"), /INVALID_PRACTICAL_GOVERNANCE_LIFECYCLE_TRANSITION/);
  await assert.rejects(() => repository.createGovernedPractical({ ...input, humanReviewHash: "0".repeat(64) }), /HUMAN_REVIEW_BINDING_REQUIRED/);
  await assert.rejects(() => repository.createGovernedPractical({ ...input, rightsBinding: "" }), /GOVERNANCE_BINDING_REQUIRED/);
  assertNoPersistenceAccess(db);
});

test("supersession requires the same server authority", async () => {
  const db = new FakeDatabase();
  await assert.rejects(() => new PracticalGovernanceRepository(db).supersedeVersion("pv-1", "pv-2"), authorityDenial);
  assertNoPersistenceAccess(db);
});

test("read-only evaluation replay and reviewer visibility remain available", async () => {
  const db = new FakeDatabase();
  db.queryOne = async () => ({ snapshot_json: canonicalPersistedEvaluationPayloadV1(evaluationModel), snapshot_digest: snapshotDigestV1(evaluationModel), evaluation_semantic_hash: evaluationSemanticHashV1(evaluationModel) });
  const repository = new PracticalGovernanceRepository(db);
  const replayed = await repository.replayEvaluationVersion("pv-1");
  assert.equal(evaluationSemanticHashV1(replayed), evaluationSemanticHashV1(evaluationModel));
  assert.ok(await repository.getReviewerMaterial("pv-1", { actorRole: "CONTENT_REVIEWER" }));
  await assert.rejects(() => repository.getReviewerMaterial("pv-1", { actorRole: "LEARNER" }), /PRACTICAL_REVIEWER_MATERIAL_FORBIDDEN/);
  assert.deepEqual(db.executions, []);
  assert.deepEqual(db.transactions, []);
});

test("authority denial exposes a stable server-owned error through the existing error interface", async () => {
  const db = new FakeDatabase();
  await assert.rejects(() => new PracticalGovernanceRepository(db).createGovernedPractical(input), (error) => {
    const response = publicError(error, "practical-denial-test");
    assert.equal(response.status, 503);
    assert.equal(response.body.code, PRACTICAL_SERVER_AUTHORITY_REQUIRED);
    assert.equal(response.body.requestId, "practical-denial-test");
    return true;
  });
  assertNoPersistenceAccess(db);
});

function assertNoPersistenceAccess(db) {
  assert.deepEqual(db.queries, []);
  assert.deepEqual(db.executions, []);
  assert.deepEqual(db.transactions, []);
}
