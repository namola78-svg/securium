import { AppError } from "../lib/errors.ts";
import { sha256, stableJson, type LearningEventSourceType } from "../lib/services/learning-event-contracts.ts";
import type { EvidenceCandidate, ProjectionOutcome } from "../lib/services/evidence-projection.ts";
import type { DatabaseProvider, DatabaseStatement } from "./provider/database-provider.ts";

export type RecomputeScope = "EVENT" | "USER" | "CONCEPT" | "FULL";
export type RecomputeRequestType = "EVIDENCE_RECOMPUTE_REQUIRED" | "MASTERY_RECOMPUTE_REQUIRED";
export type RecomputeRequestInput = Readonly<{
  id: string;
  requestType: RecomputeRequestType;
  scopeType: RecomputeScope;
  sourceType?: LearningEventSourceType;
  sourceEventId?: string;
  sourceRevisionIdentity?: string;
  userId?: string;
  conceptId?: string;
  projectionVersion: string;
  reasonCode: string;
  inputSemanticHash: string;
  cursor?: string | null;
}>;

export class EvidenceProjectionRepository {
  private readonly database: DatabaseProvider;

  constructor(database: DatabaseProvider) {
    this.database = database;
  }

  async project(candidate: EvidenceCandidate): Promise<ProjectionOutcome> {
    await this.assertParents(candidate);
    const existing = await this.getProjection(candidate.id);
    if (existing) return existing.semantic_hash === candidate.semanticHash ? "EXACT_REPLAY" : "CONFLICT";
    const masteryRequest = await createRecomputeRequest({
      requestType: "MASTERY_RECOMPUTE_REQUIRED",
      scopeType: "CONCEPT",
      userId: candidate.userId,
      conceptId: candidate.conceptId,
      projectionVersion: candidate.projectionVersion,
      reasonCode: "EVIDENCE_SEMANTICS_CHANGED",
      sourceType: candidate.sourceType,
      sourceEventId: candidate.sourceEventId,
      sourceRevisionIdentity: candidate.sourceRevisionIdentity,
    });
    try {
      const results = await this.database.transaction([
        projectionInsert(candidate),
        {
          sql: `UPDATE evidence_projections SET lifecycle = 'SUPERSEDED', superseded_by_id = ?
            WHERE source_type = ? AND source_event_id = ? AND concept_id = ?
              AND evidence_type = ? AND lifecycle = 'ACTIVE' AND id <> ?`,
          parameters: [candidate.id, candidate.sourceType, candidate.sourceEventId, candidate.conceptId, candidate.evidenceType, candidate.id],
        },
        recomputeInsert(masteryRequest),
      ]);
      if (results[0]?.affectedRows !== 1) {
        const winner = await this.getProjection(candidate.id);
        return winner ? winner.semantic_hash === candidate.semanticHash ? "EXACT_REPLAY" : "CONFLICT" : "INVALID_SOURCE";
      }
      return "NEW_SUCCESS";
    } catch (error) {
      const winner = await this.getProjection(candidate.id);
      if (winner) return winner.semantic_hash === candidate.semanticHash ? "EXACT_REPLAY" : "CONFLICT";
      throw error;
    }
  }

  async invalidateSource(input: Readonly<{
    sourceType: LearningEventSourceType;
    sourceEventId: string;
    sourceRevisionIdentity: string;
    reasonCode: string;
  }>) {
    const active = await this.database.query<{ id: string; user_id: string; concept_id: string }>(
      { sql: "SELECT id, user_id, concept_id FROM evidence_projections WHERE source_type = ? AND source_event_id = ? AND lifecycle = 'ACTIVE'", parameters: [input.sourceType, input.sourceEventId] },
    );
    if (!active.rows.length) return "EXACT_REPLAY" as const;
    const statements: DatabaseStatement[] = [{
      sql: "UPDATE evidence_projections SET lifecycle = 'INVALIDATED', invalidation_reason = ? WHERE source_type = ? AND source_event_id = ? AND lifecycle = 'ACTIVE'",
      parameters: [input.reasonCode, input.sourceType, input.sourceEventId],
    }];
    for (const row of active.rows) {
      statements.push(recomputeInsert(await createRecomputeRequest({
        requestType: "MASTERY_RECOMPUTE_REQUIRED", scopeType: "CONCEPT",
        userId: row.user_id, conceptId: row.concept_id,
        projectionVersion: "EVIDENCE_V1", reasonCode: input.reasonCode,
        sourceType: input.sourceType, sourceEventId: input.sourceEventId,
        sourceRevisionIdentity: input.sourceRevisionIdentity,
      })));
    }
    await this.database.transaction(statements);
    return "NEW_SUCCESS" as const;
  }

  async enqueue(request: RecomputeRequestInput) {
    const existing = await this.database.queryOne<{ input_semantic_hash: string }>({
      sql: "SELECT input_semantic_hash FROM evidence_recompute_requests WHERE request_type = ? AND input_semantic_hash = ? LIMIT 1",
      parameters: [request.requestType, request.inputSemanticHash],
    });
    if (existing) return "EXACT_REPLAY" as const;
    const result = await this.database.execute(recomputeInsert(request));
    return result.affectedRows === 1 ? "NEW_SUCCESS" as const : "EXACT_REPLAY" as const;
  }

  async listPending(scopeType: RecomputeScope, limit: number, cursor?: string) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) fail("EVIDENCE_REBUILD_LIMIT_INVALID");
    return this.database.query<Record<string, unknown>>({
      sql: `SELECT * FROM evidence_recompute_requests
        WHERE status = 'PENDING' AND scope_type = ? AND (? IS NULL OR id > ?)
        ORDER BY id LIMIT ?`,
      parameters: [scopeType, cursor ?? null, cursor ?? null, limit],
    });
  }

  async completeRequest(id: string) {
    return this.database.execute({
      sql: "UPDATE evidence_recompute_requests SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('PENDING', 'PROCESSING')",
      parameters: [id],
    });
  }

  private getProjection(id: string) {
    return this.database.queryOne<{ semantic_hash: string }>({
      sql: "SELECT semantic_hash FROM evidence_projections WHERE id = ? LIMIT 1",
      parameters: [id],
    });
  }

  private async assertParents(candidate: EvidenceCandidate) {
    const [user, concept, source] = await Promise.all([
      this.database.queryOne<{ id: string }>({ sql: "SELECT id FROM users WHERE id = ? LIMIT 1", parameters: [candidate.userId] }),
      this.database.queryOne<{ id: string }>({ sql: "SELECT id FROM ontology_concepts WHERE id = ? LIMIT 1", parameters: [candidate.conceptId] }),
      this.database.queryOne<{ id: string }>(sourceOwnerStatement(candidate.sourceType, candidate.sourceEventId, candidate.userId)),
    ]);
    if (!user || !concept || !source) fail("EVIDENCE_SOURCE_NOT_FOUND_OR_FORBIDDEN");
  }
}

export async function createRecomputeRequest(input: Omit<RecomputeRequestInput, "id" | "inputSemanticHash">): Promise<RecomputeRequestInput> {
  const semantics = { ...input, cursor: input.cursor ?? null };
  const inputSemanticHash = await sha256(stableJson(semantics));
  return Object.freeze({ ...semantics, id: inputSemanticHash, inputSemanticHash });
}

export function recomputeInsert(input: RecomputeRequestInput): DatabaseStatement {
  return {
    sql: `INSERT INTO evidence_recompute_requests
      (id, request_type, scope_type, source_type, source_event_id, source_revision_identity,
       user_id, concept_id, projection_version, reason_code, input_semantic_hash, status, cursor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
      ON CONFLICT (request_type, input_semantic_hash) DO NOTHING`,
    parameters: [input.id, input.requestType, input.scopeType, input.sourceType ?? null,
      input.sourceEventId ?? null, input.sourceRevisionIdentity ?? null, input.userId ?? null,
      input.conceptId ?? null, input.projectionVersion, input.reasonCode, input.inputSemanticHash,
      input.cursor ?? null],
  };
}

function projectionInsert(candidate: EvidenceCandidate): DatabaseStatement {
  const source = sourceRelation(candidate.sourceType);
  return {
    sql: `INSERT INTO evidence_projections
      (id, user_id, source_type, source_event_id, source_revision_identity, evidence_type,
       concept_id, concept_mapping_set_hash, projection_version, source_semantic_hash,
       semantic_hash, result_summary_json, quality, lifecycle, occurred_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?
      FROM ${source.fromSql} WHERE ${source.identitySql}
      ON CONFLICT (id) DO NOTHING`,
    parameters: [candidate.id, candidate.userId, candidate.sourceType, candidate.sourceEventId,
      candidate.sourceRevisionIdentity, candidate.evidenceType, candidate.conceptId,
      candidate.conceptMappingSetHash, candidate.projectionVersion, candidate.sourceSemanticHash,
      candidate.semanticHash, candidate.resultSummaryJson, candidate.quality, candidate.occurredAt,
      candidate.sourceEventId, candidate.userId],
  };
}

function sourceRelation(sourceType: EvidenceCandidate["sourceType"]) {
  const direct: Partial<Record<EvidenceCandidate["sourceType"], string>> = {
    QUESTION_ATTEMPT: "question_attempts", MOCK_ATTEMPT: "mock_exam_attempts",
    LESSON_PROGRESS: "user_lesson_progress", COURSE_LESSON_PROGRESS: "user_course_lesson_progress",
    LECTURE_PROGRESS: "lecture_progress", AUDIO_PROGRESS: "audio_progress",
  };
  if (direct[sourceType]) return { fromSql: `${direct[sourceType]} source`, identitySql: "source.id = ? AND source.user_id = ?" };
  if (sourceType === "MOCK_ITEM_RESULT") return { fromSql: "mock_exam_answers source JOIN mock_exam_attempts owner ON owner.id = source.attempt_id", identitySql: "source.id = ? AND owner.user_id = ?" };
  return { fromSql: "practical_evaluations source JOIN practical_attempts owner ON owner.id = source.attempt_id", identitySql: "source.id = ? AND owner.user_id = ?" };
}

function sourceOwnerStatement(sourceType: EvidenceCandidate["sourceType"], sourceEventId: string, userId: string): DatabaseStatement {
  const direct: Partial<Record<EvidenceCandidate["sourceType"], string>> = {
    QUESTION_ATTEMPT: "question_attempts", MOCK_ATTEMPT: "mock_exam_attempts",
    LESSON_PROGRESS: "user_lesson_progress", COURSE_LESSON_PROGRESS: "user_course_lesson_progress",
    LECTURE_PROGRESS: "lecture_progress", AUDIO_PROGRESS: "audio_progress",
  };
  if (direct[sourceType]) return { sql: `SELECT id FROM ${direct[sourceType]} WHERE id = ? AND user_id = ? LIMIT 1`, parameters: [sourceEventId, userId] };
  if (sourceType === "MOCK_ITEM_RESULT") return { sql: `SELECT a.id FROM mock_exam_answers a INNER JOIN mock_exam_attempts m ON m.id = a.attempt_id WHERE a.id = ? AND m.user_id = ? LIMIT 1`, parameters: [sourceEventId, userId] };
  return { sql: `SELECT e.id FROM practical_evaluations e INNER JOIN practical_attempts a ON a.id = e.attempt_id WHERE e.id = ? AND a.user_id = ? LIMIT 1`, parameters: [sourceEventId, userId] };
}

function fail(code: string): never {
  throw new AppError("Evidence projection operation failed.", 409, code);
}
