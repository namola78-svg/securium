import { AppError } from "../lib/errors.ts";
import type {
  AppendLearningEventRevisionInput,
  LearningEventGovernanceRepositoryContract,
  LearningEventRevision,
} from "../lib/services/learning-event-governance.ts";
import type {
  LearningEventSourceType,
} from "../lib/services/learning-event-contracts.ts";
import type {
  DatabaseProvider,
} from "./provider/database-provider.ts";
import { recomputeInsert, type RecomputeRequestInput } from "./evidence-projection-repository.ts";

type RevisionWrite = AppendLearningEventRevisionInput & Readonly<{
  correctionPayloadJson: string;
  semanticHash: string;
  recomputeRequest: RecomputeRequestInput;
}>;

export class LearningEventGovernanceRepository
implements LearningEventGovernanceRepositoryContract {
  private readonly database: DatabaseProvider;

  constructor(database: DatabaseProvider) {
    this.database = database;
  }

  async appendRevision(input: RevisionWrite) {
    await this.assertParents(input);
    const exact = await this.findBySemanticHash(
      input.sourceType,
      input.sourceEventId,
      input.semanticHash,
    );
    if (exact) {
      return { outcome: "EXACT_REPLAY" as const, revision: exact };
    }
    const latest = await this.getLatest(input.sourceType, input.sourceEventId);
    const actualPrevious = latest?.id ?? null;
    if (actualPrevious !== input.expectedPreviousRevisionId) {
      conflict("LEARNING_EVENT_REVISION_SEQUENCE_CONFLICT");
    }
    const sequence = (latest?.sequence ?? 0) + 1;
    try {
      const [insert] = await this.database.transaction([
        {
          sql: `INSERT INTO learning_event_revisions
            (id, source_type, source_event_id, sequence, previous_revision_id,
             action, reason_code, payload_schema_version, correction_payload_json,
             semantic_hash, actor_user_id)
            SELECT ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
              AND NOT EXISTS (
                SELECT 1 FROM learning_event_revisions
                WHERE source_type = ? AND source_event_id = ? AND sequence >= ?
              )`,
          parameters: [
            input.revisionId,
            input.sourceType,
            input.sourceEventId,
            sequence,
            input.expectedPreviousRevisionId,
            input.action,
            input.reasonCode,
            input.correctionPayloadJson,
            input.semanticHash,
            input.actorUserId,
            input.actorUserId,
            input.sourceType,
            input.sourceEventId,
            sequence,
          ],
        },
        recomputeInsert(input.recomputeRequest),
      ]);
      if (insert?.affectedRows !== 1) conflict("LEARNING_EVENT_REVISION_SEQUENCE_CONFLICT");
    } catch (error) {
      const winner = await this.findBySemanticHash(
        input.sourceType,
        input.sourceEventId,
        input.semanticHash,
      );
      if (winner) return { outcome: "EXACT_REPLAY" as const, revision: winner };
      if (isUniqueConflict(error)) conflict("LEARNING_EVENT_REVISION_CONFLICT");
      throw error;
    }
    const revision = await this.getById(input.revisionId);
    if (!revision) fail("LEARNING_EVENT_REVISION_CREATE_FAILED", 500);
    return { outcome: "NEW_SUCCESS" as const, revision };
  }

  private async assertParents(input: RevisionWrite) {
    const actor = await this.database.queryOne<{ id: string }>({
      sql: "SELECT id FROM users WHERE id = ? LIMIT 1",
      parameters: [input.actorUserId],
    });
    if (!actor) fail("ACTOR_NOT_FOUND", 404);
    const source = sourceOwnerQuery(
      input.sourceType,
      input.sourceEventId,
      input.ownerUserId,
    );
    const owner = await this.database.queryOne<{ id: string }>(source);
    if (!owner) fail("LEARNING_EVENT_SOURCE_NOT_FOUND_OR_FORBIDDEN", 404);
  }

  private async findBySemanticHash(
    sourceType: LearningEventSourceType,
    sourceEventId: string,
    semanticHash: string,
  ) {
    const row = await this.database.queryOne<RevisionDatabaseRow>({
      sql: `SELECT * FROM learning_event_revisions
        WHERE source_type = ? AND source_event_id = ? AND semantic_hash = ? LIMIT 1`,
      parameters: [sourceType, sourceEventId, semanticHash],
    });
    return row ? mapRevision(row) : null;
  }

  private async getLatest(
    sourceType: LearningEventSourceType,
    sourceEventId: string,
  ) {
    const row = await this.database.queryOne<RevisionDatabaseRow>({
      sql: `SELECT * FROM learning_event_revisions
        WHERE source_type = ? AND source_event_id = ?
        ORDER BY sequence DESC LIMIT 1`,
      parameters: [sourceType, sourceEventId],
    });
    return row ? mapRevision(row) : null;
  }

  private async getById(id: string) {
    const row = await this.database.queryOne<RevisionDatabaseRow>({
      sql: "SELECT * FROM learning_event_revisions WHERE id = ? LIMIT 1",
      parameters: [id],
    });
    return row ? mapRevision(row) : null;
  }
}

function sourceOwnerQuery(
  sourceType: LearningEventSourceType,
  sourceEventId: string,
  ownerUserId: string,
) {
  const direct: Partial<Record<LearningEventSourceType, string>> = {
    QUESTION_ATTEMPT: "question_attempts",
    MOCK_ATTEMPT: "mock_exam_attempts",
    PRACTICAL_ATTEMPT: "practical_attempts",
    LESSON_PROGRESS: "user_lesson_progress",
    COURSE_LESSON_PROGRESS: "user_course_lesson_progress",
    LECTURE_PROGRESS: "lecture_progress",
    AUDIO_PROGRESS: "audio_progress",
  };
  const table = direct[sourceType];
  if (table) {
    return {
      sql: `SELECT id FROM ${table} WHERE id = ? AND user_id = ? LIMIT 1`,
      parameters: [sourceEventId, ownerUserId],
    };
  }
  if (sourceType === "MOCK_ITEM_RESULT") {
    return {
      sql: `SELECT mock_exam_answers.id FROM mock_exam_answers
        INNER JOIN mock_exam_attempts ON mock_exam_attempts.id = mock_exam_answers.attempt_id
        WHERE mock_exam_answers.id = ? AND mock_exam_attempts.user_id = ? LIMIT 1`,
      parameters: [sourceEventId, ownerUserId],
    };
  }
  if (sourceType === "PRACTICAL_EVALUATION") {
    return {
      sql: `SELECT practical_evaluations.id FROM practical_evaluations
        INNER JOIN practical_attempts ON practical_attempts.id = practical_evaluations.attempt_id
        WHERE practical_evaluations.id = ? AND practical_attempts.user_id = ? LIMIT 1`,
      parameters: [sourceEventId, ownerUserId],
    };
  }
  fail("EVENT_SOURCE_TYPE_INVALID");
}

type RevisionDatabaseRow = Record<string, unknown> & {
  id: string;
  source_type: LearningEventSourceType;
  source_event_id: string;
  sequence: number | string;
  previous_revision_id: string | null;
  action: LearningEventRevision["action"];
  reason_code: string;
  payload_schema_version: number | string;
  correction_payload_json: string;
  semantic_hash: string;
  actor_user_id: string;
  created_at: string;
};

function mapRevision(row: RevisionDatabaseRow): LearningEventRevision {
  return Object.freeze({
    id: row.id,
    sourceType: row.source_type,
    sourceEventId: row.source_event_id,
    sequence: Number(row.sequence),
    previousRevisionId: row.previous_revision_id,
    action: row.action,
    reasonCode: row.reason_code,
    payloadSchemaVersion: 1,
    correctionPayloadJson: row.correction_payload_json,
    semanticHash: row.semantic_hash,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
  });
}

function isUniqueConflict(error: unknown) {
  return error instanceof Error &&
    (/UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|duplicate key/i.test(error.message) ||
      ("code" in error && error.code === "23505"));
}

function conflict(code: string): never {
  throw new AppError("Learning event revision conflicts with canonical state.", 409, code);
}

function fail(code: string, status = 400): never {
  throw new AppError("Learning event governance operation failed.", status, code);
}
