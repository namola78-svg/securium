import type {
  AuthorityClass as SharedAuthorityClass,
  AuthenticationState as SharedAuthenticationState,
  BindingRole as SharedBindingRole,
  CopyrightReviewState as SharedCopyrightReviewState,
  IndependenceState as SharedIndependenceState,
  SourceLocator,
  UsageClass as SharedUsageClass,
} from "./source-taxonomy.ts";
export const ISMS_P_SOURCE_BINDING_VERSION = "isms-p-source-foundation-v2" as const;

export const ISMS_P_ORIGINAL_SOURCE_FOUNDATION_SHA256 =
  "c0da228d73e7bcfbc697e37d7c6449e51a34a92c88a00107c0e8c0ae5c4c0daa" as const;
export const ISMS_P_COMBINED_EVIDENCE_MANIFEST_SHA256 =
  "712d6868ad2c5ddc51ab06654a5afdcb5c2dd38c693871a71e4a54c9695e1cbf" as const;
export const ISMS_P_EVIDENCE_MANIFEST_SHA256 =
  "6b405ce59586eda70dc33e95cc663cee1ca0d20b7831e12ed7efc36a52b7653b" as const;

export const SOURCE_AUTHORITY_CLASSES = [
  "OFFICIAL_PUBLIC",
  "OFFICIAL_RESTRICTED_OR_UNKNOWN",
  "PUBLIC_REFERENCE",
  "SUPPLEMENTAL_REFERENCE",
  "COMMERCIAL_REFERENCE",
  "USER_PRESERVED",
  "UNKNOWN",
] as const;

export const SOURCE_USAGE_CLASSES = [
  "CAN_USE_AS_AUTHORITY",
  "CAN_REFERENCE",
  "CAN_QUOTE_LIMITED_IF_ALLOWED",
  "REFERENCE_ONLY",
  "USAGE_REVIEW_REQUIRED",
  "DO_NOT_REPUBLISH",
] as const;

export const SOURCE_BINDING_ROLES = [
  "PRIMARY_AUTHORITY",
  "CURRICULUM_CONTEXT",
  "SUPPLEMENTAL_REFERENCE",
  "REQUIREMENT_REFERENCE",
] as const;

export const SOURCE_AUTHENTICATION_STATES = [
  "AUTHENTICATED",
  "ISSUER_INCOMPLETE",
  "UNVERIFIED",
] as const;

export const SOURCE_INDEPENDENCE_DECLARATIONS = [
  "UNREVIEWED",
  "DECLARED_INDEPENDENT",
  "REVIEW_REQUIRED",
  "REAUTHORING_REQUIRED",
] as const;

export const SOURCE_COPYRIGHT_REVIEW_STATES = [
  "LEGACY_REVIEW_REQUIRED",
  "RIGHTS_REVIEW_REQUIRED",
  "REVIEWED_WITH_RESTRICTIONS",
  "APPROVED_FOR_CANONICAL_USE",
  "BLOCKED",
] as const;

export const SOURCE_BINDING_REVIEW_DECISIONS = [
  "PENDING",
  "ACCEPT_BINDING",
  "REJECT_BINDING",
  "REQUIRES_CHANGES",
] as const;

export const SOURCE_CURRENTNESS_REVIEW_STATES = [
  "PENDING",
  "SUPPORTED",
  "SUPERSEDED",
  "UNRESOLVED",
] as const;

export type SourceAuthorityClass = SharedAuthorityClass;
export type SourceUsageClass = SharedUsageClass;
export type SourceBindingRole = SharedBindingRole;
export type SourceAuthenticationState = SharedAuthenticationState;
export type SourceIndependenceDeclaration = SharedIndependenceState;
export type SourceCopyrightReviewState = SharedCopyrightReviewState;
export type SourceBindingReviewDecision =
  (typeof SOURCE_BINDING_REVIEW_DECISIONS)[number];
export type SourceCurrentnessReviewState =
  (typeof SOURCE_CURRENTNESS_REVIEW_STATES)[number];

export const ISMS_P_SOURCE_BINDING_TARGETS = [
  ["course-lesson-isms-p-theory-1-1-1", "content-isms-p-theory-1-1-1", "1.1.1"],
  ["course-lesson-isms-p-theory-1-3-3", "content-isms-p-theory-1-3-3", "1.3.3"],
  ["course-lesson-isms-p-theory-2-2-2", "content-isms-p-theory-2-2-2", "2.2.2"],
  ["course-lesson-isms-p-theory-2-2-6", "content-isms-p-theory-2-2-6", "2.2.6"],
  ["course-lesson-isms-p-theory-2-4-1", "content-isms-p-theory-2-4-1", "2.4.1"],
  ["course-lesson-isms-p-theory-2-4-2", "content-isms-p-theory-2-4-2", "2.4.2"],
  ["course-lesson-isms-p-theory-2-4-3", "content-isms-p-theory-2-4-3", "2.4.3"],
  ["course-lesson-isms-p-theory-2-5-1", "content-isms-p-theory-2-5-1", "2.5.1"],
  ["course-lesson-isms-p-theory-2-5-2", "content-isms-p-theory-2-5-2", "2.5.2"],
  ["course-lesson-isms-p-theory-2-6-1", "content-isms-p-theory-2-6-1", "2.6.1"],
  ["course-lesson-isms-p-theory-2-8-3", "content-isms-p-theory-2-8-3", "2.8.3"],
  ["course-lesson-isms-p-theory-2-9-2", "content-isms-p-theory-2-9-2", "2.9.2"],
] as const;

export const ISMS_P_AUTHENTICATED_SOURCE_DOCUMENTS = {
  "isms-p-certification-criteria-guide-2023-11-23": {
    sourceSha256: "79144a8a28a9942facfc7d8dfa87171ee9cd0e35a91fd64a06e7cf67adf5a622",
    sourceTitle: "ISMS-P 인증기준 안내서(2023.11.23).pdf",
    sourceVersion: "2023.11.23",
    authenticationState: "AUTHENTICATED",
    allowedBindingRoles: ["PRIMARY_AUTHORITY", "REQUIREMENT_REFERENCE"],
  },
  "isms-p-certification-system-guide-2024-07": {
    sourceSha256: "e7ba3e97fc3ff29aa53d924316a01f313a115ec416d1741add374f50cf92a548",
    sourceTitle: "ISMS-P 인증제도 안내서(2024.07).pdf",
    sourceVersion: "2024.07",
    authenticationState: "AUTHENTICATED",
    allowedBindingRoles: ["CURRICULUM_CONTEXT", "SUPPLEMENTAL_REFERENCE"],
  },
} as const satisfies Record<
  string,
  {
    sourceSha256: string;
    sourceTitle: string;
    sourceVersion: string;
    authenticationState: SourceAuthenticationState;
    allowedBindingRoles: readonly SourceBindingRole[];
  }
>;

export type IsmsPSourceScopeLocator = Omit<
  Extract<SourceLocator, { kind: "criterion" }>,
  "kind"
>;

export type IsmsPSourceBinding = Readonly<{
  lessonId: string;
  contentId: string;
  criterionId: string;
  sourceDocumentId: string;
  sourceSha256: string;
  sourceTitle: string;
  sourceVersion: string;
  sourcePublishedAt: string | null;
  sourceEffectiveFrom: string | null;
  sourceEffectiveTo: string | null;
  evidenceManifestSha256: string;
  bindingRole: SourceBindingRole;
  sourceAuthenticationState: SourceAuthenticationState;
  scopeLocator: IsmsPSourceScopeLocator;
  authorityClass: SourceAuthorityClass;
  usageClass: readonly SourceUsageClass[];
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewDecision: SourceBindingReviewDecision;
  independenceDeclaration: SourceIndependenceDeclaration;
  copyrightReviewState: SourceCopyrightReviewState;
  currentnessReviewState: SourceCurrentnessReviewState;
  bindingVersion: typeof ISMS_P_SOURCE_BINDING_VERSION;
  sourcePath?: string | null;
}>;

export const ISMS_P_SOURCE_BINDING_REQUIRED_FIELDS = [
  "lessonId",
  "contentId",
  "criterionId",
  "sourceDocumentId",
  "sourceSha256",
  "sourceTitle",
  "sourceVersion",
  "sourcePublishedAt",
  "sourceEffectiveFrom",
  "sourceEffectiveTo",
  "evidenceManifestSha256",
  "bindingRole",
  "sourceAuthenticationState",
  "scopeLocator",
  "authorityClass",
  "usageClass",
  "reviewerId",
  "reviewedAt",
  "reviewDecision",
  "independenceDeclaration",
  "copyrightReviewState",
  "currentnessReviewState",
  "bindingVersion",
] as const satisfies readonly (keyof IsmsPSourceBinding)[];

export const ISMS_P_SOURCE_BINDING_IMMUTABLE_IDENTITY_FIELDS = [
  "lessonId",
  "contentId",
  "criterionId",
  "sourceSha256",
  "evidenceManifestSha256",
  "bindingVersion",
] as const satisfies readonly (keyof IsmsPSourceBinding)[];

export const ISMS_P_SOURCE_BINDING_ERROR_CODES = [
  "BINDING_LESSON_ID_MISSING",
  "BINDING_CONTENT_ID_MISSING",
  "BINDING_CRITERION_ID_MISSING",
  "BINDING_TARGET_NOT_APPROVED",
  "BINDING_TARGET_IDENTITY_INCONSISTENT",
  "SOURCE_DOCUMENT_ID_MISSING",
  "SOURCE_SHA_INVALID",
  "SOURCE_IDENTITY_INCONSISTENT",
  "EVIDENCE_MANIFEST_SHA_INVALID",
  "EVIDENCE_MANIFEST_IDENTITY_MISMATCH",
  "SOURCE_TITLE_MISSING",
  "SOURCE_VERSION_MISSING",
  "SOURCE_DATE_INVALID",
  "SOURCE_AUTHORITY_UNCLASSIFIED",
  "SOURCE_USAGE_UNCLASSIFIED",
  "SOURCE_USAGE_DUPLICATE",
  "SOURCE_SCOPE_LOCATOR_MISSING",
  "SOURCE_SCOPE_LOCATOR_INVALID",
  "SOURCE_SCOPE_CRITERION_MISMATCH",
  "BINDING_ROLE_MISSING",
  "SOURCE_AUTHENTICATION_STATE_MISSING",
  "PRIMARY_SOURCE_AUTHENTICATION_INCOMPLETE",
  "BINDING_VERSION_INVALID",
  "REVIEW_DECISION_MISSING",
  "REVIEWER_MISSING",
  "REVIEW_TIMESTAMP_MISSING",
  "REVIEW_TIMESTAMP_INVALID",
  "INDEPENDENCE_DECLARATION_MISSING",
  "COPYRIGHT_REVIEW_STATE_MISSING",
  "CURRENTNESS_REVIEW_STATE_MISSING",
  "BINDING_IDENTITY_MUTATED",
] as const;

export const ISMS_P_SOURCE_BINDING_WARNING_CODES = [
  "BINDING_REVIEW_PENDING",
  "RIGHTS_REVIEW_PENDING",
  "INDEPENDENCE_REVIEW_PENDING",
  "CURRENTNESS_REVIEW_PENDING",
  "SOURCE_PATH_NOT_IDENTITY",
  "SOURCE_TITLE_DESCRIPTOR_MISMATCH",
] as const;

export type IsmsPSourceBindingErrorCode =
  (typeof ISMS_P_SOURCE_BINDING_ERROR_CODES)[number];
export type IsmsPSourceBindingWarningCode =
  (typeof ISMS_P_SOURCE_BINDING_WARNING_CODES)[number];

export type IsmsPSourceBindingIssue<Code extends string> = Readonly<{
  code: Code;
  field: string;
}>;

export type IsmsPSourceBindingValidationResult = Readonly<{
  valid: boolean;
  accepted: boolean;
  errors: readonly IsmsPSourceBindingIssue<IsmsPSourceBindingErrorCode>[];
  warnings: readonly IsmsPSourceBindingIssue<IsmsPSourceBindingWarningCode>[];
}>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SOURCE_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isMember<const Values extends readonly string[]>(
  values: Values,
  value: unknown,
): value is Values[number] {
  return typeof value === "string" && values.includes(value);
}

function isNullableSourceDate(value: unknown) {
  return value === null || (typeof value === "string" && SOURCE_DATE_PATTERN.test(value));
}

function addError(
  errors: IsmsPSourceBindingIssue<IsmsPSourceBindingErrorCode>[],
  code: IsmsPSourceBindingErrorCode,
  field: string,
) {
  errors.push({ code, field });
}

function addWarning(
  warnings: IsmsPSourceBindingIssue<IsmsPSourceBindingWarningCode>[],
  code: IsmsPSourceBindingWarningCode,
  field: string,
) {
  warnings.push({ code, field });
}

export function validateIsmsPSourceBinding(input: unknown): IsmsPSourceBindingValidationResult {
  const errors: IsmsPSourceBindingIssue<IsmsPSourceBindingErrorCode>[] = [];
  const warnings: IsmsPSourceBindingIssue<IsmsPSourceBindingWarningCode>[] = [];

  if (!isRecord(input)) {
    addError(errors, "BINDING_LESSON_ID_MISSING", "lessonId");
    addError(errors, "BINDING_CONTENT_ID_MISSING", "contentId");
    addError(errors, "BINDING_CRITERION_ID_MISSING", "criterionId");
    return Object.freeze({ valid: false, accepted: false, errors: Object.freeze(errors), warnings: Object.freeze(warnings) });
  }

  if (!isNonEmptyString(input.lessonId)) addError(errors, "BINDING_LESSON_ID_MISSING", "lessonId");
  if (!isNonEmptyString(input.contentId)) addError(errors, "BINDING_CONTENT_ID_MISSING", "contentId");
  if (!isNonEmptyString(input.criterionId)) addError(errors, "BINDING_CRITERION_ID_MISSING", "criterionId");

  const target = ISMS_P_SOURCE_BINDING_TARGETS.find(([lessonId]) => lessonId === input.lessonId);
  if (isNonEmptyString(input.lessonId) && !target) {
    addError(errors, "BINDING_TARGET_NOT_APPROVED", "lessonId");
  } else if (
    target &&
    (input.contentId !== target[1] || input.criterionId !== target[2])
  ) {
    addError(errors, "BINDING_TARGET_IDENTITY_INCONSISTENT", "contentId/criterionId");
  }

  if (!isNonEmptyString(input.sourceDocumentId)) {
    addError(errors, "SOURCE_DOCUMENT_ID_MISSING", "sourceDocumentId");
  }
  if (typeof input.sourceSha256 !== "string" || !SHA256_PATTERN.test(input.sourceSha256)) {
    addError(errors, "SOURCE_SHA_INVALID", "sourceSha256");
  }
  if (
    typeof input.evidenceManifestSha256 !== "string" ||
    !SHA256_PATTERN.test(input.evidenceManifestSha256)
  ) {
    addError(errors, "EVIDENCE_MANIFEST_SHA_INVALID", "evidenceManifestSha256");
  } else if (input.evidenceManifestSha256 !== ISMS_P_EVIDENCE_MANIFEST_SHA256) {
    addError(errors, "EVIDENCE_MANIFEST_IDENTITY_MISMATCH", "evidenceManifestSha256");
  }
  if (!isNonEmptyString(input.sourceTitle)) addError(errors, "SOURCE_TITLE_MISSING", "sourceTitle");
  if (!isNonEmptyString(input.sourceVersion)) addError(errors, "SOURCE_VERSION_MISSING", "sourceVersion");

  for (const field of ["sourcePublishedAt", "sourceEffectiveFrom", "sourceEffectiveTo"] as const) {
    if (!(field in input) || !isNullableSourceDate(input[field])) {
      addError(errors, "SOURCE_DATE_INVALID", field);
    }
  }

  if (!isMember(SOURCE_BINDING_ROLES, input.bindingRole)) {
    addError(errors, "BINDING_ROLE_MISSING", "bindingRole");
  }
  if (!isMember(SOURCE_AUTHENTICATION_STATES, input.sourceAuthenticationState)) {
    addError(errors, "SOURCE_AUTHENTICATION_STATE_MISSING", "sourceAuthenticationState");
  }
  if (
    input.bindingRole === "PRIMARY_AUTHORITY" &&
    input.sourceAuthenticationState !== "AUTHENTICATED"
  ) {
    addError(errors, "PRIMARY_SOURCE_AUTHENTICATION_INCOMPLETE", "sourceAuthenticationState");
  }

  if (!isMember(SOURCE_AUTHORITY_CLASSES, input.authorityClass) || input.authorityClass === "UNKNOWN") {
    addError(errors, "SOURCE_AUTHORITY_UNCLASSIFIED", "authorityClass");
  }
  if (!Array.isArray(input.usageClass) || input.usageClass.length === 0) {
    addError(errors, "SOURCE_USAGE_UNCLASSIFIED", "usageClass");
  } else {
    if (input.usageClass.some((value) => !isMember(SOURCE_USAGE_CLASSES, value))) {
      addError(errors, "SOURCE_USAGE_UNCLASSIFIED", "usageClass");
    }
    if (new Set(input.usageClass).size !== input.usageClass.length) {
      addError(errors, "SOURCE_USAGE_DUPLICATE", "usageClass");
    }
  }

  if (!isRecord(input.scopeLocator)) {
    addError(errors, "SOURCE_SCOPE_LOCATOR_MISSING", "scopeLocator");
  } else {
    const locator = input.scopeLocator;
    const validLocator =
      isNonEmptyString(locator.criterionId) &&
      isNonEmptyString(locator.sectionHeading) &&
      Number.isInteger(locator.pageStart) &&
      Number.isInteger(locator.pageEnd) &&
      Number(locator.pageStart) > 0 &&
      Number(locator.pageEnd) >= Number(locator.pageStart) &&
      (locator.documentSubheading === null || typeof locator.documentSubheading === "string");
    if (!validLocator) addError(errors, "SOURCE_SCOPE_LOCATOR_INVALID", "scopeLocator");
    if (locator.criterionId !== input.criterionId) {
      addError(errors, "SOURCE_SCOPE_CRITERION_MISMATCH", "scopeLocator.criterionId");
    }
  }

  if (input.bindingVersion !== ISMS_P_SOURCE_BINDING_VERSION) {
    addError(errors, "BINDING_VERSION_INVALID", "bindingVersion");
  }
  if (!isMember(SOURCE_BINDING_REVIEW_DECISIONS, input.reviewDecision)) {
    addError(errors, "REVIEW_DECISION_MISSING", "reviewDecision");
  }
  if (!isMember(SOURCE_INDEPENDENCE_DECLARATIONS, input.independenceDeclaration)) {
    addError(errors, "INDEPENDENCE_DECLARATION_MISSING", "independenceDeclaration");
  }
  if (!isMember(SOURCE_COPYRIGHT_REVIEW_STATES, input.copyrightReviewState)) {
    addError(errors, "COPYRIGHT_REVIEW_STATE_MISSING", "copyrightReviewState");
  }
  if (!isMember(SOURCE_CURRENTNESS_REVIEW_STATES, input.currentnessReviewState)) {
    addError(errors, "CURRENTNESS_REVIEW_STATE_MISSING", "currentnessReviewState");
  }

  if (input.reviewDecision !== "PENDING" && isMember(SOURCE_BINDING_REVIEW_DECISIONS, input.reviewDecision)) {
    if (!isNonEmptyString(input.reviewerId)) addError(errors, "REVIEWER_MISSING", "reviewerId");
    if (!isNonEmptyString(input.reviewedAt)) {
      addError(errors, "REVIEW_TIMESTAMP_MISSING", "reviewedAt");
    } else if (Number.isNaN(Date.parse(input.reviewedAt))) {
      addError(errors, "REVIEW_TIMESTAMP_INVALID", "reviewedAt");
    }
  }

  const sourceDescriptor = isNonEmptyString(input.sourceDocumentId)
    ? ISMS_P_AUTHENTICATED_SOURCE_DOCUMENTS[
        input.sourceDocumentId as keyof typeof ISMS_P_AUTHENTICATED_SOURCE_DOCUMENTS
      ]
    : undefined;
  if (!sourceDescriptor) {
    if (isNonEmptyString(input.sourceDocumentId)) {
      addError(errors, "SOURCE_IDENTITY_INCONSISTENT", "sourceDocumentId");
    }
  } else {
    if (
      input.sourceSha256 !== sourceDescriptor.sourceSha256 ||
      input.sourceVersion !== sourceDescriptor.sourceVersion ||
      input.sourceAuthenticationState !== sourceDescriptor.authenticationState ||
      !sourceDescriptor.allowedBindingRoles.some((role) => role === input.bindingRole)
    ) {
      addError(errors, "SOURCE_IDENTITY_INCONSISTENT", "sourceDocumentId/sourceSha256/sourceVersion/bindingRole");
    }
    if (isNonEmptyString(input.sourceTitle) && input.sourceTitle !== sourceDescriptor.sourceTitle) {
      addWarning(warnings, "SOURCE_TITLE_DESCRIPTOR_MISMATCH", "sourceTitle");
    }
  }

  if (input.reviewDecision === "PENDING") addWarning(warnings, "BINDING_REVIEW_PENDING", "reviewDecision");
  if (
    input.copyrightReviewState === "LEGACY_REVIEW_REQUIRED" ||
    input.copyrightReviewState === "RIGHTS_REVIEW_REQUIRED"
  ) {
    addWarning(warnings, "RIGHTS_REVIEW_PENDING", "copyrightReviewState");
  }
  if (
    input.independenceDeclaration === "UNREVIEWED" ||
    input.independenceDeclaration === "REVIEW_REQUIRED" ||
    input.independenceDeclaration === "REAUTHORING_REQUIRED"
  ) {
    addWarning(warnings, "INDEPENDENCE_REVIEW_PENDING", "independenceDeclaration");
  }
  if (input.currentnessReviewState === "PENDING" || input.currentnessReviewState === "UNRESOLVED") {
    addWarning(warnings, "CURRENTNESS_REVIEW_PENDING", "currentnessReviewState");
  }
  if (isNonEmptyString(input.sourcePath)) addWarning(warnings, "SOURCE_PATH_NOT_IDENTITY", "sourcePath");

  const valid = errors.length === 0;
  const accepted = valid && input.reviewDecision === "ACCEPT_BINDING";
  return Object.freeze({
    valid,
    accepted,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
  });
}

export function getIsmsPSourceBindingImmutableIdentity(binding: IsmsPSourceBinding) {
  return Object.freeze({
    lessonId: binding.lessonId,
    contentId: binding.contentId,
    criterionId: binding.criterionId,
    sourceSha256: binding.sourceSha256,
    evidenceManifestSha256: binding.evidenceManifestSha256,
    bindingVersion: binding.bindingVersion,
  });
}

export function compareIsmsPSourceBindingImmutableIdentity(
  accepted: IsmsPSourceBinding,
  candidate: IsmsPSourceBinding,
) {
  const acceptedIdentity = getIsmsPSourceBindingImmutableIdentity(accepted);
  const candidateIdentity = getIsmsPSourceBindingImmutableIdentity(candidate);
  const changedFields = ISMS_P_SOURCE_BINDING_IMMUTABLE_IDENTITY_FIELDS.filter(
    (field) => acceptedIdentity[field] !== candidateIdentity[field],
  );
  return Object.freeze({
    matches: changedFields.length === 0,
    changedFields: Object.freeze(changedFields),
    errors: Object.freeze(
      changedFields.map((field) => ({
        code: "BINDING_IDENTITY_MUTATED" as const,
        field,
      })),
    ),
  });
}

export function createImmutableIsmsPSourceBinding(input: IsmsPSourceBinding) {
  const validation = validateIsmsPSourceBinding(input);
  if (!validation.valid) {
    throw new Error(`Invalid ISMS-P source binding: ${validation.errors.map(({ code }) => code).join(",")}`);
  }
  const immutable = {
    ...input,
    scopeLocator: Object.freeze({ ...input.scopeLocator }),
    usageClass: Object.freeze([...input.usageClass]),
  };
  return Object.freeze(immutable) as IsmsPSourceBinding;
}
