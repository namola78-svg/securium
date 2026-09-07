import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import { findActiveContentReviewJudgments, type ContentReviewJudgmentRecord } from "../../db/content-review-judgment-repository.ts";
import { findPolicyEvaluationsByJudgmentId } from "../../db/content-review-policy-evaluation-repository.ts";
import { buildSecureCodingReviewedInput } from "./secure-coding-review-adapter.ts";
import { sha256, type ContentReviewDomain } from "../policy/content-review-judgment.ts";
import { isReviewerCompletenessSatisfied } from "../policy/content-reviewer-separation.ts";

export type SecureCodingDatabaseEvidence = {
  contractVersion: "SECURE_CODING_FINAL_REVIEW_EVIDENCE_V2";
  resource: "CONTENT_REVISION";
  scope: "SECURE_CODING_V1";
  reviewedInputIdentity: string;
  subjects: ReturnType<typeof buildSecureCodingReviewedInput>["subjects"];
  reviewDomains: Record<ContentReviewDomain, { result: "REVIEW_PERFORMED_PASS"; judgmentIdentities: string[]; findingCount: number }>;
  importantClaimCount: number;
  technicalCritical: number;
  technicalHigh: number;
  safetyCritical: number;
  safetyHigh: number;
  copyrightCritical: number;
  copyrightHigh: number;
  qualificationRequired: number;
  qualificationClosed: number;
  qualificationStatus: "PASS";
  evidenceVerificationState: "VERIFIED";
  publicationAuthority: "NOT_GRANTED";
  evidenceIdentity: string;
};

export type SecureCodingDatabaseCandidate = SecureCodingDatabaseEvidence & {
  candidateIdentity: string;
  candidateState: "EVIDENCE_VERIFIED";
  authorityState: "NOT_ESTABLISHED";
};

const domains: ContentReviewDomain[] = ["TECHNICAL", "SAFETY_SECURITY_CONTENT", "COPYRIGHT_RIGHTS", "SUPPORT_QUALIFICATION"];
function blockingFindings(records: ContentReviewJudgmentRecord[]) { return records.flatMap((record) => record.findings).filter((finding) => (finding.severity === "CRITICAL" || finding.severity === "HIGH") && finding.disposition === "OPEN"); }
function exactSubjectSet(record: ContentReviewJudgmentRecord, expected: ReturnType<typeof buildSecureCodingReviewedInput>["subjects"]) {
  if (record.subjects.length !== expected.length) return false;
  return expected.every((subject) => record.subjects.some((actual) => actual.subjectIdentity === subject.subjectIdentity && actual.resourceRevisionId === subject.resourceRevisionId && actual.contentSemanticHash === subject.contentSemanticHash && actual.semanticOrdinal === subject.semanticOrdinal));
}

function hasExactSubjects(records: ContentReviewJudgmentRecord[], expected: ReturnType<typeof buildSecureCodingReviewedInput>["subjects"]) {
  if (records.some((record) => exactSubjectSet(record, expected))) return records.every((record) => exactSubjectSet(record, expected));
  const actual = records.flatMap((record) => record.subjects).sort((a, b) => a.semanticOrdinal - b.semanticOrdinal);
  if (actual.length !== expected.length) return false;
  return expected.every((subject, index) => actual[index]?.subjectIdentity === subject.subjectIdentity && actual[index]?.resourceRevisionId === subject.resourceRevisionId && actual[index]?.contentSemanticHash === subject.contentSemanticHash && actual[index]?.semanticOrdinal === subject.semanticOrdinal);
}

async function assertPolicyCompleteness(records: ContentReviewJudgmentRecord[], reviewedInputIdentity: string, database: DatabaseProvider) {
  const evaluations = (await Promise.all(records.map((record) => findPolicyEvaluationsByJudgmentId(record.judgmentId, database)))).flat();
  if (evaluations.length !== records.length || evaluations.some((evaluation) => evaluation.evaluationResult !== "ALLOW" || evaluation.policyVersion !== "CONTENT_REVIEWER_SEPARATION_POLICY_V1" || evaluation.reviewedInputIdentity !== reviewedInputIdentity)) throw new Error("SECURE_CODING_FINAL_REVIEW_POLICY_INVALID");
  const policyEvaluations = evaluations.map((evaluation) => ({ reviewer: { id: evaluation.reviewerUserId, roles: [] }, requiredReviewerCount: evaluation.requiredReviewerCount, result: evaluation.evaluationResult }));
  if (!isReviewerCompletenessSatisfied(policyEvaluations)) throw new Error("SECURE_CODING_FINAL_REVIEW_DUAL_REVIEW_INCOMPLETE");
}

export async function buildSecureCodingFinalReviewEvidenceFromDatabase(database: DatabaseProvider): Promise<SecureCodingDatabaseEvidence> {
  const current = buildSecureCodingReviewedInput();
  const byDomain = {} as Record<ContentReviewDomain, ContentReviewJudgmentRecord[]>;
  for (const domain of domains) {
    const records = await findActiveContentReviewJudgments(current.reviewedInputIdentity, domain, database);
    if (records.length === 0 || records.some((record) => record.result !== "REVIEW_PERFORMED_PASS") || !hasExactSubjects(records, current.subjects)) throw new Error("SECURE_CODING_FINAL_REVIEW_INCOMPLETE");
    await assertPolicyCompleteness(records, current.reviewedInputIdentity, database);
    byDomain[domain] = records;
  }
  const allFindings = domains.flatMap((domain) => blockingFindings(byDomain[domain]));
  const count = (domain: ContentReviewDomain, severity: "CRITICAL" | "HIGH") => blockingFindings(byDomain[domain]).filter((finding) => finding.severity === severity).length;
  const judgmentIdentities = domains.flatMap((domain) => byDomain[domain].map((record) => record.semanticReviewIdentity)).sort();
  const qualificationPass = byDomain.SUPPORT_QUALIFICATION.every((record) => record.result === "REVIEW_PERFORMED_PASS");
  const qualificationRequired = current.snapshot.qualificationRequired as number;
  const qualificationClosed = qualificationPass ? qualificationRequired : 0;
  if (!qualificationPass) throw new Error("SECURE_CODING_FINAL_REVIEW_QUALIFICATION_INCOMPLETE");
  const qualificationStatus = "PASS" as const;
  const projection = { contractVersion: "SECURE_CODING_FINAL_REVIEW_EVIDENCE_V2", reviewedInputIdentity: current.reviewedInputIdentity, subjects: current.subjects, judgmentIdentities, importantClaimCount: current.snapshot.importantClaimCount, technicalCritical: count("TECHNICAL", "CRITICAL"), technicalHigh: count("TECHNICAL", "HIGH"), safetyCritical: count("SAFETY_SECURITY_CONTENT", "CRITICAL"), safetyHigh: count("SAFETY_SECURITY_CONTENT", "HIGH"), copyrightCritical: count("COPYRIGHT_RIGHTS", "CRITICAL"), copyrightHigh: count("COPYRIGHT_RIGHTS", "HIGH"), qualificationRequired, qualificationClosed, qualificationStatus, findingCount: allFindings.length };
  return { contractVersion: "SECURE_CODING_FINAL_REVIEW_EVIDENCE_V2", resource: current.resource, scope: current.scope, reviewedInputIdentity: current.reviewedInputIdentity, subjects: current.subjects, reviewDomains: Object.fromEntries(domains.map((domain) => [domain, { result: "REVIEW_PERFORMED_PASS", judgmentIdentities: byDomain[domain].map((record) => record.semanticReviewIdentity).sort(), findingCount: byDomain[domain].flatMap((record) => record.findings).length }])) as SecureCodingDatabaseEvidence["reviewDomains"], importantClaimCount: current.snapshot.importantClaimCount as number, technicalCritical: count("TECHNICAL", "CRITICAL"), technicalHigh: count("TECHNICAL", "HIGH"), safetyCritical: count("SAFETY_SECURITY_CONTENT", "CRITICAL"), safetyHigh: count("SAFETY_SECURITY_CONTENT", "HIGH"), copyrightCritical: count("COPYRIGHT_RIGHTS", "CRITICAL"), copyrightHigh: count("COPYRIGHT_RIGHTS", "HIGH"), qualificationRequired, qualificationClosed, qualificationStatus, evidenceVerificationState: "VERIFIED", publicationAuthority: "NOT_GRANTED", evidenceIdentity: sha256(projection) };
}

export async function buildSecureCodingFinalReviewCandidateFromDatabase(database: DatabaseProvider): Promise<SecureCodingDatabaseCandidate> {
  const evidence = await buildSecureCodingFinalReviewEvidenceFromDatabase(database);
  return { ...evidence, candidateIdentity: sha256(evidence), candidateState: "EVIDENCE_VERIFIED", authorityState: "NOT_ESTABLISHED" };
}
