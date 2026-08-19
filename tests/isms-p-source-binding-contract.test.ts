import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { ismsPTheoryBatch1Records } from "../lib/data/isms-p-theory-batch1.mjs";
import {
  compareIsmsPSourceBindingImmutableIdentity,
  createImmutableIsmsPSourceBinding,
  ISMS_P_AUTHENTICATED_SOURCE_DOCUMENTS,
  ISMS_P_EVIDENCE_MANIFEST_SHA256,
  ISMS_P_SOURCE_BINDING_ERROR_CODES,
  ISMS_P_SOURCE_BINDING_REQUIRED_FIELDS,
  ISMS_P_SOURCE_BINDING_TARGETS,
  ISMS_P_SOURCE_BINDING_VERSION,
  type IsmsPSourceBinding,
  validateIsmsPSourceBinding,
} from "../lib/provenance/isms-p-source-binding.ts";
import type {
  AuthorityClass,
  BindingRole,
  CopyrightReviewState,
  IndependenceState,
  SourceLocator,
  UsageClass,
} from "../lib/provenance/source-taxonomy.ts";

const validBinding: IsmsPSourceBinding = {
  lessonId: "course-lesson-isms-p-theory-1-1-1",
  contentId: "content-isms-p-theory-1-1-1",
  criterionId: "1.1.1",
  sourceDocumentId: "isms-p-certification-criteria-guide-2023-11-23",
  sourceSha256: ISMS_P_AUTHENTICATED_SOURCE_DOCUMENTS[
    "isms-p-certification-criteria-guide-2023-11-23"
  ].sourceSha256,
  sourceTitle: "ISMS-P 인증기준 안내서(2023.11.23).pdf",
  sourceVersion: "2023.11.23",
  sourcePublishedAt: "2023-11-23",
  sourceEffectiveFrom: null,
  sourceEffectiveTo: null,
  evidenceManifestSha256: ISMS_P_EVIDENCE_MANIFEST_SHA256,
  bindingRole: "PRIMARY_AUTHORITY",
  sourceAuthenticationState: "AUTHENTICATED",
  scopeLocator: {
    criterionId: "1.1.1",
    sectionHeading: "경영진의 참여",
    pageStart: 14,
    pageEnd: 15,
    documentSubheading: null,
  },
  authorityClass: "OFFICIAL_PUBLIC",
  usageClass: ["CAN_USE_AS_AUTHORITY", "CAN_REFERENCE", "USAGE_REVIEW_REQUIRED", "DO_NOT_REPUBLISH"],
  reviewerId: "reviewer:source-governance",
  reviewedAt: "2026-08-18T00:00:00.000Z",
  reviewDecision: "ACCEPT_BINDING",
  independenceDeclaration: "REVIEW_REQUIRED",
  copyrightReviewState: "LEGACY_REVIEW_REQUIRED",
  currentnessReviewState: "PENDING",
  bindingVersion: ISMS_P_SOURCE_BINDING_VERSION,
  sourcePath: "local/evidence/location.pdf",
};

function errorCodes(input: unknown) {
  return validateIsmsPSourceBinding(input).errors.map(({ code }) => code);
}

test("fully valid reviewed binding passes and remains rights-review gated", () => {
  const result = validateIsmsPSourceBinding(validBinding);
  assert.equal(result.valid, true);
  assert.equal(result.accepted, true);
  assert.equal(validBinding.copyrightReviewState, "LEGACY_REVIEW_REQUIRED");
  assert.ok(result.warnings.some(({ code }) => code === "RIGHTS_REVIEW_PENDING"));
});

test("invalid source SHA fails closed", () => {
  assert.ok(errorCodes({ ...validBinding, sourceSha256: "bad" }).includes("SOURCE_SHA_INVALID"));
});

test("invalid evidence-manifest SHA fails closed", () => {
  assert.ok(
    errorCodes({ ...validBinding, evidenceManifestSha256: "bad" }).includes(
      "EVIDENCE_MANIFEST_SHA_INVALID",
    ),
  );
});

test("valid but different evidence-manifest identity fails", () => {
  assert.ok(
    errorCodes({ ...validBinding, evidenceManifestSha256: "a".repeat(64) }).includes(
      "EVIDENCE_MANIFEST_IDENTITY_MISMATCH",
    ),
  );
});

test("missing lessonId fails", () => {
  assert.ok(errorCodes({ ...validBinding, lessonId: "" }).includes("BINDING_LESSON_ID_MISSING"));
});

test("missing contentId fails", () => {
  assert.ok(errorCodes({ ...validBinding, contentId: "" }).includes("BINDING_CONTENT_ID_MISSING"));
});

test("missing criterionId fails", () => {
  assert.ok(errorCodes({ ...validBinding, criterionId: "" }).includes("BINDING_CRITERION_ID_MISSING"));
});

test("only the exact 12 lesson/content/criterion identities are accepted", () => {
  assert.equal(ISMS_P_SOURCE_BINDING_TARGETS.length, 12);
  assert.equal(new Set(ISMS_P_SOURCE_BINDING_TARGETS.map(([id]) => id)).size, 12);
  assert.ok(
    errorCodes({ ...validBinding, contentId: "content-isms-p-theory-1-3-3" }).includes(
      "BINDING_TARGET_IDENTITY_INCONSISTENT",
    ),
  );
});

test("missing or unknown authority class fails", () => {
  assert.ok(
    errorCodes({ ...validBinding, authorityClass: "UNKNOWN" }).includes(
      "SOURCE_AUTHORITY_UNCLASSIFIED",
    ),
  );
});

test("missing usage classification fails", () => {
  assert.ok(
    errorCodes({ ...validBinding, usageClass: [] }).includes("SOURCE_USAGE_UNCLASSIFIED"),
  );
});

test("official authority never implies republication or copyright approval", () => {
  const result = validateIsmsPSourceBinding(validBinding);
  assert.equal(validBinding.authorityClass, "OFFICIAL_PUBLIC");
  assert.ok(validBinding.usageClass.includes("DO_NOT_REPUBLISH"));
  assert.notEqual(validBinding.copyrightReviewState, "APPROVED_FOR_CANONICAL_USE");
  assert.equal(result.valid, true);
});

test("missing source scope locator fails", () => {
  assert.ok(
    errorCodes({ ...validBinding, scopeLocator: null }).includes("SOURCE_SCOPE_LOCATOR_MISSING"),
  );
});

test("review-complete decision requires reviewer identity", () => {
  assert.ok(errorCodes({ ...validBinding, reviewerId: null }).includes("REVIEWER_MISSING"));
});

test("review-complete decision requires a valid timestamp", () => {
  assert.ok(errorCodes({ ...validBinding, reviewedAt: null }).includes("REVIEW_TIMESTAMP_MISSING"));
  assert.ok(
    errorCodes({ ...validBinding, reviewedAt: "not-a-date" }).includes("REVIEW_TIMESTAMP_INVALID"),
  );
});

test("pending review remains structurally valid but is not accepted", () => {
  const result = validateIsmsPSourceBinding({
    ...validBinding,
    reviewerId: null,
    reviewedAt: null,
    reviewDecision: "PENDING",
  });
  assert.equal(result.valid, true);
  assert.equal(result.accepted, false);
  assert.ok(result.warnings.some(({ code }) => code === "BINDING_REVIEW_PENDING"));
});

test("missing independence declaration fails", () => {
  assert.ok(
    errorCodes({ ...validBinding, independenceDeclaration: undefined }).includes(
      "INDEPENDENCE_DECLARATION_MISSING",
    ),
  );
});

test("missing copyright review state fails", () => {
  assert.ok(
    errorCodes({ ...validBinding, copyrightReviewState: undefined }).includes(
      "COPYRIGHT_REVIEW_STATE_MISSING",
    ),
  );
});

test("missing currentness review state fails instead of defaulting to current", () => {
  assert.ok(
    errorCodes({ ...validBinding, currentnessReviewState: undefined }).includes(
      "CURRENTNESS_REVIEW_STATE_MISSING",
    ),
  );
});

test("wrong binding version fails", () => {
  assert.ok(
    errorCodes({ ...validBinding, bindingVersion: "isms-p-source-foundation-v1" }).includes(
      "BINDING_VERSION_INVALID",
    ),
  );
});

test("immutable identity mutation is detected", () => {
  const result = compareIsmsPSourceBindingImmutableIdentity(validBinding, {
    ...validBinding,
    criterionId: "1.3.3",
  });
  assert.equal(result.matches, false);
  assert.deepEqual(result.changedFields, ["criterionId"]);
  assert.deepEqual(result.errors, [{ code: "BINDING_IDENTITY_MUTATED", field: "criterionId" }]);
});

test("accepted binding object and nested identity values are frozen", () => {
  const immutable = createImmutableIsmsPSourceBinding(validBinding);
  assert.equal(Object.isFrozen(immutable), true);
  assert.equal(Object.isFrozen(immutable.scopeLocator), true);
  assert.equal(Object.isFrozen(immutable.usageClass), true);
});

test("issuer-incomplete source cannot be approved as primary authority", () => {
  const result = validateIsmsPSourceBinding({
    ...validBinding,
    sourceDocumentId: "isms-p-detailed-checklist-2023-10-31",
    sourceSha256: "9e2ca48cd942477c7c5c1ad4d6a8e3a606ab6de057bbf4ce47fb836a0dcc5f02",
    sourceTitle: "ISMS-P detailed checklist",
    sourceVersion: "2023.10.31",
    sourceAuthenticationState: "ISSUER_INCOMPLETE",
  });
  assert.ok(result.errors.some(({ code }) => code === "PRIMARY_SOURCE_AUTHENTICATION_INCOMPLETE"));
  assert.ok(result.errors.some(({ code }) => code === "SOURCE_IDENTITY_INCONSISTENT"));
});

test("legacy rights state remains explicitly representable", () => {
  const result = validateIsmsPSourceBinding({
    ...validBinding,
    copyrightReviewState: "LEGACY_REVIEW_REQUIRED",
    independenceDeclaration: "REAUTHORING_REQUIRED",
  });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some(({ code }) => code === "RIGHTS_REVIEW_PENDING"));
  assert.ok(result.warnings.some(({ code }) => code === "INDEPENDENCE_REVIEW_PENDING"));
});

test("source path movement does not change immutable source identity", () => {
  const result = compareIsmsPSourceBindingImmutableIdentity(validBinding, {
    ...validBinding,
    sourcePath: "another/local/path/criteria-guide.pdf",
  });
  assert.equal(result.matches, true);
  assert.deepEqual(result.changedFields, []);
});

test("contract publishes a stable mandatory-field and error-code vocabulary", () => {
  assert.equal(ISMS_P_SOURCE_BINDING_REQUIRED_FIELDS.length, 23);
  assert.equal(new Set(ISMS_P_SOURCE_BINDING_REQUIRED_FIELDS).size, 23);
  assert.equal(ISMS_P_SOURCE_BINDING_ERROR_CODES.length, 31);
  assert.equal(new Set(ISMS_P_SOURCE_BINDING_ERROR_CODES).size, 31);
});

test("W1-ISMSP-1A leaves all 12 educational payloads byte-semantically unchanged", () => {
  const educationalPayload = [...ismsPTheoryBatch1Records]
    .sort((left, right) => left.courseLesson.id.localeCompare(right.courseLesson.id))
    .map(({ content, courseLesson, extension }) => ({ content, courseLesson, extension }));
  const hash = createHash("sha256").update(JSON.stringify(educationalPayload)).digest("hex");
  assert.equal(ismsPTheoryBatch1Records.length, 12);
  assert.equal(hash, "60dcf57e0831608eb518f89cb1b18ccf9375db7e8477071685f5f08855cc83a4");
});

test("ISMS-P shared fields use the source taxonomy type boundary", () => {
  const authority: AuthorityClass = validBinding.authorityClass;
  const usage: UsageClass = validBinding.usageClass[0];
  const role: BindingRole = validBinding.bindingRole;
  const copyrightReview: CopyrightReviewState = validBinding.copyrightReviewState;
  const independence: IndependenceState = validBinding.independenceDeclaration;
  assert.equal(authority, "OFFICIAL_PUBLIC");
  assert.equal(usage, "CAN_USE_AS_AUTHORITY");
  assert.equal(role, "PRIMARY_AUTHORITY");
  assert.equal(copyrightReview, "LEGACY_REVIEW_REQUIRED");
  assert.equal(independence, "REVIEW_REQUIRED");
});

test("ISMS-P scope locator remains compatible with the neutral locator shape", () => {
  const locator: SourceLocator = {
    kind: "criterion",
    criterionId: validBinding.scopeLocator.criterionId,
    sectionHeading: validBinding.scopeLocator.sectionHeading,
    pageStart: validBinding.scopeLocator.pageStart,
    pageEnd: validBinding.scopeLocator.pageEnd,
    documentSubheading: validBinding.scopeLocator.documentSubheading,
  };
  assert.equal(locator.kind, "criterion");
  assert.equal(locator.criterionId, "1.1.1");
});
