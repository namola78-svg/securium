import type { DatabaseProvider, DatabaseStatement } from "./provider/database-provider.ts";
import {
  assertReviewerOnlyVisibility,
  comparePracticalGovernanceReplay,
  validateLifecycleTransition,
  validatePracticalGovernanceInput,
  validateGovernedEvaluationV1,
  replayGovernedEvaluationV1,
  type PracticalGovernanceInput,
  type PracticalGovernanceLifecycle,
} from "../lib/practical/practical-governance-validation.ts";

export type PracticalGovernanceReadContext = Readonly<{
  actorRole: "CONTENT_REVIEWER" | "ADMIN" | "SUPER_ADMIN" | "SYSTEM";
}>;

export class PracticalGovernanceRepository {
  private readonly database: DatabaseProvider;

  constructor(database: DatabaseProvider) {
    this.database = database;
  }

  async createGovernedPractical(input: PracticalGovernanceInput): Promise<{ outcome: "NEW_SUCCESS" | "EXACT_REPLAY" | "NEW_VERSION_REQUIRED"; practicalId: string; practicalVersionId: string }> {
    const semanticInput = input.evaluationModel ?? input.evaluation;
    const governed = semanticInput === undefined ? null : validateGovernedEvaluationV1(semanticInput, input.evaluationSemanticHash);
    const persistedInput: PracticalGovernanceInput = governed ? { ...input, evaluationSemanticHash: governed.evaluationSemanticHash, rubricSnapshotJson: governed.canonicalPayload, rubricSnapshotDigest: governed.snapshotDigest } : input;
    validatePracticalGovernanceInput(persistedInput);
    const existing = await this.database.queryOne<Record<string, unknown>>({
      sql: `SELECT p.id AS practical_id, v.id AS version_id, v.version, v.semantic_hash, v.human_review_hash,
        v.safety_review_hash, v.concept_mapping_hash, r.evaluation_semantic_hash
        FROM canonical_practicals p LEFT JOIN practical_governance_versions v ON v.practical_id = p.id AND v.version = ?
        LEFT JOIN practical_reviewer_material_versions m ON m.practical_version_id = v.id
        LEFT JOIN practical_rubric_versions r ON r.id = m.rubric_version_id
        WHERE p.semantic_key = ? LIMIT 1`,
      parameters: [persistedInput.version, persistedInput.semanticKey],
    });
    if (existing?.version_id) {
      const replay = comparePracticalGovernanceReplay(
        {
          semanticHash: String(existing.semantic_hash),
          humanReviewHash: String(existing.human_review_hash),
          safetyReviewHash: String(existing.safety_review_hash),
          conceptMappingHash: String(existing.concept_mapping_hash),
          evaluationSemanticHash: String(existing.evaluation_semantic_hash),
        },
        persistedInput,
      );
      if (replay === "CONFLICT") throw new Error("PRACTICAL_GOVERNANCE_CONFLICT");
      return { outcome: "EXACT_REPLAY", practicalId: String(existing.practical_id), practicalVersionId: String(existing.version_id) };
    }
    const practicalId = existing?.practical_id ? String(existing.practical_id) : persistedInput.practicalId;
    const statements: DatabaseStatement[] = [];
    if (!existing?.practical_id) {
      statements.push({
        sql: `INSERT INTO canonical_practicals (id, semantic_key, lifecycle, created_by) VALUES (?, ?, ?, ?)`,
        parameters: [practicalId, persistedInput.semanticKey, persistedInput.lifecycle, persistedInput.createdBy],
      });
    }
    statements.push({
      sql: `INSERT INTO practical_rubric_versions
        (id, rubric_id, version, evaluation_semantic_hash, evaluation_method, human_review_hash, evidence_classification,
         snapshot_format_version, snapshot_json, snapshot_digest, effective_from)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP)`,
      parameters: [persistedInput.rubricVersionId, persistedInput.rubricId, persistedInput.rubricVersion, persistedInput.evaluationSemanticHash, persistedInput.evaluationMethod, persistedInput.humanReviewHash, persistedInput.evidenceClassification, persistedInput.rubricSnapshotJson, persistedInput.rubricSnapshotDigest],
    });
    statements.push({
      sql: `INSERT INTO practical_governance_versions
        (id, practical_id, version, semantic_hash, human_review_hash, safety_review_hash, rights_binding, provenance_binding,
         concept_mapping_hash, theory_dependency_json, currentness_reference, lifecycle, superseded_by_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameters: [persistedInput.practicalVersionId, practicalId, persistedInput.version, persistedInput.semanticHash, persistedInput.humanReviewHash, persistedInput.safetyReviewHash, persistedInput.rightsBinding, persistedInput.provenanceBinding, persistedInput.conceptMappingHash, persistedInput.theoryDependencyJson, persistedInput.currentnessReference, persistedInput.lifecycle, persistedInput.supersededById ?? null, persistedInput.createdBy],
    });
    statements.push({
      sql: `INSERT INTO practical_reviewer_material_versions
        (id, practical_version_id, rubric_version_id, payload_json, payload_digest, visibility)
        VALUES (?, ?, ?, ?, ?, 'REVIEWER_ONLY')`,
      parameters: [persistedInput.reviewerMaterialId, persistedInput.practicalVersionId, persistedInput.rubricVersionId, persistedInput.reviewerMaterialJson, persistedInput.reviewerMaterialDigest],
    });
    for (const binding of persistedInput.conceptBindings) {
      statements.push({
        sql: `INSERT INTO practical_version_concept_bindings
          (id, practical_version_id, concept_key, concept_id, mapping_semantic_hash, qualification_json, mapping_status)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        parameters: [binding.id, persistedInput.practicalVersionId, binding.conceptKey, binding.conceptId ?? null, binding.mappingSemanticHash, binding.qualificationJson, binding.mappingStatus ?? "PENDING"],
      });
    }
    try {
      await this.database.transaction(statements);
    } catch (error) {
      const concurrent = await this.database.queryOne<Record<string, unknown>>({
        sql: `SELECT p.id AS practical_id, v.id AS version_id, v.semantic_hash, v.human_review_hash, v.safety_review_hash,
          v.concept_mapping_hash, r.evaluation_semantic_hash
          FROM canonical_practicals p JOIN practical_governance_versions v ON v.practical_id = p.id
          JOIN practical_reviewer_material_versions m ON m.practical_version_id = v.id
          JOIN practical_rubric_versions r ON r.id = m.rubric_version_id
          WHERE p.semantic_key = ? AND v.version = ? LIMIT 1`,
        parameters: [persistedInput.semanticKey, persistedInput.version],
      });
      if (concurrent && comparePracticalGovernanceReplay(
        { semanticHash: String(concurrent.semantic_hash), humanReviewHash: String(concurrent.human_review_hash), safetyReviewHash: String(concurrent.safety_review_hash), conceptMappingHash: String(concurrent.concept_mapping_hash), evaluationSemanticHash: String(concurrent.evaluation_semantic_hash) },
        persistedInput,
      ) === "EXACT_REPLAY") return { outcome: "EXACT_REPLAY", practicalId: String(concurrent.practical_id), practicalVersionId: String(concurrent.version_id) };
      throw error;
    }
    return { outcome: existing?.practical_id ? "NEW_VERSION_REQUIRED" : "NEW_SUCCESS", practicalId, practicalVersionId: persistedInput.practicalVersionId };
  }

  async replayEvaluationVersion(practicalVersionId: string) {
    const row = await this.database.queryOne<Record<string, unknown>>({
      sql: `SELECT r.snapshot_json, r.snapshot_digest, r.evaluation_semantic_hash
        FROM practical_reviewer_material_versions m JOIN practical_rubric_versions r ON r.id = m.rubric_version_id
        WHERE m.practical_version_id = ? LIMIT 1`,
      parameters: [practicalVersionId],
    });
    if (!row) throw new Error("EVALUATION_VERSION_NOT_FOUND");
    return replayGovernedEvaluationV1(row.snapshot_json, row.snapshot_digest, row.evaluation_semantic_hash);
  }

  async transitionLifecycle(practicalVersionId: string, from: PracticalGovernanceLifecycle, to: PracticalGovernanceLifecycle) {
    validateLifecycleTransition({ from, to });
    const result = await this.database.execute({
      sql: `UPDATE practical_governance_versions SET lifecycle = ? WHERE id = ? AND lifecycle = ?`,
      parameters: [to, practicalVersionId, from],
    });
    if (result.affectedRows !== 1) throw new Error("PRACTICAL_GOVERNANCE_LIFECYCLE_CONFLICT");
  }

  async supersedeVersion(previousVersionId: string, replacementVersionId: string) {
    const result = await this.database.execute({
      sql: `UPDATE practical_governance_versions
        SET lifecycle = 'SUPERSEDED', superseded_by_id = ?
        WHERE id = ? AND lifecycle = 'CANONICAL_UNPUBLISHED'`,
      parameters: [replacementVersionId, previousVersionId],
    });
    if (result.affectedRows !== 1) throw new Error("PRACTICAL_GOVERNANCE_SUPERSESSION_CONFLICT");
  }

  async getLearnerVisibleVersion(practicalVersionId: string) {
    return this.database.queryOne<Record<string, unknown>>({
      sql: `SELECT id, practical_id, version, semantic_hash, lifecycle, concept_mapping_hash, theory_dependency_json, currentness_reference
        FROM practical_governance_versions WHERE id = ? LIMIT 1`,
      parameters: [practicalVersionId],
    });
  }

  async getReviewerMaterial(practicalVersionId: string, context: PracticalGovernanceReadContext) {
    if (!["CONTENT_REVIEWER", "ADMIN", "SUPER_ADMIN", "SYSTEM"].includes(context.actorRole)) throw new Error("PRACTICAL_REVIEWER_MATERIAL_FORBIDDEN");
    assertReviewerOnlyVisibility("REVIEWER_ONLY");
    return this.database.queryOne<Record<string, unknown>>({
      sql: `SELECT * FROM practical_reviewer_material_versions WHERE practical_version_id = ? AND visibility = 'REVIEWER_ONLY' LIMIT 1`,
      parameters: [practicalVersionId],
    });
  }
}
