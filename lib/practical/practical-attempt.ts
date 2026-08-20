import {
  isPracticalId,
  validateLearnerResponses,
  type LearnerResponseComponent,
  type ResponseComponentSpec,
} from "./practical-definition.ts";
import {
  QUALIFICATION_RESULTS,
  validateDimensionEvaluationResult,
  type DimensionEvaluationResult,
  type QualificationResult,
} from "./practical-rubric.ts";
import { requireStableReference } from "../assessment/assessment-objective.ts";

export const PRACTICAL_ATTEMPT_STATES = [
  "IN_PROGRESS",
  "SUBMITTED",
  "EVALUATED",
  "EXPIRED",
  "VOIDED",
] as const;
export type PracticalAttemptState =
  (typeof PRACTICAL_ATTEMPT_STATES)[number];

export const EVALUATION_METHODS = [
  "DETERMINISTIC",
  "RUBRIC",
  "AI_ASSISTED",
  "HUMAN_REVIEWED",
  "HYBRID",
] as const;
export type EvaluationMethod = (typeof EVALUATION_METHODS)[number];

export type PracticalJsonPrimitive = string | number | boolean | null;
export type PracticalJsonValue =
  | PracticalJsonPrimitive
  | readonly PracticalJsonValue[]
  | Readonly<{ [key: string]: PracticalJsonValue }>;

export const PRACTICAL_JSON_LIMITS = Object.freeze({
  maximumDepth: 8,
  maximumNodes: 2_048,
  maximumArrayLength: 256,
  maximumObjectKeys: 128,
  maximumStringLength: 10_000,
  maximumSnapshotLength: 100_000,
  maximumArtifactManifestLength: 20_000,
  maximumProvenanceLength: 10_000,
  maximumReviewReasonLength: 2_000,
});

export type PracticalAttempt = Readonly<{
  attemptId: string;
  learnerReference: string;
  practicalId: string;
  practicalVersionId: string;
  rubricVersionId: string;
  objectivePlacementId: string;
  practicalPlacementId: string;
  state: PracticalAttemptState;
  responses: readonly LearnerResponseComponent[];
  startedAt: string;
  submittedAt?: string;
  idempotencyKey?: string;
  draftRevision: number;
  eligibilityDecisionReference?: string;
}>;

export type EvaluationProvenance = Readonly<{
  method: EvaluationMethod;
  evaluatedAt: string;
  evaluatorReference?: string;
  aiModel?: Readonly<{ provider: string; model: string; version?: string }>;
  metadata?: PracticalJsonValue;
}>;

export type PracticalEvaluation = Readonly<{
  evaluationId: string;
  sequence: number;
  attemptId: string;
  practicalVersionId: string;
  rubricVersionId: string;
  dimensionResults: readonly DimensionEvaluationResult[];
  qualification: QualificationResult;
  provenance: EvaluationProvenance;
  previousEvaluationId?: string;
}>;

export type PracticalEvidenceProjectionInput = Readonly<{
  assessmentObjectiveId: string;
  objectivePlacementId: string;
  practicalId: string;
  practicalVersionId: string;
  rubricVersionId: string;
  practicalPlacementId: string;
  artifactDigests: readonly string[];
  attemptId: string;
  evaluationId: string;
  curriculumVersionReference?: string;
  criterionReferences: readonly string[];
  creDecisionReference?: string;
  policyDecisionReference?: string;
  provenanceDecisionReference?: string;
  currentnessDecisionReference?: string;
}>;

const VERSION_ID = /^(practical-version:practical:[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*:v[1-9][0-9]*|rubric-version:rubric:[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*:v[1-9][0-9]*)$/;

function fail(code: string): never {
  throw new TypeError(code);
}

const FORBIDDEN_JSON_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function canonicalizePracticalJson(
  value: unknown,
  maximumLength: number = PRACTICAL_JSON_LIMITS.maximumSnapshotLength,
): string {
  let nodes = 0;
  const visit = (candidate: unknown, depth: number): string => {
    nodes += 1;
    if (nodes > PRACTICAL_JSON_LIMITS.maximumNodes) {
      fail("PRACTICAL_JSON_NODE_LIMIT_EXCEEDED");
    }
    if (depth > PRACTICAL_JSON_LIMITS.maximumDepth) {
      fail("PRACTICAL_JSON_DEPTH_LIMIT_EXCEEDED");
    }
    if (candidate === null) return "null";
    if (typeof candidate === "string") {
      if (candidate.length > PRACTICAL_JSON_LIMITS.maximumStringLength) {
        fail("PRACTICAL_JSON_STRING_LIMIT_EXCEEDED");
      }
      return JSON.stringify(candidate);
    }
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) fail("NON_FINITE_EVALUATION_VALUE");
      return Object.is(candidate, -0) ? "0" : JSON.stringify(candidate);
    }
    if (typeof candidate === "boolean") return candidate ? "true" : "false";
    if (typeof candidate !== "object") fail("INVALID_STRUCTURED_FIELD");
    if (Array.isArray(candidate)) {
      if (candidate.length > PRACTICAL_JSON_LIMITS.maximumArrayLength) {
        fail("PRACTICAL_JSON_ARRAY_LIMIT_EXCEEDED");
      }
      const keys = Reflect.ownKeys(candidate);
      if (
        keys.some(
          (key) =>
            typeof key !== "string" ||
            (key !== "length" && !/^(0|[1-9][0-9]*)$/.test(key)),
        )
      ) {
        fail("INVALID_STRUCTURED_FIELD");
      }
      const descriptors = Object.getOwnPropertyDescriptors(candidate);
      for (let index = 0; index < candidate.length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || descriptor.get || descriptor.set) {
          fail("INVALID_STRUCTURED_FIELD");
        }
      }
      return `[${candidate.map((item) => visit(item, depth + 1)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("INVALID_STRUCTURED_FIELD");
    }
    const keys = Reflect.ownKeys(candidate);
    if (keys.some((key) => typeof key !== "string")) {
      fail("INVALID_STRUCTURED_FIELD");
    }
    if (keys.length > PRACTICAL_JSON_LIMITS.maximumObjectKeys) {
      fail("PRACTICAL_JSON_KEY_LIMIT_EXCEEDED");
    }
    const descriptors = Object.getOwnPropertyDescriptors(candidate);
    const entries = (keys as string[]).sort().map((key) => {
      if (FORBIDDEN_JSON_KEYS.has(key)) fail("INVALID_STRUCTURED_FIELD");
      const descriptor = descriptors[key];
      if (!descriptor?.enumerable || descriptor.get || descriptor.set) {
        fail("INVALID_STRUCTURED_FIELD");
      }
      return `${JSON.stringify(key)}:${visit(descriptor.value, depth + 1)}`;
    });
    return `{${entries.join(",")}}`;
  };
  const serialized = visit(value, 0);
  if (serialized.length > maximumLength) {
    fail("PRACTICAL_JSON_SIZE_LIMIT_EXCEEDED");
  }
  return serialized;
}

export function validateCanonicalPracticalJson(
  value: unknown,
  maximumLength: number = PRACTICAL_JSON_LIMITS.maximumSnapshotLength,
): PracticalJsonValue {
  return deepFreezeJson(JSON.parse(canonicalizePracticalJson(value, maximumLength)));
}

export async function digestPracticalJson(
  value: unknown,
  maximumLength: number = PRACTICAL_JSON_LIMITS.maximumSnapshotLength,
): Promise<{ canonicalJson: string; digest: string }> {
  const canonicalJson = canonicalizePracticalJson(value, maximumLength);
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson),
  );
  return {
    canonicalJson,
    digest: [...new Uint8Array(bytes)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
  };
}

function deepFreezeJson(value: PracticalJsonValue): PracticalJsonValue {
  if (Array.isArray(value)) {
    for (const item of value) deepFreezeJson(item);
    return Object.freeze(value);
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) deepFreezeJson(item);
    return Object.freeze(value);
  }
  return value;
}

function requireTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "" || Number.isNaN(Date.parse(value))) {
    return fail(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

function requireVersionReference(
  value: unknown,
  prefix: "practical-version:" | "rubric-version:",
): string {
  if (typeof value !== "string" || !value.startsWith(prefix) || !VERSION_ID.test(value)) {
    return fail(`INVALID_${prefix === "practical-version:" ? "PRACTICAL" : "RUBRIC"}_VERSION_ID`);
  }
  return value;
}

function requireNonnegativeRevision(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    return fail("INVALID_DRAFT_REVISION");
  }
  return value as number;
}

export function createPracticalAttempt(input: {
  attemptId: unknown;
  learnerReference: unknown;
  practicalId: unknown;
  practicalVersionId: unknown;
  rubricVersionId: unknown;
  objectivePlacementId: unknown;
  practicalPlacementId: unknown;
  state?: unknown;
  responseSpec: readonly ResponseComponentSpec[];
  responses?: unknown;
  startedAt: unknown;
  submittedAt?: unknown;
  idempotencyKey?: unknown;
  draftRevision?: unknown;
  eligibilityDecisionReference?: unknown;
}): PracticalAttempt {
  if (!isPracticalId(input.practicalId)) fail("INVALID_PRACTICAL_ID");
  const state = input.state ?? "IN_PROGRESS";
  if (state !== "IN_PROGRESS") fail("INVALID_INITIAL_PRACTICAL_ATTEMPT_STATE");
  validateCanonicalPracticalJson(input.responses ?? []);
  const responses = validateLearnerResponses(
    input.responseSpec,
    input.responses ?? [],
  );
  return Object.freeze({
    attemptId: requireStableReference(input.attemptId, "attempt_id"),
    learnerReference: requireStableReference(
      input.learnerReference,
      "learner_reference",
    ),
    practicalId: input.practicalId,
    practicalVersionId: requireVersionReference(
      input.practicalVersionId,
      "practical-version:",
    ),
    rubricVersionId: requireVersionReference(
      input.rubricVersionId,
      "rubric-version:",
    ),
    objectivePlacementId: requireStableReference(
      input.objectivePlacementId,
      "objective_placement_id",
    ),
    practicalPlacementId: requireStableReference(
      input.practicalPlacementId,
      "practical_placement_id",
    ),
    state: state as PracticalAttemptState,
    responses,
    startedAt: requireTimestamp(input.startedAt, "started_at"),
    ...(input.submittedAt === undefined
      ? {}
      : { submittedAt: requireTimestamp(input.submittedAt, "submitted_at") }),
    ...(input.idempotencyKey === undefined
      ? {}
      : {
          idempotencyKey: requireStableReference(
            input.idempotencyKey,
            "idempotency_key",
          ),
        }),
    draftRevision: requireNonnegativeRevision(input.draftRevision ?? 0),
    ...(input.eligibilityDecisionReference === undefined
      ? {}
      : {
          eligibilityDecisionReference: requireStableReference(
            input.eligibilityDecisionReference,
            "eligibility_decision_reference",
          ),
        }),
  });
}

const ATTEMPT_TRANSITIONS: Readonly<
  Record<PracticalAttemptState, readonly PracticalAttemptState[]>
> = {
  IN_PROGRESS: Object.freeze(["SUBMITTED", "EXPIRED", "VOIDED"]),
  SUBMITTED: Object.freeze(["EVALUATED", "VOIDED"]),
  EVALUATED: Object.freeze([]),
  EXPIRED: Object.freeze([]),
  VOIDED: Object.freeze([]),
};

export function transitionPracticalAttempt(
  attempt: PracticalAttempt,
  nextState: unknown,
  occurredAt?: unknown,
): PracticalAttempt {
  if (!PRACTICAL_ATTEMPT_STATES.includes(nextState as PracticalAttemptState)) {
    fail("INVALID_PRACTICAL_ATTEMPT_STATE");
  }
  if (!ATTEMPT_TRANSITIONS[attempt.state].includes(nextState as PracticalAttemptState)) {
    fail("INVALID_PRACTICAL_ATTEMPT_TRANSITION");
  }
  if (nextState === "SUBMITTED" && occurredAt === undefined) {
    fail("SUBMISSION_TIMESTAMP_REQUIRED");
  }
  return Object.freeze({
    ...attempt,
    state: nextState as PracticalAttemptState,
    ...(nextState === "SUBMITTED"
      ? { submittedAt: requireTimestamp(occurredAt, "submitted_at") }
      : {}),
  });
}

function validateEvaluationProvenance(value: unknown): EvaluationProvenance {
  validateCanonicalPracticalJson(
    value,
    PRACTICAL_JSON_LIMITS.maximumProvenanceLength,
  );
  if (!value || typeof value !== "object") fail("INVALID_EVALUATION_PROVENANCE");
  const item = value as Record<string, unknown>;
  if (!EVALUATION_METHODS.includes(item.method as EvaluationMethod)) {
    fail("INVALID_EVALUATION_METHOD");
  }
  let aiModel: EvaluationProvenance["aiModel"];
  if (item.aiModel !== undefined) {
    if (!item.aiModel || typeof item.aiModel !== "object") fail("INVALID_AI_MODEL_PROVENANCE");
    const model = item.aiModel as Record<string, unknown>;
    aiModel = Object.freeze({
      provider: requireStableReference(model.provider, "ai_provider"),
      model: requireStableReference(model.model, "ai_model"),
      ...(model.version === undefined
        ? {}
        : { version: requireStableReference(model.version, "ai_model_version") }),
    });
  }
  if (item.method === "AI_ASSISTED" && !aiModel) {
    fail("AI_MODEL_PROVENANCE_REQUIRED");
  }
  return Object.freeze({
    method: item.method as EvaluationMethod,
    evaluatedAt: requireTimestamp(item.evaluatedAt, "evaluated_at"),
    ...(item.evaluatorReference === undefined
      ? {}
      : {
          evaluatorReference: requireStableReference(
            item.evaluatorReference,
            "evaluator_reference",
          ),
        }),
    ...(aiModel ? { aiModel } : {}),
    ...(item.metadata === undefined
      ? {}
      : {
          metadata: validateCanonicalPracticalJson(
            item.metadata,
            PRACTICAL_JSON_LIMITS.maximumProvenanceLength,
          ),
        }),
  });
}

export function createPracticalEvaluation(input: {
  evaluationId: unknown;
  sequence: unknown;
  attempt: PracticalAttempt;
  practicalVersionId: unknown;
  rubricVersionId: unknown;
  dimensionResults: unknown;
  qualification: unknown;
  provenance: unknown;
  previousEvaluationId?: unknown;
}): PracticalEvaluation {
  if (!Number.isInteger(input.sequence) || (input.sequence as number) < 1) {
    fail("INVALID_EVALUATION_SEQUENCE");
  }
  const practicalVersionId = requireVersionReference(
    input.practicalVersionId,
    "practical-version:",
  );
  const rubricVersionId = requireVersionReference(
    input.rubricVersionId,
    "rubric-version:",
  );
  if (
    practicalVersionId !== input.attempt.practicalVersionId ||
    rubricVersionId !== input.attempt.rubricVersionId
  ) {
    fail("EVALUATION_VERSION_MISMATCH");
  }
  const isFirst = input.sequence === 1 && input.previousEvaluationId === undefined;
  const isRevision =
    (input.sequence as number) > 1 && input.previousEvaluationId !== undefined;
  if (!isFirst && !isRevision) fail("INVALID_EVALUATION_HISTORY_LINK");
  if (isFirst && input.attempt.state !== "SUBMITTED") {
    fail("EVALUATION_BEFORE_SUBMISSION");
  }
  if (isRevision && input.attempt.state !== "EVALUATED") {
    fail("INVALID_EVALUATION_REVISION_STATE");
  }
  validateCanonicalPracticalJson(input.dimensionResults);
  if (!Array.isArray(input.dimensionResults) || input.dimensionResults.length === 0) {
    fail("DIMENSION_RESULTS_REQUIRED");
  }
  const dimensionResults = input.dimensionResults.map(
    validateDimensionEvaluationResult,
  );
  const dimensionKeys = dimensionResults.map((result) => result.dimensionKey);
  if (new Set(dimensionKeys).size !== dimensionKeys.length) {
    fail("DUPLICATE_DIMENSION_RESULT");
  }
  if (!QUALIFICATION_RESULTS.includes(input.qualification as QualificationResult)) {
    fail("INVALID_QUALIFICATION_RESULT");
  }
  const provenance = validateEvaluationProvenance(input.provenance);
  if (
    provenance.method === "AI_ASSISTED" &&
    input.qualification === "QUALIFIED"
  ) {
    fail("AI_ASSISTED_ALONE_CANNOT_QUALIFY");
  }
  return Object.freeze({
    evaluationId: requireStableReference(input.evaluationId, "evaluation_id"),
    sequence: input.sequence as number,
    attemptId: input.attempt.attemptId,
    practicalVersionId,
    rubricVersionId,
    dimensionResults: Object.freeze(dimensionResults),
    qualification: input.qualification as QualificationResult,
    provenance,
    ...(input.previousEvaluationId === undefined
      ? {}
      : {
          previousEvaluationId: requireStableReference(
            input.previousEvaluationId,
            "previous_evaluation_id",
          ),
        }),
  });
}

export function createReevaluation(
  previous: PracticalEvaluation,
  input: Omit<Parameters<typeof createPracticalEvaluation>[0], "sequence" | "previousEvaluationId">,
): PracticalEvaluation {
  const nextId = requireStableReference(input.evaluationId, "evaluation_id");
  if (nextId === previous.evaluationId) fail("REEVALUATION_REQUIRES_NEW_IDENTITY");
  if (input.attempt.attemptId !== previous.attemptId) {
    fail("REEVALUATION_ATTEMPT_MISMATCH");
  }
  return createPracticalEvaluation({
    ...input,
    evaluationId: nextId,
    sequence: previous.sequence + 1,
    previousEvaluationId: previous.evaluationId,
  });
}
