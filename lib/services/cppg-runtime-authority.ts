import {
  COURSE_THEORY_DRAFT,
  NOT_GRANTED,
  RUNTIME_AUTHORITY_SUBJECT_CONTRACT_V1,
  approvalSubjectHash,
  normalizeRuntimeAuthoritySubject,
  type RuntimeAuthoritySubject,
} from "../policy/runtime-authority-binding.ts";

export const CPPG_COURSE_ID = "course-cppg" as const;
export const CPPG_COURSE_SLUG = "cppg" as const;
export const CPPG_PACKAGE_IDENTITY = "SECURIUM_CPPG_FOUNDATION" as const;

export type CppgAuthorityBuildResult = Readonly<{
  subject: RuntimeAuthoritySubject;
  approvalSubjectHash: string;
}>;

type CppgCanonicalAuthorityMaterial = Readonly<{
  packageKey: string;
  sourceManifestId: string;
  sourcePackageHash: string;
  foundationId: string;
  foundationHash: string;
  runtimeRevisionId: string;
  semanticHash: string;
}>;

/*
 * Phase 1 has no database or approval writer. This immutable module-owned
 * projection is the temporary canonical CPPG source boundary; the later
 * repository adapter may replace its implementation without changing the
 * subject contract or its production entrypoint.
 */
const CPPG_CANONICAL_AUTHORITY_MATERIAL: CppgCanonicalAuthorityMaterial = Object.freeze({
  packageKey: "securium-cppg-foundation",
  sourceManifestId: "SECURIUM_CPPG_FOUNDATION_SOURCE_SHA256_V1",
  sourcePackageHash: "a".repeat(64),
  foundationId: "SECURIUM_CPPG_FOUNDATION_V1",
  foundationHash: "b".repeat(64),
  runtimeRevisionId: "cppg-runtime-revision-1",
  semanticHash: "c".repeat(64),
});

function loadCanonicalCppgAuthorityMaterial(): CppgCanonicalAuthorityMaterial {
  return CPPG_CANONICAL_AUTHORITY_MATERIAL;
}

const FORBIDDEN_CALLER_AUTHORITY_KEYS = new Set([
  "bundle",
  "sourceRoot",
  "courseId",
  "courseSlug",
  "packageKey",
  "packageHash",
  "sourceManifestId",
  "sourcePackageHash",
  "foundationId",
  "foundationHash",
  "revisionId",
  "runtimeRevisionId",
  "semanticHash",
  "registrationPurpose",
  "publicationAuthority",
  "approved",
  "approval",
  "currentness",
  "revocation",
  "supersession",
  "authorityId",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildSubjectFromCanonicalMaterial(material: CppgCanonicalAuthorityMaterial): CppgAuthorityBuildResult {
  const subject = normalizeRuntimeAuthoritySubject({
    contractVersion: RUNTIME_AUTHORITY_SUBJECT_CONTRACT_V1,
    registrationPurpose: COURSE_THEORY_DRAFT,
    courseId: CPPG_COURSE_ID,
    courseSlug: CPPG_COURSE_SLUG,
    packageKey: material.packageKey,
    sourceManifestId: material.sourceManifestId,
    sourcePackageHash: material.sourcePackageHash,
    foundationId: material.foundationId,
    foundationHash: material.foundationHash,
    runtimeRevisionId: material.runtimeRevisionId,
    semanticHash: material.semanticHash,
    publicationAuthority: NOT_GRANTED,
  });
  return Object.freeze({ subject, approvalSubjectHash: approvalSubjectHash(subject) });
}

/** Reject request/test-shaped authority claims before any authority path is reached. */
export function assertNoCallerAuthorityInjection(input: unknown): void {
  const visited = new WeakSet<object>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      if (visited.has(value)) return;
      visited.add(value);
      for (const item of value) visit(item);
      return;
    }
    if (!isRecord(value)) return;
    if (visited.has(value)) return;
    visited.add(value);
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_CALLER_AUTHORITY_KEYS.has(key)) throw new Error(`CPPG_CALLER_AUTHORITY_FIELD_FORBIDDEN:${key}`);
      visit(nested);
    }
  };
  visit(input);
}

/**
 * Production-facing CPPG subject construction has no material authority input.
 * Extra runtime arguments are rejected so JavaScript callers cannot bypass the
 * TypeScript signature with a valid-shaped authority object.
 */
export function buildCppgRuntimeAuthoritySubject(): CppgAuthorityBuildResult;
export function buildCppgRuntimeAuthoritySubject(...callerInputs: readonly unknown[]): CppgAuthorityBuildResult {
  if (callerInputs.length > 0) rejectCallerAuthorityInput(callerInputs[0]);
  return buildSubjectFromCanonicalMaterial(loadCanonicalCppgAuthorityMaterial());
}

export function rejectCallerAuthorityInput(input: unknown): never {
  assertNoCallerAuthorityInjection(input);
  throw new Error("CPPG_CALLER_AUTHORITY_INPUT_NOT_ALLOWED");
}
