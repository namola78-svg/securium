import { createHash } from "node:crypto";
import {
  EVALUATION_SEMANTIC_DOMAIN_V1,
  EVALUATION_SEMANTIC_HASH_V1,
  PRACTICAL_EVALUATION_MODEL_V1,
  validateEvaluationModelV1,
  type PersistedEvaluationSemanticPayloadV1,
  type PracticalEvaluationModelV1,
} from "./practical-evaluation-definition.ts";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function projection(model: PracticalEvaluationModelV1): PersistedEvaluationSemanticPayloadV1 {
  const valid = validateEvaluationModelV1(model);
  return {
    modelVersion: PRACTICAL_EVALUATION_MODEL_V1,
    hashContractVersion: EVALUATION_SEMANTIC_HASH_V1,
    evaluationMethod: valid.evaluationMethod,
    criteria: [...valid.criteria].sort((a, b) => a.key.localeCompare(b.key)),
    scoringScale: valid.scoringScale,
    aggregation: valid.aggregation,
    passFailRules: [...valid.passFailRules].sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b))),
    requiredOutputs: [],
    reviewerRules: [],
  };
}

export function canonicalPersistedEvaluationPayloadV1(model: PracticalEvaluationModelV1): string {
  return canonicalJson(projection(model));
}

export function evaluationSemanticHashV1(model: PracticalEvaluationModelV1): string {
  return createHash("sha256").update(`${EVALUATION_SEMANTIC_DOMAIN_V1}\n${canonicalPersistedEvaluationPayloadV1(model)}`, "utf8").digest("hex");
}

export function snapshotDigestV1(model: PracticalEvaluationModelV1): string {
  return createHash("sha256").update(canonicalPersistedEvaluationPayloadV1(model), "utf8").digest("hex");
}

export function parsePersistedEvaluationPayloadV1(snapshotJson: string, expectedSnapshotDigest?: string): PracticalEvaluationModelV1 {
  if (typeof snapshotJson !== "string" || snapshotJson.trim() === "") throw new TypeError("MISSING_SNAPSHOT_JSON");
  let parsed: unknown;
  try { parsed = JSON.parse(snapshotJson); } catch { throw new TypeError("INVALID_SNAPSHOT_JSON"); }
  const model = validateEvaluationModelV1(parsed);
  const canonical = canonicalPersistedEvaluationPayloadV1(model);
  if (snapshotJson !== canonical) throw new TypeError("NONCANONICAL_SNAPSHOT_JSON");
  if (expectedSnapshotDigest !== undefined && snapshotDigestV1(model) !== expectedSnapshotDigest) throw new TypeError("SNAPSHOT_DIGEST_MISMATCH");
  return model;
}

export const EVALUATION_SEMANTIC_HASH_DOMAIN_V1 = EVALUATION_SEMANTIC_DOMAIN_V1;
