import { AppError } from "../errors.ts";
import { sha256, type AuthenticatedContentReviewer } from "./content-review-judgment.ts";

export const CONTENT_REVIEWER_SEPARATION_POLICY_V1 = "CONTENT_REVIEWER_SEPARATION_POLICY_V1" as const;
export const CONTENT_REVIEW_POLICY_DENIED_AUDIT_ACTION = "CONTENT_REVIEW_POLICY_DENIED" as const;
export type ReviewerSeparationProvenanceClass = "KNOWN_AUTHOR" | "UNKNOWN_AUTHOR" | "CONFLICTING_AUTHOR";
export type ReviewerSeparationRiskClass = "STANDARD" | "HIGH_TRUST";
export type ReviewerSeparationResult = "ALLOW" | "DENY";
export type ReviewerSeparationEditorProvenance = "KNOWN" | "UNKNOWN";

export type ReviewerSeparationInput = Readonly<{
  reviewedInputIdentity: string; resourceType: string; resourceId: string; reviewer: AuthenticatedContentReviewer;
  judgmentSemanticIdentity?: string;
  authorUserId: string | null; ownerUserId: string | null; ownerAttestationId?: string | null;
  materialEditorUserIds: readonly string[]; materialEditorProvenance?: ReviewerSeparationEditorProvenance;
  provenanceClass: ReviewerSeparationProvenanceClass; riskClass: ReviewerSeparationRiskClass;
  requiredReviewerCount: 1 | 2; reviewerSlot?: 1 | 2; policyVersion?: typeof CONTENT_REVIEWER_SEPARATION_POLICY_V1;
}>;
export type ReviewerSeparationEvaluation = ReviewerSeparationInput & Readonly<{
  policyVersion: typeof CONTENT_REVIEWER_SEPARATION_POLICY_V1; result: ReviewerSeparationResult;
  reasonCodes: readonly string[]; semanticIdentity: string;
}>;

export function evaluateReviewerSeparation(input: ReviewerSeparationInput): ReviewerSeparationEvaluation {
  if (input.policyVersion && input.policyVersion !== CONTENT_REVIEWER_SEPARATION_POLICY_V1) throw new AppError("Unsupported reviewer separation policy.", 400, "CONTENT_REVIEW_POLICY_VERSION_INVALID");
  if (!/^[a-f0-9]{64}$/.test(input.reviewedInputIdentity)) throw new AppError("Reviewed input identity is invalid.", 400, "CONTENT_REVIEW_INPUT_IDENTITY_INVALID");
  if (input.requiredReviewerCount !== 1 && input.requiredReviewerCount !== 2) throw new AppError("Reviewer count is invalid.", 400, "CONTENT_REVIEW_REVIEWER_COUNT_INVALID");
  if (input.reviewerSlot && input.reviewerSlot > input.requiredReviewerCount) throw new AppError("Reviewer slot is invalid.", 400, "CONTENT_REVIEW_REVIEWER_SLOT_INVALID");
  const reasons: string[] = [];
  if (input.provenanceClass === "CONFLICTING_AUTHOR") reasons.push("AUTHOR_PROVENANCE_CONFLICT");
  if (input.provenanceClass === "UNKNOWN_AUTHOR" && !input.ownerAttestationId) reasons.push("OWNER_ATTESTATION_REQUIRED");
  if (input.authorUserId && input.authorUserId === input.reviewer.id) reasons.push("AUTHOR_REVIEWER_CONFLICT");
  if (input.ownerUserId && input.ownerUserId === input.reviewer.id) reasons.push("OWNER_REVIEWER_CONFLICT");
  if (input.materialEditorUserIds.includes(input.reviewer.id)) reasons.push("MATERIAL_EDITOR_REVIEWER_CONFLICT");
  const evaluated = { ...input, policyVersion: CONTENT_REVIEWER_SEPARATION_POLICY_V1, reviewerSlot: input.reviewerSlot ?? 1, materialEditorProvenance: input.materialEditorProvenance ?? "KNOWN", result: reasons.length === 0 ? "ALLOW" as const : "DENY" as const, reasonCodes: [...new Set(reasons)].sort() };
  return { ...evaluated, semanticIdentity: recomputeReviewerSeparationSemanticIdentity(evaluated) };
}

export function reviewerSeparationSemanticIdentity(input: Omit<ReviewerSeparationEvaluation, "semanticIdentity">): string {
  return JSON.stringify({ policyVersion: input.policyVersion, reviewedInputIdentity: input.reviewedInputIdentity, resourceType: input.resourceType, resourceId: input.resourceId, judgmentSemanticIdentity: input.judgmentSemanticIdentity ?? null, reviewerUserId: input.reviewer.id, authorUserId: input.authorUserId, ownerUserId: input.ownerUserId, ownerAttestationId: input.ownerAttestationId ?? null, materialEditorUserIds: [...input.materialEditorUserIds].sort(), materialEditorProvenance: input.materialEditorProvenance ?? "KNOWN", provenanceClass: input.provenanceClass, riskClass: input.riskClass, requiredReviewerCount: input.requiredReviewerCount, reviewerSlot: input.reviewerSlot ?? 1, result: input.result, reasonCodes: [...input.reasonCodes].sort() });
}

export function recomputeReviewerSeparationSemanticIdentity(input: Omit<ReviewerSeparationEvaluation, "semanticIdentity">): string {
  return sha256(JSON.parse(reviewerSeparationSemanticIdentity(input)));
}

export function isReviewerCompletenessSatisfied(evaluations: readonly Pick<ReviewerSeparationEvaluation, "reviewer" | "requiredReviewerCount" | "result">[]): boolean {
  if (evaluations.length === 0 || evaluations.some((evaluation) => evaluation.result !== "ALLOW")) return false;
  const required = Math.max(...evaluations.map((evaluation) => evaluation.requiredReviewerCount));
  return new Set(evaluations.map((evaluation) => evaluation.reviewer.id)).size >= required;
}
