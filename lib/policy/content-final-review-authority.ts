import { createHash } from "node:crypto";

export const CONTENT_FINAL_REVIEW_AUTHORITY_V1 = "CONTENT_FINAL_REVIEW_AUTHORITY_V1" as const;
export const CONTENT_FINAL_REVIEW_DECISION = "CONTENT_FINAL_REVIEW_DECISION" as const;
export const CONTENT_FINAL_REVIEW_PUBLICATION_AUTHORITY = "NOT_GRANTED" as const;
export const CONTENT_FINAL_REVIEW_OUTCOMES = ["APPROVED", "REJECTED"] as const;

export type ContentFinalReviewOutcome = (typeof CONTENT_FINAL_REVIEW_OUTCOMES)[number];
export type ContentFinalReviewResourceType = string;
export type ContentFinalReviewSubject = Readonly<{
  subjectIdentity: string;
  semanticOrdinal: number;
}>;
export type ContentFinalReviewDecision = Readonly<{
  contractVersion: typeof CONTENT_FINAL_REVIEW_AUTHORITY_V1;
  decisionType: typeof CONTENT_FINAL_REVIEW_DECISION;
  candidateIdentity: string;
  resourceType: ContentFinalReviewResourceType;
  scope: string;
  subjects: readonly ContentFinalReviewSubject[];
  decisionOutcome: ContentFinalReviewOutcome;
  publicationAuthority: typeof CONTENT_FINAL_REVIEW_PUBLICATION_AUTHORITY;
}>;
export type ContentFinalReviewDecisionInput = Readonly<{
  contractVersion: string;
  decisionType: string;
  candidateIdentity: string;
  resourceType: string;
  scope: string;
  subjects: readonly Readonly<{ subjectIdentity: string; semanticOrdinal: number }>[];
  decisionOutcome: string;
  publicationAuthority: string;
  [metadata: string]: unknown;
}>;
export type ContentFinalReviewDecisionValidation = Readonly<{
  valid: boolean;
  issues: readonly string[];
}>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("CONTENT_FINAL_REVIEW_NON_FINITE_NUMBER");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  throw new Error("CONTENT_FINAL_REVIEW_UNSUPPORTED_VALUE");
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isStrictIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function normalizedSubjectProjection(subjects: readonly ContentFinalReviewSubject[]): readonly ContentFinalReviewSubject[] {
  return [...subjects].sort((left, right) => left.semanticOrdinal - right.semanticOrdinal || left.subjectIdentity.localeCompare(right.subjectIdentity));
}

function semanticProjection(decision: ContentFinalReviewDecision): Omit<ContentFinalReviewDecision, never> {
  return {
    contractVersion: decision.contractVersion,
    decisionType: decision.decisionType,
    candidateIdentity: decision.candidateIdentity,
    resourceType: decision.resourceType,
    scope: decision.scope,
    subjects: normalizedSubjectProjection(decision.subjects),
    decisionOutcome: decision.decisionOutcome,
    publicationAuthority: decision.publicationAuthority,
  };
}

function decisionIssues(input: unknown): string[] {
  const issues: string[] = [];
  if (!isObject(input)) return ["decision must be an object"];
  if (input.contractVersion !== CONTENT_FINAL_REVIEW_AUTHORITY_V1) issues.push("contract version is unsupported");
  if (input.decisionType !== CONTENT_FINAL_REVIEW_DECISION) issues.push("decision type is unsupported");
  if (!isSha256(input.candidateIdentity)) issues.push("candidate identity must be a lowercase SHA-256 identity");
  if (!isStrictIdentifier(input.resourceType)) issues.push("resource type must be a non-empty normalized identifier");
  if (!isStrictIdentifier(input.scope)) issues.push("scope must be a non-empty normalized identifier");
  if (!Array.isArray(input.subjects) || input.subjects.length === 0) issues.push("subject set must be non-empty");
  if (!CONTENT_FINAL_REVIEW_OUTCOMES.includes(input.decisionOutcome as ContentFinalReviewOutcome)) issues.push("decision outcome is unsupported");
  if (input.publicationAuthority !== CONTENT_FINAL_REVIEW_PUBLICATION_AUTHORITY) issues.push("publication authority must be NOT_GRANTED");
  if (!Array.isArray(input.subjects)) return issues;

  const identities = new Set<string>();
  const ordinals = new Set<number>();
  for (const subject of input.subjects) {
    if (!isObject(subject)) { issues.push("subject must be an object"); continue; }
    if (!isStrictIdentifier(subject.subjectIdentity)) issues.push("subject identity must be a non-empty normalized identifier");
    if (!Number.isSafeInteger(subject.semanticOrdinal) || (subject.semanticOrdinal as number) < 0) issues.push("subject ordinal must be a non-negative safe integer");
    if (identities.has(subject.subjectIdentity as string)) issues.push("duplicate subject identity");
    if (ordinals.has(subject.semanticOrdinal as number)) issues.push("duplicate subject ordinal");
    identities.add(subject.subjectIdentity as string);
    ordinals.add(subject.semanticOrdinal as number);
  }
  return issues;
}

export function normalizeContentFinalReviewDecision(input: ContentFinalReviewDecisionInput): ContentFinalReviewDecision {
  const issues = decisionIssues(input);
  if (issues.length > 0) throw new Error(`CONTENT_FINAL_REVIEW_DECISION_INVALID: ${issues.join("; ")}`);
  return {
    contractVersion: CONTENT_FINAL_REVIEW_AUTHORITY_V1,
    decisionType: CONTENT_FINAL_REVIEW_DECISION,
    candidateIdentity: input.candidateIdentity,
    resourceType: input.resourceType as ContentFinalReviewResourceType,
    scope: input.scope,
    subjects: normalizedSubjectProjection(input.subjects.map((subject) => ({ subjectIdentity: subject.subjectIdentity, semanticOrdinal: subject.semanticOrdinal }))),
    decisionOutcome: input.decisionOutcome as ContentFinalReviewOutcome,
    publicationAuthority: CONTENT_FINAL_REVIEW_PUBLICATION_AUTHORITY,
  };
}

export function validateContentFinalReviewDecision(input: unknown): ContentFinalReviewDecisionValidation {
  const issues = decisionIssues(input);
  return { valid: issues.length === 0, issues };
}

export function computeContentFinalReviewDecisionIdentity(input: ContentFinalReviewDecisionInput | ContentFinalReviewDecision): string {
  const normalized = normalizeContentFinalReviewDecision(input);
  return sha256(semanticProjection(normalized));
}
