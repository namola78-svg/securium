import { createHash } from "node:crypto";
import { requireStableReference, requireStableSemanticSegment } from "../assessment/assessment-objective.ts";
import { validateEvaluationModelV1, type PracticalEvaluationModelV1 } from "./practical-evaluation-definition.ts";
import { evaluationSemanticHashV1, snapshotDigestV1, canonicalPersistedEvaluationPayloadV1, parsePersistedEvaluationPayloadV1 } from "./practical-evaluation-semantic-hash.ts";

export const PRACTICAL_GOVERNANCE_LIFECYCLES = [
  "DRAFT",
  "HUMAN_APPROVED",
  "CANONICAL_UNPUBLISHED",
  "SUPERSEDED",
] as const;
export type PracticalGovernanceLifecycle = (typeof PRACTICAL_GOVERNANCE_LIFECYCLES)[number];

export const PRACTICAL_EVIDENCE_CLASSIFICATIONS = [
  "ELIGIBLE_PERFORMANCE_EVIDENCE",
  "ELIGIBLE_AFTER_HUMAN_EVALUATION",
  "SUPPORTING_ACTIVITY_ONLY",
] as const;
export type PracticalEvidenceClassification = (typeof PRACTICAL_EVIDENCE_CLASSIFICATIONS)[number];

export const PRACTICAL_EVALUATION_METHODS = [
  "RULE_BASED",
  "STRUCTURED_HUMAN_REVIEW",
  "HYBRID",
] as const;
export type PracticalEvaluationMethod = (typeof PRACTICAL_EVALUATION_METHODS)[number];

const DIGEST = /^[a-f0-9]{64}$/;

export type PracticalConceptBindingInput = Readonly<{
  id: string;
  conceptKey: string;
  conceptId?: string | null;
  mappingSemanticHash: string;
  qualificationJson: string;
  mappingStatus?: "PENDING" | "APPROVED" | "SUPERSEDED" | "LEGACY_UNVERIFIED";
}>;

export type PracticalGovernanceInput = Readonly<{
  practicalId: string;
  semanticKey: string;
  practicalVersionId: string;
  version: number;
  semanticHash: string;
  humanReviewHash: string;
  safetyReviewHash: string;
  rightsBinding: string;
  provenanceBinding: string;
  conceptMappingHash: string;
  theoryDependencyJson: string;
  currentnessReference: string;
  lifecycle: PracticalGovernanceLifecycle;
  createdBy: string;
  rubricVersionId: string;
  rubricId: string;
  rubricVersion: number;
  evaluationSemanticHash: string;
  evaluationMethod: PracticalEvaluationMethod;
  evidenceClassification: PracticalEvidenceClassification;
  rubricSnapshotJson: string;
  rubricSnapshotDigest: string;
  reviewerMaterialId: string;
  reviewerMaterialJson: string;
  reviewerMaterialDigest: string;
  conceptBindings: readonly PracticalConceptBindingInput[];
  supersededById?: string | null;
  /** V1 semantic input. When present, all persisted semantic identities are server-recomputed. */
  evaluationModel?: unknown;
  evaluation?: unknown;
}>;

export type PracticalGovernanceOutcome = "NEW_SUCCESS" | "EXACT_REPLAY" | "NEW_VERSION_REQUIRED";

export type PracticalGovernanceLifecycleTransition = Readonly<{
  from: PracticalGovernanceLifecycle;
  to: PracticalGovernanceLifecycle;
}>;

function fail(code: string): never {
  throw new TypeError(code);
}

function requireDigest(value: unknown, field: string): string {
  if (typeof value !== "string" || !DIGEST.test(value)) fail(`INVALID_${field.toUpperCase()}`);
  return value;
}

export function stableGovernanceJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableGovernanceJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableGovernanceJson(record[key])}`).join(",")}}`;
}

export function hashPracticalGovernanceSemantics(value: unknown): string {
  return createHash("sha256").update(stableGovernanceJson(value)).digest("hex");
}

export function validatePracticalGovernanceInput(input: PracticalGovernanceInput): PracticalGovernanceInput {
  requireStableReference(input.practicalId, "practical_id");
  requireStableSemanticSegment(input.semanticKey, "semantic_key");
  requireStableReference(input.practicalVersionId, "practical_version_id");
  requireStableReference(input.createdBy, "created_by");
  if (!Number.isInteger(input.version) || input.version < 1) fail("INVALID_PRACTICAL_GOVERNANCE_VERSION");
  for (const [field, value] of Object.entries({
    semanticHash: input.semanticHash,
    humanReviewHash: input.humanReviewHash,
    safetyReviewHash: input.safetyReviewHash,
    conceptMappingHash: input.conceptMappingHash,
    evaluationSemanticHash: input.evaluationSemanticHash,
    rubricSnapshotDigest: input.rubricSnapshotDigest,
    reviewerMaterialDigest: input.reviewerMaterialDigest,
  })) requireDigest(value, field);
  if (!PRACTICAL_GOVERNANCE_LIFECYCLES.includes(input.lifecycle)) fail("INVALID_PRACTICAL_GOVERNANCE_LIFECYCLE");
  if (!PRACTICAL_EVALUATION_METHODS.includes(input.evaluationMethod)) fail("INVALID_PRACTICAL_EVALUATION_METHOD");
  if (!PRACTICAL_EVIDENCE_CLASSIFICATIONS.includes(input.evidenceClassification)) fail("INVALID_PRACTICAL_EVIDENCE_CLASSIFICATION");
  if (input.humanReviewHash === "0".repeat(64)) fail("HUMAN_REVIEW_BINDING_REQUIRED");
  if (input.safetyReviewHash === "0".repeat(64)) fail("SAFETY_REVIEW_BINDING_REQUIRED");
  if (input.rightsBinding.trim() === "" || input.provenanceBinding.trim() === "") fail("GOVERNANCE_BINDING_REQUIRED");
  if (input.theoryDependencyJson.trim() === "") fail("THEORY_DEPENDENCY_REQUIRED");
  if (!Array.isArray(input.conceptBindings) || input.conceptBindings.length === 0) fail("CONCEPT_MAPPING_REQUIRED");
  const keys = new Set<string>();
  for (const binding of input.conceptBindings) {
    requireStableReference(binding.id, "concept_binding_id");
    requireStableReference(binding.conceptKey, "concept_key");
    requireDigest(binding.mappingSemanticHash, "mapping_semantic_hash");
    if (binding.conceptId !== undefined && binding.conceptId !== null) requireStableReference(binding.conceptId, "concept_id");
    if (keys.has(binding.conceptKey)) fail("DUPLICATE_CONCEPT_MAPPING");
    keys.add(binding.conceptKey);
  }
  return input;
}

export type ValidatedEvaluationV1 = Readonly<{
  model: PracticalEvaluationModelV1;
  canonicalPayload: string;
  evaluationSemanticHash: string;
  snapshotDigest: string;
}>;

export function validateGovernedEvaluationV1(value: unknown, callerHash?: unknown): ValidatedEvaluationV1 {
  const model = validateEvaluationModelV1(value);
  const canonicalPayload = canonicalPersistedEvaluationPayloadV1(model);
  const evaluationSemanticHash = evaluationSemanticHashV1(model);
  const snapshotDigest = snapshotDigestV1(model);
  if (callerHash !== undefined && callerHash !== evaluationSemanticHash) fail("EVALUATION_SEMANTIC_HASH_MISMATCH");
  return Object.freeze({ model, canonicalPayload, evaluationSemanticHash, snapshotDigest });
}

export function replayGovernedEvaluationV1(snapshotJson: unknown, storedSnapshotDigest: unknown, storedEvaluationSemanticHash: unknown): PracticalEvaluationModelV1 {
  if (typeof storedSnapshotDigest !== "string" || typeof storedEvaluationSemanticHash !== "string") fail("MISSING_EVALUATION_IDENTITY");
  const model = parsePersistedEvaluationPayloadV1(String(snapshotJson), storedSnapshotDigest);
  if (evaluationSemanticHashV1(model) !== storedEvaluationSemanticHash) fail("EVALUATION_SEMANTIC_HASH_MISMATCH");
  return model;
}

export function comparePracticalGovernanceReplay(
  existing: Pick<PracticalGovernanceInput, "semanticHash" | "humanReviewHash" | "safetyReviewHash" | "conceptMappingHash" | "evaluationSemanticHash">,
  incoming: Pick<PracticalGovernanceInput, "semanticHash" | "humanReviewHash" | "safetyReviewHash" | "conceptMappingHash" | "evaluationSemanticHash">,
): "EXACT_REPLAY" | "CONFLICT" {
  return existing.semanticHash === incoming.semanticHash &&
    existing.humanReviewHash === incoming.humanReviewHash &&
    existing.safetyReviewHash === incoming.safetyReviewHash &&
    existing.conceptMappingHash === incoming.conceptMappingHash &&
    existing.evaluationSemanticHash === incoming.evaluationSemanticHash
    ? "EXACT_REPLAY"
    : "CONFLICT";
}

export function validateLifecycleTransition(transition: PracticalGovernanceLifecycleTransition): void {
  const allowed: Record<PracticalGovernanceLifecycle, readonly PracticalGovernanceLifecycle[]> = {
    DRAFT: ["DRAFT", "HUMAN_APPROVED"],
    HUMAN_APPROVED: ["HUMAN_APPROVED", "CANONICAL_UNPUBLISHED"],
    CANONICAL_UNPUBLISHED: ["CANONICAL_UNPUBLISHED", "SUPERSEDED"],
    SUPERSEDED: ["SUPERSEDED"],
  };
  if (!PRACTICAL_GOVERNANCE_LIFECYCLES.includes(transition.from) || !allowed[transition.from].includes(transition.to)) {
    fail("INVALID_PRACTICAL_GOVERNANCE_LIFECYCLE_TRANSITION");
  }
}

export function assertReviewerOnlyVisibility(visibility: unknown): void {
  if (visibility !== "REVIEWER_ONLY") fail("REVIEWER_MATERIAL_VISIBILITY_DENIED");
}
