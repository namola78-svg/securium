import { createHash } from "node:crypto";
import { AppError } from "../errors.ts";

export const CONTENT_REVIEW_JUDGMENT_CONTRACT_V1 = "CONTENT_REVIEW_JUDGMENT_V1" as const;
export const CONTENT_REVIEW_DOMAINS = [
  "TECHNICAL",
  "SAFETY_SECURITY_CONTENT",
  "COPYRIGHT_RIGHTS",
  "SUPPORT_QUALIFICATION",
  "CURRENTNESS",
] as const;
export const CONTENT_REVIEW_RESULTS = [
  "REVIEW_PERFORMED_PASS",
  "REVIEW_PERFORMED_FAIL",
  "REQUIRES_REVISION",
  "NOT_REVIEWED",
] as const;
export const CONTENT_REVIEW_LIFECYCLE_STATES = ["ACTIVE", "HISTORICAL", "INVALIDATED", "SUPERSEDED"] as const;
export const CONTENT_REVIEW_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
export const CONTENT_REVIEW_DISPOSITIONS = ["OPEN", "REMEDIATED", "ACCEPTED", "NOT_APPLICABLE"] as const;

export type ContentReviewDomain = (typeof CONTENT_REVIEW_DOMAINS)[number];
export type ContentReviewResult = (typeof CONTENT_REVIEW_RESULTS)[number];
export type ContentReviewLifecycle = (typeof CONTENT_REVIEW_LIFECYCLE_STATES)[number];
export type ContentReviewSeverity = (typeof CONTENT_REVIEW_SEVERITIES)[number];
export type ContentReviewDisposition = (typeof CONTENT_REVIEW_DISPOSITIONS)[number];

export type ContentReviewSubjectBinding = {
  subjectIdentity: string;
  resourceRevisionId: string;
  contentSemanticHash: string;
  semanticOrdinal: number;
};

export type ContentReviewFindingInput = {
  subjectIdentity?: string | null;
  category: string;
  severity: ContentReviewSeverity;
  disposition: ContentReviewDisposition;
  materialFacts: Record<string, unknown>;
};

export type ContentReviewJudgmentInput = {
  contractVersion?: typeof CONTENT_REVIEW_JUDGMENT_CONTRACT_V1;
  reviewDomain: ContentReviewDomain;
  reviewedInputIdentity: string;
  reviewedInputSnapshot: Record<string, unknown>;
  result: ContentReviewResult;
  subjects: ContentReviewSubjectBinding[];
  findings: ContentReviewFindingInput[];
  idempotencyKey: string;
  supersedesJudgmentId?: string | null;
};

export type AuthenticatedContentReviewer = {
  id: string;
  roles: string[];
  status?: string;
};

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  throw new AppError("Review value is not canonicalizable.", 400, "CONTENT_REVIEW_VALUE_INVALID");
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function findingSemanticIdentity(input: ContentReviewFindingInput, domain: ContentReviewDomain, reviewedInputIdentity: string): string {
  return sha256({
    contractVersion: CONTENT_REVIEW_JUDGMENT_CONTRACT_V1,
    domain,
    reviewedInputIdentity,
    subjectIdentity: input.subjectIdentity ?? null,
    category: input.category.trim(),
    severity: input.severity,
    disposition: input.disposition,
    materialFacts: input.materialFacts,
  });
}

export function semanticReviewIdentity(input: ContentReviewJudgmentInput): string {
  return sha256({
    contractVersion: input.contractVersion ?? CONTENT_REVIEW_JUDGMENT_CONTRACT_V1,
    reviewDomain: input.reviewDomain,
    reviewedInputIdentity: input.reviewedInputIdentity,
    result: input.result,
    subjects: input.subjects,
    findings: input.findings.map((finding) => findingSemanticIdentity(finding, input.reviewDomain, input.reviewedInputIdentity)).sort(),
  });
}

export function validateContentReviewJudgmentInput(input: ContentReviewJudgmentInput): void {
  if (input.contractVersion && input.contractVersion !== CONTENT_REVIEW_JUDGMENT_CONTRACT_V1) throw new AppError("Unsupported content review contract.", 400, "CONTENT_REVIEW_CONTRACT_INVALID");
  if (!CONTENT_REVIEW_DOMAINS.includes(input.reviewDomain)) throw new AppError("Unsupported content review domain.", 400, "CONTENT_REVIEW_DOMAIN_INVALID");
  if (!/^[a-f0-9]{64}$/.test(input.reviewedInputIdentity)) throw new AppError("Reviewed input identity is invalid.", 400, "CONTENT_REVIEW_INPUT_IDENTITY_INVALID");
  if (!CONTENT_REVIEW_RESULTS.includes(input.result)) throw new AppError("Content review result is invalid.", 400, "CONTENT_REVIEW_RESULT_INVALID");
  if (!/^[A-Za-z0-9._:-]{1,100}$/.test(input.idempotencyKey)) throw new AppError("Content review idempotency key is invalid.", 400, "CONTENT_REVIEW_IDEMPOTENCY_INVALID");
  if (input.result === "NOT_REVIEWED") throw new AppError("NOT_REVIEWED cannot be persisted as an authenticated judgment.", 400, "CONTENT_REVIEW_NOT_REVIEWED_INVALID");
  if (input.subjects.length === 0) throw new AppError("Exact subject binding is required.", 400, "CONTENT_REVIEW_SUBJECTS_REQUIRED");
  const identities = new Set<string>(); const ordinals = new Set<number>();
  for (const subject of input.subjects) {
    if (!subject.subjectIdentity.trim() || !subject.resourceRevisionId.trim() || !/^[a-f0-9]{64}$/.test(subject.contentSemanticHash) || !Number.isInteger(subject.semanticOrdinal) || subject.semanticOrdinal < 0) throw new AppError("Content review subject binding is invalid.", 400, "CONTENT_REVIEW_SUBJECT_INVALID");
    if (identities.has(subject.subjectIdentity) || ordinals.has(subject.semanticOrdinal)) throw new AppError("Content review subject binding is duplicated.", 400, "CONTENT_REVIEW_SUBJECT_DUPLICATE");
    identities.add(subject.subjectIdentity); ordinals.add(subject.semanticOrdinal);
  }
  for (const finding of input.findings) {
    if (!finding.category.trim() || !CONTENT_REVIEW_SEVERITIES.includes(finding.severity) || !CONTENT_REVIEW_DISPOSITIONS.includes(finding.disposition)) throw new AppError("Content review finding is invalid.", 400, "CONTENT_REVIEW_FINDING_INVALID");
    if (finding.subjectIdentity !== undefined && finding.subjectIdentity !== null && !identities.has(finding.subjectIdentity)) throw new AppError("Finding subject is not bound to the judgment.", 400, "CONTENT_REVIEW_FINDING_SUBJECT_INVALID");
  }
}

export function assertAuthorizedContentReviewer(actor: AuthenticatedContentReviewer | null): void {
  if (!actor || actor.status === "INACTIVE") throw new AppError("Authenticated reviewer is required.", 401, "UNAUTHENTICATED");
  if (!actor.roles.some((role) => ["CONTENT_REVIEWER", "ADMIN", "SUPER_ADMIN"].includes(role))) throw new AppError("Content review governance role is required.", 403, "CONTENT_REVIEW_GOVERNANCE_ROLE_REQUIRED");
}
