import { createHash } from "node:crypto";
import { findExactContentFinalReviewAuthority } from "../../db/content-final-review-authority-repository.ts";
import type { AppUser } from "../auth.ts";
import { computeContentFinalReviewDecisionIdentity, normalizeContentFinalReviewDecision } from "../policy/content-final-review-authority.ts";
import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import { buildSecureCodingFinalReviewCandidateFromDatabase } from "./secure-coding-final-review-evidence.ts";
import { buildIseWaveAFinalReviewCandidateFromDatabase } from "./ise-wave-a-final-review-evidence.ts";

export type ContentFinalReviewAuthoritySubject = Readonly<{ subjectIdentity: string; semanticOrdinal: number }>;
export type ContentFinalReviewAuthorityRecord = Readonly<{ authorityId: string; contractVersion: string; decisionType: string; semanticDecisionHash: string; idempotencyKey: string; candidateIdentity: string; resourceType: string; scope: string; decisionOutcome: "APPROVED" | "REJECTED"; authorityState: "ACTIVE" | "HISTORICAL" | "INVALIDATED"; publicationAuthority: "NOT_GRANTED"; actorUserId: string; actorRole: string; auditLogId: string; createdAt: string; subjects: readonly ContentFinalReviewAuthoritySubject[] }>;
export type ContentFinalReviewDecisionIntent = Readonly<{ outcome: "APPROVED" | "REJECTED"; confirmed: boolean; idempotencyKey: string; requestId?: string | null }>;

const GOVERNANCE_ROLES = ["CONTENT_REVIEWER", "ADMIN", "SUPER_ADMIN"] as const;

export async function recordSecureCodingFinalReviewDecision(intent: ContentFinalReviewDecisionIntent, actor: AppUser, database?: DatabaseProvider) {
  assertActor(actor);
  if (intent.confirmed !== true) throw new Error("CONTENT_FINAL_REVIEW_EXPLICIT_CONFIRMATION_REQUIRED");
  if (!/^[A-Za-z0-9._:-]{1,100}$/.test(intent.idempotencyKey)) throw new Error("CONTENT_FINAL_REVIEW_IDEMPOTENCY_KEY_INVALID");
  const provider = await resolveProvider(database);
  const candidate = await buildSecureCodingFinalReviewCandidateFromDatabase(provider);
  const decision = normalizeContentFinalReviewDecision({ contractVersion: "CONTENT_FINAL_REVIEW_AUTHORITY_V1", decisionType: "CONTENT_FINAL_REVIEW_DECISION", candidateIdentity: candidate.candidateIdentity, resourceType: candidate.resource, scope: candidate.scope, subjects: candidate.subjects.map((subject) => ({ subjectIdentity: `${subject.subjectIdentity}|${candidate.scope}|${subject.resourceRevisionId}|${subject.contentSemanticHash}`, semanticOrdinal: subject.semanticOrdinal })), decisionOutcome: intent.outcome, publicationAuthority: "NOT_GRANTED" });
  const { saveContentFinalReviewAuthority } = await import("../../db/content-final-review-authority-repository.ts");
  const authority = await saveContentFinalReviewAuthority({ decision, idempotencyKey: hashIdempotencyKey(intent.idempotencyKey), actorUserId: actor.id, actorRole: actor.roles.find((role) => GOVERNANCE_ROLES.includes(role as never)) ?? "UNKNOWN", requestId: intent.requestId ?? null }, provider);
  return { ...authority, decisionSemanticHash: computeContentFinalReviewDecisionIdentity(decision) };
}

export async function getSecureCodingCanonicalEligibility(database?: DatabaseProvider): Promise<ContentFinalReviewAuthorityRecord | null> {
  try {
    const provider = await resolveProvider(database);
    const candidate = await buildSecureCodingFinalReviewCandidateFromDatabase(provider);
    const decision = normalizeContentFinalReviewDecision({ contractVersion: "CONTENT_FINAL_REVIEW_AUTHORITY_V1", decisionType: "CONTENT_FINAL_REVIEW_DECISION", candidateIdentity: candidate.candidateIdentity, resourceType: candidate.resource, scope: candidate.scope, subjects: candidate.subjects.map((subject) => ({ subjectIdentity: `${subject.subjectIdentity}|${candidate.scope}|${subject.resourceRevisionId}|${subject.contentSemanticHash}`, semanticOrdinal: subject.semanticOrdinal })), decisionOutcome: "APPROVED", publicationAuthority: "NOT_GRANTED" });
    return findExactContentFinalReviewAuthority(decision, provider);
  } catch {
    return null;
  }
}

/** Resolve authority eligibility only through an approved server-owned resource adapter. */
export async function getCanonicalFinalReviewEligibility(resourceType: string, database?: DatabaseProvider): Promise<ContentFinalReviewAuthorityRecord | null> {
  if (resourceType === "CONTENT_REVISION_REGISTRATION") return getIseWaveACanonicalEligibility(database);
  if (resourceType === "CONTENT_REVISION") return getSecureCodingCanonicalEligibility(database);
  return null;
}

export async function getIseWaveACanonicalEligibility(database?: DatabaseProvider): Promise<ContentFinalReviewAuthorityRecord | null> {
  try {
    const provider = await resolveProvider(database);
    const candidate = await buildIseWaveAFinalReviewCandidateFromDatabase(provider);
    const decision = normalizeContentFinalReviewDecision({ contractVersion: "CONTENT_FINAL_REVIEW_AUTHORITY_V1", decisionType: "CONTENT_FINAL_REVIEW_DECISION", candidateIdentity: candidate.candidateIdentity, resourceType: candidate.resource, scope: candidate.scope, subjects: candidate.subjects.map((subject) => ({ subjectIdentity: `${subject.subjectIdentity}|${candidate.scope}|${subject.resourceRevisionId}|${subject.contentSemanticHash}`, semanticOrdinal: subject.semanticOrdinal })), decisionOutcome: "APPROVED", publicationAuthority: "NOT_GRANTED" });
    return findExactContentFinalReviewAuthority(decision, provider);
  } catch {
    return null;
  }
}

export function isAuthorizedFinalReviewActor(actor: AppUser | null | undefined): actor is AppUser { return Boolean(actor?.id?.trim() && actor.roles.some((role) => GOVERNANCE_ROLES.includes(role as never))); }
function assertActor(actor: AppUser | null | undefined): asserts actor is AppUser { if (!actor?.id?.trim()) throw new Error("CONTENT_FINAL_REVIEW_UNAUTHENTICATED"); if (!isAuthorizedFinalReviewActor(actor) || !actor.roles.length) throw new Error("CONTENT_FINAL_REVIEW_GOVERNANCE_ROLE_REQUIRED"); }
function hashIdempotencyKey(value: string) { return createHash("sha256").update(`CONTENT_FINAL_REVIEW_AUTHORITY_V1\u0000${value}`, "utf8").digest("hex"); }
async function resolveProvider(database?: DatabaseProvider): Promise<DatabaseProvider> { if (database) return database; const { getDatabaseProvider } = await import("../../db/index.ts"); return getDatabaseProvider(); }
