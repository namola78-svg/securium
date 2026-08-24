import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalDecimalV1, PRACTICAL_EVALUATION_DECIMAL_TOKEN_MAX_LENGTH, validateEvaluationModelV1 } from "../lib/practical/practical-evaluation-definition.ts";
import { canonicalPersistedEvaluationPayloadV1, evaluationSemanticHashV1, EVALUATION_SEMANTIC_HASH_DOMAIN_V1, snapshotDigestV1 } from "../lib/practical/practical-evaluation-semantic-hash.ts";

const model = {
  modelVersion: "PRACTICAL_EVALUATION_MODEL_V1",
  hashContractVersion: "EVALUATION_SEMANTIC_HASH_V1",
  evaluationMethod: "HYBRID",
  criteria: [{ key: "criterion:one", statement: "Assess the governed behavior.", score: { minimum: "0.00", passing: "0.50", maximum: "1.00" } }],
  scoringScale: { minimum: "0", passing: "0.5", maximum: "1" },
  aggregation: "EQUAL_WEIGHT",
  passFailRules: [{ key: "pass", threshold: "0.5" }],
  requiredOutputs: [],
  reviewerRules: [],
} as const;

test("canonical decimals are exact and reject ambiguous syntax", () => {
  assert.equal(canonicalDecimalV1("1.00"), "1");
  assert.equal(canonicalDecimalV1("0.50"), "0.5");
  assert.equal(canonicalDecimalV1("-0"), "0");
  for (const value of ["NaN", "Infinity", "-Infinity", "1e2", "1,0", "+1", "01"]) assert.throws(() => canonicalDecimalV1(value), /INVALID_CANONICAL_DECIMAL/);
});

test("decimal resource envelope is pre-parse, bounded, and non-semantic", () => {
  const boundary = `1${"0".repeat(PRACTICAL_EVALUATION_DECIMAL_TOKEN_MAX_LENGTH - 1)}`;
  assert.equal(canonicalDecimalV1(boundary), boundary);
  assert.throws(() => canonicalDecimalV1(`${boundary}0`), /CANONICAL_DECIMAL_RESOURCE_LIMIT/);
  assert.equal(canonicalDecimalV1(`0.${"1".repeat(PRACTICAL_EVALUATION_DECIMAL_TOKEN_MAX_LENGTH - 2)}`), `0.${"1".repeat(PRACTICAL_EVALUATION_DECIMAL_TOKEN_MAX_LENGTH - 2)}`);
  assert.throws(() => canonicalDecimalV1(`${"9".repeat(PRACTICAL_EVALUATION_DECIMAL_TOKEN_MAX_LENGTH + 1)}e0`), /CANONICAL_DECIMAL_RESOURCE_LIMIT/);
  for (const value of ["NaN", "Infinity", "-Infinity"]) assert.throws(() => canonicalDecimalV1(value), /INVALID_CANONICAL_DECIMAL/);
});

test("hash projection is deterministic, ordered, and explicitly carries empty governed sets", () => {
  const canonical = canonicalPersistedEvaluationPayloadV1(validateEvaluationModelV1(model));
  assert.match(canonical, /"requiredOutputs":\[\]/);
  assert.match(canonical, /"reviewerRules":\[\]/);
  assert.equal(evaluationSemanticHashV1(validateEvaluationModelV1(model)), evaluationSemanticHashV1(validateEvaluationModelV1({ ...model, criteria: [...model.criteria].reverse() })));
  assert.equal(snapshotDigestV1(validateEvaluationModelV1(model)), snapshotDigestV1(validateEvaluationModelV1({ ...model, criteria: [...model.criteria].reverse() })));
  assert.equal(EVALUATION_SEMANTIC_HASH_DOMAIN_V1, "SECURIUM:EVALUATION_SEMANTICS:V1");
});

test("semantic changes affect only semantic identity; excluded metadata does not", () => {
  const base = validateEvaluationModelV1(model);
  const changed = validateEvaluationModelV1({ ...model, criteria: [{ ...model.criteria[0], statement: "A changed governed statement." }] });
  assert.notEqual(evaluationSemanticHashV1(base), evaluationSemanticHashV1(changed));
  const excluded = validateEvaluationModelV1({ ...model, reviewer: "person", decision: "PASS", evidenceClassification: "SUPPORTING_ACTIVITY_ONLY", provenanceBinding: "source", conceptMapping: "concept", theoryBinding: "theory" });
  assert.equal(evaluationSemanticHashV1(base), evaluationSemanticHashV1(excluded));
});

test("weighted aggregation requires exact canonical sum and explicit weights", () => {
  const weighted = validateEvaluationModelV1({ ...model, aggregation: "WEIGHTED", criteria: [
    { ...model.criteria[0], weight: "0.25" },
    { key: "criterion:two", statement: "Assess another governed behavior.", score: model.criteria[0].score, weight: "0.75" },
  ] });
  assert.equal(weighted.aggregation, "WEIGHTED");
  assert.throws(() => validateEvaluationModelV1({ ...model, aggregation: "WEIGHTED", criteria: [{ ...model.criteria[0], weight: "0.3" }] }), /WEIGHT_SUM_MUST_EQUAL_ONE/);
});
