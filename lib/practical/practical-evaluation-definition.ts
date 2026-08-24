export const PRACTICAL_EVALUATION_MODEL_V1 = "PRACTICAL_EVALUATION_MODEL_V1" as const;
export const EVALUATION_SEMANTIC_HASH_V1 = "EVALUATION_SEMANTIC_HASH_V1" as const;
export const EVALUATION_SEMANTIC_DOMAIN_V1 = "SECURIUM:EVALUATION_SEMANTICS:V1" as const;
import { PRACTICAL_JSON_LIMITS } from "./practical-attempt.ts";

/** Resource envelope only; this does not define semantic decimal precision. */
export const PRACTICAL_EVALUATION_DECIMAL_TOKEN_MAX_LENGTH = PRACTICAL_JSON_LIMITS.maximumStringLength;

export type CanonicalDecimalV1 = string & { readonly __canonicalDecimalV1: unique symbol };
export type EvaluationMethodV1 = "RULE_BASED" | "STRUCTURED_HUMAN_REVIEW" | "HYBRID";
export type AggregationV1 = "EQUAL_WEIGHT" | "WEIGHTED";

export type ScoringScaleV1 = Readonly<{
  minimum: CanonicalDecimalV1;
  maximum: CanonicalDecimalV1;
  passing?: CanonicalDecimalV1;
}>;

export type CriterionSemanticDefinitionV1 = Readonly<{
  key: string;
  statement: string;
  score: ScoringScaleV1;
  weight?: CanonicalDecimalV1;
}>;

export type RequiredEvaluatorOutputV1 = Readonly<{ key: string; kind: string }>;
export type ReviewerScoringRuleV1 = Readonly<{ key: string; kind: string; value?: string }>;

export type PersistedEvaluationSemanticPayloadV1 = Readonly<{
  modelVersion: typeof PRACTICAL_EVALUATION_MODEL_V1;
  hashContractVersion: typeof EVALUATION_SEMANTIC_HASH_V1;
  evaluationMethod: EvaluationMethodV1;
  criteria: readonly CriterionSemanticDefinitionV1[];
  scoringScale: ScoringScaleV1;
  aggregation: AggregationV1;
  passFailRules: readonly Readonly<Record<string, unknown>>[];
  requiredOutputs: readonly RequiredEvaluatorOutputV1[];
  reviewerRules: readonly ReviewerScoringRuleV1[];
}>;

export type PracticalEvaluationModelV1 = PersistedEvaluationSemanticPayloadV1;

const DIGEST = /^[a-f0-9]{64}$/;
const METHODS: readonly EvaluationMethodV1[] = ["RULE_BASED", "STRUCTURED_HUMAN_REVIEW", "HYBRID"];

function fail(code: string): never { throw new TypeError(code); }
function decimalParts(value: string): { sign: -1 | 1; digits: string; scale: number } {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  return { sign: negative ? -1 : 1, digits: `${whole}${fraction}`.replace(/^0+(?=\d)/, ""), scale: fraction.length };
}
function aligned(part: { digits: string; scale: number }, scale: number): string { return part.digits + "0".repeat(scale - part.scale); }
function addUnsigned(left: string, right: string): string {
  let carry = 0; let result = ""; let i = left.length - 1; let j = right.length - 1;
  while (i >= 0 || j >= 0 || carry) { const sum = (i >= 0 ? left.charCodeAt(i--) - 48 : 0) + (j >= 0 ? right.charCodeAt(j--) - 48 : 0) + carry; result = `${sum % 10}${result}`; carry = Math.floor(sum / 10); }
  return result.replace(/^0+(?=\d)/, "");
}
function subtractUnsigned(left: string, right: string): string {
  let borrow = 0; let result = "";
  for (let i = left.length - 1, j = right.length - 1; i >= 0; i--, j--) { let difference = left.charCodeAt(i) - 48 - (j >= 0 ? right.charCodeAt(j) - 48 : 0) - borrow; if (difference < 0) { difference += 10; borrow = 1; } else borrow = 0; result = `${difference}${result}`; }
  return result.replace(/^0+(?=\d)/, "");
}

export function canonicalDecimalV1(value: unknown): CanonicalDecimalV1 {
  if (typeof value !== "string") fail("INVALID_CANONICAL_DECIMAL");
  if (value.length > PRACTICAL_EVALUATION_DECIMAL_TOKEN_MAX_LENGTH) fail("CANONICAL_DECIMAL_RESOURCE_LIMIT");
  if (value === "" || /[eE,+,]/.test(value) || !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) fail("INVALID_CANONICAL_DECIMAL");
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");
  const normalized = `${whole}${trimmedFraction ? `.${trimmedFraction}` : ""}`;
  return (normalized === "0" ? "0" : negative ? `-${normalized}` : normalized) as CanonicalDecimalV1;
}

export function compareCanonicalDecimalV1(left: CanonicalDecimalV1, right: CanonicalDecimalV1): -1 | 0 | 1 {
  const a = decimalParts(left); const b = decimalParts(right); const scale = Math.max(a.scale, b.scale);
  if (a.sign !== b.sign) return a.sign < b.sign ? -1 : 1;
  const av = aligned(a, scale).replace(/^0+(?=\d)/, ""); const bv = aligned(b, scale).replace(/^0+(?=\d)/, "");
  const magnitude = av.length !== bv.length ? (av.length < bv.length ? -1 : 1) : (av < bv ? -1 : av > bv ? 1 : 0);
  return a.sign === 1 ? magnitude : (magnitude === 0 ? 0 : magnitude === 1 ? -1 : 1);
}

export function addCanonicalDecimalsV1(values: readonly CanonicalDecimalV1[]): CanonicalDecimalV1 {
  let sign: -1 | 0 | 1 = 0; let digits = "0"; let scale = 0;
  for (const value of values) { const part = decimalParts(value); const nextScale = Math.max(scale, part.scale); const current = aligned({ digits, scale }, nextScale); const incoming = aligned(part, nextScale); if (sign === 0) { sign = part.sign; digits = incoming; } else if (sign === part.sign) digits = addUnsigned(current, incoming); else { const magnitude = current.length !== incoming.length ? (current.length > incoming.length ? 1 : -1) : (current >= incoming ? 1 : -1); if (magnitude === 1) digits = subtractUnsigned(current, incoming); else { digits = subtractUnsigned(incoming, current); sign = part.sign; } } scale = nextScale; }
  const padded = digits.padStart(scale + 1, "0"); const places = scale; const text = places ? `${padded.slice(0, -places) || "0"}.${padded.slice(-places)}` : padded;
  return canonicalDecimalV1(`${sign === -1 ? "-" : ""}${text}`);
}

export function validateEvaluationModelV1(input: unknown): PracticalEvaluationModelV1 {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("INVALID_EVALUATION_MODEL");
  const value = input as Record<string, unknown>;
  if (value.modelVersion !== PRACTICAL_EVALUATION_MODEL_V1) fail("INVALID_EVALUATION_MODEL_VERSION");
  if (value.hashContractVersion !== EVALUATION_SEMANTIC_HASH_V1) fail("INVALID_HASH_CONTRACT_VERSION");
  if (!METHODS.includes(value.evaluationMethod as EvaluationMethodV1)) fail("INVALID_EVALUATION_METHOD");
  if (!Array.isArray(value.criteria) || value.criteria.length === 0) fail("CRITERIA_REQUIRED");
  const criteria = value.criteria.map((candidate) => {
    if (!candidate || typeof candidate !== "object") fail("INVALID_CRITERION");
    const item = candidate as Record<string, unknown>;
    if (typeof item.key !== "string" || item.key.trim() === "") fail("INVALID_CRITERION_KEY");
    if (typeof item.statement !== "string" || item.statement.trim() === "") fail("MISSING_CRITERION_STATEMENT");
    const rawScore = item.score;
    if (!rawScore || typeof rawScore !== "object") fail("INVALID_SCORE_RANGE");
    const score = rawScore as Record<string, unknown>;
    const normalized: ScoringScaleV1 = { minimum: canonicalDecimalV1(score.minimum), maximum: canonicalDecimalV1(score.maximum), ...(score.passing === undefined ? {} : { passing: canonicalDecimalV1(score.passing) }) };
    if (compareCanonicalDecimalV1(normalized.minimum, normalized.maximum) > 0) fail("INVALID_SCORE_RANGE");
    if (normalized.passing !== undefined && (compareCanonicalDecimalV1(normalized.minimum, normalized.passing) > 0 || compareCanonicalDecimalV1(normalized.passing, normalized.maximum) > 0)) fail("INVALID_PASSING_THRESHOLD");
    const result: CriterionSemanticDefinitionV1 = { key: item.key, statement: item.statement, score: normalized, ...(item.weight === undefined ? {} : { weight: canonicalDecimalV1(item.weight) }) };
    return result;
  });
  if (new Set(criteria.map((criterion) => criterion.key)).size !== criteria.length) fail("DUPLICATE_CRITERION_KEY");
  if (value.aggregation !== "EQUAL_WEIGHT" && value.aggregation !== "WEIGHTED") fail("MISSING_AGGREGATION");
  const scoring = value.scoringScale;
  if (!scoring || typeof scoring !== "object") fail("INVALID_SCORING_SCALE");
  const scale = scoring as Record<string, unknown>;
  const scoringScale: ScoringScaleV1 = { minimum: canonicalDecimalV1(scale.minimum), maximum: canonicalDecimalV1(scale.maximum), ...(scale.passing === undefined ? {} : { passing: canonicalDecimalV1(scale.passing) }) };
  if (compareCanonicalDecimalV1(scoringScale.minimum, scoringScale.maximum) > 0) fail("INVALID_SCORE_RANGE");
  if (scoringScale.passing !== undefined && (compareCanonicalDecimalV1(scoringScale.minimum, scoringScale.passing) > 0 || compareCanonicalDecimalV1(scoringScale.passing, scoringScale.maximum) > 0)) fail("INVALID_PASSING_THRESHOLD");
  if (!Array.isArray(value.passFailRules)) fail("MISSING_PASS_FAIL_RULES");
  if (!Array.isArray(value.requiredOutputs)) fail("MISSING_REQUIRED_OUTPUTS");
  if (!Array.isArray(value.reviewerRules)) fail("MISSING_REVIEWER_RULES");
  if (value.requiredOutputs.length || value.reviewerRules.length) fail("UNKNOWN_GOVERNED_OUTPUT_OR_REVIEWER_RULE");
  if (value.aggregation === "WEIGHTED") {
    if (criteria.some((criterion) => criterion.weight === undefined)) fail("WEIGHT_REQUIRED");
    if (criteria.some((criterion) => compareCanonicalDecimalV1(criterion.weight!, canonicalDecimalV1("0")) <= 0 || compareCanonicalDecimalV1(criterion.weight!, canonicalDecimalV1("1")) > 0)) fail("INVALID_WEIGHT");
    if (addCanonicalDecimalsV1(criteria.map((criterion) => criterion.weight!)) !== "1") fail("WEIGHT_SUM_MUST_EQUAL_ONE");
  } else if (criteria.some((criterion) => criterion.weight !== undefined)) fail("WEIGHTS_REQUIRE_WEIGHTED_AGGREGATION");
  return Object.freeze({ modelVersion: PRACTICAL_EVALUATION_MODEL_V1, hashContractVersion: EVALUATION_SEMANTIC_HASH_V1, evaluationMethod: value.evaluationMethod as EvaluationMethodV1, criteria: Object.freeze(criteria), scoringScale, aggregation: value.aggregation, passFailRules: Object.freeze(value.passFailRules as readonly Readonly<Record<string, unknown>>[]), requiredOutputs: Object.freeze([]), reviewerRules: Object.freeze([]) });
}

export function isDigestV1(value: unknown): value is string { return typeof value === "string" && DIGEST.test(value); }
