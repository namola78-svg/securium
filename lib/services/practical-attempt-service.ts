import {
  PracticalRepository,
  type PracticalAttemptRow,
  type PracticalElevatedReadContext,
} from "../../db/practical-repositories.ts";
import { AppError } from "../errors.ts";
import {
  PRACTICAL_JSON_LIMITS,
  createPracticalAttempt,
  createPracticalEvaluation,
  digestPracticalJson,
  transitionPracticalAttempt,
  validateCanonicalPracticalJson,
  type PracticalAttempt,
} from "../practical/practical-attempt.ts";
import type { ResponseComponentSpec } from "../practical/practical-definition.ts";
import { createEvidenceRecomputeRequiredSignal } from "./learning-event-contracts.ts";
import { createRecomputeRequest } from "../../db/evidence-projection-repository.ts";

const REVIEW_STATUSES = ["NOT_REQUIRED", "PENDING", "COMPLETED"] as const;
const EVALUATION_ACTOR_ROLES = [
  "SYSTEM",
  "SUPER_ADMIN",
  "ADMIN",
  "CONTENT_REVIEWER",
] as const;
export type PracticalEvaluatorRole = (typeof EVALUATION_ACTOR_ROLES)[number];
export type PracticalEvaluatorAuthorization = Readonly<{
  actorUserId: unknown;
  actorRoles: readonly unknown[];
}>;
export type PracticalEvaluatorAuthorizationPolicy = Readonly<{
  authorize(
    input: Readonly<{ actorUserId: string; actorRoles: readonly string[] }>,
  ): PracticalElevatedReadContext | null;
}>;
type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const DENY_ALL_EVALUATOR_AUTHORIZATION: PracticalEvaluatorAuthorizationPolicy =
  Object.freeze({ authorize: () => null });

export class PracticalAttemptService {
  private readonly repository: PracticalRepository;
  private readonly now: () => Date;
  private readonly evaluatorAuthorizationPolicy: PracticalEvaluatorAuthorizationPolicy;

  constructor(
    repository: PracticalRepository,
    now: () => Date = () => new Date(),
    evaluatorAuthorizationPolicy: PracticalEvaluatorAuthorizationPolicy =
      DENY_ALL_EVALUATOR_AUTHORIZATION,
  ) {
    this.repository = repository;
    this.now = now;
    this.evaluatorAuthorizationPolicy = evaluatorAuthorizationPolicy;
  }

  async storeRubricVersion(input: VersionSnapshotInput & { rubricId: unknown }) {
    const id = requireReference(input.id, "RUBRIC_VERSION_ID");
    const rubricId = requireReference(input.rubricId, "RUBRIC_ID");
    const version = requirePositiveInteger(input.version, "RUBRIC_VERSION");
    const format = requirePositiveInteger(
      input.snapshotFormatVersion ?? 1,
      "RUBRIC_SNAPSHOT_FORMAT_VERSION",
    );
    const snapshot = await digestPracticalJson(input.snapshot);
    return this.repository.insertRubricVersion({
      id,
      rubricId,
      version,
      snapshotFormatVersion: format,
      snapshotJson: snapshot.canonicalJson,
      snapshotDigest: snapshot.digest,
      effectiveFrom: optionalTimestamp(input.effectiveFrom),
    });
  }

  async storeDefinitionVersion(
    input: VersionSnapshotInput & {
      practicalId: unknown;
      rubricVersionId: unknown;
    },
  ) {
    const id = requireReference(input.id, "PRACTICAL_VERSION_ID");
    const practicalId = requireReference(input.practicalId, "PRACTICAL_ID");
    const rubricVersionId = requireReference(
      input.rubricVersionId,
      "RUBRIC_VERSION_ID",
    );
    if (!(await this.repository.getRubricVersion(rubricVersionId))) {
      fail("RUBRIC_VERSION_NOT_FOUND", 404);
    }
    const snapshot = await digestPracticalJson(input.snapshot);
    return this.repository.insertDefinitionVersion({
      id,
      practicalId,
      version: requirePositiveInteger(input.version, "PRACTICAL_VERSION"),
      rubricVersionId,
      snapshotFormatVersion: requirePositiveInteger(
        input.snapshotFormatVersion ?? 1,
        "PRACTICAL_SNAPSHOT_FORMAT_VERSION",
      ),
      snapshotJson: snapshot.canonicalJson,
      snapshotDigest: snapshot.digest,
      effectiveFrom: optionalTimestamp(input.effectiveFrom),
    });
  }

  async createAttempt(input: CreateAttemptInput) {
    if (input.initialState !== undefined && input.initialState !== "IN_PROGRESS") {
      fail("INVALID_INITIAL_PRACTICAL_ATTEMPT_STATE");
    }
    const userId = requireReference(input.userId, "USER_ID");
    const practicalDefinitionVersionId = requireReference(
      input.practicalDefinitionVersionId,
      "PRACTICAL_VERSION_ID",
    );
    const rubricVersionId = requireReference(
      input.rubricVersionId,
      "RUBRIC_VERSION_ID",
    );
    const definition = await this.repository.getDefinitionVersion(
      practicalDefinitionVersionId,
    );
    if (!definition) fail("PRACTICAL_VERSION_NOT_FOUND", 404);
    if (definition.rubricVersionId !== rubricVersionId) {
      fail("RUBRIC_VERSION_MISMATCH");
    }
    const startedAt = this.now().toISOString();
    const domain = createPracticalAttempt({
      attemptId: crypto.randomUUID(),
      learnerReference: userId,
      practicalId: definition.practicalId,
      practicalVersionId: practicalDefinitionVersionId,
      rubricVersionId,
      objectivePlacementId: input.objectivePlacementId,
      practicalPlacementId: input.practicalPlacementId,
      state: "IN_PROGRESS",
      responseSpec: input.responseSpec,
      responses: input.responses ?? [],
      startedAt,
      idempotencyKey: input.creationIdempotencyKey,
      draftRevision: 0,
      eligibilityDecisionReference: input.eligibilityDecisionReference,
    });
    const responsesJson = (await digestPracticalJson(domain.responses)).canonicalJson;
    const artifactManifestJson = (
      await digestPracticalJson(
        input.artifactManifest ?? [],
        PRACTICAL_JSON_LIMITS.maximumArtifactManifestLength,
      )
    ).canonicalJson;
    const result = await this.repository.createAttempt(
      {
        id: domain.attemptId,
        userId,
        practicalId: domain.practicalId,
        practicalDefinitionVersionId,
        rubricVersionId,
        courseId: requireReference(input.courseId, "COURSE_ID"),
        curriculumTreeId: requireReference(
          input.curriculumTreeId,
          "CURRICULUM_TREE_ID",
        ),
        curriculumTreeVersionReference: requireReference(
          input.curriculumTreeVersionReference,
          "CURRICULUM_TREE_VERSION_REFERENCE",
        ),
        curriculumNodeId: requireReference(
          input.curriculumNodeId,
          "CURRICULUM_NODE_ID",
        ),
        objectivePlacementId: domain.objectivePlacementId,
        practicalPlacementId: domain.practicalPlacementId,
        responsesJson,
        artifactManifestJson,
        creationIdempotencyKey: requireReference(
          input.creationIdempotencyKey,
          "CREATION_IDEMPOTENCY_KEY",
        ),
        draftRevision: 0,
        startedAt,
        expiresAt: optionalTimestamp(input.expiresAt),
        eligibilityDecisionReference:
          domain.eligibilityDecisionReference ?? null,
      },
      auditForAttempt(userId, "PRACTICAL_ATTEMPT_CREATED", domain.attemptId, {
        practicalId: domain.practicalId,
        practicalDefinitionVersionId,
        rubricVersionId,
      }),
    );
    return result;
  }

  getAttemptForUser(attemptId: string, userId: string) {
    return this.repository.getAttemptForUser(attemptId, userId);
  }

  listAttemptsForUser(userId: string, practicalId: string) {
    return this.repository.listAttemptsForUser(userId, practicalId);
  }

  async submitAttempt(input: SubmitAttemptInput) {
    const attempt = await this.requireOwnedAttempt(input.attemptId, input.userId);
    validateCanonicalPracticalJson(input.responses);
    validateCanonicalPracticalJson(
      input.artifactManifest ?? [],
      PRACTICAL_JSON_LIMITS.maximumArtifactManifestLength,
    );
    const frozen = await digestPracticalJson({
      artifactManifest: input.artifactManifest ?? [],
      responses: input.responses,
    });
    const responsesJson = (await digestPracticalJson(input.responses)).canonicalJson;
    const artifactManifestJson = (
      await digestPracticalJson(
        input.artifactManifest ?? [],
        PRACTICAL_JSON_LIMITS.maximumArtifactManifestLength,
      )
    ).canonicalJson;
    if (attempt.state === "IN_PROGRESS") {
      transitionPracticalAttempt(
        toDomainAttempt(attempt),
        "SUBMITTED",
        this.now().toISOString(),
      );
    } else if (attempt.state !== "SUBMITTED" && attempt.state !== "EVALUATED") {
      fail("INVALID_ATTEMPT_STATE", 409);
    }
    const submittedAt = this.now().toISOString();
    return this.repository.submitAttempt(
      {
        attemptId: attempt.id,
        userId: attempt.userId,
        responsesJson,
        artifactManifestJson,
        submissionDigest: frozen.digest,
        submissionIdempotencyKey: requireReference(
          input.submissionIdempotencyKey,
          "SUBMISSION_IDEMPOTENCY_KEY",
        ),
        expectedDraftRevision: attempt.draftRevision,
        nextDraftRevision: attempt.draftRevision + 1,
        submittedAt,
      },
      auditForAttempt(attempt.userId, "PRACTICAL_ATTEMPT_SUBMITTED", attempt.id, {
        submissionDigest: frozen.digest,
        draftRevision: attempt.draftRevision + 1,
      }),
    );
  }

  async expireAttempt(input: OwnedTransitionInput) {
    const attempt = await this.requireOwnedAttempt(input.attemptId, input.userId);
    transitionPracticalAttempt(toDomainAttempt(attempt), "EXPIRED", this.now().toISOString());
    const occurredAt = this.now().toISOString();
    return this.repository.transitionAttempt(
      {
        attemptId: attempt.id,
        userId: attempt.userId,
        expectedState: "IN_PROGRESS",
        nextState: "EXPIRED",
        occurredAt,
        reasonCode: null,
      },
      auditForAttempt(attempt.userId, "PRACTICAL_ATTEMPT_EXPIRED", attempt.id, {
        reasonCode: input.reasonCode ?? "ATTEMPT_EXPIRED",
      }),
    );
  }

  async voidAttempt(input: OwnedTransitionInput) {
    const attempt = await this.requireOwnedAttempt(input.attemptId, input.userId);
    transitionPracticalAttempt(toDomainAttempt(attempt), "VOIDED", this.now().toISOString());
    const occurredAt = this.now().toISOString();
    const sourceRevisionIdentity = `${attempt.id}:VOIDED:${occurredAt}`;
    const result = await this.repository.transitionAttempt(
      {
        attemptId: attempt.id,
        userId: attempt.userId,
        expectedState: attempt.state === "SUBMITTED" ? "SUBMITTED" : "IN_PROGRESS",
        nextState: "VOIDED",
        occurredAt,
        reasonCode: boundedText(input.reasonCode ?? "ATTEMPT_VOIDED", 200),
      },
      auditForAttempt(attempt.userId, "PRACTICAL_ATTEMPT_VOIDED", attempt.id, {
        reasonCode: input.reasonCode ?? "ATTEMPT_VOIDED",
      }),
      await createRecomputeRequest({
        requestType: "EVIDENCE_RECOMPUTE_REQUIRED", scopeType: "EVENT",
        sourceType: "PRACTICAL_ATTEMPT", sourceEventId: attempt.id,
        sourceRevisionIdentity, userId: attempt.userId,
        projectionVersion: "EVIDENCE_V1", reasonCode: "PRACTICAL_ATTEMPT_VOIDED",
      }),
    );
    return {
      ...result,
      recomputeSignal: createEvidenceRecomputeRequiredSignal({
        sourceType: "PRACTICAL_ATTEMPT",
        sourceEventId: attempt.id,
        reasonCode: "PRACTICAL_ATTEMPT_VOIDED",
        sourceRevisionIdentity,
      }),
    };
  }

  async createFirstEvaluation(input: EvaluationInput) {
    const access = await this.requireEvaluationAccess(input);
    return this.persistEvaluation(input, access.attempt, access.evaluator, 1, null);
  }

  async appendEvaluationRevision(
    input: EvaluationInput & { previousEvaluationId: unknown },
  ) {
    const access = await this.requireEvaluationAccess(input);
    const attempt = access.attempt;
    const previousEvaluationId = requireReference(
      input.previousEvaluationId,
      "PREVIOUS_EVALUATION_ID",
    );
    const latest = await this.repository.getLatestEvaluationForElevatedAccess(
      attempt.id,
      access.evaluator,
    );
    if (!latest || latest.id !== previousEvaluationId) {
      fail("EVALUATION_SEQUENCE_CONFLICT", 409);
    }
    return this.persistEvaluation(
      input,
      attempt,
      access.evaluator,
      latest.sequence + 1,
      previousEvaluationId,
    );
  }

  getEvaluationForOwner(evaluationId: string, userId: string) {
    return this.repository.getEvaluationForOwner(
      requireReference(evaluationId, "EVALUATION_ID"),
      requireReference(userId, "USER_ID"),
    );
  }

  getLatestEvaluationForOwner(attemptId: string, userId: string) {
    return this.repository.getLatestEvaluationForOwner(
      requireReference(attemptId, "ATTEMPT_ID"),
      requireReference(userId, "USER_ID"),
    );
  }

  listEvaluationHistoryForOwner(attemptId: string, userId: string) {
    return this.repository.listEvaluationHistoryForOwner(
      requireReference(attemptId, "ATTEMPT_ID"),
      requireReference(userId, "USER_ID"),
    );
  }

  getEvaluationForReviewer(
    evaluationId: string,
    authorization: PracticalEvaluatorAuthorization,
  ) {
    return this.repository.getEvaluationForElevatedAccess(
      requireReference(evaluationId, "EVALUATION_ID"),
      requireEvaluatorAuthorization(
        authorization,
        this.evaluatorAuthorizationPolicy,
      ),
    );
  }

  getLatestEvaluationForReviewer(
    attemptId: string,
    authorization: PracticalEvaluatorAuthorization,
  ) {
    return this.repository.getLatestEvaluationForElevatedAccess(
      requireReference(attemptId, "ATTEMPT_ID"),
      requireEvaluatorAuthorization(
        authorization,
        this.evaluatorAuthorizationPolicy,
      ),
    );
  }

  listEvaluationHistoryForReviewer(
    attemptId: string,
    authorization: PracticalEvaluatorAuthorization,
  ) {
    return this.repository.listEvaluationHistoryForElevatedAccess(
      requireReference(attemptId, "ATTEMPT_ID"),
      requireEvaluatorAuthorization(
        authorization,
        this.evaluatorAuthorizationPolicy,
      ),
    );
  }

  async recordEvaluatorFailure(input: {
    evaluatorAuthorization: PracticalEvaluatorAuthorization;
    attemptId: unknown;
    reasonCode: "EVALUATOR_ERROR" | "EXECUTION_UNAVAILABLE" | "TIMEOUT" | "DEPENDENCY_FAILURE";
    evaluatorJobId?: unknown;
  }) {
    const evaluator = requireEvaluatorAuthorization(
      input.evaluatorAuthorization,
      this.evaluatorAuthorizationPolicy,
    );
    if (evaluator.actorRole !== "SYSTEM") {
      fail("SYSTEM_EVALUATOR_AUTHORITY_REQUIRED", 403);
    }
    await this.repository.recordOperationalAudit({
      actorUserId: evaluator.actorUserId,
      actorRole: evaluator.actorRole,
      action: "PRACTICAL_EVALUATOR_FAILED",
      resourceType: "PRACTICAL_ATTEMPT",
      resourceId: requireReference(input.attemptId, "ATTEMPT_ID"),
      result: "FAILURE",
      metadata: {
        reasonCode: input.reasonCode,
        ...(input.evaluatorJobId === undefined
          ? {}
          : {
              evaluatorJobId: requireReference(
                input.evaluatorJobId,
                "EVALUATOR_JOB_ID",
              ),
            }),
      },
    });
  }

  private async persistEvaluation(
    input: EvaluationInput,
    attempt: PracticalAttemptRow,
    evaluator: PracticalElevatedReadContext,
    sequence: number,
    previousEvaluationId: string | null,
  ) {
    const idempotencyKey = requireReference(
      input.idempotencyKey,
      "EVALUATION_IDEMPOTENCY_KEY",
    );
    const evaluatorJobId = optionalReference(
      input.evaluatorJobId,
      "EVALUATOR_JOB_ID",
    );
    const evaluatorResultId = optionalReference(
      input.evaluatorResultId,
      "EVALUATOR_RESULT_ID",
    );
    if ((evaluatorJobId === null) !== (evaluatorResultId === null)) {
      fail("INVALID_EVALUATOR_RESULT_IDENTITY");
    }
    const existingByOperation = await this.repository.getEvaluationByOperationForElevatedAccess(
      attempt.id,
      idempotencyKey,
      evaluator,
    );
    const existingByEvaluator =
      evaluatorJobId && evaluatorResultId
        ? await this.repository.getEvaluationByEvaluatorResultForElevatedAccess(
            attempt.id,
            evaluatorJobId,
            evaluatorResultId,
            evaluator,
          )
        : null;
    if (
      existingByOperation &&
      existingByEvaluator &&
      existingByOperation.id !== existingByEvaluator.id
    ) {
      fail("EVALUATION_IDEMPOTENCY_CONFLICT", 409);
    }
    const existing = existingByOperation ?? existingByEvaluator;
    if (!existing && sequence === 1 && attempt.state !== "SUBMITTED") {
      fail("EVALUATION_BEFORE_SUBMISSION", 409);
    }
    if (!existing && sequence > 1 && attempt.state !== "EVALUATED") {
      fail("EVALUATION_SEQUENCE_CONFLICT", 409);
    }
    const practicalDefinitionVersionId = requireReference(
      input.practicalDefinitionVersionId,
      "PRACTICAL_VERSION_ID",
    );
    const rubricVersionId = requireReference(
      input.rubricVersionId,
      "RUBRIC_VERSION_ID",
    );
    if (
      practicalDefinitionVersionId !== attempt.practicalDefinitionVersionId ||
      rubricVersionId !== attempt.rubricVersionId
    ) {
      fail("RUBRIC_VERSION_MISMATCH");
    }
    const evaluatedAt = existing?.evaluatedAt ?? this.now().toISOString();
    const evaluationId = requireReference(input.evaluationId, "EVALUATION_ID");
    const domain = createPracticalEvaluation({
      evaluationId,
      sequence,
      attempt:
        existing && sequence === 1
          ? { ...toDomainAttempt(attempt), state: "SUBMITTED" }
          : toDomainAttempt(attempt),
      practicalVersionId: practicalDefinitionVersionId,
      rubricVersionId,
      dimensionResults: input.dimensionResults,
      qualification: input.qualification,
      provenance: {
        ...(input.provenance as Record<string, unknown>),
        evaluatedAt,
        evaluatorReference: evaluator.actorUserId,
      },
      ...(previousEvaluationId === null ? {} : { previousEvaluationId }),
    });
    const scores = validateScores(input.rawScore, input.maximumScore);
    const reviewStatus = requireReviewStatus(input.reviewStatus ?? "NOT_REQUIRED");
    const reviewerId = optionalReference(input.reviewerId, "REVIEWER_ID");
    if (domain.provenance.method === "HUMAN_REVIEWED" && !reviewerId) {
      fail("HUMAN_REVIEWER_REQUIRED");
    }
    validateEvaluatorMethodConsistency(
      evaluator,
      domain.provenance.method,
      reviewerId,
    );
    const reviewReason = optionalBoundedText(
      input.reviewReason,
      PRACTICAL_JSON_LIMITS.maximumReviewReasonLength,
      "REVIEW_REASON",
    );
    const dimensionResultsJson = (
      await digestPracticalJson(domain.dimensionResults)
    ).canonicalJson;
    const provenanceJson = (
      await digestPracticalJson(
        domain.provenance,
        PRACTICAL_JSON_LIMITS.maximumProvenanceLength,
      )
    ).canonicalJson;
    const payload = await digestPracticalJson({
      attemptId: attempt.id,
      dimensionResults: domain.dimensionResults,
      evaluatedAt,
      evaluatorJobId,
      evaluatorResultId,
      method: domain.provenance.method,
      previousEvaluationId,
      qualification: domain.qualification,
      rawScore: scores.rawScore,
      maximumScore: scores.maximumScore,
      reviewReason,
      reviewerId,
      reviewStatus,
      sequence,
    });
    if (existing) {
      if (existing.evaluationPayloadDigest !== payload.digest) {
        fail("EVALUATION_IDEMPOTENCY_CONFLICT", 409);
      }
      return { evaluation: existing, idempotentReplay: true };
    }
    const write = {
      id: domain.evaluationId,
      attemptId: attempt.id,
      ownerUserId: attempt.userId,
      sequence,
      previousEvaluationId,
      practicalDefinitionVersionId,
      rubricVersionId,
      method: domain.provenance.method,
      dimensionResultsJson,
      rawScore: scores.rawScore,
      maximumScore: scores.maximumScore,
      qualification: domain.qualification,
      reviewStatus,
      provenanceJson,
      reviewerId,
      reviewedAt: reviewerId ? evaluatedAt : null,
      reviewReason,
      evaluationPayloadDigest: payload.digest,
      idempotencyKey,
      evaluatorJobId,
      evaluatorResultId,
      evaluatedAt,
    };
    const action = sequence === 1
      ? "PRACTICAL_EVALUATION_CREATED"
      : "PRACTICAL_EVALUATION_REVISED";
    const audit = {
      eventId: `${action}:${domain.evaluationId}`,
      actorUserId: evaluator.actorUserId,
      actorRole: evaluator.actorRole,
      action,
      resourceType: "PRACTICAL_EVALUATION" as const,
      resourceId: domain.evaluationId,
      courseId: attempt.courseId,
      metadata: {
        sequence,
        ...(previousEvaluationId ? { previousEvaluationId } : {}),
        method: domain.provenance.method,
        qualification: domain.qualification,
        evaluationPayloadDigest: payload.digest,
      },
    };
    const reasonCode = sequence === 1
      ? "PRACTICAL_EVALUATION_CREATED"
      : "PRACTICAL_EVALUATION_REVISED";
    const recomputeRequest = await createRecomputeRequest({
      requestType: "EVIDENCE_RECOMPUTE_REQUIRED", scopeType: "EVENT",
      sourceType: "PRACTICAL_EVALUATION", sourceEventId: domain.evaluationId,
      sourceRevisionIdentity: payload.digest, userId: attempt.userId,
      projectionVersion: "EVIDENCE_V1", reasonCode,
    });
    const persisted = await (sequence === 1
      ? this.repository.createFirstEvaluation(write, audit, recomputeRequest)
      : this.repository.appendEvaluationRevision(write, audit, recomputeRequest));
    return {
      ...persisted,
      recomputeSignal: createEvidenceRecomputeRequiredSignal({
        sourceType: "PRACTICAL_EVALUATION",
        sourceEventId: domain.evaluationId,
        reasonCode,
        sourceRevisionIdentity: payload.digest,
      }),
    };
  }

  private async requireOwnedAttempt(attemptIdValue: unknown, userIdValue: unknown) {
    const attemptId = requireReference(attemptIdValue, "ATTEMPT_ID");
    const userId = requireReference(userIdValue, "USER_ID");
    const attempt = await this.repository.getAttemptForUser(attemptId, userId);
    if (!attempt) fail("ATTEMPT_NOT_FOUND", 404);
    return attempt;
  }

  private async requireEvaluationAccess(input: EvaluationInput) {
    const ownerUserId = requireReference(input.ownerUserId, "OWNER_USER_ID");
    const attempt = await this.requireOwnedAttempt(input.attemptId, ownerUserId);
    const evaluator = requireEvaluatorAuthorization(
      input.evaluatorAuthorization,
      this.evaluatorAuthorizationPolicy,
    );
    return { attempt, evaluator };
  }
}

type VersionSnapshotInput = Readonly<{
  id: unknown;
  version: unknown;
  snapshotFormatVersion?: unknown;
  snapshot: unknown;
  effectiveFrom?: unknown;
}>;

export type CreateAttemptInput = Readonly<{
  userId: unknown;
  practicalDefinitionVersionId: unknown;
  rubricVersionId: unknown;
  courseId: unknown;
  curriculumTreeId: unknown;
  curriculumTreeVersionReference: unknown;
  curriculumNodeId: unknown;
  objectivePlacementId: unknown;
  practicalPlacementId: unknown;
  responseSpec: readonly ResponseComponentSpec[];
  responses?: unknown;
  artifactManifest?: unknown;
  creationIdempotencyKey: unknown;
  expiresAt?: unknown;
  eligibilityDecisionReference?: unknown;
  initialState?: unknown;
}>;

export type SubmitAttemptInput = Readonly<{
  attemptId: unknown;
  userId: unknown;
  responses: unknown;
  artifactManifest?: unknown;
  submissionIdempotencyKey: unknown;
}>;

type OwnedTransitionInput = Readonly<{
  attemptId: unknown;
  userId: unknown;
  reasonCode?: string;
}>;

export type EvaluationInput = Readonly<{
  evaluationId: unknown;
  attemptId: unknown;
  ownerUserId: unknown;
  evaluatorAuthorization: PracticalEvaluatorAuthorization;
  practicalDefinitionVersionId: unknown;
  rubricVersionId: unknown;
  dimensionResults: unknown;
  rawScore?: unknown;
  maximumScore?: unknown;
  qualification: unknown;
  provenance: unknown;
  reviewStatus?: unknown;
  reviewerId?: unknown;
  reviewReason?: unknown;
  idempotencyKey: unknown;
  evaluatorJobId?: unknown;
  evaluatorResultId?: unknown;
}>;

function toDomainAttempt(row: PracticalAttemptRow): PracticalAttempt {
  return Object.freeze({
    attemptId: row.id,
    learnerReference: row.userId,
    practicalId: row.practicalId,
    practicalVersionId: row.practicalDefinitionVersionId,
    rubricVersionId: row.rubricVersionId,
    objectivePlacementId: row.objectivePlacementId,
    practicalPlacementId: row.practicalPlacementId,
    state: row.state,
    responses: JSON.parse(row.responsesJson),
    startedAt: row.startedAt,
    ...(row.submittedAt ? { submittedAt: row.submittedAt } : {}),
    idempotencyKey: row.creationIdempotencyKey,
    draftRevision: row.draftRevision,
    ...(row.eligibilityDecisionReference
      ? { eligibilityDecisionReference: row.eligibilityDecisionReference }
      : {}),
  });
}

function validateScores(raw: unknown, maximum: unknown) {
  if (raw === undefined && maximum === undefined) {
    return { rawScore: null, maximumScore: null };
  }
  if (
    typeof raw !== "number" ||
    typeof maximum !== "number" ||
    !Number.isFinite(raw) ||
    !Number.isFinite(maximum) ||
    raw < 0 ||
    maximum <= 0 ||
    raw > maximum
  ) {
    fail("NON_FINITE_EVALUATION_VALUE");
  }
  return { rawScore: Object.is(raw, -0) ? 0 : raw, maximumScore: maximum };
}

function requireReviewStatus(value: unknown): ReviewStatus {
  if (typeof value !== "string" || !REVIEW_STATUSES.includes(value as ReviewStatus)) {
    fail("INVALID_REVIEW_STATUS");
  }
  return value as ReviewStatus;
}

function requireEvaluatorAuthorization(
  value: PracticalEvaluatorAuthorization,
  policy: PracticalEvaluatorAuthorizationPolicy,
): PracticalElevatedReadContext {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray(value.actorRoles)
  ) {
    fail("EVALUATOR_AUTHORITY_REQUIRED", 403);
  }
  const actorUserId = requireReference(value.actorUserId, "ACTOR_USER_ID");
  if (value.actorRoles.some((role) => typeof role !== "string")) {
    fail("EVALUATOR_AUTHORITY_REQUIRED", 403);
  }
  const authorized = policy.authorize({
    actorUserId,
    actorRoles: value.actorRoles as readonly string[],
  });
  if (
    !authorized ||
    authorized.actorUserId !== actorUserId ||
    !EVALUATION_ACTOR_ROLES.includes(authorized.actorRole)
  ) {
    fail("EVALUATOR_AUTHORITY_REQUIRED", 403);
  }
  return Object.freeze({
    actorUserId: authorized.actorUserId,
    actorRole: authorized.actorRole,
  });
}

function validateEvaluatorMethodConsistency(
  evaluator: PracticalElevatedReadContext,
  method: string,
  reviewerId: string | null,
) {
  if (reviewerId !== null && reviewerId !== evaluator.actorUserId) {
    fail("REVIEWER_IDENTITY_MISMATCH", 403);
  }
  if (method === "HUMAN_REVIEWED" && evaluator.actorRole === "SYSTEM") {
    fail("HUMAN_REVIEWER_REQUIRED", 403);
  }
  if (method === "AI_ASSISTED" && evaluator.actorRole !== "SYSTEM") {
    fail("AI_EVALUATOR_ROLE_MISMATCH", 403);
  }
  if (evaluator.actorRole === "SYSTEM" && reviewerId !== null) {
    fail("REVIEWER_IDENTITY_MISMATCH", 403);
  }
}

function auditForAttempt(
  userId: string,
  action: string,
  attemptId: string,
  metadata: Record<string, unknown>,
) {
  return {
    eventId: `${action}:${attemptId}`,
    actorUserId: userId,
    actorRole: "USER",
    action,
    resourceType: "PRACTICAL_ATTEMPT" as const,
    resourceId: attemptId,
    metadata,
  };
}

function requireReference(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > 500) {
    fail(`INVALID_${field}`);
  }
  return value;
}

function optionalReference(value: unknown, field: string): string | null {
  return value === undefined || value === null ? null : requireReference(value, field);
}

function requirePositiveInteger(value: unknown, field: string) {
  if (!Number.isInteger(value) || (value as number) <= 0) fail(`INVALID_${field}`);
  return value as number;
}

function optionalTimestamp(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    fail("INVALID_TIMESTAMP");
  }
  return value;
}

function boundedText(value: string, maximum: number) {
  if (value.length === 0 || value.length > maximum) fail("INVALID_BOUNDED_TEXT");
  return value;
}

function optionalBoundedText(
  value: unknown,
  maximum: number,
  field: string,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    fail(`INVALID_${field}`);
  }
  return value;
}

function fail(code: string, status = 400): never {
  throw new AppError("The Practical operation is invalid.", status, code);
}
