import { CONTENT_REVIEW_DOMAINS } from "../policy/content-review-judgment.ts";
import { buildSecureCodingReviewedInput } from "./secure-coding-review-adapter.ts";
import type { ServerOwnedReviewedInputContext } from "./content-review-input-resolver.ts";

const SECURE_CODING_REQUIRED_DOMAINS = Object.freeze(
  CONTENT_REVIEW_DOMAINS.filter((domain) => domain !== "CURRENTNESS"),
);

export async function resolveSecureCodingReviewedInputContext(): Promise<ServerOwnedReviewedInputContext> {
  const current = buildSecureCodingReviewedInput();
  return {
    resourceType: current.resource,
    resourceId: current.subjects[0]?.resourceRevisionId ?? "V1",
    scope: current.scope,
    reviewedInputIdentity: current.reviewedInputIdentity,
    reviewedInputSnapshot: current.snapshot,
    subjects: current.subjects,
    requiredDomains: SECURE_CODING_REQUIRED_DOMAINS,
    requiredReviewerCount: 2,
    riskClass: "HIGH_TRUST",
    subjectBindingMode: "SUBSET",
  };
}
