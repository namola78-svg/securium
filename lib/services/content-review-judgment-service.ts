import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import { findActiveOwnerAttestation } from "../../db/content-review-owner-attestation-repository.ts";
import { saveContentReviewJudgment } from "../../db/content-review-judgment-repository.ts";
import { assertAuthorizedContentReviewer, semanticReviewIdentity, type ContentReviewJudgmentInput, type AuthenticatedContentReviewer } from "../policy/content-review-judgment.ts";
import { CONTENT_REVIEWER_SEPARATION_POLICY_V1, CONTENT_REVIEW_POLICY_DENIED_AUDIT_ACTION, evaluateReviewerSeparation } from "../policy/content-reviewer-separation.ts";
import { AppError } from "../errors.ts";
import { assertJudgmentBoundToReviewedInput, assertReviewDomainRequired, resolveReviewedInputContextByResourceType, resolveSecureCodingReviewedInputContext, type ServerOwnedReviewedInputContext, type ServerOwnedReviewedInputResolver } from "./content-review-input-resolver.ts";

export type AuthenticatedContentReviewIntent = Omit<ContentReviewJudgmentInput, "reviewedInputIdentity" | "reviewedInputSnapshot" | "subjects"> & {
  subjectId?: string;
  expectedReviewedInputIdentity?: string;
};

export async function recordAuthenticatedContentReviewJudgment(intent: AuthenticatedContentReviewIntent, actor: AuthenticatedContentReviewer, database: DatabaseProvider) {
  return recordAuthenticatedContentReviewJudgmentWithResolver(intent, actor, database, (provider) => resolveReviewedInputContextByResourceType("CONTENT_REVISION", provider));
}

/** ISE server boundary: the caller supplies only review facts, never a resource or adapter. */
export async function recordAuthenticatedIseWaveAReviewJudgment(intent: AuthenticatedContentReviewIntent, actor: AuthenticatedContentReviewer, database: DatabaseProvider) {
  return recordAuthenticatedContentReviewJudgmentWithResolver(intent, actor, database, (provider) => resolveReviewedInputContextByResourceType("CONTENT_REVISION_REGISTRATION", provider));
}

async function recordAuthenticatedContentReviewJudgmentWithResolver(intent: AuthenticatedContentReviewIntent, actor: AuthenticatedContentReviewer, database: DatabaseProvider, resolver: ServerOwnedReviewedInputResolver) {
  assertAuthorizedContentReviewer(actor);
  const first = await reconstructJudgment(intent, database, resolver);
  const input = first.input;
  const context = await buildServerOwnedReviewerSeparationContext(input, actor, database, first.context);
  const evaluation = evaluateReviewerSeparation(context);
  if (evaluation.result !== "ALLOW") {
    const auditId = crypto.randomUUID();
    await database.transaction([{ sql: "INSERT INTO admin_audit_logs (id, actor_user_id, actor_role, action, resource_type, resource_id, result, request_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, 'DENIED', ?, ?, ?)", parameters: [auditId, actor.id, actor.roles.slice().sort().join(","), CONTENT_REVIEW_POLICY_DENIED_AUDIT_ACTION, "CONTENT_REVIEW_JUDGMENT", input.reviewedInputIdentity, null, JSON.stringify({ policyVersion: CONTENT_REVIEWER_SEPARATION_POLICY_V1, reasonCodes: evaluation.reasonCodes, reviewedInputIdentity: input.reviewedInputIdentity }), new Date().toISOString()] }]);
    throw new AppError("Reviewer separation policy denied this review.", 409, "CONTENT_REVIEW_POLICY_DENIED");
  }
  const latest = await reconstructJudgment(intent, database, resolver);
  const latestInput = latest.input;
  const latestContext = await buildServerOwnedReviewerSeparationContext(latestInput, actor, database, latest.context);
  const latestEvaluation = evaluateReviewerSeparation(latestContext);
  if (latestInput.reviewedInputIdentity !== input.reviewedInputIdentity || semanticReviewIdentity(latestInput) !== semanticReviewIdentity(input) || latestEvaluation.semanticIdentity !== evaluation.semanticIdentity || latestEvaluation.result !== "ALLOW") {
    throw new AppError("Current reviewed input changed before persistence.", 409, "CONTENT_REVIEW_INPUT_STALE");
  }
  return saveContentReviewJudgment(latestInput, actor, database, latestEvaluation, resolver);
}

async function reconstructJudgment(intent: AuthenticatedContentReviewIntent, database: DatabaseProvider, resolver: ServerOwnedReviewedInputResolver): Promise<{ input: ContentReviewJudgmentInput; context: ServerOwnedReviewedInputContext }> {
  const raw = intent as unknown as Record<string, unknown>;
  for (const field of ["reviewedInputIdentity", "reviewedInputSnapshot", "subjects", "resourceType", "resourceId", "requiredDomains", "requiredReviewerCount", "adapter"]) {
    if (Object.prototype.hasOwnProperty.call(raw, field)) throw new AppError("Reviewed input fields are server-owned.", 400, "CONTENT_REVIEW_INPUT_FIELDS_SERVER_OWNED");
  }
  const { subjectId, expectedReviewedInputIdentity, ...boundedIntent } = intent;
  const context = await resolver(database);
  assertReviewDomainRequired(context, intent.reviewDomain);
  if (context.subjectBindingMode === "EXACT" && subjectId !== undefined) throw new AppError("The exact package subject scope is server-owned.", 400, "CONTENT_REVIEW_SUBJECT_SCOPE_SERVER_OWNED");
  const subjects = context.subjectBindingMode === "SUBSET" && intent.reviewDomain === "TECHNICAL" && subjectId
    ? context.subjects.filter((subject) => subject.subjectIdentity === subjectId)
    : [...context.subjects];
  if (subjects.length === 0) throw new AppError("The requested subject is not in the current reviewed input.", 409, "CONTENT_REVIEW_SUBJECT_SCOPE_INVALID");
  if (expectedReviewedInputIdentity !== undefined && expectedReviewedInputIdentity !== context.reviewedInputIdentity) throw new AppError("Expected reviewed input is stale.", 409, "CONTENT_REVIEW_INPUT_STALE");
  const input = { ...boundedIntent, reviewedInputIdentity: context.reviewedInputIdentity, reviewedInputSnapshot: context.reviewedInputSnapshot, subjects };
  assertJudgmentBoundToReviewedInput(input, context);
  return { input, context };
}

export async function buildServerOwnedReviewerSeparationContext(input: ContentReviewJudgmentInput, actor: AuthenticatedContentReviewer, database: DatabaseProvider, resolvedContext?: ServerOwnedReviewedInputContext) {
  const owner = await findActiveOwnerAttestation(input.reviewedInputIdentity, database);
  const revisionId = input.subjects[0]?.resourceRevisionId ?? "";
  const revision = revisionId ? await database.queryOne<{ created_by: string | null }>({ sql: "SELECT created_by FROM content_revisions WHERE id = ? LIMIT 1", parameters: [revisionId] }) : null;
  const authorUserId = revision?.created_by ?? null;
  const provenanceClass = authorUserId ? "KNOWN_AUTHOR" as const : "UNKNOWN_AUTHOR" as const;
  const materialEditorProvenance = "UNKNOWN" as const;
  const context = resolvedContext ?? await resolveSecureCodingReviewedInputContext();
  if (context.reviewedInputIdentity !== input.reviewedInputIdentity) throw new AppError("Reviewer policy context is bound to a stale reviewed input.", 409, "CONTENT_REVIEW_INPUT_STALE");
  return { reviewedInputIdentity: input.reviewedInputIdentity, resourceType: context.resourceType, resourceId: context.resourceId || revisionId || "SERVER_RESOLVED", judgmentSemanticIdentity: semanticReviewIdentity(input), reviewer: actor, authorUserId, ownerUserId: owner?.ownerUserId ?? null, ownerAttestationId: owner?.attestationId ?? null, materialEditorUserIds: [], materialEditorProvenance, provenanceClass, riskClass: context.riskClass, requiredReviewerCount: context.requiredReviewerCount, reviewerSlot: 1 as const, policyVersion: CONTENT_REVIEWER_SEPARATION_POLICY_V1 };
}
