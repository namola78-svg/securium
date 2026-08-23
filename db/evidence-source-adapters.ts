import { AppError } from "../lib/errors.ts";
import { computeConceptMappingSetHash, sha256, stableJson, type LearningEventSourceType } from "../lib/services/learning-event-contracts.ts";
import type { CanonicalEvidenceSource } from "../lib/services/evidence-projection.ts";
import type { CanonicalEvidenceSourceResolver } from "../lib/services/evidence-recompute.ts";
import type { DatabaseProvider } from "./provider/database-provider.ts";

type ResolveInput = Readonly<{ sourceType: LearningEventSourceType; sourceEventId: string; sourceRevisionIdentity: string }>;

export class DatabaseEvidenceSourceResolver implements CanonicalEvidenceSourceResolver {
  private readonly database: DatabaseProvider;
  constructor(database: DatabaseProvider) { this.database = database; }

  async resolveEvent(input: ResolveInput): Promise<CanonicalEvidenceSource | null> {
    if (input.sourceType === "QUESTION_ATTEMPT" || input.sourceType === "MOCK_ITEM_RESULT") return this.resolveQuestion(input);
    if (input.sourceType === "MOCK_ATTEMPT") return this.resolveMock(input);
    if (input.sourceType === "PRACTICAL_EVALUATION") return this.resolvePractical(input);
    if (["LESSON_PROGRESS", "COURSE_LESSON_PROGRESS", "LECTURE_PROGRESS", "AUDIO_PROGRESS"].includes(input.sourceType)) return this.resolveProgress(input);
    return null;
  }

  private async resolveQuestion(input: ResolveInput): Promise<CanonicalEvidenceSource | null> {
    const mock = input.sourceType === "MOCK_ITEM_RESULT";
    const row = await this.database.queryOne<Record<string, unknown>>({
      sql: mock ? `SELECT a.id, m.user_id, a.question_version_id, a.concept_mapping_set_hash,
          a.is_correct, a.score, a.answered_at AS occurred_at, v.semantic_hash AS version_hash
        FROM mock_exam_answers a JOIN mock_exam_attempts m ON m.id = a.attempt_id
        LEFT JOIN question_versions v ON v.id = a.question_version_id WHERE a.id = ? LIMIT 1`
        : `SELECT a.id, a.user_id, a.question_version_id, a.concept_mapping_set_hash,
          a.is_correct, a.score, a.attempted_at AS occurred_at, v.semantic_hash AS version_hash
        FROM question_attempts a LEFT JOIN question_versions v ON v.id = a.question_version_id WHERE a.id = ? LIMIT 1`,
      parameters: [input.sourceEventId],
    });
    if (!row) return null;
    if (!row.question_version_id || !row.concept_mapping_set_hash || !row.version_hash) return legacy(input, row);
    const mappings = await this.questionMappings(String(row.question_version_id));
    const mappingHash = await computeConceptMappingSetHash(mappings.map((item) => ({ conceptIdentity: item.concept_key, mappingVersion: Number(item.mapping_version), qualification: parse(item.qualification_json), provenance: parse(item.provenance_json), status: "APPROVED" as const })));
    if (mappingHash !== row.concept_mapping_set_hash) invalid("EVIDENCE_MAPPING_SET_MISMATCH");
    const revision = await this.latestRevision(input);
    const validity = revision?.action === "INVALIDATE" ? "INVALIDATED" : "ELIGIBLE";
    const corrected = revision && revision.action === "CORRECT" ? parse(revision.correction_payload_json) as Record<string, unknown> : {};
    return {
      sourceType: input.sourceType as CanonicalEvidenceSource["sourceType"], sourceEventId: input.sourceEventId,
      sourceRevisionIdentity: revision?.semantic_hash ?? input.sourceRevisionIdentity,
      userId: String(row.user_id), contentVersionIdentity: String(row.question_version_id),
      conceptMappingSetHash: mappingHash, conceptIds: mappings.map((item) => item.concept_id).sort(),
      occurredAt: String(row.occurred_at), validity, evidenceType: "PERFORMANCE_RESULT",
      quality: "DIRECT_PERFORMANCE",
      resultSummary: { correct: Boolean(corrected.isCorrect ?? row.is_correct), score: Number(corrected.score ?? row.score ?? 0) },
      sourceSemanticHash: String(row.version_hash),
    };
  }

  private async resolveMock(input: ResolveInput): Promise<CanonicalEvidenceSource | null> {
    const row = await this.database.queryOne<Record<string, unknown>>({ sql: `SELECT id, user_id, composition_semantic_hash, score, correct_count, wrong_count, unanswered_count, submitted_at FROM mock_exam_attempts WHERE id = ? LIMIT 1`, parameters: [input.sourceEventId] });
    if (!row) return null;
    if (!row.composition_semantic_hash || !row.submitted_at) return legacy(input, row);
    const mappingRows = await this.database.query<Record<string, unknown>>({ sql: `SELECT DISTINCT c.id AS concept_id, c.concept_key, qc.mapping_version, qc.qualification_json, qc.provenance_json
      FROM mock_exam_answers a JOIN question_concepts qc ON qc.question_version_id = a.question_version_id AND qc.mapping_status = 'APPROVED'
      JOIN ontology_concepts c ON c.id = qc.concept_id AND c.status = 'ACTIVE' WHERE a.attempt_id = ? ORDER BY c.concept_key`, parameters: [input.sourceEventId] });
    if (!mappingRows.rows.length) invalid("EVIDENCE_CONCEPT_MAPPING_MISSING");
    const mappingHash = await sha256(stableJson(mappingRows.rows.map((item) => ({ conceptIdentity: item.concept_key, mappingVersion: Number(item.mapping_version), qualification: parse(item.qualification_json), provenance: parse(item.provenance_json) }))));
    const revision = await this.latestRevision(input);
    const corrected = revision?.action === "CORRECT" ? parse(revision.correction_payload_json) as Record<string, unknown> : {};
    return { sourceType: "MOCK_ATTEMPT", sourceEventId: input.sourceEventId, sourceRevisionIdentity: revision?.semantic_hash ?? input.sourceRevisionIdentity,
      userId: String(row.user_id), contentVersionIdentity: String(row.composition_semantic_hash), conceptMappingSetHash: mappingHash,
      conceptIds: mappingRows.rows.map((item) => String(item.concept_id)).sort(), occurredAt: String(row.submitted_at),
      validity: revision?.action === "INVALIDATE" ? "INVALIDATED" : "ELIGIBLE", evidenceType: "PERFORMANCE_RESULT", quality: "DIRECT_PERFORMANCE",
      resultSummary: { score: Number(corrected.score ?? row.score), correctCount: Number(corrected.correctCount ?? row.correct_count), wrongCount: Number(corrected.wrongCount ?? row.wrong_count), unansweredCount: Number(corrected.unansweredCount ?? row.unanswered_count) },
      sourceSemanticHash: String(row.composition_semantic_hash) };
  }

  private async resolvePractical(input: ResolveInput): Promise<CanonicalEvidenceSource | null> {
    const row = await this.database.queryOne<Record<string, unknown>>({ sql: `SELECT e.id, a.user_id, a.practical_id, e.practical_definition_version_id, e.rubric_version_id,
      e.method, e.raw_score, e.maximum_score, e.qualification, e.review_status, e.evaluation_payload_digest, e.evaluated_at
      FROM practical_evaluations e JOIN practical_attempts a ON a.id = e.attempt_id WHERE e.id = ? LIMIT 1`, parameters: [input.sourceEventId] });
    if (!row) return null;
    const eligible = row.qualification === "QUALIFIED" && (row.method !== "HUMAN_REVIEWED" || row.review_status === "COMPLETED");
    const concepts = await this.edgeConcepts("PRACTICAL", String(row.practical_id));
    if (!concepts.length) invalid("EVIDENCE_CONCEPT_MAPPING_MISSING");
    const mappingHash = await sha256(stableJson(concepts.map((item) => ({ edgeKey: item.edge_key, conceptId: item.concept_id }))));
    return { sourceType: "PRACTICAL_EVALUATION", sourceEventId: input.sourceEventId, sourceRevisionIdentity: input.sourceRevisionIdentity,
      userId: String(row.user_id), contentVersionIdentity: `${row.practical_definition_version_id}:${row.rubric_version_id}`,
      conceptMappingSetHash: mappingHash, conceptIds: concepts.map((item) => item.concept_id).sort(), occurredAt: String(row.evaluated_at),
      validity: eligible ? "ELIGIBLE" : "LEGACY_INELIGIBLE", evidenceType: "PRACTICAL_PERFORMANCE",
      quality: row.method === "HUMAN_REVIEWED" ? "HUMAN_EVALUATED" : "DIRECT_PERFORMANCE",
      resultSummary: { rawScore: Number(row.raw_score ?? 0), maximumScore: Number(row.maximum_score ?? 0), qualification: String(row.qualification) },
      sourceSemanticHash: String(row.evaluation_payload_digest) };
  }

  private async resolveProgress(input: ResolveInput): Promise<CanonicalEvidenceSource | null> {
    const config = progressConfig[input.sourceType as keyof typeof progressConfig];
    if (!config) return null;
    const row = await this.database.queryOne<Record<string, unknown>>({ sql: `SELECT id, user_id, ${config.parentColumn} AS parent_id, ${config.versionColumn} AS version_id, ${config.completedColumn} AS completed, ${config.occurredColumn} AS occurred_at FROM ${config.table} WHERE id = ? LIMIT 1`, parameters: [input.sourceEventId] });
    if (!row) return null;
    if (!row.version_id) return legacy(input, row);
    const concepts = await this.edgeConcepts(config.ontologyType, String(row.parent_id));
    if (!concepts.length) invalid("EVIDENCE_CONCEPT_MAPPING_MISSING");
    const mappingHash = await sha256(stableJson(concepts.map((item) => ({ edgeKey: item.edge_key, conceptId: item.concept_id }))));
    const revision = await this.latestRevision(input);
    return { sourceType: input.sourceType as CanonicalEvidenceSource["sourceType"], sourceEventId: input.sourceEventId, sourceRevisionIdentity: revision?.semantic_hash ?? input.sourceRevisionIdentity,
      userId: String(row.user_id), contentVersionIdentity: String(row.version_id), conceptMappingSetHash: mappingHash,
      conceptIds: concepts.map((item) => item.concept_id).sort(), occurredAt: String(row.occurred_at),
      validity: revision?.action === "INVALIDATE" ? "INVALIDATED" : Boolean(row.completed) ? "ELIGIBLE" : "LEGACY_INELIGIBLE",
      evidenceType: "LEARNING_ACTIVITY", quality: "SUPPORTING_ACTIVITY", resultSummary: { completed: Boolean(row.completed) },
      sourceSemanticHash: await sha256(stableJson({ contentVersionIdentity: row.version_id, completed: Boolean(row.completed) })) };
  }

  private async questionMappings(questionVersionId: string) {
    const result = await this.database.query<{ concept_id: string; concept_key: string; mapping_version: number | string; qualification_json: string | null; provenance_json: string | null }>({ sql: `SELECT qc.concept_id, c.concept_key, qc.mapping_version, qc.qualification_json, qc.provenance_json FROM question_concepts qc JOIN ontology_concepts c ON c.id = qc.concept_id WHERE qc.question_version_id = ? AND qc.mapping_status = 'APPROVED' AND c.status = 'ACTIVE' ORDER BY c.concept_key`, parameters: [questionVersionId] });
    if (!result.rows.length) invalid("EVIDENCE_CONCEPT_MAPPING_MISSING");
    return result.rows;
  }
  private async edgeConcepts(fromType: string, fromId: string) {
    const result = await this.database.query<{ edge_key: string; concept_id: string }>({ sql: `SELECT e.edge_key, c.id AS concept_id FROM ontology_edges e JOIN ontology_concepts c ON c.id = e.to_id AND c.status = 'ACTIVE' WHERE e.from_type = ? AND e.from_id = ? AND e.to_type = 'CONCEPT' AND e.status = 'ACTIVE' AND e.relation IN ('TESTS', 'ASSESSED_BY', 'COVERS') ORDER BY e.edge_key`, parameters: [fromType, fromId] });
    return result.rows;
  }
  private latestRevision(input: ResolveInput) { return this.database.queryOne<{ action: string; semantic_hash: string; correction_payload_json: string }>({ sql: "SELECT action, semantic_hash, correction_payload_json FROM learning_event_revisions WHERE source_type = ? AND source_event_id = ? ORDER BY sequence DESC LIMIT 1", parameters: [input.sourceType, input.sourceEventId] }); }
}

const progressConfig = {
  LESSON_PROGRESS: { table: "user_lesson_progress", parentColumn: "lesson_id", versionColumn: "content_version", completedColumn: "status = 'COMPLETED'", occurredColumn: "last_studied_at", ontologyType: "LESSON" },
  COURSE_LESSON_PROGRESS: { table: "user_course_lesson_progress", parentColumn: "course_lesson_id", versionColumn: "content_version", completedColumn: "status = 'COMPLETED'", occurredColumn: "last_studied_at", ontologyType: "COURSE_LESSON" },
  LECTURE_PROGRESS: { table: "lecture_progress", parentColumn: "lecture_id", versionColumn: "content_revision_id", completedColumn: "completed", occurredColumn: "last_played_at", ontologyType: "LECTURE" },
  AUDIO_PROGRESS: { table: "audio_progress", parentColumn: "audio_content_id", versionColumn: "content_revision_id", completedColumn: "completed", occurredColumn: "last_played_at", ontologyType: "AUDIO_CONTENT" },
} as const;

function legacy(input: ResolveInput, row: Record<string, unknown>): CanonicalEvidenceSource {
  return { sourceType: input.sourceType as CanonicalEvidenceSource["sourceType"], sourceEventId: input.sourceEventId, sourceRevisionIdentity: input.sourceRevisionIdentity, userId: String(row.user_id), contentVersionIdentity: "LEGACY_UNKNOWN", conceptMappingSetHash: "0".repeat(64), conceptIds: ["LEGACY_UNKNOWN"], occurredAt: String(row.occurred_at ?? ""), validity: "LEGACY_INELIGIBLE", evidenceType: input.sourceType.includes("PROGRESS") ? "LEARNING_ACTIVITY" : "PERFORMANCE_RESULT", quality: input.sourceType.includes("PROGRESS") ? "SUPPORTING_ACTIVITY" : "DIRECT_PERFORMANCE", resultSummary: {}, sourceSemanticHash: "0".repeat(64) };
}
function parse(value: unknown) { if (typeof value !== "string" || !value) return null; try { return JSON.parse(value); } catch { invalid("EVIDENCE_SOURCE_METADATA_INVALID"); } }
function invalid(code: string): never { throw new AppError("Canonical Evidence adapter rejected its source.", 409, code); }
