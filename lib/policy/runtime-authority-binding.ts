import { createHash } from "node:crypto";
import { AppError } from "../errors.ts";
import { stableCanonicalJson } from "./stable-canonical-hash.ts";

export const RUNTIME_AUTHORITY_SUBJECT_CONTRACT_V1 = "SECURIUM_RUNTIME_AUTHORITY_SUBJECT_V1" as const;
export const COURSE_THEORY_DRAFT = "COURSE_THEORY_DRAFT" as const;
export const NOT_GRANTED = "NOT_GRANTED" as const;

export const RUNTIME_AUTHORITY_FAILURE_CODES = [
  "APPROVAL_BINDING_UNAVAILABLE",
  "APPROVAL_BINDING_MISMATCH",
  "CURRENTNESS_UNAVAILABLE",
  "CURRENTNESS_STALE",
  "AUTHORITY_REVOKED",
  "AUTHORITY_SUPERSEDED",
  "AUTHORITY_LIFECYCLE_UNAVAILABLE",
  "PUBLICATION_AUTHORITY_FORBIDDEN",
] as const;

export type RuntimeAuthorityFailureCode = (typeof RUNTIME_AUTHORITY_FAILURE_CODES)[number];

export const RUNTIME_AUTHORITY_CURRENTNESS_STATES = [
  "CURRENT",
  "CURRENT_WITH_VERSION_UNCERTAINTY",
  "HISTORICAL",
  "SUPERSEDED",
  "FUTURE_EFFECTIVE",
  "UNKNOWN",
  "REVIEW_REQUIRED",
] as const;

export type RuntimeAuthorityCurrentnessState = (typeof RUNTIME_AUTHORITY_CURRENTNESS_STATES)[number];

export type RuntimeAuthoritySubject = Readonly<{
  contractVersion: typeof RUNTIME_AUTHORITY_SUBJECT_CONTRACT_V1;
  registrationPurpose: typeof COURSE_THEORY_DRAFT;
  courseId: string;
  courseSlug: string;
  packageKey: string;
  sourceManifestId: string;
  sourcePackageHash: string;
  foundationId: string;
  foundationHash: string;
  runtimeRevisionId: string;
  semanticHash: string;
  publicationAuthority: typeof NOT_GRANTED;
}>;

export type RuntimeAuthorityCurrentnessEvidence = Readonly<{
  state: RuntimeAuthorityCurrentnessState;
  runtimeRevisionId?: string;
  semanticHash?: string;
  evidenceId?: string;
}>;

export type RuntimeAuthorityBindingResult = Readonly<{
  valid: boolean;
  mismatches: readonly (keyof RuntimeAuthoritySubject)[];
}>;

export type RuntimeAuthorityCurrentnessResolver = Readonly<{
  resolveCurrentness: (
    subject: RuntimeAuthoritySubject,
  ) => RuntimeAuthorityCurrentnessEvidence | null | Promise<RuntimeAuthorityCurrentnessEvidence | null>;
}>;

export type RuntimeAuthorityLifecycleState = "APPROVED_ACTIVE" | "SUPERSEDED" | "REVOKED";

export type RuntimeAuthorityLifecycleResolver = Readonly<{
  resolveLifecycle: (
    subject: RuntimeAuthoritySubject,
    authorityId: string,
  ) => RuntimeAuthorityLifecycleState | null | Promise<RuntimeAuthorityLifecycleState | null>;
}>;

export type RuntimeAuthorityGateInput = Readonly<{
  expectedSubject: RuntimeAuthoritySubject | null | undefined;
  resolvedSubject: RuntimeAuthoritySubject | null | undefined;
  authorityId: string | null | undefined;
  currentnessResolver: RuntimeAuthorityCurrentnessResolver;
  lifecycleResolver: RuntimeAuthorityLifecycleResolver;
}>;

const SUBJECT_KEYS = [
  "contractVersion",
  "registrationPurpose",
  "courseId",
  "courseSlug",
  "packageKey",
  "sourceManifestId",
  "sourcePackageHash",
  "foundationId",
  "foundationHash",
  "runtimeRevisionId",
  "semanticHash",
  "publicationAuthority",
] as const satisfies readonly (keyof RuntimeAuthoritySubject)[];

const HASH_FIELDS = ["sourcePackageHash", "foundationHash", "semanticHash"] as const;
const SUBJECT_METADATA_KEYS = ["actorId", "auditId", "requestId", "idempotencyKey"] as const;

function fail(code: RuntimeAuthorityFailureCode, message: string, status: number): never {
  throw new AppError(message, status, code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isStrictIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function subjectProjection(subject: RuntimeAuthoritySubject): Record<string, unknown> {
  return {
    contractVersion: subject.contractVersion,
    registrationPurpose: subject.registrationPurpose,
    courseId: subject.courseId,
    courseSlug: subject.courseSlug,
    packageKey: subject.packageKey,
    sourceManifestId: subject.sourceManifestId,
    sourcePackageHash: subject.sourcePackageHash,
    foundationId: subject.foundationId,
    foundationHash: subject.foundationHash,
    runtimeRevisionId: subject.runtimeRevisionId,
    semanticHash: subject.semanticHash,
    publicationAuthority: subject.publicationAuthority,
  };
}

function subjectIssues(value: unknown, requireExactKeys = true): string[] {
  if (!isRecord(value)) return ["subject must be an object"];
  try {
    const issues: string[] = [];
    if (Object.getPrototypeOf(value) !== Object.prototype) issues.push("subject prototype is not the expected plain-object prototype");
    const ownKeys = Reflect.ownKeys(value);
    const stringKeys = ownKeys.filter((key): key is string => typeof key === "string");
    const symbolKeys = ownKeys.filter((key) => typeof key === "symbol");
    const expectedSubjectKeys = [...SUBJECT_KEYS].sort();
    const allowedKeys = [...SUBJECT_KEYS, ...(!requireExactKeys ? SUBJECT_METADATA_KEYS : [])].sort();
    const actualKeys = [...stringKeys].sort();
    if (symbolKeys.length > 0) issues.push("subject cannot contain Symbol keys");
    const unknownKeys = actualKeys.filter((key) => !allowedKeys.includes(key as (typeof allowedKeys)[number]));
    const missingSubjectKeys = SUBJECT_KEYS.filter((key) => !actualKeys.includes(key));
    if (unknownKeys.length > 0 || missingSubjectKeys.length > 0 || (requireExactKeys && actualKeys.join("\u0000") !== expectedSubjectKeys.join("\u0000"))) issues.push("subject keys are not exact");
    for (const key of SUBJECT_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) issues.push(`${key} must be an enumerable own data property`);
    }
    if (!requireExactKeys) {
      for (const key of SUBJECT_METADATA_KEYS) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && (!descriptor.enumerable || !("value" in descriptor))) issues.push(`${key} must be an enumerable own data property when present`);
        if (descriptor && !isStrictIdentifier(value[key])) issues.push(`${key} must be a non-empty identifier when present`);
      }
    }
    if (value.contractVersion !== RUNTIME_AUTHORITY_SUBJECT_CONTRACT_V1) issues.push("contract version is unsupported");
    if (value.registrationPurpose !== COURSE_THEORY_DRAFT) issues.push("registration purpose is unsupported");
    if (value.publicationAuthority !== NOT_GRANTED) issues.push("publication authority must be NOT_GRANTED");
    for (const key of ["courseId", "courseSlug", "packageKey", "sourceManifestId", "foundationId", "runtimeRevisionId"] as const) {
      if (!isStrictIdentifier(value[key])) issues.push(`${key} must be a non-empty identifier`);
    }
    for (const key of HASH_FIELDS) {
      if (!isSha256(value[key])) issues.push(`${key} must be a lowercase SHA-256 hash`);
    }
    return issues;
  } catch {
    return ["subject shape cannot be inspected"];
  }
}

function hasOnlyPublicationBoundaryIssue(value: unknown): boolean {
  const issues = subjectIssues(value);
  return issues.length === 1 && issues[0] === "publication authority must be NOT_GRANTED";
}

function isBindingShapeReady(value: unknown): boolean {
  const issues = subjectIssues(value);
  return issues.length === 0 || (issues.length === 1 && hasOnlyPublicationBoundaryIssue(value));
}

export function normalizeRuntimeAuthoritySubject(input: RuntimeAuthoritySubject): RuntimeAuthoritySubject {
  const issues = subjectIssues(input);
  if (issues.length > 0) fail("APPROVAL_BINDING_MISMATCH", `Runtime authority subject is invalid: ${issues.join("; ")}`, 409);
  return Object.freeze({
    contractVersion: input.contractVersion,
    registrationPurpose: input.registrationPurpose,
    courseId: input.courseId,
    courseSlug: input.courseSlug,
    packageKey: input.packageKey,
    sourceManifestId: input.sourceManifestId,
    sourcePackageHash: input.sourcePackageHash,
    foundationId: input.foundationId,
    foundationHash: input.foundationHash,
    runtimeRevisionId: input.runtimeRevisionId,
    semanticHash: input.semanticHash,
    publicationAuthority: input.publicationAuthority,
  });
}

/** Canonical field projection intentionally excludes actor, audit, request, and idempotency metadata. */
export function canonicalRuntimeAuthoritySubject(subject: RuntimeAuthoritySubject): string {
  const issues = subjectIssues(subject, false);
  if (issues.length > 0) fail("APPROVAL_BINDING_MISMATCH", `Runtime authority subject is invalid: ${issues.join("; ")}`, 409);
  return stableCanonicalJson(subjectProjection(subject));
}

export function approvalSubjectHash(subject: RuntimeAuthoritySubject): string {
  return createHash("sha256").update(canonicalRuntimeAuthoritySubject(subject), "utf8").digest("hex");
}

export const computeApprovalSubjectHash = approvalSubjectHash;

export function compareRuntimeAuthorityBinding(
  expected: RuntimeAuthoritySubject | null | undefined,
  resolved: RuntimeAuthoritySubject | null | undefined,
): RuntimeAuthorityBindingResult {
  if (!expected || !resolved) return { valid: false, mismatches: [...SUBJECT_KEYS] };
  const malformed = subjectIssues(expected).length > 0 || subjectIssues(resolved).length > 0;
  const mismatches = SUBJECT_KEYS.filter((key) => expected[key] !== resolved[key]);
  if (malformed && mismatches.length === 0) return { valid: false, mismatches: [...SUBJECT_KEYS] };
  return { valid: mismatches.length === 0, mismatches };
}

export function assertRuntimeAuthorityBinding(
  expected: RuntimeAuthoritySubject | null | undefined,
  resolved: RuntimeAuthoritySubject | null | undefined,
): void {
  if (!expected || !resolved) fail("APPROVAL_BINDING_UNAVAILABLE", "Runtime authority binding is unavailable.", 503);
  const expectedSubject = normalizeRuntimeAuthoritySubject(expected);
  const resolvedSubject = normalizeRuntimeAuthoritySubject(resolved);
  const result = compareRuntimeAuthorityBinding(expectedSubject, resolvedSubject);
  if (!result.valid) fail("APPROVAL_BINDING_MISMATCH", `Runtime authority binding mismatch: ${result.mismatches.join(", ")}.`, 409);
}

export function assertPublicationAuthorityBoundary(value: unknown): void {
  if (!isRecord(value) || value.publicationAuthority !== NOT_GRANTED) {
    fail("PUBLICATION_AUTHORITY_FORBIDDEN", "Publication authority is forbidden in Phase 1.", 403);
  }
}

export function assertCurrentRuntimeAuthorityEvidence(
  subject: RuntimeAuthoritySubject,
  evidence: RuntimeAuthorityCurrentnessEvidence | null | undefined,
): void {
  if (!isRecord(evidence) || typeof evidence.state !== "string") {
    fail("CURRENTNESS_UNAVAILABLE", "Explicit CURRENT currentness evidence is unavailable.", 503);
  }
  if (evidence.state === "UNKNOWN" || evidence.state === "REVIEW_REQUIRED") {
    fail("CURRENTNESS_UNAVAILABLE", "Explicit CURRENT currentness evidence is unavailable.", 503);
  }
  if (!RUNTIME_AUTHORITY_CURRENTNESS_STATES.includes(evidence.state as RuntimeAuthorityCurrentnessState)) {
    fail("CURRENTNESS_UNAVAILABLE", "Currentness evidence contains an unknown state.", 503);
  }
  if (evidence.state !== "CURRENT") {
    fail("CURRENTNESS_STALE", `Runtime authority currentness is ${evidence.state}.`, 409);
  }
  if (!isStrictIdentifier(evidence.runtimeRevisionId) || !isSha256(evidence.semanticHash)) {
    fail("CURRENTNESS_UNAVAILABLE", "CURRENT evidence must bind a runtime revision and semantic hash.", 503);
  }
  if (evidence.runtimeRevisionId !== subject.runtimeRevisionId) {
    fail("CURRENTNESS_STALE", "Currentness evidence is bound to a different runtime revision.", 409);
  }
  if (evidence.semanticHash !== subject.semanticHash) {
    fail("CURRENTNESS_STALE", "Currentness evidence is bound to a different semantic hash.", 409);
  }
}

export async function assertRuntimeAuthorityGate(input: RuntimeAuthorityGateInput): Promise<void> {
  if (!input.expectedSubject || !input.resolvedSubject) {
    assertRuntimeAuthorityBinding(input.expectedSubject, input.resolvedSubject);
  }
  if (!isBindingShapeReady(input.expectedSubject) || !isBindingShapeReady(input.resolvedSubject)) assertRuntimeAuthorityBinding(input.expectedSubject, input.resolvedSubject);
  assertPublicationAuthorityBoundary(input.expectedSubject);
  assertPublicationAuthorityBoundary(input.resolvedSubject);
  assertRuntimeAuthorityBinding(input.expectedSubject, input.resolvedSubject);
  const subject = normalizeRuntimeAuthoritySubject(input.expectedSubject as RuntimeAuthoritySubject);
  let evidence: RuntimeAuthorityCurrentnessEvidence | null;
  try {
    evidence = await input.currentnessResolver.resolveCurrentness(subject);
  } catch {
    fail("CURRENTNESS_UNAVAILABLE", "Runtime authority currentness could not be resolved.", 503);
  }
  assertCurrentRuntimeAuthorityEvidence(subject, evidence);

  if (!isStrictIdentifier(input.authorityId)) {
    fail("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Runtime authority identity is unavailable.", 503);
  }
  let lifecycle: RuntimeAuthorityLifecycleState | null;
  try {
    lifecycle = await input.lifecycleResolver.resolveLifecycle(subject, input.authorityId);
  } catch {
    fail("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Runtime authority lifecycle could not be resolved.", 503);
  }
  if (lifecycle === null) fail("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Runtime authority lifecycle is unavailable.", 503);
  if (lifecycle === "REVOKED") fail("AUTHORITY_REVOKED", "Runtime authority has been revoked.", 409);
  if (lifecycle === "SUPERSEDED") fail("AUTHORITY_SUPERSEDED", "Runtime authority has been superseded.", 409);
  if (lifecycle !== "APPROVED_ACTIVE") fail("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Runtime authority lifecycle is not explicitly active.", 503);
}
