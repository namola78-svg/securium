import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import { AppError } from "../errors.ts";
import { CONTENT_REVIEW_DOMAINS, sha256, type ContentReviewDomain, type ContentReviewJudgmentInput, type ContentReviewSubjectBinding } from "../policy/content-review-judgment.ts";
import { buildSecureCodingReviewedInput } from "./secure-coding-review-adapter.ts";
import { assertIseWaveAGovernanceDependencies, buildIseWaveAGovernanceContext } from "./ise-wave-a-reviewed-input-adapter.ts";

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

export async function resolveIseWaveAReviewedInputContext(database: DatabaseProvider): Promise<ServerOwnedReviewedInputContext> {
  const context = await buildIseWaveAGovernanceContext(database);
  assertIseWaveAGovernanceDependencies(context);
  const reviewed = context.reviewedInput;
  return {
    resourceType: reviewed.resourceType,
    resourceId: reviewed.resourceId,
    scope: reviewed.scope,
    reviewedInputIdentity: reviewed.reviewedInputIdentity,
    reviewedInputSnapshot: reviewed.snapshot,
    subjects: reviewed.subjects.map((subject) => ({
      subjectIdentity: subject.subjectIdentity,
      resourceRevisionId: subject.resourceRevisionId,
      contentSemanticHash: subject.contentSemanticHash,
      semanticOrdinal: subject.semanticOrdinal,
    })),
    requiredDomains: reviewed.requiredDomains,
    requiredReviewerCount: reviewed.requiredReviewerCount,
    riskClass: reviewed.riskClass,
    subjectBindingMode: "EXACT",
  };
}

/**
 * Resource type is supplied only by a server-owned execution boundary. It is
 * never read from reviewer intent or persisted as caller authority.
 */
export async function resolveReviewedInputContextByResourceType(resourceType: string, database: DatabaseProvider): Promise<ServerOwnedReviewedInputContext> {
  if (resourceType === "CONTENT_REVISION") return resolveSecureCodingReviewedInputContext();
  if (resourceType === "CONTENT_REVISION_REGISTRATION") return resolveIseWaveAReviewedInputContext(database);
  throw new AppError("No approved reviewed-input adapter exists for this resource type.", 400, "CONTENT_REVIEW_RESOURCE_TYPE_UNSUPPORTED");
}

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
