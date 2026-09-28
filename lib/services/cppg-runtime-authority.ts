export const CPPG_COURSE_ID = "course-cppg" as const;
export const CPPG_COURSE_SLUG = "cppg" as const;
export const CPPG_PACKAGE_IDENTITY = "SECURIUM_CPPG_FOUNDATION" as const;

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
export function buildCppgRuntimeAuthoritySubject(...callerInputs: readonly unknown[]): never {
  if (callerInputs.length > 0) rejectCallerAuthorityInput(callerInputs[0]);
  throw new Error("CPPG_CANONICAL_PROJECTION_REQUIRED: authority subjects are derived from a source-revalidated runtime projection");
}

export function rejectCallerAuthorityInput(input: unknown): never {
  assertNoCallerAuthorityInjection(input);
  throw new Error("CPPG_CALLER_AUTHORITY_INPUT_NOT_ALLOWED");
}
