import { readFileSync } from "node:fs";
import { gradeQuestion, type GradeResult, type GradingQuestion, type SubmittedAnswer } from "./grading-service.ts";

export const ISRM_RUNTIME_ADAPTER_EXECUTION = "SERVER_ONLY" as const;
export const ISRM_RUNTIME_ADAPTER_PURITY = "READ_ONLY_PURE_NON_PERSISTENT" as const;

export const ISRM_RUNTIME_IDENTITY = Object.freeze({
  courseId: "course-isrm",
  code: "ISRM",
  slug: "isrm",
  foundationCourseId: "course-isrm",
});

export const ISRM_FOUNDATION_COUNTS = Object.freeze({
  course: 1,
  subjects: 5,
  units: 12,
  theory: 3,
  questions: 30,
  practicals: 10,
  executablePracticals: 0,
});

export type IsrmFoundationCounts = {
  course: number;
  subjects: number;
  units: number;
  theory: number;
  questions: number;
  practicals: number;
  executablePracticals: number;
};

export const ISRM_SOURCE_SEMANTIC_VERSION =
  "OFFICIAL_SOURCE_SEMANTIC_VERSION_UNKNOWN" as const;

export type IsrmRuntimeErrorCode =
  | "FOUNDATION_NOT_FOUND"
  | "FOUNDATION_INVALID"
  | "COURSE_ID_MISMATCH"
  | "COURSE_CODE_MISMATCH"
  | "COURSE_SLUG_MISMATCH"
  | "RUNTIME_IDENTITY_CONFLICT"
  | "PUBLICATION_STATE_CONFLICT"
  | "SUBJECT_MAPPING_CONFLICT"
  | "UNIT_MAPPING_CONFLICT"
  | "THEORY_MAPPING_CONFLICT"
  | "QUESTION_ID_CONFLICT"
  | "PRACTICAL_ID_CONFLICT"
  | "GRADING_CONTRACT_MISMATCH"
  | "COUNT_MISMATCH"
  | "INTERNAL_ERROR";

export class IsrmRuntimeAdapterError extends Error {
  readonly code: IsrmRuntimeErrorCode;
  readonly details: unknown;

  constructor(code: IsrmRuntimeErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "IsrmRuntimeAdapterError";
    this.code = code;
    this.details = details;
  }
}

export type IsrmRuntimeIdentityRecord = {
  courseId: string;
  code: string;
  slug: string;
  foundationCourseId: string;
  active?: boolean;
  published?: boolean;
  isSample?: boolean;
  deletedAt?: string | null;
};

type JsonRecord = Record<string, unknown>;

const FOUNDATION_FILE_URLS = Object.freeze({
  manifest: new URL("../../content-drafts/securium-isrm-foundation/manifest.json", import.meta.url),
  course: new URL("../../content-drafts/securium-isrm-foundation/course.json", import.meta.url),
  subjects: new URL("../../content-drafts/securium-isrm-foundation/subject-authority.json", import.meta.url),
  curriculum: new URL("../../content-drafts/securium-isrm-foundation/curriculum-authority.json", import.meta.url),
  theory: new URL("../../content-drafts/securium-isrm-foundation/theory-authority.json", import.meta.url),
  assessment: new URL("../../content-drafts/securium-isrm-foundation/assessment-authority.json", import.meta.url),
  practicals: new URL("../../content-drafts/securium-isrm-foundation/practical-spec-authority.json", import.meta.url),
  source: new URL("../../content-drafts/securium-isrm-foundation/source-manifest.json", import.meta.url),
  provenance: new URL("../../content-drafts/securium-isrm-foundation/provenance-rights-manifest.json", import.meta.url),
});

const SUBJECT_MAPPING = Object.freeze([
  { foundationId: "isrm-2025-2027-s01", runtimeKey: "isrm:subject:isrm-2025-2027-s01" },
  { foundationId: "isrm-2025-2027-s02", runtimeKey: "isrm:subject:isrm-2025-2027-s02" },
  { foundationId: "isrm-2025-2027-s03", runtimeKey: "isrm:subject:isrm-2025-2027-s03" },
  { foundationId: "isrm-2025-2027-s04", runtimeKey: "isrm:subject:isrm-2025-2027-s04" },
  { foundationId: "isrm-2025-2027-s05", runtimeKey: "isrm:subject:isrm-2025-2027-s05" },
] as const);

const UNIT_MAPPING = Object.freeze([
  "isrm-2025-2027-s01-u01",
  "isrm-2025-2027-s01-u02",
  "isrm-2025-2027-s01-u03",
  "isrm-2025-2027-s02-u01",
  "isrm-2025-2027-s02-u02",
  "isrm-2025-2027-s03-u01",
  "isrm-2025-2027-s03-u02",
  "isrm-2025-2027-s03-u03",
  "isrm-2025-2027-s03-u04",
  "isrm-2025-2027-s04-u01",
  "isrm-2025-2027-s04-u02",
  "isrm-2025-2027-s05-u01",
] as const);

const THEORY_MAPPING = Object.freeze([
  "isrm-theory-foundation-v2",
  "isrm-theory-practice-v2",
  "isrm-theory-review-v2",
] as const);

const PRACTICAL_MAPPING = Object.freeze([
  "isrm-practical-v2-01",
  "isrm-practical-v2-02",
  "isrm-practical-v2-03",
  "isrm-practical-v2-04",
  "isrm-practical-v2-05",
  "isrm-practical-v2-06",
  "isrm-practical-v2-07",
  "isrm-practical-v2-08",
  "isrm-practical-v2-09",
  "isrm-practical-v2-10",
] as const);

function readJson(url: URL, name: string): JsonRecord {
  try {
    return JSON.parse(readFileSync(url, "utf8")) as JsonRecord;
  } catch (error) {
    throw new IsrmRuntimeAdapterError(
      "FOUNDATION_NOT_FOUND",
      `The canonical ISRM Foundation file could not be loaded: ${name}.`,
      error,
    );
  }
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IsrmRuntimeAdapterError(
      "FOUNDATION_INVALID",
      `The canonical ISRM Foundation ${label} must be an object.`,
    );
  }
  return value as JsonRecord;
}

function array(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value)) {
    throw new IsrmRuntimeAdapterError(
      "FOUNDATION_INVALID",
      `The canonical ISRM Foundation ${label} must be an array.`,
    );
  }
  return value.map((item, index) => record(item, `${label}[${index}]`));
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new IsrmRuntimeAdapterError(
      "FOUNDATION_INVALID",
      `The canonical ISRM Foundation ${label} must be a non-empty string.`,
    );
  }
  return value;
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new IsrmRuntimeAdapterError(
      "FOUNDATION_INVALID",
      `The canonical ISRM Foundation ${label} must be an integer.`,
    );
  }
  return value;
}

function assertExactCount(actual: number, expected: number, label: string) {
  if (actual !== expected) {
    throw new IsrmRuntimeAdapterError(
      "COUNT_MISMATCH",
      `The canonical ISRM Foundation ${label} count is ${actual}; expected ${expected}.`,
      { actual, expected },
    );
  }
}

function assertUnique(values: string[], code: IsrmRuntimeErrorCode, label: string) {
  if (new Set(values).size !== values.length) {
    throw new IsrmRuntimeAdapterError(code, `The canonical ISRM Foundation contains duplicate ${label} IDs.`);
  }
}

function expectedSet(values: readonly string[]) {
  return new Set(values);
}

function assertSetEquality(actual: string[], expected: readonly string[], code: IsrmRuntimeErrorCode, label: string) {
  const expectedSetValue = expectedSet(expected);
  if (actual.length !== expected.length || actual.some((value) => !expectedSetValue.has(value))) {
    throw new IsrmRuntimeAdapterError(code, `The canonical ISRM Foundation ${label} mapping is not exact.`, {
      actual,
      expected,
    });
  }
}

type ValidatedFoundation = {
  course: JsonRecord;
  subjects: JsonRecord[];
  units: JsonRecord[];
  theoryAssets: JsonRecord[];
  questions: JsonRecord[];
  practicals: JsonRecord[];
  source: JsonRecord;
  provenance: JsonRecord;
  counts: Readonly<IsrmFoundationCounts>;
};

function readAndValidateFoundation(): ValidatedFoundation {
  const manifest = readJson(FOUNDATION_FILE_URLS.manifest, "manifest.json");
  const course = readJson(FOUNDATION_FILE_URLS.course, "course.json");
  const subjectAuthority = readJson(FOUNDATION_FILE_URLS.subjects, "subject-authority.json");
  const curriculum = readJson(FOUNDATION_FILE_URLS.curriculum, "curriculum-authority.json");
  const theory = readJson(FOUNDATION_FILE_URLS.theory, "theory-authority.json");
  const assessment = readJson(FOUNDATION_FILE_URLS.assessment, "assessment-authority.json");
  const practicalAuthority = readJson(FOUNDATION_FILE_URLS.practicals, "practical-spec-authority.json");
  const source = readJson(FOUNDATION_FILE_URLS.source, "source-manifest.json");
  const provenance = readJson(FOUNDATION_FILE_URLS.provenance, "provenance-rights-manifest.json");

  if (manifest.authorityType !== "CANONICAL_STATIC_PRODUCT_CONTENT_AUTHORITY") {
    throw new IsrmRuntimeAdapterError("FOUNDATION_INVALID", "The ISRM Foundation manifest is not canonical product authority.");
  }
  if (manifest.courseId !== ISRM_RUNTIME_IDENTITY.foundationCourseId) {
    throw new IsrmRuntimeAdapterError("RUNTIME_IDENTITY_CONFLICT", "The ISRM Foundation manifest course identity does not match the runtime identity.");
  }
  if (manifest.runtimeRegistration !== 0 || manifest.publicationAuthority !== false) {
    throw new IsrmRuntimeAdapterError("FOUNDATION_INVALID", "The ISRM Foundation must not register or publish runtime content.");
  }

  const manifestCounts = record(manifest.counts, "manifest counts");
  const manifestCountFields = [
    ["course", "course"],
    ["subjects", "subjects"],
    ["pedagogicalUnits", "units"],
    ["theoryAssets", "theory"],
    ["questions", "questions"],
    ["practicalSpecs", "practicals"],
  ] as const;
  for (const [manifestKey, countKey] of manifestCountFields) {
    assertExactCount(
      numberValue(manifestCounts[manifestKey], `manifest counts.${manifestKey}`),
      ISRM_FOUNDATION_COUNTS[countKey],
      `manifest.${manifestKey}`,
    );
  }

  if (
    course.courseId !== ISRM_RUNTIME_IDENTITY.foundationCourseId ||
    course.code !== ISRM_RUNTIME_IDENTITY.code ||
    course.slug !== ISRM_RUNTIME_IDENTITY.slug ||
    course.officialSourceSemanticVersion !== ISRM_SOURCE_SEMANTIC_VERSION ||
    course.publication !== "NOT_AUTHORIZED"
  ) {
    throw new IsrmRuntimeAdapterError("FOUNDATION_INVALID", "The ISRM Foundation course identity or publication boundary is invalid.");
  }
  if (course.courseAuthorityCount !== 1) {
    throw new IsrmRuntimeAdapterError("RUNTIME_IDENTITY_CONFLICT", "The ISRM Foundation course authority is not unique.");
  }

  const subjects = array(subjectAuthority.subjects, "subjects");
  const units = array(curriculum.units, "units");
  const theoryAssets = array(theory.assets, "theory assets");
  const questions = array(assessment.questions, "questions");
  const practicals = array(practicalAuthority.practicals, "practicals");
  const subjectIds = subjects.map((subject) => stringValue(subject.id, "subject ID"));
  const unitIds = units.map((unit) => stringValue(unit.id, "unit ID"));
  const theoryIds = theoryAssets.map((asset) => stringValue(asset.id, "theory ID"));
  const questionIds = questions.map((question) => stringValue(question.id, "question ID"));
  const practicalIds = practicals.map((practical) => stringValue(practical.id, "practical ID"));

  assertExactCount(subjects.length, ISRM_FOUNDATION_COUNTS.subjects, "subjects");
  assertExactCount(units.length, ISRM_FOUNDATION_COUNTS.units, "units");
  assertExactCount(theoryAssets.length, ISRM_FOUNDATION_COUNTS.theory, "theory assets");
  assertExactCount(questions.length, ISRM_FOUNDATION_COUNTS.questions, "questions");
  assertExactCount(practicals.length, ISRM_FOUNDATION_COUNTS.practicals, "practicals");
  assertUnique(subjectIds, "SUBJECT_MAPPING_CONFLICT", "subject");
  assertUnique(unitIds, "UNIT_MAPPING_CONFLICT", "unit");
  assertUnique(theoryIds, "THEORY_MAPPING_CONFLICT", "theory");
  assertUnique(questionIds, "QUESTION_ID_CONFLICT", "question");
  assertUnique(practicalIds, "PRACTICAL_ID_CONFLICT", "practical");

  assertSetEquality(subjectIds, SUBJECT_MAPPING.map((item) => item.foundationId), "SUBJECT_MAPPING_CONFLICT", "subject");
  assertSetEquality(unitIds, UNIT_MAPPING, "UNIT_MAPPING_CONFLICT", "unit");
  assertSetEquality(theoryIds, THEORY_MAPPING, "THEORY_MAPPING_CONFLICT", "theory");
  assertSetEquality(practicalIds, PRACTICAL_MAPPING, "PRACTICAL_ID_CONFLICT", "practical");

  const subjectIdSet = expectedSet(subjectIds);
  const unitIdSet = expectedSet(unitIds);
  if (
    units.some((unit) => unit.classification !== "SECURIUM_PEDAGOGICAL" || unit.unsupportedOfficialClaim !== false || !subjectIdSet.has(String(unit.subjectId)))
  ) {
    throw new IsrmRuntimeAdapterError("UNIT_MAPPING_CONFLICT", "ISRM pedagogical units do not preserve their reviewed boundary.");
  }
  if (
    questions.some(
      (question) =>
        question.answerAuthority !== "PRESENT" ||
        question.explanation !== "PRESENT" ||
        question.authoringStatus !== "SECURIUM_INDEPENDENT" ||
        question.decision !== "ACCEPT" ||
        !subjectIdSet.has(String(question.officialSubjectId)) ||
        !unitIdSet.has(String(question.learningUnitId)),
    )
  ) {
    throw new IsrmRuntimeAdapterError("QUESTION_ID_CONFLICT", "ISRM question authority is not complete or deterministically bound.");
  }
  if (
    practicalAuthority.executableRegistration !== 0 ||
    practicalAuthority.execution !== 0 ||
    practicalAuthority.officialExamContent !== false ||
    practicals.some(
      (practical) =>
        practical.classification !== "SYNTHETIC" ||
        practical.mode !== "SPEC_ONLY" ||
        practical.officialExamContent !== false,
    )
  ) {
    throw new IsrmRuntimeAdapterError("PRACTICAL_ID_CONFLICT", "ISRM practical specifications are not safely non-executable.");
  }
  if (
    source.officialSourceSemanticVersion !== ISRM_SOURCE_SEMANTIC_VERSION ||
    provenance.unknownProvenanceAccepted !== 0 ||
    provenance.commercialInfluence !== 0 ||
    provenance.officialExpressionReproduction !== 0 ||
    record(provenance.rights, "rights").commercialCanonicalDependency !== 0
  ) {
    throw new IsrmRuntimeAdapterError("FOUNDATION_INVALID", "The ISRM Foundation source and rights boundary is invalid.");
  }

  const counts = Object.freeze({
    course: numberValue(course.courseAuthorityCount, "course authority count"),
    subjects: subjects.length,
    units: units.length,
    theory: theoryAssets.length,
    questions: questions.length,
    practicals: practicals.length,
    executablePracticals: numberValue(practicalAuthority.execution, "practical execution count"),
  });
  if (counts.executablePracticals !== 0) {
    throw new IsrmRuntimeAdapterError("PRACTICAL_ID_CONFLICT", "The ISRM Foundation contains executable practical registration.");
  }
  return { course, subjects, units, theoryAssets, questions, practicals, source, provenance, counts };
}

export function validateIsrmFoundationAuthority() {
  const foundation = readAndValidateFoundation();
  return Object.freeze({
    courseId: String(foundation.course.courseId),
    code: String(foundation.course.code),
    slug: String(foundation.course.slug),
    counts: foundation.counts,
    sourceSemanticVersion: ISRM_SOURCE_SEMANTIC_VERSION,
    publication: "NOT_AUTHORIZED" as const,
    executablePracticals: 0 as const,
  });
}

function assertVisibilityField(value: unknown, label: string) {
  if (typeof value !== "boolean") {
    throw new IsrmRuntimeAdapterError("RUNTIME_IDENTITY_CONFLICT", `Runtime ${label} must be boolean when supplied.`);
  }
}

export function assertIsrmRuntimeBinding(runtime: IsrmRuntimeIdentityRecord) {
  if (!runtime || typeof runtime !== "object") {
    throw new IsrmRuntimeAdapterError("RUNTIME_IDENTITY_CONFLICT", "The runtime ISRM identity record is required.");
  }
  if (runtime.courseId !== ISRM_RUNTIME_IDENTITY.courseId) {
    throw new IsrmRuntimeAdapterError("COURSE_ID_MISMATCH", "The runtime course ID is not course-isrm.");
  }
  if (runtime.code !== ISRM_RUNTIME_IDENTITY.code) {
    throw new IsrmRuntimeAdapterError("COURSE_CODE_MISMATCH", "The runtime course code is not ISRM.");
  }
  if (runtime.slug !== ISRM_RUNTIME_IDENTITY.slug) {
    throw new IsrmRuntimeAdapterError("COURSE_SLUG_MISMATCH", "The runtime course slug is not isrm.");
  }
  if (runtime.foundationCourseId !== ISRM_RUNTIME_IDENTITY.foundationCourseId) {
    throw new IsrmRuntimeAdapterError("RUNTIME_IDENTITY_CONFLICT", "The runtime/Foundation binding key is not course-isrm.");
  }
  if (runtime.deletedAt !== undefined && runtime.deletedAt !== null) {
    throw new IsrmRuntimeAdapterError("RUNTIME_IDENTITY_CONFLICT", "A deleted runtime course cannot bind the canonical Foundation.");
  }
  for (const [value, label] of [
    [runtime.active, "active"],
    [runtime.published, "published"],
    [runtime.isSample, "isSample"],
  ] as const) {
    if (value !== undefined) assertVisibilityField(value, label);
  }
  return true;
}

export function assertIsrmCanonicalVisibility(runtime: IsrmRuntimeIdentityRecord) {
  assertIsrmRuntimeBinding(runtime);
  if (runtime.active !== true || runtime.published !== false || runtime.isSample !== false) {
    throw new IsrmRuntimeAdapterError(
      "PUBLICATION_STATE_CONFLICT",
      "The canonical ISRM Foundation may only be projected from active, unpublished, non-sample runtime state.",
      { active: runtime.active, published: runtime.published, isSample: runtime.isSample },
    );
  }
  return true;
}

function runtimeKey(prefix: string, id: string) {
  return `${prefix}:${id}`;
}

export type IsrmRuntimeReadModel = {
  execution: typeof ISRM_RUNTIME_ADAPTER_EXECUTION;
  persistence: "NON_PERSISTENT";
  runtimeIdentity: Readonly<typeof ISRM_RUNTIME_IDENTITY>;
  foundationBinding: { foundationCourseId: string; bindingKey: string };
  counts: {
    course: number;
    subjects: number;
    units: number;
    theory: number;
    questions: number;
    practicals: number;
    executablePracticals: number;
  };
  subjects: ReadonlyArray<{ foundationId: string; runtimeKey: string; order: number }>;
  units: ReadonlyArray<{ foundationId: string; runtimeKey: string; subjectId: string; classification: "SECURIUM_PEDAGOGICAL" }>;
  theory: ReadonlyArray<{ foundationId: string; runtimeKey: string }>;
  questions: ReadonlyArray<{ id: string; subjectId: string; unitId: string; answerAuthority: "PRESENT"; authoringStatus: "SECURIUM_INDEPENDENT" }>;
  practicals: ReadonlyArray<{ foundationId: string; runtimeKey: string; classification: "SYNTHETIC"; mode: "SPEC_ONLY"; officialExamContent: false }>;
  source: { officialSourceSemanticVersion: typeof ISRM_SOURCE_SEMANTIC_VERSION; detailedOfficialScope: string };
  grading: { authority: "SHARED_GRADER"; duplicateIsrmGrader: 0 };
  questionAttempts: { status: "THIN_RELATIONAL_MAPPING_REQUIRED"; writesInAdapter: 0 };
  publication: "NOT_AUTHORIZED";
};

export function loadIsrmFoundationRuntimeReadModel(runtime: IsrmRuntimeIdentityRecord): IsrmRuntimeReadModel {
  assertIsrmCanonicalVisibility(runtime);
  const foundation = readAndValidateFoundation();
  const subjects = foundation.subjects.map((subject) => ({
    foundationId: String(subject.id),
    runtimeKey: runtimeKey("isrm:subject", String(subject.id)),
    order: numberValue(subject.order, `subject ${String(subject.id)} order`),
  }));
  const subjectIds = new Set(subjects.map((subject) => subject.foundationId));
  const units = foundation.units.map((unit) => ({
    foundationId: String(unit.id),
    runtimeKey: runtimeKey("isrm:unit", String(unit.id)),
    subjectId: String(unit.subjectId),
    classification: "SECURIUM_PEDAGOGICAL" as const,
  }));
  if (units.some((unit) => !subjectIds.has(unit.subjectId))) {
    throw new IsrmRuntimeAdapterError("UNIT_MAPPING_CONFLICT", "An ISRM unit is bound to an unknown subject.");
  }
  const unitIds = new Set(units.map((unit) => unit.foundationId));
  const theory = foundation.theoryAssets.map((asset) => ({
    foundationId: String(asset.id),
    runtimeKey: runtimeKey("isrm:theory", String(asset.id)),
  }));
  const questions = foundation.questions.map((question) => ({
    id: String(question.id),
    subjectId: String(question.officialSubjectId),
    unitId: String(question.learningUnitId),
    answerAuthority: "PRESENT" as const,
    authoringStatus: "SECURIUM_INDEPENDENT" as const,
  }));
  if (questions.some((question) => !subjectIds.has(question.subjectId) || !unitIds.has(question.unitId))) {
    throw new IsrmRuntimeAdapterError("QUESTION_ID_CONFLICT", "An ISRM question is not bound to a canonical subject and unit.");
  }
  const practicals = foundation.practicals.map((practical) => ({
    foundationId: String(practical.id),
    runtimeKey: runtimeKey("isrm:practical", String(practical.id)),
    classification: "SYNTHETIC" as const,
    mode: "SPEC_ONLY" as const,
    officialExamContent: false as const,
  }));
  const source = record(foundation.source, "source");
  const model = {
    execution: ISRM_RUNTIME_ADAPTER_EXECUTION,
    persistence: "NON_PERSISTENT" as const,
    runtimeIdentity: ISRM_RUNTIME_IDENTITY,
    foundationBinding: {
      foundationCourseId: ISRM_RUNTIME_IDENTITY.foundationCourseId,
      bindingKey: `${ISRM_RUNTIME_IDENTITY.courseId}:${ISRM_RUNTIME_IDENTITY.code}:${ISRM_RUNTIME_IDENTITY.slug}`,
    },
    counts: foundation.counts,
    subjects,
    units,
    theory,
    questions,
    practicals,
    source: {
      officialSourceSemanticVersion: ISRM_SOURCE_SEMANTIC_VERSION,
      detailedOfficialScope: String(source.detailedOfficialScope),
    },
    grading: { authority: "SHARED_GRADER" as const, duplicateIsrmGrader: 0 as const },
    questionAttempts: { status: "THIN_RELATIONAL_MAPPING_REQUIRED" as const, writesInAdapter: 0 as const },
    publication: "NOT_AUTHORIZED" as const,
  } satisfies IsrmRuntimeReadModel;
  return Object.freeze(model);
}

export type IsrmGradingInput = {
  questionId: string;
  question: GradingQuestion;
  answer: SubmittedAnswer;
};

export function gradeIsrmRuntimeQuestion(input: IsrmGradingInput): GradeResult {
  if (!input || typeof input.questionId !== "string" || !/^isrm-q-v2-\d{2}$/.test(input.questionId)) {
    throw new IsrmRuntimeAdapterError("QUESTION_ID_CONFLICT", "The runtime grading question ID is not a canonical ISRM question ID.");
  }
  if (!input.question || !Array.isArray(input.question.choices)) {
    throw new IsrmRuntimeAdapterError("GRADING_CONTRACT_MISMATCH", "The ISRM grading input does not satisfy the shared grader contract.");
  }
  return gradeQuestion(input.question, input.answer);
}

export const ISRM_STATIC_ID_MAPPINGS = Object.freeze({
  subjects: SUBJECT_MAPPING,
  units: UNIT_MAPPING,
  theory: THEORY_MAPPING,
  practicals: PRACTICAL_MAPPING,
});
