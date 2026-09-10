import {
  ISRM_SOURCE_SEMANTIC_VERSION,
  validateIsrmFoundationAuthority,
} from "../lib/services/securium-isrm-foundation-runtime-adapter.ts";

export const ISRM_RUNTIME_REGISTRATION_TARGET = Object.freeze({
  courseId: "course-isrm",
  code: "ISRM",
  slug: "isrm",
  foundationCourseId: "course-isrm",
});

export const ISRM_DESIRED_COURSE_STATE = Object.freeze({
  active: true,
  published: false,
  isSample: false,
  deletedAt: null,
});

export const ISRM_RUNTIME_VISIBILITY = Object.freeze({
  initial: "LEGACY_PUBLIC_SAMPLE",
  desired: "RUNTIME_REGISTERED_UNPUBLISHED",
  catalog: "EXCLUDED_FROM_PUBLISHED_CATALOG",
  publicSlug: "NOT_FOUND_WHILE_UNPUBLISHED",
});

export const ISRM_REGISTRATION_ERROR_CODES = Object.freeze([
  "FOUNDATION_NOT_FOUND",
  "FOUNDATION_INVALID",
  "COURSE_ID_MISMATCH",
  "COURSE_CODE_MISMATCH",
  "COURSE_SLUG_MISMATCH",
  "RUNTIME_IDENTITY_CONFLICT",
  "LEGACY_CHILD_CONFLICT",
  "UNKNOWN_LEGACY_CHILD",
  "PUBLICATION_STATE_CONFLICT",
  "SUBJECT_MAPPING_CONFLICT",
  "UNIT_MAPPING_CONFLICT",
  "THEORY_MAPPING_CONFLICT",
  "QUESTION_ID_CONFLICT",
  "PRACTICAL_ID_CONFLICT",
  "GRADING_CONTRACT_MISMATCH",
  "COUNT_MISMATCH",
  "PROVIDER_PARITY_MISMATCH",
  "TRANSACTION_FAILED",
  "INTERNAL_ERROR",
]);

const LEARNER_DATA_KINDS = new Set([
  "enrollment",
  "user_course_enrollment",
  "user_level_progress",
  "question_attempt",
  "question_attempts",
  "learning_activity",
  "learning_activities",
  "evidence",
  "learner_evidence",
  "user_progress",
]);

const MUTABLE_QUARANTINE_KINDS = new Set([
  "course_subject",
  "subject",
  "topic",
  "learning_unit",
  "lesson",
  "level",
  "question",
  "mock_exam",
  "course_lesson",
  "course_specialization",
]);

const QUARANTINE_FIELD_UPDATES = Object.freeze({
  course_subject: Object.freeze({ active: false }),
  subject: Object.freeze({ active: false }),
  topic: Object.freeze({ active: false }),
  learning_unit: Object.freeze({ active: false, published: false }),
  lesson: Object.freeze({ active: false, published: false }),
  level: Object.freeze({ active: false, published: false }),
  question: Object.freeze({ status: "ARCHIVED" }),
  mock_exam: Object.freeze({ status: "ARCHIVED", published: false }),
  course_lesson: Object.freeze({ status: "ARCHIVED" }),
  course_specialization: Object.freeze({ active: false }),
});

export class IsrmRuntimeRegistrationError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "IsrmRuntimeRegistrationError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new IsrmRuntimeRegistrationError(code, message, details);
}

function assertProviderKind(kind) {
  if (kind !== "supabase" && kind !== "d1") {
    fail("PROVIDER_PARITY_MISMATCH", "ISRM registration requires the supported Supabase PostgreSQL or D1 provider semantics.", { kind });
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) fail("INTERNAL_ERROR", `${label} must be an array.`);
  return value;
}

function assertCourseIdentity(course, foundation) {
  if (!course || typeof course !== "object") fail("RUNTIME_IDENTITY_CONFLICT", "The course-isrm runtime record is missing.");
  if (course.id !== ISRM_RUNTIME_REGISTRATION_TARGET.courseId) {
    fail("COURSE_ID_MISMATCH", "The runtime course ID must be course-isrm.", course);
  }
  if (course.code !== ISRM_RUNTIME_REGISTRATION_TARGET.code) {
    fail("COURSE_CODE_MISMATCH", "The runtime course code must be ISRM.", course);
  }
  if (course.slug !== ISRM_RUNTIME_REGISTRATION_TARGET.slug) {
    fail("COURSE_SLUG_MISMATCH", "The runtime course slug must be isrm.", course);
  }
  if (foundation.courseId !== ISRM_RUNTIME_REGISTRATION_TARGET.foundationCourseId) {
    fail("RUNTIME_IDENTITY_CONFLICT", "The Foundation course identity is not course-isrm.", foundation);
  }
  if (course.deletedAt !== undefined && course.deletedAt !== null) {
    fail("RUNTIME_IDENTITY_CONFLICT", "A deleted course-isrm record cannot be reconciled.", course);
  }
  return true;
}

function sourceClassification(child) {
  return child?.classification ?? child?.sourceClassification ??
    (child?.isCanonicalFoundation === true ? "CANONICAL_FOUNDATION" :
      child?.isSample === true ? "GENERIC_SAMPLE" : undefined);
}

function isLearnerData(child) {
  return child?.learnerData === true || LEARNER_DATA_KINDS.has(child?.kind);
}

function quarantineMutationFor(child) {
  if (isLearnerData(child)) return Object.freeze({ strategy: "PRESERVE_LEARNER_DATA", fields: Object.freeze({}) });
  if (child?.quarantineMutation && typeof child.quarantineMutation === "object") return child.quarantineMutation;
  if (MUTABLE_QUARANTINE_KINDS.has(child?.kind)) {
    return Object.freeze({ strategy: "UPDATE_EXISTING_VISIBILITY_FIELDS", fields: QUARANTINE_FIELD_UPDATES[child.kind] });
  }
  return Object.freeze({ strategy: "PRESERVE_NON_LEARNER_ROW", fields: Object.freeze({}) });
}

export function classifyLegacyChild(child) {
  if (!child || typeof child !== "object" || typeof child.id !== "string" || typeof child.kind !== "string") {
    fail("UNKNOWN_LEGACY_CHILD", "Every ISRM descendant must have a stable ID and kind.", child);
  }
  if (child.courseId !== ISRM_RUNTIME_REGISTRATION_TARGET.courseId) {
    fail("UNKNOWN_LEGACY_CHILD", "An ISRM descendant is bound to an unexpected course identity.", child);
  }
  const classification = sourceClassification(child);
  if (classification === "CANONICAL_FOUNDATION") {
    fail("LEGACY_CHILD_CONFLICT", "Canonical Foundation runtime materialization is not allowed in the legacy child set.", child);
  }
  if (classification !== "GENERIC_SAMPLE" && classification !== "LEGACY_PLACEHOLDER") {
    fail("UNKNOWN_LEGACY_CHILD", "An ISRM descendant has no approved legacy classification.", child);
  }
  return Object.freeze({
    id: child.id,
    kind: child.kind,
    classification,
    learnerData: isLearnerData(child),
    quarantineMutation: quarantineMutationFor(child),
    alreadyQuarantined: child.quarantined === true,
  });
}

export function classifyLegacyDescendants(descendants) {
  const rows = assertArray(descendants, "ISRM descendants");
  const seen = new Set();
  const classified = rows.map((child) => {
    if (seen.has(child?.id)) fail("LEGACY_CHILD_CONFLICT", "Duplicate ISRM descendant identity detected.", child?.id);
    seen.add(child?.id);
    return classifyLegacyChild(child);
  });
  const counts = {
    total: classified.length,
    genericSample: classified.filter((child) => child.classification === "GENERIC_SAMPLE").length,
    legacyPlaceholder: classified.filter((child) => child.classification === "LEGACY_PLACEHOLDER").length,
    canonical: 0,
    unknown: 0,
  };
  return Object.freeze({
    rows: classified,
    counts: Object.freeze(counts),
    mutableRows: classified.filter((child) => !child.learnerData),
    preservedLearnerRows: classified.filter((child) => child.learnerData),
  });
}

function desiredCourseState(course) {
  return course.active === ISRM_DESIRED_COURSE_STATE.active &&
    course.published === ISRM_DESIRED_COURSE_STATE.published &&
    course.isSample === ISRM_DESIRED_COURSE_STATE.isSample &&
    (course.deletedAt === undefined || course.deletedAt === null);
}

export function createIsrmRegistrationPlan({ providerKind, courseRows, descendants }) {
  assertProviderKind(providerKind);
  const foundation = validateIsrmFoundationAuthority();
  if (foundation.sourceSemanticVersion !== ISRM_SOURCE_SEMANTIC_VERSION) {
    fail("FOUNDATION_INVALID", "The source semantic-version limitation must remain unknown.");
  }
  const rows = assertArray(courseRows, "ISRM course rows");
  if (rows.length === 0) fail("RUNTIME_IDENTITY_CONFLICT", "The existing course-isrm runtime identity was not found.");
  if (rows.length !== 1) fail("RUNTIME_IDENTITY_CONFLICT", "The existing course-isrm runtime identity is duplicated.", { count: rows.length });
  const course = rows[0];
  assertCourseIdentity(course, foundation);
  const legacy = classifyLegacyDescendants(descendants);
  const childActions = legacy.mutableRows
    .filter((child) => !child.alreadyQuarantined)
    .map((child) => Object.freeze({
      id: child.id,
      kind: child.kind,
      classification: child.classification,
      mutation: child.quarantineMutation,
    }));
  const noop = desiredCourseState(course) && childActions.length === 0;
  return Object.freeze({
    providerKind,
    status: noop ? "NOOP" : "RECONCILE",
    binding: Object.freeze({
      courseId: course.id,
      code: course.code,
      slug: course.slug,
      foundationCourseId: foundation.courseId,
      bindingKey: `${course.id}:${course.code}:${course.slug}`,
    }),
    foundation: Object.freeze({
      counts: foundation.counts,
      sourceSemanticVersion: foundation.sourceSemanticVersion,
      executablePracticals: foundation.executablePracticals,
      publication: foundation.publication,
    }),
    originalVisibility: Object.freeze({
      active: course.active,
      published: course.published,
      isSample: course.isSample,
      deletedAt: course.deletedAt ?? null,
    }),
    desiredVisibility: ISRM_DESIRED_COURSE_STATE,
    legacy: Object.freeze({
      counts: legacy.counts,
      quarantine: childActions,
      preservedLearnerRows: legacy.preservedLearnerRows.map((child) => child.id),
    }),
    writes: Object.freeze({
      course: noop ? 0 : 1,
      legacyChildren: childActions.length,
      learnerData: 0,
      foundationContent: 0,
      publication: 0,
    }),
  });
}

function assertReconciledCourse(course) {
  assertCourseIdentity(course, { courseId: ISRM_RUNTIME_REGISTRATION_TARGET.foundationCourseId });
  if (!desiredCourseState(course)) {
    fail("PUBLICATION_STATE_CONFLICT", "The reconciled ISRM course is not active, unpublished, and non-sample.", course);
  }
}

function assertReconciledChildren(descendants) {
  const legacy = classifyLegacyDescendants(descendants);
  const remaining = legacy.mutableRows.filter((child) => child.alreadyQuarantined !== true);
  if (remaining.length > 0) {
    fail("LEGACY_CHILD_CONFLICT", "A legacy non-learner descendant remained unquarantined after reconciliation.", remaining);
  }
  return legacy;
}

export async function reconcileIsrmRuntime(provider) {
  if (!provider || typeof provider.transaction !== "function") {
    fail("PROVIDER_PARITY_MISMATCH", "An injected supported-provider transaction is required; no live database is opened by this bounded script.");
  }
  assertProviderKind(provider.kind);
  try {
    return await provider.transaction(async (transaction) => {
      if (!transaction || typeof transaction.readIsrmCourseRows !== "function" || typeof transaction.readIsrmDescendants !== "function") {
        fail("PROVIDER_PARITY_MISMATCH", "The injected provider does not expose the bounded ISRM registration contract.");
      }
      const plan = createIsrmRegistrationPlan({
        providerKind: provider.kind,
        courseRows: await transaction.readIsrmCourseRows(),
        descendants: await transaction.readIsrmDescendants(),
      });
      if (plan.status === "NOOP") {
        const finalRows = await transaction.readIsrmCourseRows();
        const finalChildren = await transaction.readIsrmDescendants();
        assertReconciledCourse(finalRows.length === 1 ? finalRows[0] : null);
        assertReconciledChildren(finalChildren);
        return plan;
      }
      if (typeof transaction.updateIsrmCourseVisibility !== "function" || typeof transaction.quarantineIsrmLegacyChild !== "function") {
        fail("PROVIDER_PARITY_MISMATCH", "The injected provider cannot perform bounded visibility reconciliation.");
      }
      await transaction.updateIsrmCourseVisibility({ ...ISRM_DESIRED_COURSE_STATE });
      for (const action of plan.legacy.quarantine) {
        await transaction.quarantineIsrmLegacyChild(action);
      }
      const finalRows = await transaction.readIsrmCourseRows();
      const finalChildren = await transaction.readIsrmDescendants();
      if (finalRows.length !== 1) fail("TRANSACTION_FAILED", "The reconciled ISRM course identity is not unique.", finalRows);
      assertReconciledCourse(finalRows[0]);
      assertReconciledChildren(finalChildren);
      return Object.freeze({ ...plan, status: "RECONCILED" });
    });
  } catch (error) {
    if (error?.code && ISRM_REGISTRATION_ERROR_CODES.includes(error.code)) throw error;
    if (error instanceof IsrmRuntimeRegistrationError) throw error;
    throw new IsrmRuntimeRegistrationError("TRANSACTION_FAILED", "The bounded ISRM reconciliation transaction failed and must roll back.", error);
  }
}

export function assertNoForbiddenRegistrationFlags(argv) {
  const forbidden = new Set(["--publish", "--public", "--activate-public", "--sample", "--force-public"]);
  const found = assertArray(argv, "registration arguments").filter((argument) => forbidden.has(argument));
  if (found.length > 0) fail("PUBLICATION_STATE_CONFLICT", "The ISRM registration script has no publication or sample-enabling mode.", found);
  return true;
}

export const REGISTRATION_PROVIDER_CONTRACT = Object.freeze({
  reads: ["readIsrmCourseRows", "readIsrmDescendants"],
  writes: ["updateIsrmCourseVisibility", "quarantineIsrmLegacyChild"],
  transaction: "atomic-provider-transaction",
  runtimeDatabaseAccessInThisGate: 0,
  learnerDataWrites: 0,
  foundationContentWrites: 0,
});

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  try {
    assertNoForbiddenRegistrationFlags(process.argv.slice(2));
    console.error("The bounded ISRM registration module requires an explicitly injected disposable/provider transaction. No live database execution is provided by this gate.");
    process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
