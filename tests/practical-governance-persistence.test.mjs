import assert from "node:assert/strict";
import { test } from "node:test";
import { PracticalGovernanceRepository } from "../db/practical-governance-repositories.ts";
import { evaluationSemanticHashV1, canonicalPersistedEvaluationPayloadV1, snapshotDigestV1 } from "../lib/practical/practical-evaluation-semantic-hash.ts";
import { replayGovernedEvaluationV1 } from "../lib/practical/practical-governance-validation.ts";

const row = { id: "pv-1", practical_id: "cp-1", version: 1, semantic_hash: "a".repeat(64), human_review_hash: "b".repeat(64), safety_review_hash: "c".repeat(64), concept_mapping_hash: "d".repeat(64), evaluation_semantic_hash: "e".repeat(64) };
const input = { practicalId: "cp-1", semanticKey: "practical.swsec.input.command-resource", practicalVersionId: "pv-1", version: 1, semanticHash: row.semantic_hash, humanReviewHash: row.human_review_hash, safetyReviewHash: row.safety_review_hash, rightsBinding: "SECURIUM_ORIGINAL", provenanceBinding: "official:swsec", conceptMappingHash: row.concept_mapping_hash, theoryDependencyJson: "{}", currentnessReference: "source:current", lifecycle: "DRAFT", createdBy: "actor", rubricVersionId: "rv-1", rubricId: "rubric:swsec:command-resource", rubricVersion: 1, evaluationSemanticHash: row.evaluation_semantic_hash, evaluationMethod: "HYBRID", evidenceClassification: "ELIGIBLE_PERFORMANCE_EVIDENCE", rubricSnapshotJson: "{}", rubricSnapshotDigest: "f".repeat(64), reviewerMaterialId: "rm-1", reviewerMaterialJson: "{}", reviewerMaterialDigest: "1".repeat(64), conceptBindings: [{ id: "cb-1", conceptKey: "swsec.input.command-resource", mappingSemanticHash: "2".repeat(64), qualificationJson: "{}" }] };

class FakeDatabase {
  constructor(existing = null) { this.existing = existing; this.transactions = []; }
  async queryOne(statement) {
    if (statement.sql.includes("FROM canonical_practicals") && this.existing) return this.existing;
    if (statement.sql.includes("FROM practical_reviewer_material_versions")) return { visibility: "REVIEWER_ONLY", payload_json: "{}" };
    return null;
  }
  async transaction(statements) { this.transactions.push(statements); return statements.map(() => ({ affectedRows: 1, returnedRows: [], metadata: { provider: "d1" } })); }
  async execute() { return { affectedRows: 1, returnedRows: [], metadata: { provider: "d1" } }; }
  async query() { return { rows: [], rowCount: 0, metadata: { provider: "d1" } }; }
  async healthCheck() { return true; }
}

test("NEW_SUCCESS is atomic across identity, rubric, version, reviewer material, and mappings", async () => {
  const db = new FakeDatabase();
  const result = await new PracticalGovernanceRepository(db).createGovernedPractical(input);
  assert.equal(result.outcome, "NEW_SUCCESS");
  assert.equal(db.transactions.length, 1);
  assert.equal(db.transactions[0].length, 5);
});
test("EXACT_REPLAY is a no-op when governed hashes match", async () => {
  const db = new FakeDatabase({ ...row, practical_id: "cp-1", version_id: "pv-1" });
  const result = await new PracticalGovernanceRepository(db).createGovernedPractical(input);
  assert.equal(result.outcome, "EXACT_REPLAY");
  assert.equal(db.transactions.length, 0);
});
test("same version with changed semantics fails closed", async () => {
  const db = new FakeDatabase({ ...row, practical_id: "cp-1", version_id: "pv-1", semantic_hash: "9".repeat(64) });
  await assert.rejects(() => new PracticalGovernanceRepository(db).createGovernedPractical(input), /PRACTICAL_GOVERNANCE_CONFLICT/);
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

test("V1 writes the complete canonical snapshot and server recomputes both identities", async () => {
  const db = new FakeDatabase();
  const hash = evaluationSemanticHashV1(evaluationModel);
  const result = await new PracticalGovernanceRepository(db).createGovernedPractical({ ...input, evaluationModel, evaluationSemanticHash: hash, rubricSnapshotJson: "caller supplied lossy text", rubricSnapshotDigest: "0".repeat(64) });
  assert.equal(result.outcome, "NEW_SUCCESS");
  const rubricInsert = db.transactions[0].find((statement) => statement.sql.includes("INSERT INTO practical_rubric_versions"));
  assert.equal(rubricInsert.parameters[7], canonicalPersistedEvaluationPayloadV1(evaluationModel));
  assert.equal(rubricInsert.parameters[8], snapshotDigestV1(evaluationModel));
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

class ConcurrentV1Database extends FakeDatabase {
  constructor({ failCommit = false } = {}) {
    super();
    this.state = null;
    this.failCommit = failCommit;
    this.readBarrier = null;
  }
  async queryOne(statement) {
    if (statement.sql.includes("FROM canonical_practicals")) {
      if (this.readBarrier) await this.readBarrier;
      if (!this.state) return null;
      return { ...this.state, practical_id: "cp-1", version_id: "pv-1" };
    }
    if (statement.sql.includes("FROM practical_reviewer_material_versions")) return { visibility: "REVIEWER_ONLY", payload_json: "{}" };
    return null;
  }
  async transaction(statements) {
    if (this.failCommit) throw new Error("ATOMIC_COMMIT_FAILURE");
    if (this.state) throw new Error("UNIQUE_VERSION_CONFLICT");
    const rubric = statements.find((statement) => statement.sql.includes("INSERT INTO practical_rubric_versions"));
    const governance = statements.find((statement) => statement.sql.includes("INSERT INTO practical_governance_versions"));
    this.state = {
      semantic_hash: governance.parameters[3],
      human_review_hash: governance.parameters[4],
      safety_review_hash: governance.parameters[5],
      concept_mapping_hash: governance.parameters[8],
      evaluation_semantic_hash: rubric.parameters[3],
    };
    return statements.map(() => ({ affectedRows: 1, returnedRows: [], metadata: { provider: "d1" } }));
  }
}

const concurrentModel = evaluationModel;
const concurrentHash = evaluationSemanticHashV1(concurrentModel);
const concurrentInput = { ...input, evaluationModel: concurrentModel, evaluationSemanticHash: concurrentHash };
const differentConcurrentModel = { ...concurrentModel, criteria: [{ ...concurrentModel.criteria[0], statement: "A different governed statement." }] };
const differentConcurrentInput = { ...concurrentInput, evaluationModel: differentConcurrentModel, evaluationSemanticHash: evaluationSemanticHashV1(differentConcurrentModel) };

test("CONC-01 same version and same payload is deterministic exact replay", async () => {
  const db = new ConcurrentV1Database();
  const [first, second] = await Promise.all([
    new PracticalGovernanceRepository(db).createGovernedPractical(concurrentInput),
    new PracticalGovernanceRepository(db).createGovernedPractical(concurrentInput),
  ]);
  assert.equal(first.outcome, "NEW_SUCCESS");
  assert.equal(second.outcome, "EXACT_REPLAY");
  assert.deepEqual(db.state && Object.keys(db.state).sort(), ["concept_mapping_hash", "evaluation_semantic_hash", "human_review_hash", "safety_review_hash", "semantic_hash"]);
});

test("CONC-02 same version and different payload rejects rebinding", async () => {
  const db = new ConcurrentV1Database();
  await new PracticalGovernanceRepository(db).createGovernedPractical(concurrentInput);
  await assert.rejects(() => new PracticalGovernanceRepository(db).createGovernedPractical(differentConcurrentInput), /PRACTICAL_GOVERNANCE_CONFLICT/);
});

test("CONC-03 failed commit leaves no partial authoritative state", async () => {
  const db = new ConcurrentV1Database({ failCommit: true });
  await assert.rejects(() => new PracticalGovernanceRepository(db).createGovernedPractical(concurrentInput), /ATOMIC_COMMIT_FAILURE/);
  assert.equal(db.state, null);
});

test("CONC-04 concurrent equivalent replay resolves to one authoritative state", async () => {
  const db = new ConcurrentV1Database();
  const firstRead = new Promise((resolve) => { db.readBarrier = new Promise((release) => { resolve(release); }); });
  const first = new PracticalGovernanceRepository(db).createGovernedPractical(concurrentInput);
  const second = new PracticalGovernanceRepository(db).createGovernedPractical(concurrentInput);
  (await firstRead)();
  const results = await Promise.all([first, second]);
  assert.equal(results.filter((result) => result.outcome === "NEW_SUCCESS").length, 1);
  assert.equal(results.filter((result) => result.outcome === "EXACT_REPLAY").length, 1);
  assert.equal(db.state?.evaluation_semantic_hash, concurrentHash);
});
