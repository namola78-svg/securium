import assert from "node:assert/strict";
import { test } from "node:test";
import { PracticalGovernanceRepository } from "../db/practical-governance-repositories.ts";

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
