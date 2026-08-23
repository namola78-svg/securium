import { AppError } from "../lib/errors.ts";
import {
  PRACTICAL_JSON_LIMITS,
  canonicalizePracticalJson,
} from "../lib/practical/practical-attempt.ts";
import { sanitizeAuditMetadata } from "../lib/services/audit-service.ts";
import type {
  DatabaseProvider,
  DatabaseStatement,
  DatabaseValue,
} from "./provider/database-provider.ts";
import { recomputeInsert, type RecomputeRequestInput } from "./evidence-projection-repository.ts";

export type PracticalRubricVersionRow = Readonly<{
  id: string;
  rubricId: string;
  version: number;
  snapshotFormatVersion: number;
  snapshotJson: string;
  snapshotDigest: string;
  createdAt: string;
  effectiveFrom: string | null;
  withdrawnAt: string | null;
}>;

export type PracticalDefinitionVersionRow = Readonly<{
  id: string;
  practicalId: string;
  version: number;
  rubricVersionId: string;
  snapshotFormatVersion: number;
  snapshotJson: string;
  snapshotDigest: string;
  createdAt: string;
  effectiveFrom: string | null;
  withdrawnAt: string | null;
}>;

export type PracticalAttemptRow = Readonly<{
  id: string;
  userId: string;
  practicalId: string;
  practicalDefinitionVersionId: string;
  rubricVersionId: string;
  courseId: string;
  curriculumTreeId: string;
  curriculumTreeVersionReference: string;
  curriculumNodeId: string;
  objectivePlacementId: string;
  practicalPlacementId: string;
  state: "IN_PROGRESS" | "SUBMITTED" | "EVALUATED" | "EXPIRED" | "VOIDED";
  responsesJson: string;
  artifactManifestJson: string;
  submissionDigest: string | null;
  creationIdempotencyKey: string;
  submissionIdempotencyKey: string | null;
  draftRevision: number;
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string | null;
  expiredAt: string | null;
  voidedAt: string | null;
  voidReasonCode: string | null;
  eligibilityDecisionReference: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type PracticalEvaluationRow = Readonly<{
  id: string;
  attemptId: string;
  sequence: number;
  previousEvaluationId: string | null;
  practicalDefinitionVersionId: string;
  rubricVersionId: string;
  method: string;
  dimensionResultsJson: string;
  rawScore: number | null;
  maximumScore: number | null;
  qualification: string;
  reviewStatus: string;
  provenanceJson: string;
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  evaluationPayloadDigest: string;
  idempotencyKey: string;
  evaluatorJobId: string | null;
  evaluatorResultId: string | null;
  evaluatedAt: string;
  createdAt: string;
}>;

export type PracticalAuditInput = Readonly<{
  eventId?: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  resourceType: "PRACTICAL_ATTEMPT" | "PRACTICAL_EVALUATION";
  resourceId: string;
  result?: "SUCCESS" | "FAILURE" | "DENIED";
  courseId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}>;

export type PracticalElevatedReadContext = Readonly<{
  actorUserId: string;
  actorRole: "CONTENT_REVIEWER" | "ADMIN" | "SUPER_ADMIN" | "SYSTEM";
}>;

export class PracticalRepository {
  private readonly database: DatabaseProvider;

  constructor(database: DatabaseProvider) {
    this.database = database;
  }

  async insertRubricVersion(
    input: Omit<PracticalRubricVersionRow, "createdAt" | "withdrawnAt">,
  ) {
    requireCanonicalJsonText(input.snapshotJson);
    requireDigest(input.snapshotDigest);
    await this.executeImmutableInsert({
      sql: `INSERT INTO practical_rubric_versions
        (id, rubric_id, version, snapshot_format_version, snapshot_json, snapshot_digest, effective_from)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      parameters: [
        input.id,
        input.rubricId,
        input.version,
        input.snapshotFormatVersion,
        input.snapshotJson,
        input.snapshotDigest,
        input.effectiveFrom,
      ],
    });
    return this.getRubricVersion(input.id);
  }

  async recordOperationalAudit(input: PracticalAuditInput) {
    await this.database.execute(auditStatement(input));
  }

  async insertDefinitionVersion(
    input: Omit<PracticalDefinitionVersionRow, "createdAt" | "withdrawnAt">,
  ) {
    requireCanonicalJsonText(input.snapshotJson);
    requireDigest(input.snapshotDigest);
    await this.executeImmutableInsert({
      sql: `INSERT INTO practical_definition_versions
        (id, practical_id, version, rubric_version_id, snapshot_format_version, snapshot_json, snapshot_digest, effective_from)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      parameters: [
        input.id,
        input.practicalId,
        input.version,
        input.rubricVersionId,
        input.snapshotFormatVersion,
        input.snapshotJson,
        input.snapshotDigest,
        input.effectiveFrom,
      ],
    });
    return this.getDefinitionVersion(input.id);
  }

  getRubricVersion(id: string) {
    return this.database.queryOne<DatabaseRubricVersionRow>({
      sql: "SELECT * FROM practical_rubric_versions WHERE id = ? LIMIT 1",
      parameters: [id],
    }).then((row) => (row ? mapRubricVersion(row) : null));
  }

  getDefinitionVersion(id: string) {
    return this.database.queryOne<DatabaseDefinitionVersionRow>({
      sql: "SELECT * FROM practical_definition_versions WHERE id = ? LIMIT 1",
      parameters: [id],
    }).then((row) => (row ? mapDefinitionVersion(row) : null));
  }

  async findAttemptByCreationKey(userId: string, idempotencyKey: string) {
    const row = await this.database.queryOne<DatabaseAttemptRow>({
      sql: "SELECT * FROM practical_attempts WHERE user_id = ? AND creation_idempotency_key = ? LIMIT 1",
      parameters: [userId, idempotencyKey],
    });
    return row ? mapAttempt(row) : null;
  }

  async getAttemptForUser(attemptId: string, userId: string) {
    const row = await this.database.queryOne<DatabaseAttemptRow>({
      sql: "SELECT * FROM practical_attempts WHERE id = ? AND user_id = ? LIMIT 1",
      parameters: [attemptId, userId],
    });
    return row ? mapAttempt(row) : null;
  }

  async listAttemptsForUser(userId: string, practicalId: string) {
    const result = await this.database.query<DatabaseAttemptRow>({
      sql: "SELECT * FROM practical_attempts WHERE user_id = ? AND practical_id = ? ORDER BY started_at DESC, id DESC",
      parameters: [userId, practicalId],
    });
    return result.rows.map(mapAttempt);
  }

  async createAttempt(input: CreateAttemptWrite, audit: PracticalAuditInput) {
    requireCanonicalJsonText(input.responsesJson);
    requireCanonicalJsonText(
      input.artifactManifestJson,
      PRACTICAL_JSON_LIMITS.maximumArtifactManifestLength,
    );
    const existing = await this.findAttemptByCreationKey(
      input.userId,
      input.creationIdempotencyKey,
    );
    if (existing) {
      if (!sameAttemptCreation(existing, input)) conflict("ATTEMPT_IDEMPOTENCY_CONFLICT");
      return { attempt: existing, idempotentReplay: true };
    }
    try {
      await this.database.transaction([
        {
          sql: `INSERT INTO practical_attempts
            (id, user_id, practical_id, practical_definition_version_id, rubric_version_id,
             course_id, curriculum_tree_id, curriculum_tree_version_reference, curriculum_node_id,
             objective_placement_id, practical_placement_id, state, responses_json,
             artifact_manifest_json, creation_idempotency_key, draft_revision, started_at,
             expires_at, eligibility_decision_reference)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?, ?, ?, ?, ?)`,
          parameters: [
            input.id,
            input.userId,
            input.practicalId,
            input.practicalDefinitionVersionId,
            input.rubricVersionId,
            input.courseId,
            input.curriculumTreeId,
            input.curriculumTreeVersionReference,
            input.curriculumNodeId,
            input.objectivePlacementId,
            input.practicalPlacementId,
            input.responsesJson,
            input.artifactManifestJson,
            input.creationIdempotencyKey,
            input.draftRevision,
            input.startedAt,
            input.expiresAt,
            input.eligibilityDecisionReference,
          ],
        },
        auditStatement(audit),
      ]);
    } catch (error) {
      if (isUniqueConflict(error)) {
        const replay = await this.findAttemptByCreationKey(
          input.userId,
          input.creationIdempotencyKey,
        );
        if (replay && sameAttemptCreation(replay, input)) {
          return { attempt: replay, idempotentReplay: true };
        }
        conflict("ATTEMPT_IDEMPOTENCY_CONFLICT");
      }
      throw error;
    }
    const attempt = await this.getAttemptForUser(input.id, input.userId);
    if (!attempt) fail("ATTEMPT_CREATE_FAILED", 500);
    return { attempt, idempotentReplay: false };
  }

  async submitAttempt(input: SubmitAttemptWrite, audit: PracticalAuditInput) {
    requireCanonicalJsonText(input.responsesJson);
    requireCanonicalJsonText(
      input.artifactManifestJson,
      PRACTICAL_JSON_LIMITS.maximumArtifactManifestLength,
    );
    requireDigest(input.submissionDigest);
    const before = await this.getAttemptForUser(input.attemptId, input.userId);
    if (!before) fail("ATTEMPT_NOT_FOUND", 404);
    if (before.state === "SUBMITTED" || before.state === "EVALUATED") {
      if (
        before.submissionIdempotencyKey === input.submissionIdempotencyKey &&
        before.submissionDigest === input.submissionDigest
      ) {
        return { attempt: before, idempotentReplay: true };
      }
      conflict("ATTEMPT_ALREADY_SUBMITTED");
    }
    if (before.state !== "IN_PROGRESS") conflict("INVALID_ATTEMPT_STATE");
    let results;
    try {
      results = await this.database.transaction([
        {
        sql: `UPDATE practical_attempts SET state = 'SUBMITTED', responses_json = ?,
          artifact_manifest_json = ?, submission_digest = ?, submission_idempotency_key = ?,
          draft_revision = ?, submitted_at = ?, updated_at = ?
          WHERE id = ? AND user_id = ? AND state = 'IN_PROGRESS' AND draft_revision = ?`,
        parameters: [
          input.responsesJson,
          input.artifactManifestJson,
          input.submissionDigest,
          input.submissionIdempotencyKey,
          input.nextDraftRevision,
          input.submittedAt,
          input.submittedAt,
          input.attemptId,
          input.userId,
          input.expectedDraftRevision,
        ],
        },
        auditStatement(audit, {
          sql: "SELECT 1 FROM practical_attempts WHERE id = ? AND user_id = ? AND state = 'SUBMITTED' AND submission_idempotency_key = ? AND submission_digest = ?",
          parameters: [
            input.attemptId,
            input.userId,
            input.submissionIdempotencyKey,
            input.submissionDigest,
          ],
        }),
      ]);
    } catch (error) {
      if (isUniqueConflict(error)) conflict("CONCURRENT_MODIFICATION");
      throw error;
    }
    if (results[0]?.affectedRows !== 1) conflict("CONCURRENT_MODIFICATION");
    const attempt = await this.getAttemptForUser(input.attemptId, input.userId);
    if (!attempt) fail("ATTEMPT_NOT_FOUND", 404);
    return { attempt, idempotentReplay: false };
  }

  async transitionAttempt(input: TransitionAttemptWrite, audit: PracticalAuditInput, recomputeRequest?: RecomputeRequestInput) {
    const timestampColumn = input.nextState === "EXPIRED" ? "expired_at" : "voided_at";
    const reasonSql = input.nextState === "VOIDED" ? ", void_reason_code = ?" : "";
    const parameters: DatabaseValue[] = [input.occurredAt, input.occurredAt];
    if (input.nextState === "VOIDED") parameters.push(input.reasonCode);
    parameters.push(input.attemptId, input.userId, input.expectedState);
    let results;
    try {
      const statements: DatabaseStatement[] = [
        {
        sql: `UPDATE practical_attempts SET state = ?, ${timestampColumn} = ?, updated_at = ?${reasonSql}
          WHERE id = ? AND user_id = ? AND state = ?`.replace(
          "SET state = ?",
          `SET state = '${input.nextState}'`,
        ),
        parameters,
        },
        auditStatement(audit, {
          sql: "SELECT 1 FROM practical_attempts WHERE id = ? AND user_id = ? AND state = ?",
          parameters: [input.attemptId, input.userId, input.nextState],
        }),
      ];
      if (recomputeRequest) statements.push(recomputeInsert(recomputeRequest));
      results = await this.database.transaction(statements);
    } catch (error) {
      if (isUniqueConflict(error)) conflict("CONCURRENT_MODIFICATION");
      throw error;
    }
    if (results[0]?.affectedRows !== 1) conflict("CONCURRENT_MODIFICATION");
    const attempt = await this.getAttemptForUser(input.attemptId, input.userId);
    if (!attempt) fail("ATTEMPT_NOT_FOUND", 404);
    return attempt;
  }

  async createFirstEvaluation(input: EvaluationWrite, audit: PracticalAuditInput, recomputeRequest?: RecomputeRequestInput) {
    return this.insertEvaluation(input, audit, true, recomputeRequest);
  }

  async appendEvaluationRevision(input: EvaluationWrite, audit: PracticalAuditInput, recomputeRequest?: RecomputeRequestInput) {
    return this.insertEvaluation(input, audit, false, recomputeRequest);
  }

  async getEvaluationForOwner(evaluationId: string, userId: string) {
    const row = await this.database.queryOne<DatabaseEvaluationRow>({
      sql: `SELECT practical_evaluations.* FROM practical_evaluations
        INNER JOIN practical_attempts ON practical_attempts.id = practical_evaluations.attempt_id
        WHERE practical_evaluations.id = ? AND practical_attempts.user_id = ? LIMIT 1`,
      parameters: [evaluationId, userId],
    });
    return row ? mapEvaluation(row) : null;
  }

  async getLatestEvaluationForOwner(attemptId: string, userId: string) {
    const row = await this.database.queryOne<DatabaseEvaluationRow>({
      sql: `SELECT practical_evaluations.* FROM practical_evaluations
        INNER JOIN practical_attempts ON practical_attempts.id = practical_evaluations.attempt_id
        WHERE practical_evaluations.attempt_id = ? AND practical_attempts.user_id = ?
        ORDER BY practical_evaluations.sequence DESC LIMIT 1`,
      parameters: [attemptId, userId],
    });
    return row ? mapEvaluation(row) : null;
  }

  async listEvaluationHistoryForOwner(attemptId: string, userId: string) {
    const result = await this.database.query<DatabaseEvaluationRow>({
      sql: `SELECT practical_evaluations.* FROM practical_evaluations
        INNER JOIN practical_attempts ON practical_attempts.id = practical_evaluations.attempt_id
        WHERE practical_evaluations.attempt_id = ? AND practical_attempts.user_id = ?
        ORDER BY practical_evaluations.sequence ASC`,
      parameters: [attemptId, userId],
    });
    return result.rows.map(mapEvaluation);
  }

  async getEvaluationForElevatedAccess(
    evaluationId: string,
    context: PracticalElevatedReadContext,
  ) {
    requireElevatedReadContext(context);
    return this.getEvaluationInternal(evaluationId);
  }

  async getLatestEvaluationForElevatedAccess(
    attemptId: string,
    context: PracticalElevatedReadContext,
  ) {
    requireElevatedReadContext(context);
    return this.getLatestEvaluationInternal(attemptId);
  }

  async listEvaluationHistoryForElevatedAccess(
    attemptId: string,
    context: PracticalElevatedReadContext,
  ) {
    requireElevatedReadContext(context);
    return this.listEvaluationHistoryInternal(attemptId);
  }

  private async insertEvaluation(
    input: EvaluationWrite,
    audit: PracticalAuditInput,
    first: boolean,
    recomputeRequest?: RecomputeRequestInput,
  ) {
    validateEvaluationWrite(input);
    const existing = await this.getEvaluationByOperationInternal(
      input.attemptId,
      input.idempotencyKey,
    );
    if (existing) {
      if (existing.evaluationPayloadDigest !== input.evaluationPayloadDigest) {
        conflict("EVALUATION_IDEMPOTENCY_CONFLICT");
      }
      return { evaluation: existing, idempotentReplay: true };
    }
    const expectedState = first ? "SUBMITTED" : "EVALUATED";
    const predecessorPredicate = first
      ? "? = 1 AND ? IS NULL"
      : `? > 1 AND ? IS NOT NULL AND EXISTS (
          SELECT 1 FROM practical_evaluations previous
          WHERE previous.id = ? AND previous.attempt_id = practical_attempts.id
            AND previous.sequence = ? - 1
            AND NOT EXISTS (
              SELECT 1 FROM practical_evaluations newer
              WHERE newer.attempt_id = practical_attempts.id
                AND newer.sequence > previous.sequence
            )
        )`;
    const predecessorParameters: DatabaseValue[] = first
      ? [input.sequence, input.previousEvaluationId]
      : [
          input.sequence,
          input.previousEvaluationId,
          input.previousEvaluationId,
          input.sequence,
        ];
    const insert: DatabaseStatement = {
      sql: `INSERT INTO practical_evaluations
        (id, attempt_id, sequence, previous_evaluation_id,
         practical_definition_version_id, rubric_version_id, method,
         dimension_results_json, raw_score, maximum_score, qualification,
         review_status, provenance_json, reviewer_id, reviewed_at, review_reason,
         evaluation_payload_digest, idempotency_key, evaluator_job_id,
         evaluator_result_id, evaluated_at)
        SELECT ?, practical_attempts.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM practical_attempts
        WHERE practical_attempts.id = ? AND practical_attempts.user_id = ?
          AND practical_attempts.state = ?
          AND practical_attempts.practical_definition_version_id = ?
          AND practical_attempts.rubric_version_id = ?
          AND ${predecessorPredicate}`,
      parameters: [
        input.id,
        input.sequence,
        input.previousEvaluationId,
        input.practicalDefinitionVersionId,
        input.rubricVersionId,
        input.method,
        input.dimensionResultsJson,
        input.rawScore,
        input.maximumScore,
        input.qualification,
        input.reviewStatus,
        input.provenanceJson,
        input.reviewerId,
        input.reviewedAt,
        input.reviewReason,
        input.evaluationPayloadDigest,
        input.idempotencyKey,
        input.evaluatorJobId,
        input.evaluatorResultId,
        input.evaluatedAt,
        input.attemptId,
        input.ownerUserId,
        expectedState,
        input.practicalDefinitionVersionId,
        input.rubricVersionId,
        ...predecessorParameters,
      ],
    };
    const statements: DatabaseStatement[] = [insert];
    if (first) {
      statements.push({
        sql: `UPDATE practical_attempts SET state = 'EVALUATED', updated_at = ?
          WHERE id = ? AND user_id = ? AND state = 'SUBMITTED'
            AND EXISTS (SELECT 1 FROM practical_evaluations WHERE id = ? AND attempt_id = practical_attempts.id)`,
        parameters: [input.evaluatedAt, input.attemptId, input.ownerUserId, input.id],
      });
    }
    statements.push(
      auditStatement(audit, {
        sql: "SELECT 1 FROM practical_evaluations WHERE id = ? AND attempt_id = ?",
        parameters: [input.id, input.attemptId],
      }),
    );
    if (recomputeRequest) statements.push(recomputeInsert(recomputeRequest));
    let results;
    try {
      results = await this.database.transaction(statements);
    } catch (error) {
      if (isUniqueConflict(error)) conflict("EVALUATION_SEQUENCE_CONFLICT");
      throw error;
    }
    if (results[0]?.affectedRows !== 1) {
      conflict(first ? "EVALUATION_BEFORE_SUBMISSION" : "EVALUATION_SEQUENCE_CONFLICT");
    }
    if (first && results[1]?.affectedRows !== 1) {
      fail("EVALUATION_ATOMICITY_FAILED", 500);
    }
    const evaluation = await this.getEvaluationInternal(input.id);
    if (!evaluation) fail("EVALUATION_CREATE_FAILED", 500);
    return { evaluation, idempotentReplay: false };
  }

  async getEvaluationByOperationForElevatedAccess(
    attemptId: string,
    key: string,
    context: PracticalElevatedReadContext,
  ) {
    requireElevatedReadContext(context);
    return this.getEvaluationByOperationInternal(attemptId, key);
  }

  private async getEvaluationByOperationInternal(attemptId: string, key: string) {
    const row = await this.database.queryOne<DatabaseEvaluationRow>({
      sql: "SELECT * FROM practical_evaluations WHERE attempt_id = ? AND idempotency_key = ? LIMIT 1",
      parameters: [attemptId, key],
    });
    return row ? mapEvaluation(row) : null;
  }

  async getEvaluationByEvaluatorResultForElevatedAccess(
    attemptId: string,
    evaluatorJobId: string,
    evaluatorResultId: string,
    context: PracticalElevatedReadContext,
  ) {
    requireElevatedReadContext(context);
    const row = await this.database.queryOne<DatabaseEvaluationRow>({
      sql: `SELECT * FROM practical_evaluations
        WHERE attempt_id = ? AND evaluator_job_id = ? AND evaluator_result_id = ?
        LIMIT 1`,
      parameters: [attemptId, evaluatorJobId, evaluatorResultId],
    });
    return row ? mapEvaluation(row) : null;
  }

  private async getEvaluationInternal(evaluationId: string) {
    const row = await this.database.queryOne<DatabaseEvaluationRow>({
      sql: "SELECT * FROM practical_evaluations WHERE id = ? LIMIT 1",
      parameters: [evaluationId],
    });
    return row ? mapEvaluation(row) : null;
  }

  private async getLatestEvaluationInternal(attemptId: string) {
    const row = await this.database.queryOne<DatabaseEvaluationRow>({
      sql: "SELECT * FROM practical_evaluations WHERE attempt_id = ? ORDER BY sequence DESC LIMIT 1",
      parameters: [attemptId],
    });
    return row ? mapEvaluation(row) : null;
  }

  private async listEvaluationHistoryInternal(attemptId: string) {
    const result = await this.database.query<DatabaseEvaluationRow>({
      sql: "SELECT * FROM practical_evaluations WHERE attempt_id = ? ORDER BY sequence ASC",
      parameters: [attemptId],
    });
    return result.rows.map(mapEvaluation);
  }

  private async executeImmutableInsert(statement: DatabaseStatement) {
    try {
      await this.database.execute(statement);
    } catch (error) {
      if (isUniqueConflict(error)) conflict("PRACTICAL_VERSION_IMMUTABLE");
      throw error;
    }
  }
}

export type CreateAttemptWrite = Omit<
  PracticalAttemptRow,
  | "state"
  | "submissionDigest"
  | "submissionIdempotencyKey"
  | "submittedAt"
  | "expiredAt"
  | "voidedAt"
  | "voidReasonCode"
  | "createdAt"
  | "updatedAt"
>;

export type SubmitAttemptWrite = Readonly<{
  attemptId: string;
  userId: string;
  responsesJson: string;
  artifactManifestJson: string;
  submissionDigest: string;
  submissionIdempotencyKey: string;
  expectedDraftRevision: number;
  nextDraftRevision: number;
  submittedAt: string;
}>;

export type TransitionAttemptWrite = Readonly<{
  attemptId: string;
  userId: string;
  expectedState: "IN_PROGRESS" | "SUBMITTED";
  nextState: "EXPIRED" | "VOIDED";
  occurredAt: string;
  reasonCode: string | null;
}>;

export type EvaluationWrite = Omit<PracticalEvaluationRow, "createdAt"> &
  Readonly<{ ownerUserId: string }>;

type DatabaseRubricVersionRow = Record<string, unknown> & {
  id: string; rubric_id: string; version: number; snapshot_format_version: number;
  snapshot_json: string; snapshot_digest: string; created_at: string;
  effective_from: string | null; withdrawn_at: string | null;
};
type DatabaseDefinitionVersionRow = Record<string, unknown> & {
  id: string; practical_id: string; version: number; rubric_version_id: string;
  snapshot_format_version: number; snapshot_json: string; snapshot_digest: string;
  created_at: string; effective_from: string | null; withdrawn_at: string | null;
};
type DatabaseAttemptRow = Record<string, unknown> & {
  id: string; user_id: string; practical_id: string;
  practical_definition_version_id: string; rubric_version_id: string;
  course_id: string; curriculum_tree_id: string;
  curriculum_tree_version_reference: string; curriculum_node_id: string;
  objective_placement_id: string; practical_placement_id: string; state: PracticalAttemptRow["state"];
  responses_json: string; artifact_manifest_json: string; submission_digest: string | null;
  creation_idempotency_key: string; submission_idempotency_key: string | null;
  draft_revision: number; started_at: string; submitted_at: string | null;
  expires_at: string | null; expired_at: string | null; voided_at: string | null;
  void_reason_code: string | null; eligibility_decision_reference: string | null;
  created_at: string; updated_at: string;
};
type DatabaseEvaluationRow = Record<string, unknown> & {
  id: string; attempt_id: string; sequence: number; previous_evaluation_id: string | null;
  practical_definition_version_id: string; rubric_version_id: string; method: string;
  dimension_results_json: string; raw_score: number | null; maximum_score: number | null;
  qualification: string; review_status: string; provenance_json: string;
  reviewer_id: string | null; reviewed_at: string | null; review_reason: string | null;
  evaluation_payload_digest: string; idempotency_key: string;
  evaluator_job_id: string | null; evaluator_result_id: string | null;
  evaluated_at: string; created_at: string;
};

function mapRubricVersion(row: DatabaseRubricVersionRow): PracticalRubricVersionRow {
  return Object.freeze({
    id: row.id, rubricId: row.rubric_id, version: Number(row.version),
    snapshotFormatVersion: Number(row.snapshot_format_version),
    snapshotJson: row.snapshot_json, snapshotDigest: row.snapshot_digest,
    createdAt: row.created_at, effectiveFrom: row.effective_from, withdrawnAt: row.withdrawn_at,
  });
}

function mapDefinitionVersion(row: DatabaseDefinitionVersionRow): PracticalDefinitionVersionRow {
  return Object.freeze({
    id: row.id, practicalId: row.practical_id, version: Number(row.version),
    rubricVersionId: row.rubric_version_id,
    snapshotFormatVersion: Number(row.snapshot_format_version),
    snapshotJson: row.snapshot_json, snapshotDigest: row.snapshot_digest,
    createdAt: row.created_at, effectiveFrom: row.effective_from, withdrawnAt: row.withdrawn_at,
  });
}

function mapAttempt(row: DatabaseAttemptRow): PracticalAttemptRow {
  return Object.freeze({
    id: row.id, userId: row.user_id, practicalId: row.practical_id,
    practicalDefinitionVersionId: row.practical_definition_version_id,
    rubricVersionId: row.rubric_version_id, courseId: row.course_id,
    curriculumTreeId: row.curriculum_tree_id,
    curriculumTreeVersionReference: row.curriculum_tree_version_reference,
    curriculumNodeId: row.curriculum_node_id, objectivePlacementId: row.objective_placement_id,
    practicalPlacementId: row.practical_placement_id, state: row.state,
    responsesJson: row.responses_json, artifactManifestJson: row.artifact_manifest_json,
    submissionDigest: row.submission_digest,
    creationIdempotencyKey: row.creation_idempotency_key,
    submissionIdempotencyKey: row.submission_idempotency_key,
    draftRevision: Number(row.draft_revision), startedAt: row.started_at,
    submittedAt: row.submitted_at, expiresAt: row.expires_at, expiredAt: row.expired_at,
    voidedAt: row.voided_at, voidReasonCode: row.void_reason_code,
    eligibilityDecisionReference: row.eligibility_decision_reference,
    createdAt: row.created_at, updatedAt: row.updated_at,
  });
}

function mapEvaluation(row: DatabaseEvaluationRow): PracticalEvaluationRow {
  return Object.freeze({
    id: row.id, attemptId: row.attempt_id, sequence: Number(row.sequence),
    previousEvaluationId: row.previous_evaluation_id,
    practicalDefinitionVersionId: row.practical_definition_version_id,
    rubricVersionId: row.rubric_version_id, method: row.method,
    dimensionResultsJson: row.dimension_results_json,
    rawScore: row.raw_score === null ? null : Number(row.raw_score),
    maximumScore: row.maximum_score === null ? null : Number(row.maximum_score),
    qualification: row.qualification, reviewStatus: row.review_status,
    provenanceJson: row.provenance_json, reviewerId: row.reviewer_id,
    reviewedAt: row.reviewed_at, reviewReason: row.review_reason,
    evaluationPayloadDigest: row.evaluation_payload_digest,
    idempotencyKey: row.idempotency_key, evaluatorJobId: row.evaluator_job_id,
    evaluatorResultId: row.evaluator_result_id, evaluatedAt: row.evaluated_at,
    createdAt: row.created_at,
  });
}

function sameAttemptCreation(row: PracticalAttemptRow, input: CreateAttemptWrite) {
  return row.practicalId === input.practicalId &&
    row.practicalDefinitionVersionId === input.practicalDefinitionVersionId &&
    row.rubricVersionId === input.rubricVersionId && row.courseId === input.courseId &&
    row.curriculumTreeId === input.curriculumTreeId &&
    row.curriculumTreeVersionReference === input.curriculumTreeVersionReference &&
    row.curriculumNodeId === input.curriculumNodeId &&
    row.objectivePlacementId === input.objectivePlacementId &&
    row.practicalPlacementId === input.practicalPlacementId &&
    row.responsesJson === input.responsesJson &&
    row.artifactManifestJson === input.artifactManifestJson;
}

function auditStatement(input: PracticalAuditInput, condition?: DatabaseStatement): DatabaseStatement {
  const metadata = JSON.stringify(sanitizeAuditMetadata(input.action, input.metadata));
  const values: DatabaseValue[] = [
    input.eventId ?? crypto.randomUUID(), input.actorUserId, input.actorRole.slice(0, 100),
    input.action.slice(0, 100), input.resourceType, input.resourceId.slice(0, 200),
    input.result ?? "SUCCESS", input.courseId ?? null, input.requestId ?? null, metadata,
  ];
  if (!condition) {
    return {
      sql: `INSERT INTO admin_audit_logs
        (id, actor_user_id, actor_role, action, resource_type, resource_id, result,
         request_id, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameters: values.filter((_, index) => index !== 7),
    };
  }
  return {
    sql: `INSERT INTO admin_audit_logs
      (id, actor_user_id, actor_role, action, resource_type, resource_id, result,
       request_id, metadata_json)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (${condition.sql})`,
    parameters: [...values.filter((_, index) => index !== 7), ...(condition.parameters ?? [])],
  };
}

function isUniqueConflict(error: unknown) {
  return error instanceof Error &&
    (/UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|duplicate key/i.test(error.message) ||
      ("code" in error && error.code === "23505"));
}

function requireCanonicalJsonText(
  value: string,
  maximumLength: number = PRACTICAL_JSON_LIMITS.maximumSnapshotLength,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail("INVALID_STRUCTURED_FIELD", 400);
  }
  if (canonicalizePracticalJson(parsed, maximumLength) !== value) {
    fail("INVALID_STRUCTURED_FIELD", 400);
  }
}

function requireDigest(value: string) {
  if (!/^[0-9a-f]{64}$/.test(value)) fail("INVALID_DIGEST", 400);
}

function validateEvaluationWrite(input: EvaluationWrite) {
  requireCanonicalJsonText(input.dimensionResultsJson);
  requireCanonicalJsonText(
    input.provenanceJson,
    PRACTICAL_JSON_LIMITS.maximumProvenanceLength,
  );
  requireDigest(input.evaluationPayloadDigest);
  const scorePairIsEmpty = input.rawScore === null && input.maximumScore === null;
  const scorePairIsValid =
    typeof input.rawScore === "number" &&
    typeof input.maximumScore === "number" &&
    Number.isFinite(input.rawScore) &&
    Number.isFinite(input.maximumScore) &&
    input.rawScore >= 0 &&
    input.maximumScore > 0 &&
    input.rawScore <= input.maximumScore;
  if (!scorePairIsEmpty && !scorePairIsValid) {
    fail("NON_FINITE_EVALUATION_VALUE", 400);
  }
  if (
    !["DETERMINISTIC", "RUBRIC", "AI_ASSISTED", "HUMAN_REVIEWED", "HYBRID"].includes(
      input.method,
    )
  ) {
    fail("INVALID_EVALUATION_METHOD", 400);
  }
  if (
    !["QUALIFIED", "NOT_QUALIFIED", "PENDING_REVIEW"].includes(
      input.qualification,
    )
  ) {
    fail("INVALID_QUALIFICATION_RESULT", 400);
  }
  if (input.method === "AI_ASSISTED" && input.qualification === "QUALIFIED") {
    fail("AI_ONLY_QUALIFICATION_FORBIDDEN", 400);
  }
}

function requireElevatedReadContext(context: PracticalElevatedReadContext) {
  if (
    typeof context.actorUserId !== "string" ||
    context.actorUserId.trim() === "" ||
    !["CONTENT_REVIEWER", "ADMIN", "SUPER_ADMIN", "SYSTEM"].includes(
      context.actorRole,
    )
  ) {
    fail("ATTEMPT_FORBIDDEN", 403);
  }
}

function conflict(code: string): never {
  throw new AppError("The Practical operation conflicts with current state.", 409, code);
}

function fail(code: string, status: number): never {
  throw new AppError("The Practical operation could not be completed.", status, code);
}
