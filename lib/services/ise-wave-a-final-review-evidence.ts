import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import { findActiveOwnerAttestation } from "../../db/content-review-owner-attestation-repository.ts";
import { findActiveContentReviewJudgments, type ContentReviewJudgmentRecord } from "../../db/content-review-judgment-repository.ts";
import { findPolicyEvaluationsByJudgmentId } from "../../db/content-review-policy-evaluation-repository.ts";
import { sha256, type ContentReviewDomain } from "../policy/content-review-judgment.ts";
import { isReviewerCompletenessSatisfied } from "../policy/content-reviewer-separation.ts";
import { buildIseWaveAGovernanceContext, assertIseWaveAGovernanceDependencies, ISE_WAVE_A_REQUIRED_REVIEW_DOMAINS } from "./ise-wave-a-reviewed-input-adapter.ts";

export const ISE_WAVE_A_FINAL_REVIEW_EVIDENCE_V1 = "ISE_WAVE_A_FINAL_REVIEW_EVIDENCE_V1" as const;
export const ISE_WAVE_A_REVIEW_SCOPE = "ISE_WAVE_A_EXACT_PACKAGE_2_OF_2" as const;

export type IseWaveAFinalReviewCandidate = Readonly<{
  contractVersion: typeof ISE_WAVE_A_FINAL_REVIEW_EVIDENCE_V1;
  resource: "CONTENT_REVISION_REGISTRATION";
  scope: typeof ISE_WAVE_A_REVIEW_SCOPE;
  reviewedInputIdentity: string;
  subjects: readonly Readonly<{ subjectIdentity: string; semanticOrdinal: number; resourceRevisionId: string; contentSemanticHash: string }>[];
  reviewDomains: Record<ContentReviewDomain, { result: "REVIEW_PERFORMED_PASS"; judgmentIdentities: string[]; findingCount: number }>;
  ownerAttestationId: string;
  evidenceVerificationState: "VERIFIED";
  publicationAuthority: "NOT_GRANTED";
  candidateIdentity: string;
  candidateState: "EVIDENCE_VERIFIED";
  authorityState: "NOT_ESTABLISHED";
}>;

async function assertDomainCompleteness(domain: ContentReviewDomain, reviewedInputIdentity: string, expectedSnapshot: Record<string, unknown>, expectedResourceId: string, expectedSubjects: IseWaveAFinalReviewCandidate["subjects"], database: DatabaseProvider): Promise<{ result: "REVIEW_PERFORMED_PASS"; judgmentIdentities: string[]; findingCount: number }> {
  const records = await findActiveContentReviewJudgments(reviewedInputIdentity, domain, database);
  if (records.length === 0 || records.some((record) => record.result !== "REVIEW_PERFORMED_PASS" || sha256(record.reviewedInputSnapshot) !== sha256(expectedSnapshot)) || records.some((record) => !hasExactSubjects(record, expectedSubjects))) throw new Error("ISE_WAVE_A_FINAL_REVIEW_INCOMPLETE");
  const evaluations = (await Promise.all(records.map((record) => findPolicyEvaluationsByJudgmentId(record.judgmentId, database)))).flat();
  if (evaluations.length !== records.length || evaluations.some((evaluation) => evaluation.evaluationResult !== "ALLOW" || evaluation.policyVersion !== "CONTENT_REVIEWER_SEPARATION_POLICY_V1" || evaluation.reviewedInputIdentity !== reviewedInputIdentity || evaluation.resourceType !== "CONTENT_REVISION_REGISTRATION" || evaluation.resourceId !== expectedResourceId)) throw new Error("ISE_WAVE_A_FINAL_REVIEW_POLICY_INVALID");
  if (!isReviewerCompletenessSatisfied(evaluations.map((evaluation) => ({ reviewer: { id: evaluation.reviewerUserId, roles: [] }, requiredReviewerCount: evaluation.requiredReviewerCount, result: evaluation.evaluationResult })))) throw new Error("ISE_WAVE_A_FINAL_REVIEW_DUAL_REVIEW_INCOMPLETE");
  return { result: "REVIEW_PERFORMED_PASS", judgmentIdentities: records.map((record) => record.semanticReviewIdentity).sort(), findingCount: records.flatMap((record) => record.findings).length };
}

function hasExactSubjects(record: ContentReviewJudgmentRecord, expected: IseWaveAFinalReviewCandidate["subjects"]): boolean {
  if (record.subjects.length !== expected.length) return false;
  return expected.every((subject) => record.subjects.some((actual) => actual.subjectIdentity === subject.subjectIdentity && actual.resourceRevisionId === subject.resourceRevisionId && actual.contentSemanticHash === subject.contentSemanticHash && actual.semanticOrdinal === subject.semanticOrdinal));
}

export async function buildIseWaveAFinalReviewCandidateFromDatabase(database: DatabaseProvider): Promise<IseWaveAFinalReviewCandidate> {
  const context = await buildIseWaveAGovernanceContext(database);
  assertIseWaveAGovernanceDependencies(context);
  const reviewed = context.reviewedInput;
  const owner = await findActiveOwnerAttestation(reviewed.reviewedInputIdentity, database);
  if (!owner || owner.resourceType !== reviewed.resourceType || owner.resourceId !== reviewed.resourceId) throw new Error("ISE_WAVE_A_FINAL_REVIEW_OWNER_INCOMPLETE");
  const subjects = reviewed.subjects.map((subject) => ({ subjectIdentity: subject.subjectIdentity, semanticOrdinal: subject.semanticOrdinal, resourceRevisionId: subject.resourceRevisionId, contentSemanticHash: subject.contentSemanticHash }));
  const reviewDomains = {} as Record<ContentReviewDomain, { result: "REVIEW_PERFORMED_PASS"; judgmentIdentities: string[]; findingCount: number }>;
  for (const domain of ISE_WAVE_A_REQUIRED_REVIEW_DOMAINS) reviewDomains[domain] = await assertDomainCompleteness(domain, reviewed.reviewedInputIdentity, reviewed.snapshot, reviewed.resourceId, subjects, database);
  const projection = { contractVersion: ISE_WAVE_A_FINAL_REVIEW_EVIDENCE_V1, resource: reviewed.resourceType, scope: ISE_WAVE_A_REVIEW_SCOPE, reviewedInputIdentity: reviewed.reviewedInputIdentity, subjects, reviewDomains, ownerAttestationId: owner.attestationId, publicationAuthority: "NOT_GRANTED" as const };
  return { ...projection, evidenceVerificationState: "VERIFIED", candidateIdentity: sha256(projection), candidateState: "EVIDENCE_VERIFIED", authorityState: "NOT_ESTABLISHED" };
}
