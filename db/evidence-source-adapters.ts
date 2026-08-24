import { AppError } from "../lib/errors.ts";
import {
  computeConceptMappingSetHash,
  sha256,
  stableJson,
  type LearningEventSourceType,
} from "../lib/services/learning-event-contracts.ts";
import type {
  CanonicalEvidenceSource,
  EvidenceMappingGuard,
} from "../lib/services/evidence-projection.ts";
import type {
  CanonicalEvidenceSourceResolver,
  EvidenceLineageInvalidation,
} from "../lib/services/evidence-recompute.ts";
import type { DatabaseProvider } from "./provider/database-provider.ts";

type ResolveInput = Readonly<{
  sourceType: LearningEventSourceType;
  sourceEventId: string;
  sourceRevisionIdentity: string;
}>;

type QuestionMappingRow = Readonly<{
  mapping_id: string;
  concept_id: string;
  concept_key: string;
  mapping_version: number | string;
  qualification_json: string | null;
  provenance_json: string | null;
}>;

type EdgeRow = Readonly<{ edge_key: string; concept_id: string }>;

export class DatabaseEvidenceSourceResolver
implements CanonicalEvidenceSourceResolver {
  private readonly database: DatabaseProvider;

  constructor(database: DatabaseProvider) {
    this.database = database;
  }

  async resolveEvent(input: ResolveInput): Promise<CanonicalEvidenceSource | null> {
    if (input.sourceType === "QUESTION_ATTEMPT" || input.sourceType === "MOCK_ITEM_RESULT") {
      return this.resolveQuestion(input);
    }
    if (input.sourceType === "MOCK_ATTEMPT") return this.resolveMock(input);
    if (input.sourceType === "PRACTICAL_EVALUATION") return this.resolvePractical(input);
    if (["LESSON_PROGRESS", "COURSE_LESSON_PROGRESS", "LECTURE_PROGRESS", "AUDIO_PROGRESS"].includes(input.sourceType)) {
      return this.resolveProgress(input);
    }
    return null;
  }

  async resolveLineageInvalidation(input: ResolveInput): Promise<EvidenceLineageInvalidation | null> {
    if (input.sourceType !== "PRACTICAL_ATTEMPT") return null;
    const row = await this.database.queryOne<Record<string, unknown>>({
      sql: "SELECT id, user_id, state FROM practical_attempts WHERE id = ? LIMIT 1",
      parameters: [input.sourceEventId],
    });
    if (!row || row.state !== "VOIDED") return null;
    return Object.freeze({
      sourceType: "PRACTICAL_EVALUATION",
      sourceLineageIdentity: String(row.id),
      sourceRevisionIdentity: input.sourceRevisionIdentity,
      userId: String(row.user_id),
      reasonCode: "PRACTICAL_ATTEMPT_VOIDED",
      guard: Object.freeze({ kind: "PRACTICAL_ATTEMPT_VOIDED" as const, attemptId: String(row.id) }),
    });
  }

  private async resolveQuestion(input: ResolveInput): Promise<CanonicalEvidenceSource | null> {
    const mock = input.sourceType === "MOCK_ITEM_RESULT";
    const row = await this.database.queryOne<Record<string, unknown>>({
      sql: mock
        ? `SELECT a.id, m.user_id, a.question_version_id, a.concept_mapping_set_hash,
            a.is_correct, a.score, a.answered_at AS occurred_at, v.semantic_hash AS version_hash
          FROM mock_exam_answers a JOIN mock_exam_attempts m ON m.id = a.attempt_id
          LEFT JOIN question_versions v ON v.id = a.question_version_id WHERE a.id = ? LIMIT 1`
        : `SELECT a.id, a.user_id, a.question_version_id, a.concept_mapping_set_hash,
            a.is_correct, a.score, a.attempted_at AS occurred_at, v.semantic_hash AS version_hash
          FROM question_attempts a LEFT JOIN question_versions v ON v.id = a.question_version_id WHERE a.id = ? LIMIT 1`,
      parameters: [input.sourceEventId],
    });
    if (!row) return null;
    if (!row.question_version_id || !row.concept_mapping_set_hash || !row.version_hash) {
      return legacy(input, row);
    }
    const revision = await this.latestRevision(input);
    if (revision?.action === "INVALIDATE") {
      return invalidatedSource(input, row, revision.semantic_hash, String(row.question_version_id), String(row.version_hash));
    }
    const correction = revision?.action === "CORRECT_CONCEPT_MAPPING"
      ? mappingCorrection(revision.correction_payload_json)
      : null;
    const expectedMappingHash = correction?.conceptMappingSetHash ?? String(row.concept_mapping_set_hash);
    const mappings = await this.questionMappings(String(row.question_version_id));
    const mappingHash = await computeConceptMappingSetHash(mappings.map((item) => ({
      conceptIdentity: item.concept_key,
      mappingVersion: Number(item.mapping_version),
      qualification: parse(item.qualification_json),
      provenance: parse(item.provenance_json),
      status: "APPROVED" as const,
    })));
    if (mappingHash !== expectedMappingHash) invalid("EVIDENCE_MAPPING_SET_MISMATCH");
    const corrected = revision?.action === "CORRECT"
      ? objectPayload(revision.correction_payload_json)
      : {};
    return {
      sourceType: input.sourceType as CanonicalEvidenceSource["sourceType"],
      sourceEventId: input.sourceEventId,
      sourceLineageIdentity: input.sourceEventId,
      sourceRevisionIdentity: revision?.semantic_hash ?? input.sourceRevisionIdentity,
      userId: String(row.user_id),
      contentVersionIdentity: String(row.question_version_id),
      conceptMappingSetHash: mappingHash,
      conceptIds: uniqueConceptIds(mappings),
      occurredAt: String(row.occurred_at),
      validity: "ELIGIBLE",
      evidenceType: "PERFORMANCE_RESULT",
      quality: "DIRECT_PERFORMANCE",
      resultSummary: {
        correct: Boolean(corrected.isCorrect ?? row.is_correct),
        score: Number(corrected.score ?? row.score ?? 0),
      },
      sourceSemanticHash: String(row.version_hash),
      mappingTransition: correction ? "GOVERNED_CORRECTION" : "PRESERVE_EVENT_TIME",
      mappingGuard: questionMappingGuard(
        input.sourceType === "MOCK_ITEM_RESULT" ? "QUESTION_VERSION" : "QUESTION_VERSION",
        String(row.question_version_id),
        mappings,
      ),
    };
  }

  private async resolveMock(input: ResolveInput): Promise<CanonicalEvidenceSource | null> {
    const row = await this.database.queryOne<Record<string, unknown>>({
      sql: `SELECT id, user_id, composition_semantic_hash, score, correct_count,
        wrong_count, unanswered_count, submitted_at
        FROM mock_exam_attempts WHERE id = ? LIMIT 1`,
      parameters: [input.sourceEventId],
    });
    if (!row) return null;
    if (!row.composition_semantic_hash || !row.submitted_at) return legacy(input, row);
    const revision = await this.latestRevision(input);
    if (revision?.action === "INVALIDATE") {
      return invalidatedSource(input, row, revision.semantic_hash, String(row.composition_semantic_hash), String(row.composition_semantic_hash));
    }
    const correction = revision?.action === "CORRECT_CONCEPT_MAPPING"
      ? mappingCorrection(revision.correction_payload_json)
      : null;
    const mappings = await this.mockMappings(input.sourceEventId);
    if (!mappings.length) invalid("EVIDENCE_CONCEPT_MAPPING_MISSING");
    const mappingHash = await sha256(stableJson(mappings.map((item) => ({
      conceptIdentity: item.concept_key,
      mappingVersion: Number(item.mapping_version),
      qualification: parse(item.qualification_json),
      provenance: parse(item.provenance_json),
    }))));
    if (correction && correction.conceptMappingSetHash !== mappingHash) {
      invalid("EVIDENCE_MAPPING_SET_MISMATCH");
    }
    const corrected = revision?.action === "CORRECT"
      ? objectPayload(revision.correction_payload_json)
      : {};
    return {
      sourceType: "MOCK_ATTEMPT",
      sourceEventId: input.sourceEventId,
      sourceLineageIdentity: input.sourceEventId,
      sourceRevisionIdentity: revision?.semantic_hash ?? input.sourceRevisionIdentity,
      userId: String(row.user_id),
      contentVersionIdentity: String(row.composition_semantic_hash),
      conceptMappingSetHash: mappingHash,
      conceptIds: uniqueConceptIds(mappings),
      occurredAt: String(row.submitted_at),
      validity: "ELIGIBLE",
      evidenceType: "PERFORMANCE_RESULT",
      quality: "DIRECT_PERFORMANCE",
      resultSummary: {
        score: Number(corrected.score ?? row.score),
        correctCount: Number(corrected.correctCount ?? row.correct_count),
        wrongCount: Number(corrected.wrongCount ?? row.wrong_count),
        unansweredCount: Number(corrected.unansweredCount ?? row.unanswered_count),
      },
      sourceSemanticHash: String(row.composition_semantic_hash),
      mappingTransition: correction ? "GOVERNED_CORRECTION" : "PRESERVE_EVENT_TIME",
      mappingGuard: questionMappingGuard("MOCK_COMPOSITION", input.sourceEventId, mappings),
    };
  }

  private async resolvePractical(input: ResolveInput): Promise<CanonicalEvidenceSource | null> {
    const seed = await this.database.queryOne<Record<string, unknown>>({
      sql: `SELECT e.attempt_id, a.user_id, a.state
        FROM practical_evaluations e JOIN practical_attempts a ON a.id = e.attempt_id
        WHERE e.id = ? LIMIT 1`,
      parameters: [input.sourceEventId],
    });
    if (!seed) return null;
    const row = await this.database.queryOne<Record<string, unknown>>({
      sql: `SELECT e.id, e.attempt_id, e.sequence, a.user_id, a.state, a.practical_id,
        e.practical_definition_version_id, e.rubric_version_id, e.method, e.raw_score,
        e.maximum_score, e.qualification, e.review_status, e.evaluation_payload_digest,
        e.evaluated_at
        FROM practical_evaluations e JOIN practical_attempts a ON a.id = e.attempt_id
        WHERE e.attempt_id = ? ORDER BY e.sequence DESC LIMIT 1`,
      parameters: [String(seed.attempt_id)],
    });
    if (!row) return null;
    if (row.state === "VOIDED") {
      return invalidatedSource(
        { ...input, sourceType: "PRACTICAL_EVALUATION", sourceEventId: String(row.id) },
        row,
        String(row.evaluation_payload_digest),
        `${row.practical_definition_version_id}:${row.rubric_version_id}`,
        String(row.evaluation_payload_digest),
        String(row.attempt_id),
      );
    }
    const eligible = row.qualification === "QUALIFIED" &&
      (row.method !== "HUMAN_REVIEWED" || row.review_status === "COMPLETED");
    const concepts = await this.edgeConcepts("PRACTICAL", String(row.practical_id));
    if (!concepts.length) invalid("EVIDENCE_CONCEPT_MAPPING_MISSING");
    const mappingHash = await edgeMappingHash(concepts);
    return {
      sourceType: "PRACTICAL_EVALUATION",
      sourceEventId: String(row.id),
      sourceLineageIdentity: String(row.attempt_id),
      sourceRevisionIdentity: String(row.evaluation_payload_digest),
      userId: String(row.user_id),
      contentVersionIdentity: `${row.practical_definition_version_id}:${row.rubric_version_id}`,
      conceptMappingSetHash: mappingHash,
      conceptIds: concepts.map((item) => item.concept_id).sort(),
      occurredAt: String(row.evaluated_at),
      validity: eligible ? "ELIGIBLE" : "LEGACY_INELIGIBLE",
      evidenceType: "PRACTICAL_PERFORMANCE",
      quality: row.method === "HUMAN_REVIEWED" ? "HUMAN_EVALUATED" : "DIRECT_PERFORMANCE",
      resultSummary: {
        rawScore: Number(row.raw_score ?? 0),
        maximumScore: Number(row.maximum_score ?? 0),
        qualification: String(row.qualification),
      },
      sourceSemanticHash: String(row.evaluation_payload_digest),
      mappingTransition: "PRESERVE_EVENT_TIME",
      mappingGuard: edgeMappingGuard("PRACTICAL", String(row.practical_id), concepts),
    };
  }

  private async resolveProgress(input: ResolveInput): Promise<CanonicalEvidenceSource | null> {
    const config = progressConfig[input.sourceType as keyof typeof progressConfig];
    if (!config) return null;
    const row = await this.database.queryOne<Record<string, unknown>>({
      sql: `SELECT id, user_id, ${config.parentColumn} AS parent_id,
        ${config.versionColumn} AS version_id, ${config.completedColumn} AS completed,
        ${config.occurredColumn} AS occurred_at FROM ${config.table} WHERE id = ? LIMIT 1`,
      parameters: [input.sourceEventId],
    });
    if (!row) return null;
    if (!row.version_id) return legacy(input, row);
    const revision = await this.latestRevision(input);
    if (revision?.action === "INVALIDATE") {
      return invalidatedSource(
        input,
        row,
        revision.semantic_hash,
        String(row.version_id),
        await sha256(stableJson({ contentVersionIdentity: row.version_id, completed: Boolean(row.completed) })),
      );
    }
    const concepts = await this.edgeConcepts(config.ontologyType, String(row.parent_id));
    if (!concepts.length) invalid("EVIDENCE_CONCEPT_MAPPING_MISSING");
    const mappingHash = await edgeMappingHash(concepts);
    return {
      sourceType: input.sourceType as CanonicalEvidenceSource["sourceType"],
      sourceEventId: input.sourceEventId,
      sourceLineageIdentity: input.sourceEventId,
      sourceRevisionIdentity: revision?.semantic_hash ?? input.sourceRevisionIdentity,
      userId: String(row.user_id),
      contentVersionIdentity: String(row.version_id),
      conceptMappingSetHash: mappingHash,
      conceptIds: concepts.map((item) => item.concept_id).sort(),
      occurredAt: String(row.occurred_at),
      validity: Boolean(row.completed) ? "ELIGIBLE" : "LEGACY_INELIGIBLE",
      evidenceType: "LEARNING_ACTIVITY",
      quality: "SUPPORTING_ACTIVITY",
      resultSummary: { completed: Boolean(row.completed) },
      sourceSemanticHash: await sha256(stableJson({
        contentVersionIdentity: row.version_id,
        completed: Boolean(row.completed),
      })),
      mappingTransition: "PRESERVE_EVENT_TIME",
      mappingGuard: edgeMappingGuard(config.ontologyType, String(row.parent_id), concepts),
    };
  }

  private async questionMappings(questionVersionId: string) {
    const result = await this.database.query<QuestionMappingRow>({
      sql: `SELECT qc.id AS mapping_id, qc.concept_id, c.concept_key,
        qc.mapping_version, qc.qualification_json, qc.provenance_json
        FROM question_concepts qc JOIN ontology_concepts c ON c.id = qc.concept_id
        WHERE qc.question_version_id = ? AND qc.mapping_status = 'APPROVED'
          AND c.status = 'ACTIVE' ORDER BY c.concept_key, qc.id`,
      parameters: [questionVersionId],
    });
    if (!result.rows.length) invalid("EVIDENCE_CONCEPT_MAPPING_MISSING");
    return result.rows;
  }

  private async mockMappings(attemptId: string) {
    const result = await this.database.query<QuestionMappingRow>({
      sql: `SELECT DISTINCT qc.id AS mapping_id, qc.concept_id, c.concept_key,
        qc.mapping_version, qc.qualification_json, qc.provenance_json
        FROM mock_exam_answers a
        JOIN question_concepts qc ON qc.question_version_id = a.question_version_id
          AND qc.mapping_status = 'APPROVED'
        JOIN ontology_concepts c ON c.id = qc.concept_id AND c.status = 'ACTIVE'
        WHERE a.attempt_id = ? ORDER BY c.concept_key, qc.id`,
      parameters: [attemptId],
    });
    return result.rows;
  }

  private async edgeConcepts(fromType: string, fromId: string) {
    const result = await this.database.query<EdgeRow>({
      sql: `SELECT e.edge_key, c.id AS concept_id FROM ontology_edges e
        JOIN ontology_concepts c ON c.id = e.to_id AND c.status = 'ACTIVE'
        WHERE e.from_type = ? AND e.from_id = ? AND e.to_type = 'CONCEPT'
          AND e.status = 'ACTIVE' AND e.relation IN ('TESTS', 'ASSESSED_BY', 'COVERS')
        ORDER BY e.edge_key`,
      parameters: [fromType, fromId],
    });
    return result.rows;
  }

  private latestRevision(input: ResolveInput) {
    return this.database.queryOne<{
      action: string;
      semantic_hash: string;
      correction_payload_json: string;
    }>({
      sql: `SELECT action, semantic_hash, correction_payload_json
        FROM learning_event_revisions WHERE source_type = ? AND source_event_id = ?
        ORDER BY sequence DESC LIMIT 1`,
      parameters: [input.sourceType, input.sourceEventId],
    });
  }
}

const progressConfig = {
  LESSON_PROGRESS: { table: "user_lesson_progress", parentColumn: "lesson_id", versionColumn: "content_version", completedColumn: "status = 'COMPLETED'", occurredColumn: "last_studied_at", ontologyType: "LESSON" },
  COURSE_LESSON_PROGRESS: { table: "user_course_lesson_progress", parentColumn: "course_lesson_id", versionColumn: "content_version", completedColumn: "status = 'COMPLETED'", occurredColumn: "last_studied_at", ontologyType: "COURSE_LESSON" },
  LECTURE_PROGRESS: { table: "lecture_progress", parentColumn: "lecture_id", versionColumn: "content_revision_id", completedColumn: "completed", occurredColumn: "last_played_at", ontologyType: "LECTURE" },
  AUDIO_PROGRESS: { table: "audio_progress", parentColumn: "audio_content_id", versionColumn: "content_revision_id", completedColumn: "completed", occurredColumn: "last_played_at", ontologyType: "AUDIO_CONTENT" },
} as const;

function questionMappingGuard(
  kind: "QUESTION_VERSION" | "MOCK_COMPOSITION",
  parentIdentity: string,
  mappings: readonly QuestionMappingRow[],
): EvidenceMappingGuard {
  return Object.freeze({
    kind,
    parentIdentity,
    members: Object.freeze(mappings.map((item) => Object.freeze({
      mappingId: item.mapping_id,
      conceptId: item.concept_id,
      conceptIdentity: item.concept_key,
      mappingVersion: Number(item.mapping_version),
      qualificationJson: item.qualification_json,
      provenanceJson: item.provenance_json,
    }))),
  });
}

function edgeMappingGuard(parentType: string, parentIdentity: string, mappings: readonly EdgeRow[]): EvidenceMappingGuard {
  return Object.freeze({
    kind: "ONTOLOGY_EDGES",
    parentIdentity,
    parentType,
    members: Object.freeze(mappings.map((item) => Object.freeze({
      edgeKey: item.edge_key,
      conceptId: item.concept_id,
    }))),
  });
}

function uniqueConceptIds(mappings: readonly QuestionMappingRow[]) {
  return [...new Set(mappings.map((item) => item.concept_id))].sort();
}

async function edgeMappingHash(mappings: readonly EdgeRow[]) {
  return sha256(stableJson(mappings.map((item) => ({
    edgeKey: item.edge_key,
    conceptId: item.concept_id,
  }))));
}

function mappingCorrection(value: unknown) {
  const payload = objectPayload(value);
  if (payload.kind !== "CONCEPT_MAPPING" ||
    typeof payload.conceptMappingSetHash !== "string" ||
    !/^[0-9a-f]{64}$/.test(payload.conceptMappingSetHash)) {
    invalid("EVIDENCE_SOURCE_METADATA_INVALID");
  }
  return { conceptMappingSetHash: payload.conceptMappingSetHash };
}

function objectPayload(value: unknown): Record<string, unknown> {
  const parsed = parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    invalid("EVIDENCE_SOURCE_METADATA_INVALID");
  }
  return parsed as Record<string, unknown>;
}

function invalidatedSource(
  input: ResolveInput,
  row: Record<string, unknown>,
  sourceRevisionIdentity: string,
  contentVersionIdentity: string,
  sourceSemanticHash: string,
  sourceLineageIdentity = input.sourceEventId,
): CanonicalEvidenceSource {
  return {
    sourceType: input.sourceType as CanonicalEvidenceSource["sourceType"],
    sourceEventId: input.sourceEventId,
    sourceLineageIdentity,
    sourceRevisionIdentity,
    userId: String(row.user_id),
    contentVersionIdentity,
    conceptMappingSetHash: "0".repeat(64),
    conceptIds: [],
    occurredAt: String(row.occurred_at ?? row.evaluated_at ?? ""),
    validity: "INVALIDATED",
    evidenceType: input.sourceType === "PRACTICAL_EVALUATION"
      ? "PRACTICAL_PERFORMANCE"
      : input.sourceType.includes("PROGRESS") ? "LEARNING_ACTIVITY" : "PERFORMANCE_RESULT",
    quality: input.sourceType === "PRACTICAL_EVALUATION"
      ? "DIRECT_PERFORMANCE"
      : input.sourceType.includes("PROGRESS") ? "SUPPORTING_ACTIVITY" : "DIRECT_PERFORMANCE",
    resultSummary: {},
    sourceSemanticHash,
    mappingTransition: "PRESERVE_EVENT_TIME",
    mappingGuard: Object.freeze({
      kind: "ONTOLOGY_EDGES",
      parentIdentity: sourceLineageIdentity,
      parentType: "INVALIDATION_CONTROL",
      members: Object.freeze([]),
    }),
  };
}

function legacy(input: ResolveInput, row: Record<string, unknown>): CanonicalEvidenceSource {
  return {
    sourceType: input.sourceType as CanonicalEvidenceSource["sourceType"],
    sourceEventId: input.sourceEventId,
    sourceLineageIdentity: input.sourceEventId,
    sourceRevisionIdentity: input.sourceRevisionIdentity,
    userId: String(row.user_id),
    contentVersionIdentity: "LEGACY_UNKNOWN",
    conceptMappingSetHash: "0".repeat(64),
    conceptIds: ["LEGACY_UNKNOWN"],
    occurredAt: String(row.occurred_at ?? ""),
    validity: "LEGACY_INELIGIBLE",
    evidenceType: input.sourceType.includes("PROGRESS") ? "LEARNING_ACTIVITY" : "PERFORMANCE_RESULT",
    quality: input.sourceType.includes("PROGRESS") ? "SUPPORTING_ACTIVITY" : "DIRECT_PERFORMANCE",
    resultSummary: {},
    sourceSemanticHash: "0".repeat(64),
    mappingTransition: "PRESERVE_EVENT_TIME",
    mappingGuard: Object.freeze({
      kind: "ONTOLOGY_EDGES",
      parentIdentity: input.sourceEventId,
      parentType: "LEGACY_INELIGIBLE",
      members: Object.freeze([]),
    }),
  };
}

function parse(value: unknown): unknown {
  if (typeof value !== "string" || !value) return null;
  try {
    return JSON.parse(value);
  } catch {
    invalid("EVIDENCE_SOURCE_METADATA_INVALID");
  }
}

function invalid(code: string): never {
  throw new AppError("Canonical Evidence adapter rejected its source.", 409, code);
}
