import {
  DEFINITION_LIFECYCLES,
  requireStableReference,
  requireStableSemanticSegment,
  type DefinitionLifecycle,
} from "../assessment/assessment-objective.ts";

export const RUBRIC_EVALUATION_MODES = [
  "DETERMINISTIC",
  "RUBRIC",
  "HYBRID",
] as const;
export type RubricEvaluationMode = (typeof RUBRIC_EVALUATION_MODES)[number];

export const DIMENSION_OUTCOMES = [
  "PASS",
  "PARTIAL",
  "FAIL",
  "NOT_EVALUATED",
] as const;
export type DimensionOutcome = (typeof DIMENSION_OUTCOMES)[number];

export const QUALIFICATION_RESULTS = [
  "QUALIFIED",
  "NOT_QUALIFIED",
  "PENDING_REVIEW",
] as const;
export type QualificationResult = (typeof QUALIFICATION_RESULTS)[number];

export const DETERMINISTIC_CHECK_KINDS = [
  "EXACT_OPTION",
  "CLASSIFICATION",
  "CRITERION_SELECTION",
  "UNIT_TEST",
  "STATIC_ANALYZER",
] as const;
export type DeterministicCheckKind =
  (typeof DETERMINISTIC_CHECK_KINDS)[number];

export type BoundedScore = Readonly<{
  minimum: number;
  maximum: number;
  passing?: number;
}>;

export type RubricDimension = Readonly<{
  key: string;
  evaluationMode: RubricEvaluationMode;
  required: boolean;
  supportsDeterministic: boolean;
  supportsQualitative: boolean;
  score?: BoundedScore;
  contributesToEvidence: boolean;
}>;

export type Rubric = Readonly<{
  id: string;
  namespace: string;
  purposeKey: string;
  lifecycle: DefinitionLifecycle;
}>;

export type RubricVersion = Readonly<{
  id: string;
  rubricId: string;
  version: number;
  dimensions: readonly RubricDimension[];
  digest: string;
}>;

export type DeterministicCheckResult = Readonly<{
  checkKey: string;
  kind: DeterministicCheckKind;
  outcome: "PASS" | "FAIL" | "NOT_RUN";
  observedValue?: string;
}>;

export type DimensionEvaluationResult = Readonly<{
  dimensionKey: string;
  outcome: DimensionOutcome;
  points?: number;
  maximumPoints?: number;
  deterministicChecks: readonly DeterministicCheckResult[];
  rationale?: string;
}>;

const RUBRIC_ID = /^rubric:([a-z0-9][a-z0-9._-]*):([a-z0-9][a-z0-9._-]*)$/;
const DIMENSION_KEY = /^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$/;
const SHA256 = /^[a-f0-9]{64}$/;

function fail(code: string): never {
  throw new TypeError(code);
}

function requirePositiveVersion(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    return fail("INVALID_RUBRIC_VERSION");
  }
  return value as number;
}

export function buildRubricId(namespace: unknown, purposeKey: unknown): string {
  return `rubric:${requireStableSemanticSegment(namespace, "rubric_namespace")}:${requireStableSemanticSegment(purposeKey, "rubric_purpose")}`;
}

export function createRubric(input: {
  namespace: unknown;
  purposeKey: unknown;
  lifecycle: unknown;
}): Rubric {
  if (!DEFINITION_LIFECYCLES.includes(input.lifecycle as DefinitionLifecycle)) {
    fail("INVALID_DEFINITION_LIFECYCLE");
  }
  const id = buildRubricId(input.namespace, input.purposeKey);
  const [, namespace, purposeKey] = RUBRIC_ID.exec(id) ?? [];
  return Object.freeze({
    id,
    namespace,
    purposeKey,
    lifecycle: input.lifecycle as DefinitionLifecycle,
  });
}

export function validateRubricDimension(value: unknown): RubricDimension {
  if (!value || typeof value !== "object") fail("INVALID_RUBRIC_DIMENSION");
  const item = value as Record<string, unknown>;
  if (typeof item.key !== "string" || !DIMENSION_KEY.test(item.key)) {
    fail("INVALID_RUBRIC_DIMENSION_KEY");
  }
  if (!RUBRIC_EVALUATION_MODES.includes(item.evaluationMode as RubricEvaluationMode)) {
    fail("INVALID_RUBRIC_EVALUATION_MODE");
  }
  if (
    typeof item.required !== "boolean" ||
    typeof item.supportsDeterministic !== "boolean" ||
    typeof item.supportsQualitative !== "boolean" ||
    typeof item.contributesToEvidence !== "boolean"
  ) {
    fail("INVALID_RUBRIC_DIMENSION_FLAGS");
  }
  if (!item.supportsDeterministic && !item.supportsQualitative) {
    fail("RUBRIC_DIMENSION_HAS_NO_EVALUATOR");
  }
  let score: BoundedScore | undefined;
  if (item.score !== undefined) {
    if (!item.score || typeof item.score !== "object") fail("INVALID_BOUNDED_SCORE");
    const candidate = item.score as Record<string, unknown>;
    if (
      typeof candidate.minimum !== "number" ||
      typeof candidate.maximum !== "number" ||
      !Number.isFinite(candidate.minimum) ||
      !Number.isFinite(candidate.maximum) ||
      candidate.minimum > candidate.maximum ||
      (candidate.passing !== undefined &&
        (typeof candidate.passing !== "number" ||
          !Number.isFinite(candidate.passing) ||
          candidate.passing < candidate.minimum ||
          candidate.passing > candidate.maximum))
    ) {
      fail("INVALID_BOUNDED_SCORE");
    }
    score = Object.freeze({
      minimum: candidate.minimum,
      maximum: candidate.maximum,
      ...(candidate.passing === undefined ? {} : { passing: candidate.passing }),
    });
  }
  return Object.freeze({
    key: item.key,
    evaluationMode: item.evaluationMode as RubricEvaluationMode,
    required: item.required,
    supportsDeterministic: item.supportsDeterministic,
    supportsQualitative: item.supportsQualitative,
    ...(score ? { score } : {}),
    contributesToEvidence: item.contributesToEvidence,
  });
}

export function createRubricVersion(input: {
  rubricId: unknown;
  version: unknown;
  dimensions: unknown;
  digest: unknown;
}): RubricVersion {
  if (typeof input.rubricId !== "string" || !RUBRIC_ID.test(input.rubricId)) {
    fail("INVALID_RUBRIC_ID");
  }
  const version = requirePositiveVersion(input.version);
  if (!Array.isArray(input.dimensions) || input.dimensions.length === 0) {
    fail("RUBRIC_DIMENSIONS_REQUIRED");
  }
  const dimensions = input.dimensions.map(validateRubricDimension);
  const keys = dimensions.map((dimension) => dimension.key);
  if (new Set(keys).size !== keys.length) fail("DUPLICATE_RUBRIC_DIMENSION");
  if (typeof input.digest !== "string" || !SHA256.test(input.digest)) {
    fail("INVALID_RUBRIC_DIGEST");
  }
  return Object.freeze({
    id: `rubric-version:${input.rubricId}:v${version}`,
    rubricId: input.rubricId,
    version,
    dimensions: Object.freeze([...dimensions]),
    digest: input.digest,
  });
}

export function validateDimensionEvaluationResult(
  value: unknown,
): DimensionEvaluationResult {
  if (!value || typeof value !== "object") fail("INVALID_DIMENSION_RESULT");
  const item = value as Record<string, unknown>;
  if (typeof item.dimensionKey !== "string" || !DIMENSION_KEY.test(item.dimensionKey)) {
    fail("INVALID_DIMENSION_RESULT_KEY");
  }
  if (!DIMENSION_OUTCOMES.includes(item.outcome as DimensionOutcome)) {
    fail("INVALID_DIMENSION_OUTCOME");
  }
  if ((item.points === undefined) !== (item.maximumPoints === undefined)) {
    fail("INCOMPLETE_DIMENSION_POINTS");
  }
  if (
    item.points !== undefined &&
    (typeof item.points !== "number" ||
      typeof item.maximumPoints !== "number" ||
      !Number.isFinite(item.points) ||
      !Number.isFinite(item.maximumPoints) ||
      item.points < 0 ||
      item.maximumPoints <= 0 ||
      item.points > item.maximumPoints)
  ) {
    fail("INVALID_DIMENSION_POINTS");
  }
  if (!Array.isArray(item.deterministicChecks)) fail("INVALID_DETERMINISTIC_CHECKS");
  const checks = item.deterministicChecks.map((check) => {
    if (!check || typeof check !== "object") fail("INVALID_DETERMINISTIC_CHECK");
    const candidate = check as Record<string, unknown>;
    const checkKey = requireStableReference(candidate.checkKey, "check_key");
    if (!DETERMINISTIC_CHECK_KINDS.includes(candidate.kind as DeterministicCheckKind)) {
      fail("INVALID_DETERMINISTIC_CHECK_KIND");
    }
    if (
      typeof candidate.outcome !== "string" ||
      !["PASS", "FAIL", "NOT_RUN"].includes(candidate.outcome)
    ) {
      fail("INVALID_DETERMINISTIC_CHECK_OUTCOME");
    }
    return Object.freeze({
      checkKey,
      kind: candidate.kind as DeterministicCheckKind,
      outcome: candidate.outcome as "PASS" | "FAIL" | "NOT_RUN",
      ...(typeof candidate.observedValue === "string"
        ? { observedValue: candidate.observedValue }
        : {}),
    });
  });
  return Object.freeze({
    dimensionKey: item.dimensionKey,
    outcome: item.outcome as DimensionOutcome,
    ...(item.points === undefined ? {} : { points: item.points as number }),
    ...(item.maximumPoints === undefined
      ? {}
      : { maximumPoints: item.maximumPoints as number }),
    deterministicChecks: Object.freeze(checks),
    ...(typeof item.rationale === "string" ? { rationale: item.rationale } : {}),
  });
}
