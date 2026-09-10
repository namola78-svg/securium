import { readFileSync } from "node:fs";
import { AppError } from "../errors.ts";

export const DIGITAL_FORENSICS_8H_RUNTIME_ADAPTER_EXECUTION = "SERVER_ONLY" as const;
export const DIGITAL_FORENSICS_8H_RUNTIME_ADAPTER_PURITY =
  "READ_ONLY_PURE_NON_PERSISTENT" as const;
export const DIGITAL_FORENSICS_8H_FOUNDATION_SOURCE_DEPENDENCY =
  "FOUNDATION_ONLY" as const;

export const DIGITAL_FORENSICS_8H_FOUNDATION_MANIFEST_ID =
  "SECURIUM_DIGITAL_FORENSICS_8H_FOUNDATION_PRODUCT_AUTHORITY_V1" as const;
export const DIGITAL_FORENSICS_8H_FOUNDATION_VERSION =
  "digital-forensics-8h-foundation.v1" as const;
export const DIGITAL_FORENSICS_8H_BINDING_KEY =
  "course-digital-forensics-8h:DF-8H:digital-forensics-8h:foundation:digital-forensics-8h-foundation.v1" as const;
export const DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE = "SINGLE_CHOICE" as const;
export const DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE_AUTHORITY =
  "RUNTIME_PROJECTION_DEFAULT" as const;

export const DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY = Object.freeze({
  courseId: "course-digital-forensics-8h",
  code: "DF-8H",
  slug: "digital-forensics-8h",
  bindingKey: DIGITAL_FORENSICS_8H_BINDING_KEY,
  foundationVersion: DIGITAL_FORENSICS_8H_FOUNDATION_VERSION,
});

export const DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS = Object.freeze({
  course: 1,
  modules: 8,
  minutes: 480,
  objectives: 32,
  theoryAssets: 24,
  questions: 40,
  explanations: 40,
  practicalSpecifications: 8,
  executableLabs: 0,
});

export const DIGITAL_FORENSICS_8H_SOURCE_MANIFEST_SHA256 =
  "717204c2ba58f53b81eecb1bbc52c2e799d3250194f39e88b61fc177627b1ece" as const;

const MODULE_IDS = Object.freeze(
  Array.from({ length: DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.modules }, (_, index) =>
    `DF-H${String(index + 1).padStart(2, "0")}`,
  ),
);
const OBJECTIVE_IDS = Object.freeze(
  MODULE_IDS.flatMap((moduleId) =>
    Array.from({ length: 4 }, (_, index) => `${moduleId}-O${String(index + 1).padStart(2, "0")}`),
  ),
);
const THEORY_IDS = Object.freeze(
  MODULE_IDS.flatMap((moduleId) =>
    Array.from({ length: 3 }, (_, index) => `${moduleId}-T${String(index + 1).padStart(2, "0")}`),
  ),
);
const QUESTION_IDS = Object.freeze(
  MODULE_IDS.flatMap((moduleId) =>
    Array.from({ length: 5 }, (_, index) => `${moduleId}-Q${String(index + 1).padStart(2, "0")}`),
  ),
);
const PRACTICAL_IDS = Object.freeze(
  MODULE_IDS.map((moduleId) => `${moduleId}-P01`),
);

const FOUNDATION_FILE_URLS = Object.freeze({
  manifest: new URL("../../content-drafts/digital-forensics-8h-foundation/manifest.json", import.meta.url),
  course: new URL("../../content-drafts/digital-forensics-8h-foundation/course.json", import.meta.url),
  modules: new URL("../../content-drafts/digital-forensics-8h-foundation/modules.json", import.meta.url),
  objectives: new URL("../../content-drafts/digital-forensics-8h-foundation/objectives.json", import.meta.url),
  theory: new URL("../../content-drafts/digital-forensics-8h-foundation/theory.json", import.meta.url),
  assessment: new URL("../../content-drafts/digital-forensics-8h-foundation/assessment.json", import.meta.url),
  practicals: new URL("../../content-drafts/digital-forensics-8h-foundation/practicals.json", import.meta.url),
  provenance: new URL("../../content-drafts/digital-forensics-8h-foundation/provenance.json", import.meta.url),
});

const FOUNDATION_MEMBER_ROLES = Object.freeze([
  ["manifest.json", "FOUNDATION_AUTHORITY"],
  ["course.json", "FOUNDATION_CONTENT"],
  ["modules.json", "FOUNDATION_CONTENT"],
  ["objectives.json", "FOUNDATION_CONTENT"],
  ["theory.json", "FOUNDATION_CONTENT"],
  ["assessment.json", "FOUNDATION_CONTENT"],
  ["practicals.json", "FOUNDATION_CONTENT"],
  ["provenance.json", "FOUNDATION_AUTHORITY"],
  ["validator.mjs", "VALIDATOR"],
  ["validator.test.mjs", "FOCUSED_TEST"],
] as const);

const ASSESSMENT_TYPES = new Set([
  "conceptRecognition",
  "workflowProcess",
  "scenarioReasoning",
  "artifactInterpretation",
  "timelineReasoning",
  "falsePositiveAlternativeExplanation",
]);
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

export type DigitalForensics8HRuntimeExposure = "registration" | "server-runtime";

export type DigitalForensics8HRuntimeCourseContext = Readonly<{
  id: string;
  code: string;
  slug: string;
  bindingKey: string;
  active: boolean;
  published: boolean;
  deletedAt?: string | null;
}>;

export type DigitalForensics8HRuntimeAdapterInput = Readonly<{
  runtimeCourse: DigitalForensics8HRuntimeCourseContext;
  exposure: DigitalForensics8HRuntimeExposure;
}>;

export type DigitalForensics8HSourceAuthorityInput = Readonly<{
  manifestSha256: string;
  authorityCount: number;
  competingAuthorities: number;
  memberCount: number;
  localExpressionReuse: number;
  localQuestionWordingReuse?: number;
  restrictedSourceDependence?: number;
  h04ToH08LocalSourceDependence: number;
}>;

export type DigitalForensics8HFoundationQuestion = Readonly<{
  id: string;
  moduleId: string;
  objectiveIds: readonly string[];
  theoryIds: readonly string[];
  assessmentType: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options: readonly string[];
  answerIndex: number;
  explanation: string;
  provenance: "SECURIUM_INDEPENDENTLY_AUTHORED";
}>;

export type DigitalForensics8HRuntimeModel = Readonly<{
  runtimeIdentity: Readonly<typeof DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY>;
  foundationBinding: Readonly<{
    manifestId: typeof DIGITAL_FORENSICS_8H_FOUNDATION_MANIFEST_ID;
    courseId: typeof DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId;
    code: typeof DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.code;
    slug: typeof DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.slug;
    version: typeof DIGITAL_FORENSICS_8H_FOUNDATION_VERSION;
    bindingKey: typeof DIGITAL_FORENSICS_8H_BINDING_KEY;
    status: "DRAFT_UNPUBLISHED";
  }>;
  counts: Readonly<{
    course: number;
    modules: number;
    minutes: number;
    objectives: number;
    theoryAssets: number;
    questions: number;
    explanations: number;
    practicalSpecifications: number;
    executableLabs: number;
  }>;
  moduleIds: readonly string[];
  objectiveIds: readonly string[];
  theoryIds: readonly string[];
  questionIds: readonly string[];
  practicalIds: readonly string[];
  sourceBoundary: Readonly<{
    sourceManifestSha256: typeof DIGITAL_FORENSICS_8H_SOURCE_MANIFEST_SHA256;
    sourceAuthorityCount: 1;
    sourceMemberCount: 22;
    sourcePathIntegrity: "22/22";
    sourceHashIntegrity: "22/22";
    rights: string;
    currentness: string;
    h01ToH03: "LOCAL_SOURCE_PARTIAL";
    h04ToH08: "SOURCE_SUPPORT_MISSING_FOR_STRUCTURE";
    h04ToH08LocalDependence: 0;
    sourceExpressionReuse: 0;
    sourceQuestionReuse: 0;
    ocr: 0;
    transcription: 0;
    reconstruction: 0;
    restrictedSourceDependence: 0;
  }>;
  practicalBoundary: Readonly<{
    classification: "SYNTHETIC_SPEC_ONLY";
    executableLabs: 0;
    automatedGrading: 0;
    caseId: "DF-CASE-001-credential-misuse-exfiltration";
    realPii: 0;
    realVictimEvidence: 0;
    malwareExecution: 0;
    credentialTheftExecution: 0;
  }>;
  exposure: DigitalForensics8HRuntimeExposure;
  foundation: Readonly<{
    course: Readonly<{
      courseId: string;
      code: string;
      slug: string;
      title: string;
      version: string;
      status: string;
      durationMinutes: number;
    }>;
    modules: readonly Readonly<Record<string, unknown>>[];
    objectives: readonly Readonly<Record<string, unknown>>[];
    theory: readonly Readonly<Record<string, unknown>>[];
    questions: readonly DigitalForensics8HFoundationQuestion[];
    practicals: readonly Readonly<Record<string, unknown>>[];
    provenance: Readonly<{
      localFacts: "LOCAL_SOURCE_PARTIAL";
      publicFacts: "PUBLIC_FACTUAL_AUTHORITY";
      h04ToH08LocalDependence: 0;
      sourceExpressionReuse: 0;
      restrictedSourceDependence: 0;
    }>;
  }>;
}>;

type JsonRecord = Record<string, unknown>;
type FoundationBundle = Readonly<{
  manifest: unknown;
  course: unknown;
  modules: unknown;
  objectives: unknown;
  theory: unknown;
  assessment: unknown;
  practicals: unknown;
  provenance: unknown;
}>;

export class DigitalForensics8HRuntimeAdapterError extends AppError {
  constructor(code: string, message: string, status = 409) {
    super(message, status, code);
    this.name = "DigitalForensics8HRuntimeAdapterError";
  }
}

/**
 * Loads the one approved Digital Forensics Foundation without persistence.
 * The Foundation path is fixed at module load time; callers cannot select a
 * checkout path, source package, or alternate content authority.
 */
export function loadDigitalForensics8HRuntimeModel(
  input: DigitalForensics8HRuntimeAdapterInput,
): DigitalForensics8HRuntimeModel {
  assertRuntimeContext(input);
  const bundle = loadFoundationBundle();
  const validated = validateFoundation(bundle);

  if (
    input.exposure === "server-runtime" &&
    (!input.runtimeCourse.active ||
      !input.runtimeCourse.published ||
      input.runtimeCourse.deletedAt != null)
  ) {
    throw new DigitalForensics8HRuntimeAdapterError(
      "UNPUBLISHED_ACCESS_DENIED",
      "The Digital Forensics Foundation is not publicly available.",
      404,
    );
  }

  if (
    input.exposure === "registration" &&
    (input.runtimeCourse.active ||
      input.runtimeCourse.published ||
      input.runtimeCourse.deletedAt != null)
  ) {
    throw new DigitalForensics8HRuntimeAdapterError(
      "PUBLICATION_STATE_CONFLICT",
      "Digital Forensics registration must remain inactive and unpublished.",
    );
  }

  return deepFreeze({
    runtimeIdentity: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY,
    foundationBinding: {
      manifestId: DIGITAL_FORENSICS_8H_FOUNDATION_MANIFEST_ID,
      courseId: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId,
      code: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.code,
      slug: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.slug,
      version: DIGITAL_FORENSICS_8H_FOUNDATION_VERSION,
      bindingKey: DIGITAL_FORENSICS_8H_BINDING_KEY,
      status: "DRAFT_UNPUBLISHED" as const,
    },
    counts: validated.counts,
    moduleIds: MODULE_IDS,
    objectiveIds: OBJECTIVE_IDS,
    theoryIds: THEORY_IDS,
    questionIds: QUESTION_IDS,
    practicalIds: PRACTICAL_IDS,
    sourceBoundary: validated.sourceBoundary,
    practicalBoundary: validated.practicalBoundary,
    exposure: input.exposure,
    foundation: validated.foundation,
  });
}

/**
 * Pure source-boundary guard used by the fixed Foundation loader and focused
 * tests. It validates metadata only; it never opens a source member.
 */
export function assertDigitalForensics8HSourceAuthority(
  input: DigitalForensics8HSourceAuthorityInput,
): void {
  if (
    input.manifestSha256 !== DIGITAL_FORENSICS_8H_SOURCE_MANIFEST_SHA256 ||
    input.authorityCount !== 1 ||
    input.competingAuthorities !== 0 ||
    input.memberCount !== 22 ||
    input.localExpressionReuse !== 0 ||
    (input.localQuestionWordingReuse ?? 0) !== 0 ||
    (input.restrictedSourceDependence ?? 0) !== 0 ||
    input.h04ToH08LocalSourceDependence !== 0
  ) {
    fail("SOURCE_AUTHORITY_INVALID", "Digital Forensics Foundation source authority is invalid.");
  }
}

function assertRuntimeContext(input: DigitalForensics8HRuntimeAdapterInput): void {
  if (!input || typeof input !== "object") {
    fail("RUNTIME_CONTEXT_INVALID", "Digital Forensics runtime context is invalid.");
  }
  if (input.exposure !== "registration" && input.exposure !== "server-runtime") {
    fail("RUNTIME_CONTEXT_INVALID", "Digital Forensics runtime exposure is invalid.");
  }
  const runtimeCourse = input.runtimeCourse;
  if (!runtimeCourse || typeof runtimeCourse !== "object") {
    fail("RUNTIME_CONTEXT_INVALID", "Digital Forensics runtime course context is invalid.");
  }
  if (
    runtimeCourse.id !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId ||
    runtimeCourse.code !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.code ||
    runtimeCourse.slug !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.slug ||
    runtimeCourse.bindingKey !== DIGITAL_FORENSICS_8H_BINDING_KEY
  ) {
    fail(
      "RUNTIME_IDENTITY_MISMATCH",
      "Digital Forensics runtime identity does not match the Foundation contract.",
    );
  }
  if (typeof runtimeCourse.active !== "boolean" || typeof runtimeCourse.published !== "boolean") {
    fail("RUNTIME_CONTEXT_INVALID", "Digital Forensics runtime publication state is invalid.");
  }
}

function loadFoundationBundle(): FoundationBundle {
  return {
    manifest: readJson(FOUNDATION_FILE_URLS.manifest, "manifest.json"),
    course: readJson(FOUNDATION_FILE_URLS.course, "course.json"),
    modules: readJson(FOUNDATION_FILE_URLS.modules, "modules.json"),
    objectives: readJson(FOUNDATION_FILE_URLS.objectives, "objectives.json"),
    theory: readJson(FOUNDATION_FILE_URLS.theory, "theory.json"),
    assessment: readJson(FOUNDATION_FILE_URLS.assessment, "assessment.json"),
    practicals: readJson(FOUNDATION_FILE_URLS.practicals, "practicals.json"),
    provenance: readJson(FOUNDATION_FILE_URLS.provenance, "provenance.json"),
  };
}

function readJson(url: URL, name: string): unknown {
  try {
    return JSON.parse(readFileSync(url, "utf8")) as unknown;
  } catch {
    throw new DigitalForensics8HRuntimeAdapterError(
      "FOUNDATION_NOT_FOUND",
      `The canonical Digital Forensics Foundation file could not be loaded: ${name}.`,
      409,
    );
  }
}

function validateFoundation(bundle: FoundationBundle): {
  counts: DigitalForensics8HRuntimeModel["counts"];
  sourceBoundary: DigitalForensics8HRuntimeModel["sourceBoundary"];
  practicalBoundary: DigitalForensics8HRuntimeModel["practicalBoundary"];
  foundation: DigitalForensics8HRuntimeModel["foundation"];
} {
  const manifest = record(bundle.manifest, "manifest");
  const course = record(bundle.course, "course");
  const modulesDocument = record(bundle.modules, "modules");
  const objectivesDocument = record(bundle.objectives, "objectives");
  const theoryDocument = record(bundle.theory, "theory");
  const assessmentDocument = record(bundle.assessment, "assessment");
  const practicalsDocument = record(bundle.practicals, "practicals");
  const provenanceDocument = record(bundle.provenance, "provenance");

  validateManifest(manifest);
  validateCourse(course);
  const moduleEntries = arrayField(modulesDocument, "modules", "modules.modules");
  const objectiveEntries = arrayField(
    objectivesDocument,
    "objectives",
    "objectives.objectives",
  );
  const theoryEntries = arrayField(theoryDocument, "theory", "theory.theory");
  const questionEntries = arrayField(
    assessmentDocument,
    "questions",
    "assessment.questions",
  );
  const practicalEntries = arrayField(
    practicalsDocument,
    "practicals",
    "practicals.practicals",
  );

  validateModules(modulesDocument, moduleEntries);
  const moduleById = indexById(moduleEntries, "module");
  const objectiveById = validateObjectives(objectivesDocument, objectiveEntries, moduleById);
  const theoryById = validateTheory(theoryDocument, theoryEntries, moduleById, objectiveById);
  const questions = validateAssessment(
    assessmentDocument,
    questionEntries,
    moduleById,
    objectiveById,
    theoryById,
  );
  validateModuleQuestionBindings(moduleEntries, questions);
  const practicals = validatePracticals(
    practicalsDocument,
    practicalEntries,
    moduleById,
    objectiveById,
  );
  validateObjectiveAssessmentBindings(objectiveById, theoryById, questions, practicals);
  const sourceBoundary = validateProvenance(manifest, provenanceDocument, moduleEntries);
  const practicalBoundary = validatePracticalSafety(practicalsDocument);
  validateRuntimeBoundaries(manifest, provenanceDocument);

  const counts = Object.freeze({
    course: 1,
    modules: moduleEntries.length,
    minutes: moduleEntries.reduce(
      (total, moduleEntry) => total + integerField(moduleEntry, "minutes", "module.minutes"),
      0,
    ),
    objectives: objectiveEntries.length,
    theoryAssets: theoryEntries.length,
    questions: questions.length,
    explanations: questions.filter((question) => question.explanation.length > 0).length,
    practicalSpecifications: practicalEntries.length,
    executableLabs: numberField(practicalsDocument, "executableLabs", "practicals.executableLabs"),
  });
  assertCounts(counts);

  const safeFoundation = {
    course: {
      courseId: stringField(course, "courseId", "course.courseId"),
      code: stringField(course, "code", "course.code"),
      slug: stringField(course, "slug", "course.slug"),
      title: stringField(course, "title", "course.title"),
      version: stringField(course, "version", "course.version"),
      status: stringField(course, "status", "course.status"),
      durationMinutes: integerField(course, "durationMinutes", "course.durationMinutes"),
    },
    modules: moduleEntries.map((moduleEntry) => safeModule(moduleEntry)),
    objectives: objectiveEntries.map((objectiveEntry) => safeObjective(objectiveEntry)),
    theory: theoryEntries.map((theoryEntry) => safeTheory(theoryEntry)),
    questions,
    practicals: practicals.map((practicalEntry) => practicalEntry.summary),
    provenance: {
      localFacts: "LOCAL_SOURCE_PARTIAL" as const,
      publicFacts: "PUBLIC_FACTUAL_AUTHORITY" as const,
      h04ToH08LocalDependence: 0 as const,
      sourceExpressionReuse: 0 as const,
      restrictedSourceDependence: 0 as const,
    },
  };

  return {
    counts,
    sourceBoundary,
    practicalBoundary,
    foundation: deepFreeze(safeFoundation),
  };
}

function validateManifest(manifest: JsonRecord): void {
  if (manifest.manifestId !== DIGITAL_FORENSICS_8H_FOUNDATION_MANIFEST_ID) {
    fail("FOUNDATION_IDENTITY_MISMATCH", "Digital Forensics Foundation manifest identity is invalid.");
  }
  if (manifest.authorityType !== "CANONICAL_STATIC_PRODUCT_FOUNDATION_AUTHORITY") {
    fail("FOUNDATION_AUTHORITY_INVALID", "Digital Forensics Foundation authority type is invalid.");
  }
  if (
    numberField(manifest, "productFoundationAuthorityCount", "manifest.productFoundationAuthorityCount") !== 1 ||
    numberField(manifest, "competingProductFoundationAuthorities", "manifest.competingProductFoundationAuthorities") !== 0
  ) {
    fail("FOUNDATION_AUTHORITY_CONFLICT", "Digital Forensics Foundation authority is not unique.");
  }
  if (manifest.status !== "DRAFT_UNPUBLISHED" || manifest.contentStatus !== "CANONICAL_PRODUCT_FOUNDATION_AUTHORITY_DRAFT_WITHOUT_RUNTIME_REGISTRATION") {
    fail("PUBLICATION_STATE_CONFLICT", "Digital Forensics Foundation publication state is invalid.");
  }
  const identity = record(manifest.courseIdentity, "manifest.courseIdentity");
  assertIdentity(identity, "manifest.courseIdentity");
  if (numberField(manifest, "durationMinutes", "manifest.durationMinutes") !== DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.minutes) {
    fail("COUNT_MISMATCH", "Digital Forensics Foundation duration is outside the runtime contract.");
  }
  const counts = record(manifest.counts, "manifest.counts");
  const expectedCountFields: ReadonlyArray<readonly [string, number]> = [
    ["course", DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.course],
    ["modules", DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.modules],
    ["objectives", DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.objectives],
    ["theoryAssets", DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.theoryAssets],
    ["questions", DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.questions],
    ["explanations", DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.explanations],
    ["practicalSpecifications", DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.practicalSpecifications],
    ["executableLabs", DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.executableLabs],
  ];
  for (const [field, expected] of expectedCountFields) {
    if (numberField(counts, field, `manifest.counts.${field}`) !== expected) {
      fail("COUNT_MISMATCH", `Digital Forensics Foundation manifest count ${field} is invalid.`);
    }
  }
  const files = arrayField(manifest, "files", "manifest.files");
  if (
    files.length !== FOUNDATION_MEMBER_ROLES.length ||
    files.some((fileEntry, index) => {
      const path = stringField(fileEntry, "path", `manifest.files[${index}].path`);
      const role = stringField(fileEntry, "role", `manifest.files[${index}].role`);
      return path !== FOUNDATION_MEMBER_ROLES[index][0] || role !== FOUNDATION_MEMBER_ROLES[index][1];
    })
  ) {
    fail("FOUNDATION_MEMBER_CONFLICT", "Digital Forensics Foundation member authority is invalid.");
  }
  const sourceAuthority = record(manifest.sourceAuthority, "manifest.sourceAuthority");
  assertSourceAuthority(sourceAuthority, "manifest.sourceAuthority", true);
  const provenancePolicy = record(manifest.provenancePolicy, "manifest.provenancePolicy");
  if (
    provenancePolicy.questionExpressionReuse !== 0 ||
    provenancePolicy.practicalExpressionReuse !== 0 ||
    provenancePolicy.restrictedSourceExpressionReuse !== 0 ||
    provenancePolicy.unknownRightsFailClosed !== 1
  ) {
    fail("PROVENANCE_BOUNDARY_INVALID", "Digital Forensics Foundation provenance policy is invalid.");
  }
}

function validateCourse(course: JsonRecord): void {
  assertIdentity(course, "course");
  if (
    course.status !== "DRAFT_UNPUBLISHED" ||
    course.durationMinutes !== DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.minutes ||
    course.publicationDefault !== "UNPUBLISHED"
  ) {
    fail("PUBLICATION_STATE_CONFLICT", "Digital Forensics Foundation course publication state is invalid.");
  }
  const rights = record(course.rightsAndProvenance, "course.rightsAndProvenance");
  if (
    rights.sourceBoundary !== "DIGITAL_FORENSICS_RIGHTS_READY_FOR_FACTS_ONLY_AUTHORING" ||
    rights.restrictedSourceExpressionReuse !== 0 ||
    rights.officialExamOrQualificationClaim !== 0
  ) {
    fail("RIGHTS_BOUNDARY_INVALID", "Digital Forensics Foundation rights boundary is invalid.");
  }
}

function validateModules(document: JsonRecord, moduleEntries: JsonRecord[]): void {
  if (
    document.courseId !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId ||
    document.minutesTotal !== DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.minutes
  ) {
    fail("COUNT_MISMATCH", "Digital Forensics Foundation module totals are invalid.");
  }
  assertOrderedIds(moduleEntries.map((moduleEntry) => stringField(moduleEntry, "id", "module.id")), MODULE_IDS, "module");
  moduleEntries.forEach((moduleEntry, moduleIndex) => {
    if (integerField(moduleEntry, "minutes", `modules[${moduleIndex}].minutes`) !== 60) {
      fail("COUNT_MISMATCH", "Digital Forensics Foundation module minutes are invalid.");
    }
    const moduleId = MODULE_IDS[moduleIndex];
    assertOrderedIds(stringArrayField(moduleEntry, "objectiveIds", `modules[${moduleIndex}].objectiveIds`), expectedObjectiveIds(moduleId), "module objectives");
    assertOrderedIds(stringArrayField(moduleEntry, "theoryIds", `modules[${moduleIndex}].theoryIds`), expectedTheoryIds(moduleId), "module theory");
    assertOrderedIds(stringArrayField(moduleEntry, "questionIds", `modules[${moduleIndex}].questionIds`), expectedQuestionIds(moduleId), "module questions");
    if (moduleEntry.practicalId !== `${moduleId}-P01`) {
      fail("PRACTICAL_ID_CONFLICT", "Digital Forensics Foundation module practical binding is invalid.");
    }
    const support = record(moduleEntry.sourceSupport, `modules[${moduleIndex}].sourceSupport`);
    const expectedLocal = moduleIndex < 3 ? "LOCAL_SOURCE_PARTIAL" : "SOURCE_SUPPORT_MISSING_FOR_STRUCTURE";
    if (
      support.local !== expectedLocal ||
      support.public !== "PUBLIC_FACTUAL_AUTHORITY_REQUIRED" ||
      support.design !== "SECURIUM_INDEPENDENT_DESIGN" ||
      support.localSourceDependence !== 0
    ) {
      fail("SOURCE_BOUNDARY_INVALID", "Digital Forensics Foundation module source support is invalid.");
    }
  });
}

function validateObjectives(
  document: JsonRecord,
  objectiveEntries: JsonRecord[],
  moduleById: Map<string, JsonRecord>,
): Map<string, JsonRecord> {
  if (
    document.courseId !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId ||
    document.objectiveCount !== DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.objectives ||
    document.objectivesPerModule !== 4 ||
    document.orphanObjectives !== 0
  ) {
    fail("TRACEABILITY_INVALID", "Digital Forensics Foundation objective contract is invalid.");
  }
  const objectiveById = indexById(objectiveEntries, "objective");
  assertOrderedIds([...objectiveById.keys()], OBJECTIVE_IDS, "objective");
  objectiveEntries.forEach((objectiveEntry, index) => {
    const id = stringField(objectiveEntry, "id", `objectives[${index}].id`);
    const moduleId = stringField(objectiveEntry, "module", `objectives[${index}].module`);
    if (!moduleById.has(moduleId) || !id.startsWith(`${moduleId}-O`)) {
      fail("TRACEABILITY_INVALID", "Digital Forensics Foundation objective module binding is invalid.");
    }
    const expectedLocal = MODULE_IDS.indexOf(moduleId) < 3 ? "LOCAL_SOURCE_PARTIAL" : "SOURCE_SUPPORT_MISSING_FOR_STRUCTURE";
    const expectedSupport = `${expectedLocal}; PUBLIC_FACTUAL_AUTHORITY_REQUIRED; SECURIUM_INDEPENDENT_DESIGN`;
    if (objectiveEntry.sourceSupport !== expectedSupport || objectiveEntry.provenance !== "SECURIUM_INDEPENDENTLY_AUTHORED") {
      fail("SOURCE_BOUNDARY_INVALID", "Digital Forensics Foundation objective provenance is invalid.");
    }
    nonEmptyTextField(objectiveEntry, "outcome", `objectives[${index}].outcome`);
  });
  return objectiveById;
}

function validateTheory(
  document: JsonRecord,
  theoryEntries: JsonRecord[],
  moduleById: Map<string, JsonRecord>,
  objectiveById: Map<string, JsonRecord>,
): Map<string, JsonRecord> {
  if (
    document.courseId !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId ||
    document.assetCount !== DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.theoryAssets ||
    document.assetsPerModule !== 3 ||
    document.provenance !== "SECURIUM_INDEPENDENTLY_AUTHORED" ||
    document.sourceExpressionReuse !== 0
  ) {
    fail("THEORY_AUTHORITY_INVALID", "Digital Forensics Foundation theory authority is invalid.");
  }
  const theoryById = indexById(theoryEntries, "theory");
  assertOrderedIds([...theoryById.keys()], THEORY_IDS, "theory");
  theoryEntries.forEach((theoryEntry, index) => {
    const moduleId = stringField(theoryEntry, "module", `theory[${index}].module`);
    if (!moduleById.has(moduleId) || theoryEntry.provenance !== "SECURIUM_INDEPENDENTLY_AUTHORED") {
      fail("THEORY_AUTHORITY_INVALID", "Digital Forensics Foundation theory binding is invalid.");
    }
    const objectiveIds = stringArrayField(theoryEntry, "objectiveIds", `theory[${index}].objectiveIds`);
    if (objectiveIds.length === 0 || objectiveIds.some((objectiveId) => !objectiveById.has(objectiveId))) {
      fail("TRACEABILITY_INVALID", "Digital Forensics Foundation theory objective binding is invalid.");
    }
    if (stringArrayField(theoryEntry, "authorityIds", `theory[${index}].authorityIds`).length === 0) {
      fail("PROVENANCE_BOUNDARY_INVALID", "Digital Forensics Foundation theory authority references are missing.");
    }
  });
  return theoryById;
}

function validateAssessment(
  document: JsonRecord,
  questionEntries: JsonRecord[],
  moduleById: Map<string, JsonRecord>,
  objectiveById: Map<string, JsonRecord>,
  theoryById: Map<string, JsonRecord>,
): DigitalForensics8HFoundationQuestion[] {
  if (
    document.courseId !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId ||
    document.status !== "DRAFT_UNPUBLISHED" ||
    document.total !== DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.questions ||
    document.perModule !== 5 ||
    document.explanationsRequired !== "40/40" ||
    document.provenance !== "SECURIUM_INDEPENDENTLY_AUTHORED" ||
    document.localQuestionWordingReuse !== 0 ||
    document.restrictedScreenshots !== 0 ||
    document.questionReconstruction !== 0
  ) {
    fail("QUESTION_AUTHORITY_INVALID", "Digital Forensics Foundation assessment authority is invalid.");
  }
  const questions = questionEntries.map((questionEntry, index) => {
    const id = stringField(questionEntry, "id", `assessment.questions[${index}].id`);
    const moduleId = stringField(questionEntry, "module", `assessment.questions[${index}].module`);
    const objectiveIds = stringArrayField(questionEntry, "objectiveIds", `assessment.questions[${index}].objectiveIds`);
    const theoryIds = stringArrayField(questionEntry, "theoryIds", `assessment.questions[${index}].theoryIds`);
    const assessmentType = stringField(questionEntry, "type", `assessment.questions[${index}].type`);
    const difficulty = stringField(questionEntry, "difficulty", `assessment.questions[${index}].difficulty`);
    const prompt = nonEmptyTextField(questionEntry, "prompt", `assessment.questions[${index}].prompt`);
    const options = stringArrayField(questionEntry, "options", `assessment.questions[${index}].options`);
    const answerIndex = questionEntry.answer;
    const explanation = nonEmptyTextField(questionEntry, "explanation", `assessment.questions[${index}].explanation`);
    if (
      id !== QUESTION_IDS[index] ||
      !moduleById.has(moduleId) ||
      !id.startsWith(`${moduleId}-Q`) ||
      objectiveIds.length !== 1 ||
      objectiveIds.some((objectiveId) => !objectiveById.has(objectiveId)) ||
      theoryIds.length !== 1 ||
      theoryIds.some((theoryId) => !theoryById.has(theoryId)) ||
      !ASSESSMENT_TYPES.has(assessmentType) ||
      !DIFFICULTIES.has(difficulty) ||
      options.length !== 4 ||
      options.some((option) => option.trim() !== option || option.length === 0) ||
      typeof answerIndex !== "number" ||
      !Number.isInteger(answerIndex) ||
      answerIndex < 0 ||
      answerIndex >= options.length ||
      questionEntry.provenance !== "SECURIUM_INDEPENDENTLY_AUTHORED" ||
      questionEntry.sourceExpressionReuse !== 0
    ) {
      fail("QUESTION_AUTHORITY_INVALID", "Digital Forensics Foundation question authority is invalid.");
    }
    return {
      id,
      moduleId,
      objectiveIds: Object.freeze([...objectiveIds]),
      theoryIds: Object.freeze([...theoryIds]),
      assessmentType,
      difficulty: difficulty as DigitalForensics8HFoundationQuestion["difficulty"],
      prompt,
      options: Object.freeze([...options]),
      answerIndex,
      explanation,
      provenance: "SECURIUM_INDEPENDENTLY_AUTHORED" as const,
    };
  });

  const typeDistribution = countBy(questions, (question) => question.assessmentType);
  const difficultyDistribution = countBy(questions, (question) => question.difficulty);
  assertDistribution(typeDistribution, {
    conceptRecognition: 7,
    workflowProcess: 7,
    scenarioReasoning: 8,
    artifactInterpretation: 7,
    timelineReasoning: 4,
    falsePositiveAlternativeExplanation: 7,
  }, "question type");
  assertDistribution(difficultyDistribution, { easy: 10, medium: 20, hard: 10 }, "difficulty");
  return questions;
}

function validateModuleQuestionBindings(
  moduleEntries: JsonRecord[],
  questions: readonly DigitalForensics8HFoundationQuestion[],
): void {
  const questionIdsByModule = new Map<string, string[]>();
  for (const question of questions) {
    const existing = questionIdsByModule.get(question.moduleId) ?? [];
    existing.push(question.id);
    questionIdsByModule.set(question.moduleId, existing);
  }
  moduleEntries.forEach((moduleEntry, index) => {
    const moduleId = MODULE_IDS[index];
    const expected = expectedQuestionIds(moduleId);
    const actual = questionIdsByModule.get(moduleId) ?? [];
    assertOrderedIds(actual, expected, "module question binding");
    const declared = stringArrayField(moduleEntry, "questionIds", `modules[${index}].questionIds`);
    assertOrderedIds(declared, actual, "module question declaration");
  });
}

function validatePracticals(
  document: JsonRecord,
  practicalEntries: JsonRecord[],
  moduleById: Map<string, JsonRecord>,
  objectiveById: Map<string, JsonRecord>,
): Array<{ id: string; summary: Readonly<Record<string, unknown>> }> {
  if (
    document.courseId !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId ||
    document.status !== "DRAFT_UNPUBLISHED" ||
    document.total !== DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.practicalSpecifications ||
    document.perModule !== 1 ||
    document.classification !== "SYNTHETIC_SPEC_ONLY" ||
    document.executable !== false ||
    document.executableLabs !== 0 ||
    document.automatedGrader !== 0 ||
    document.caseId !== "DF-CASE-001-credential-misuse-exfiltration"
  ) {
    fail("PRACTICAL_BOUNDARY_INVALID", "Digital Forensics Foundation practical boundary is invalid.");
  }
  return practicalEntries.map((practicalEntry, index) => {
    const id = stringField(practicalEntry, "id", `practicals[${index}].id`);
    const moduleId = stringField(practicalEntry, "module", `practicals[${index}].module`);
    const objectiveIds = stringArrayField(practicalEntry, "objectiveIds", `practicals[${index}].objectiveIds`);
    if (
      id !== PRACTICAL_IDS[index] ||
      !moduleById.has(moduleId) ||
      objectiveIds.length !== 4 ||
      objectiveIds.some((objectiveId) => !objectiveById.has(objectiveId)) ||
      practicalEntry.classification !== "SYNTHETIC_SPEC_ONLY" ||
      !String(practicalEntry.provenance).includes("SECURIUM_INDEPENDENTLY_AUTHORED") ||
      !String(practicalEntry.provenance).includes("SYNTHETIC_SPEC_ONLY") ||
      ("executable" in practicalEntry && practicalEntry.executable !== false) ||
      ("automatedGrader" in practicalEntry && ![null, false, 0].includes(practicalEntry.automatedGrader as null | boolean | number))
    ) {
      fail("PRACTICAL_BOUNDARY_INVALID", "Digital Forensics Foundation practical specification is invalid.");
    }
    return {
      id,
      summary: {
        id,
        moduleId,
        objectiveIds: Object.freeze([...objectiveIds]),
        classification: "SYNTHETIC_SPEC_ONLY",
        executable: false,
      },
    };
  });
}

function validateObjectiveAssessmentBindings(
  objectiveById: Map<string, JsonRecord>,
  theoryById: Map<string, JsonRecord>,
  questions: readonly DigitalForensics8HFoundationQuestion[],
  practicals: ReadonlyArray<{ id: string; summary: Readonly<Record<string, unknown>> }>,
): void {
  const questionIds = new Set(questions.map((question) => question.id));
  const theoryIds = new Set(theoryById.keys());
  const practicalIds = new Set(practicals.map((practical) => practical.id));
  for (const [objectiveId, objectiveEntry] of objectiveById) {
    const theoryRefs = stringArrayField(objectiveEntry, "theoryIds", `objective ${objectiveId}.theoryIds`);
    const questionRefs = stringArrayField(objectiveEntry, "questionIds", `objective ${objectiveId}.questionIds`);
    const practicalId = stringField(objectiveEntry, "practicalId", `objective ${objectiveId}.practicalId`);
    if (
      theoryRefs.length === 0 || theoryRefs.some((theoryId) => !theoryIds.has(theoryId)) ||
      questionRefs.length === 0 || questionRefs.some((questionId) => !questionIds.has(questionId)) ||
      !practicalIds.has(practicalId)
    ) {
      fail("TRACEABILITY_INVALID", "Digital Forensics Foundation objective traceability is incomplete.");
    }
  }
}

function validateProvenance(
  manifest: JsonRecord,
  provenanceDocument: JsonRecord,
  moduleEntries: JsonRecord[],
): DigitalForensics8HRuntimeModel["sourceBoundary"] {
  if (
    provenanceDocument.courseId !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId ||
    provenanceDocument.status !== "DRAFT_UNPUBLISHED"
  ) {
    fail("PROVENANCE_BOUNDARY_INVALID", "Digital Forensics Foundation provenance identity is invalid.");
  }
  const sourceAuthority = record(provenanceDocument.sourceAuthority, "provenance.sourceAuthority");
  assertSourceAuthority(sourceAuthority, "provenance.sourceAuthority", false);
  const supportEntries = arrayField(provenanceDocument, "sourceSupportByModule", "provenance.sourceSupportByModule");
  if (supportEntries.length !== MODULE_IDS.length) {
    fail("SOURCE_BOUNDARY_INVALID", "Digital Forensics Foundation source support coverage is incomplete.");
  }
  supportEntries.forEach((supportEntry, index) => {
    const expectedLocal = index < 3 ? "LOCAL_SOURCE_PARTIAL" : "SOURCE_SUPPORT_MISSING_FOR_STRUCTURE";
    if (
      supportEntry.module !== MODULE_IDS[index] ||
      supportEntry.local !== expectedLocal ||
      supportEntry.public !== "PUBLIC_FACTUAL_AUTHORITY_REQUIRED" ||
      supportEntry.design !== "SECURIUM_INDEPENDENT_DESIGN"
    ) {
      fail("SOURCE_BOUNDARY_INVALID", "Digital Forensics Foundation source support classification is invalid.");
    }
  });
  const rightsRules = record(provenanceDocument.rightsRules, "provenance.rightsRules");
  if (rightsRules.restrictedDependency !== 0) {
    fail("RIGHTS_BOUNDARY_INVALID", "Digital Forensics Foundation restricted dependency is invalid.");
  }
  if (moduleEntries.some((moduleEntry) => record(moduleEntry.sourceSupport, "module.sourceSupport").localSourceDependence !== 0)) {
    fail("SOURCE_BOUNDARY_INVALID", "Digital Forensics Foundation local source dependence is invalid.");
  }
  const manifestSource = record(manifest.sourceAuthority, "manifest.sourceAuthority");
  return {
    sourceManifestSha256: DIGITAL_FORENSICS_8H_SOURCE_MANIFEST_SHA256,
    sourceAuthorityCount: numberField(manifestSource, "authorityCount", "manifest.sourceAuthority.authorityCount") as 1,
    sourceMemberCount: numberField(manifestSource, "memberCount", "manifest.sourceAuthority.memberCount") as 22,
    sourcePathIntegrity: "22/22",
    sourceHashIntegrity: "22/22",
    rights: stringField(manifestSource, "rights", "manifest.sourceAuthority.rights"),
    currentness: stringField(manifestSource, "currentness", "manifest.sourceAuthority.currentness"),
    h01ToH03: "LOCAL_SOURCE_PARTIAL",
    h04ToH08: "SOURCE_SUPPORT_MISSING_FOR_STRUCTURE",
    h04ToH08LocalDependence: 0,
    sourceExpressionReuse: 0,
    sourceQuestionReuse: 0,
    ocr: 0,
    transcription: 0,
    reconstruction: 0,
    restrictedSourceDependence: 0,
  };
}

function validatePracticalSafety(document: JsonRecord): DigitalForensics8HRuntimeModel["practicalBoundary"] {
  const safety = record(document.practicalSafety, "practicals.practicalSafety");
  const zeroFields = ["realPii", "realVictimEvidence", "malwareExecution", "credentialTheftExecution", "uncontrolledNetworkTarget"];
  if (
    safety.synthetic !== 1 ||
    zeroFields.some((field) => safety[field] !== 0)
  ) {
    fail("PRACTICAL_SAFETY_INVALID", "Digital Forensics Foundation practical safety boundary is invalid.");
  }
  return {
    classification: "SYNTHETIC_SPEC_ONLY",
    executableLabs: 0,
    automatedGrading: 0,
    caseId: "DF-CASE-001-credential-misuse-exfiltration",
    realPii: 0,
    realVictimEvidence: 0,
    malwareExecution: 0,
    credentialTheftExecution: 0,
  };
}

function validateRuntimeBoundaries(manifest: JsonRecord, provenance: JsonRecord): void {
  const manifestBoundaryKeys = [
    "runtimeRegistration",
    "publication",
    "schemaChanges",
    "migrationChanges",
    "drizzleChanges",
    "databaseOperations",
    "ontologyMappings",
    "roleSkillConceptMappings",
    "evidenceProjection",
    "learnerSkillState",
    "masteryComputation",
    "confidenceComputation",
    "competencyEvidence",
    "digitalTwinState",
  ];
  const provenanceBoundaryKeys = [
    "runtimeRegistration",
    "publication",
    "databaseOperations",
    "ontologyMappings",
    "evidenceProjection",
    "learnerSkillState",
  ];
  for (const [document, boundaryKeys] of [[manifest, manifestBoundaryKeys], [provenance, provenanceBoundaryKeys]] as const) {
    const boundary = record(document.runtimeBoundary, "runtimeBoundary");
    for (const key of boundaryKeys) {
      if (boundary[key] !== 0) {
        fail("RUNTIME_BOUNDARY_INVALID", `Digital Forensics Foundation runtime boundary ${key} is nonzero.`);
      }
    }
  }
}

function assertSourceAuthority(sourceAuthority: JsonRecord, label: string, requireIntegrityCounters: boolean): void {
  if (
    sourceAuthority.manifestSha256 !== DIGITAL_FORENSICS_8H_SOURCE_MANIFEST_SHA256 ||
    sourceAuthority.rights !== "DIGITAL_FORENSICS_RIGHTS_READY_FOR_FACTS_ONLY_AUTHORING" ||
    sourceAuthority.currentness !== "DIGITAL_FORENSICS_SOURCE_CURRENTNESS_READY_WITH_LIMITATIONS" ||
    sourceAuthority.localExpressionReuse !== 0 ||
    ("localQuestionWordingReuse" in sourceAuthority && sourceAuthority.localQuestionWordingReuse !== 0) ||
    ("restrictedSourceDependence" in sourceAuthority && sourceAuthority.restrictedSourceDependence !== 0) ||
    sourceAuthority.h04ToH08LocalSourceDependence !== 0 ||
    (requireIntegrityCounters && (
      sourceAuthority.authorityCount !== 1 ||
      sourceAuthority.competingAuthorities !== 0 ||
      sourceAuthority.memberCount !== 22
    ))
  ) {
    fail("SOURCE_AUTHORITY_INVALID", `Digital Forensics Foundation ${label} is invalid.`);
  }
  assertDigitalForensics8HSourceAuthority({
    manifestSha256: String(sourceAuthority.manifestSha256),
    authorityCount: requireIntegrityCounters ? Number(sourceAuthority.authorityCount) : 1,
    competingAuthorities: requireIntegrityCounters ? Number(sourceAuthority.competingAuthorities) : 0,
    memberCount: requireIntegrityCounters ? Number(sourceAuthority.memberCount) : 22,
    localExpressionReuse: Number(sourceAuthority.localExpressionReuse),
    localQuestionWordingReuse: "localQuestionWordingReuse" in sourceAuthority
      ? Number(sourceAuthority.localQuestionWordingReuse)
      : 0,
    restrictedSourceDependence: "restrictedSourceDependence" in sourceAuthority
      ? Number(sourceAuthority.restrictedSourceDependence)
      : 0,
    h04ToH08LocalSourceDependence: Number(sourceAuthority.h04ToH08LocalSourceDependence),
  });
}

function assertIdentity(identity: JsonRecord, label: string): void {
  if (
    identity.courseId !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId ||
    identity.code !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.code ||
    identity.slug !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.slug ||
    identity.version !== DIGITAL_FORENSICS_8H_FOUNDATION_VERSION
  ) {
    fail("FOUNDATION_IDENTITY_MISMATCH", `Digital Forensics Foundation ${label} identity is invalid.`);
  }
}

function assertCounts(counts: DigitalForensics8HRuntimeModel["counts"]): void {
  const expected = DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS;
  if (
    counts.course !== expected.course ||
    counts.modules !== expected.modules ||
    counts.minutes !== expected.minutes ||
    counts.objectives !== expected.objectives ||
    counts.theoryAssets !== expected.theoryAssets ||
    counts.questions !== expected.questions ||
    counts.explanations !== expected.explanations ||
    counts.practicalSpecifications !== expected.practicalSpecifications ||
    counts.executableLabs !== expected.executableLabs
  ) {
    fail("COUNT_MISMATCH", "Digital Forensics Foundation counts are outside the runtime contract.");
  }
}

function indexById(entries: JsonRecord[], label: string): Map<string, JsonRecord> {
  const result = new Map<string, JsonRecord>();
  for (const [index, entry] of entries.entries()) {
    const id = stringField(entry, "id", `${label}[${index}].id`);
    if (result.has(id)) fail("DUPLICATE_ID", `Digital Forensics Foundation contains duplicate ${label} ID ${id}.`);
    result.set(id, entry);
  }
  return result;
}

function safeModule(moduleEntry: JsonRecord): Readonly<Record<string, unknown>> {
  return {
    id: stringField(moduleEntry, "id", "module.id"),
    title: stringField(moduleEntry, "title", "module.title"),
    minutes: integerField(moduleEntry, "minutes", "module.minutes"),
    purpose: stringField(moduleEntry, "purpose", "module.purpose"),
    objectiveIds: Object.freeze([...stringArrayField(moduleEntry, "objectiveIds", "module.objectiveIds")]),
    theoryIds: Object.freeze([...stringArrayField(moduleEntry, "theoryIds", "module.theoryIds")]),
    questionIds: Object.freeze([...stringArrayField(moduleEntry, "questionIds", "module.questionIds")]),
    practicalId: stringField(moduleEntry, "practicalId", "module.practicalId"),
  };
}

function safeObjective(objectiveEntry: JsonRecord): Readonly<Record<string, unknown>> {
  return {
    id: stringField(objectiveEntry, "id", "objective.id"),
    module: stringField(objectiveEntry, "module", "objective.module"),
    theoryIds: Object.freeze([...stringArrayField(objectiveEntry, "theoryIds", "objective.theoryIds")]),
    questionIds: Object.freeze([...stringArrayField(objectiveEntry, "questionIds", "objective.questionIds")]),
    practicalId: stringField(objectiveEntry, "practicalId", "objective.practicalId"),
    outcome: stringField(objectiveEntry, "outcome", "objective.outcome"),
  };
}

function safeTheory(theoryEntry: JsonRecord): Readonly<Record<string, unknown>> {
  return {
    id: stringField(theoryEntry, "id", "theory.id"),
    module: stringField(theoryEntry, "module", "theory.module"),
    title: stringField(theoryEntry, "title", "theory.title"),
    objectiveIds: Object.freeze([...stringArrayField(theoryEntry, "objectiveIds", "theory.objectiveIds")]),
    authorityIds: Object.freeze([...stringArrayField(theoryEntry, "authorityIds", "theory.authorityIds")]),
  };
}

function expectedObjectiveIds(moduleId: string): readonly string[] {
  return OBJECTIVE_IDS.filter((objectiveId) => objectiveId.startsWith(`${moduleId}-`));
}

function expectedTheoryIds(moduleId: string): readonly string[] {
  return THEORY_IDS.filter((theoryId) => theoryId.startsWith(`${moduleId}-`));
}

function expectedQuestionIds(moduleId: string): readonly string[] {
  return QUESTION_IDS.filter((questionId) => questionId.startsWith(`${moduleId}-`));
}

function assertOrderedIds(actual: readonly string[], expected: readonly string[], label: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    fail("ID_BINDING_CONFLICT", `Digital Forensics Foundation ${label} IDs are not canonical.`);
  }
}

function assertDistribution(
  actual: Map<string, number>,
  expected: Record<string, number>,
  label: string,
): void {
  const actualKeys = [...actual.keys()].sort();
  const expectedKeys = Object.keys(expected).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    expectedKeys.some((key) => actual.get(key) !== expected[key])
  ) {
    fail("DISTRIBUTION_MISMATCH", `Digital Forensics Foundation ${label} distribution is invalid.`);
  }
}

function countBy<T>(entries: readonly T[], selector: (entry: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(selector(entry), (counts.get(selector(entry)) ?? 0) + 1);
  return counts;
}

function record(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("FOUNDATION_INVALID", `Digital Forensics Foundation ${label} must be an object.`);
  }
  return value as JsonRecord;
}

function arrayField(recordValue: JsonRecord, key: string, label: string): JsonRecord[] {
  if (!Array.isArray(recordValue[key])) fail("FOUNDATION_INVALID", `Digital Forensics Foundation ${label} must be an array.`);
  return (recordValue[key] as unknown[]).map((entry, index) => record(entry, `${label}[${index}]`));
}

function stringArrayField(recordValue: JsonRecord, key: string, label: string): string[] {
  if (!Array.isArray(recordValue[key])) fail("FOUNDATION_INVALID", `Digital Forensics Foundation ${label} must be an array.`);
  const values = recordValue[key] as unknown[];
  if (values.some((value) => typeof value !== "string" || value.trim() !== value || value.length === 0)) {
    fail("FOUNDATION_INVALID", `Digital Forensics Foundation ${label} contains invalid strings.`);
  }
  return values as string[];
}

function stringField(recordValue: JsonRecord, key: string, label: string): string {
  const value = recordValue[key];
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    fail("FOUNDATION_INVALID", `Digital Forensics Foundation ${label} must be a non-empty string.`);
  }
  return value;
}

function nonEmptyTextField(recordValue: JsonRecord, key: string, label: string): string {
  return stringField(recordValue, key, label);
}

function integerField(recordValue: JsonRecord, key: string, label: string): number {
  const value = recordValue[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    fail("FOUNDATION_INVALID", `Digital Forensics Foundation ${label} must be an integer.`);
  }
  return value;
}

function numberField(recordValue: JsonRecord, key: string, label: string): number {
  return integerField(recordValue, key, label);
}

function fail(code: string, message: string): never {
  throw new DigitalForensics8HRuntimeAdapterError(code, message);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
