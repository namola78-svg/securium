import type { ContentFinalReviewAuthorityRecord } from "../services/content-final-review-authority.ts";

export function isContentFinalReviewCanonicalEligible(
  authority: ContentFinalReviewAuthorityRecord | null,
): boolean {
  return authority?.authorityState === "ACTIVE" && authority.decisionOutcome === "APPROVED" && authority.publicationAuthority === "NOT_GRANTED";
}

export function isContentFinalReviewPublicationEligible(): false {
  return false;
}
