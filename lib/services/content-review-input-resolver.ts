import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import { AppError } from "../errors.ts";
import { sha256, type ContentReviewDomain, type ContentReviewJudgmentInput, type ContentReviewSubjectBinding } from "../policy/content-review-judgment.ts";

export type ServerOwnedReviewedInputContext = Readonly<{
  resourceType: string;
  resourceId: string;
  scope: string;
  reviewedInputIdentity: string;
  reviewedInputSnapshot: Record<string, unknown>;
  subjects: readonly ContentReviewSubjectBinding[];
  requiredDomains: readonly ContentReviewDomain[];
  requiredReviewerCount: 1 | 2;
  riskClass: "STANDARD" | "HIGH_TRUST";
  subjectBindingMode: "EXACT" | "SUBSET";
}>;

export type ServerOwnedReviewedInputResolver = (database: DatabaseProvider) => Promise<ServerOwnedReviewedInputContext>;

export function assertReviewDomainRequired(context: ServerOwnedReviewedInputContext, domain: ContentReviewDomain): void {
  if (!context.requiredDomains.includes(domain)) throw new AppError("The review domain is not required for this server-owned reviewed input.", 409, "CONTENT_REVIEW_DOMAIN_NOT_REQUIRED");
}

export function assertJudgmentBoundToReviewedInput(input: ContentReviewJudgmentInput, context: ServerOwnedReviewedInputContext): void {
  if (input.reviewedInputIdentity !== context.reviewedInputIdentity || sha256(input.reviewedInputSnapshot) !== sha256(context.reviewedInputSnapshot)) throw new AppError("Judgment must bind to the current server-owned reviewed input.", 409, "CONTENT_REVIEW_CANONICAL_STATE_REQUIRED");
  const matches = (subject: ContentReviewSubjectBinding) => context.subjects.some((expected) => expected.subjectIdentity === subject.subjectIdentity && expected.resourceRevisionId === subject.resourceRevisionId && expected.contentSemanticHash === subject.contentSemanticHash && expected.semanticOrdinal === subject.semanticOrdinal);
  if (context.subjectBindingMode === "EXACT" && (input.subjects.length !== context.subjects.length || !context.subjects.every(matches))) throw new AppError("Judgment subject scope does not match the current reviewed input.", 409, "CONTENT_REVIEW_SUBJECT_SCOPE_INVALID");
  if (context.subjectBindingMode === "SUBSET" && !input.subjects.every(matches)) throw new AppError("Judgment subject scope is outside the current reviewed input.", 409, "CONTENT_REVIEW_SUBJECT_SCOPE_INVALID");
  assertReviewDomainRequired(context, input.reviewDomain);
}
