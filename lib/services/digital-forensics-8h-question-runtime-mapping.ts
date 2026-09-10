import {
  gradeQuestion,
  requireSupportedGrade,
  type GradeResult,
  type GradingQuestion,
  type SubmittedAnswer,
} from "./grading-service.ts";
import { stableJson } from "./question-governance.ts";
import { AppError } from "../errors.ts";
import {
  DIGITAL_FORENSICS_8H_BINDING_KEY,
  DIGITAL_FORENSICS_8H_FOUNDATION_MANIFEST_ID,
  DIGITAL_FORENSICS_8H_FOUNDATION_VERSION,
  DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS,
  DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY,
  DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE,
  DIGITAL_FORENSICS_8H_SOURCE_MANIFEST_SHA256,
  loadDigitalForensics8HRuntimeModel,
  type DigitalForensics8HFoundationQuestion,
  type DigitalForensics8HRuntimeAdapterInput,
  type DigitalForensics8HRuntimeModel,
} from "./digital-forensics-8h-runtime-adapter.ts";

export const DIGITAL_FORENSICS_8H_QUESTION_MAPPING_CONTRACT_VERSION =
  "SECURIUM_DIGITAL_FORENSICS_8H_QUESTION_MAPPING_V1" as const;

export type DigitalForensics8HRuntimeDifficulty = "EASY" | "MEDIUM" | "HARD";

export type DigitalForensics8HRuntimeQuestionChoice = Readonly<{
  id: string;
  questionId: string;
  content: string;
  displayOrder: number;
}>;

export type DigitalForensics8HRuntimeQuestionMapping = Readonly<{
  foundationQuestionId: string;
  foundationVersion: typeof DIGITAL_FORENSICS_8H_FOUNDATION_VERSION;
  moduleId: string;
  objectiveIds: readonly string[];
  foundationAssessmentType: string;
  foundationDifficulty: DigitalForensics8HFoundationQuestion["difficulty"];
  semanticHash: string;
  runtimeQuestionId: string;
  runtimeQuestionVersionId: string;
  question: Readonly<{
    id: string;
    title: string;
    content: string;
    type: typeof DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE;
    difficulty: DigitalForensics8HRuntimeDifficulty;
    explanation: string;
    status: "DRAFT";
    source: "SECURIUM_INDEPENDENTLY_AUTHORED";
    version: 1;
  }>;
  choices: readonly DigitalForensics8HRuntimeQuestionChoice[];
  courseBinding: Readonly<{
    questionId: string;
    courseId: typeof DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId;
    weight: 100;
  }>;
  version: Readonly<{
    id: string;
    questionId: string;
    version: 1;
    snapshotJson: string;
    semanticHash: string;
    foundationManifestId: typeof DIGITAL_FORENSICS_8H_FOUNDATION_MANIFEST_ID;
    foundationVersion: typeof DIGITAL_FORENSICS_8H_FOUNDATION_VERSION;
    conceptMappingSetHash: null;
  }>;
  serverOnlyGrading: Readonly<{
    type: typeof DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE;
    correctChoiceId: string;
  }>;
}>;

export type DigitalForensics8HRuntimeQuestionMappingManifest = Readonly<{
  contractVersion: typeof DIGITAL_FORENSICS_8H_QUESTION_MAPPING_CONTRACT_VERSION;
  courseId: typeof DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId;
  code: typeof DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.code;
  courseSlug: typeof DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.slug;
  bindingKey: typeof DIGITAL_FORENSICS_8H_BINDING_KEY;
  foundationManifestId: typeof DIGITAL_FORENSICS_8H_FOUNDATION_MANIFEST_ID;
  foundationVersion: typeof DIGITAL_FORENSICS_8H_FOUNDATION_VERSION;
  questionCount: 40;
  mappings: readonly DigitalForensics8HRuntimeQuestionMapping[];
}>;

/**
 * Loads the fixed Foundation and creates the deterministic question projection.
 * This performs no persistence, registration, network access, or learner-state
 * work. The registration exposure is intentional: the Foundation is still
 * DRAFT_UNPUBLISHED and public runtime exposure must fail closed.
 */
export async function buildDigitalForensics8HQuestionRuntimeMapping(
  input: DigitalForensics8HRuntimeAdapterInput,
): Promise<DigitalForensics8HRuntimeQuestionMappingManifest> {
  const model = loadDigitalForensics8HRuntimeModel(input);
  return projectDigitalForensics8HQuestionRuntimeMapping(model);
}

/**
 * Projects an already validated adapter model. Rechecks the fixed contract so
 * a forged or stale model cannot become a second question authority.
 */
export async function projectDigitalForensics8HQuestionRuntimeMapping(
  model: DigitalForensics8HRuntimeModel,
): Promise<DigitalForensics8HRuntimeQuestionMappingManifest> {
  assertRuntimeModel(model);
  const mappings = await Promise.all(
    model.foundation.questions.map((question) => createMapping(question)),
  );
  const runtimeQuestionIds = mappings.map((mapping) => mapping.runtimeQuestionId);
  const runtimeVersionIds = mappings.map((mapping) => mapping.runtimeQuestionVersionId);
  assertUnique(runtimeQuestionIds, "runtime question");
  assertUnique(runtimeVersionIds, "runtime question version");
  if (mappings.length !== DIGITAL_FORENSICS_8H_FOUNDATION_COUNTS.questions) {
    fail("COUNT_MISMATCH", "Digital Forensics runtime question mapping is not complete.");
  }
  return deepFreeze({
    contractVersion: DIGITAL_FORENSICS_8H_QUESTION_MAPPING_CONTRACT_VERSION,
    courseId: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId,
    code: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.code,
    courseSlug: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.slug,
    bindingKey: DIGITAL_FORENSICS_8H_BINDING_KEY,
    foundationManifestId: DIGITAL_FORENSICS_8H_FOUNDATION_MANIFEST_ID,
    foundationVersion: DIGITAL_FORENSICS_8H_FOUNDATION_VERSION,
    questionCount: 40 as const,
    mappings,
  });
}

/** Recomputes the projection and rejects every semantic mismatch. */
export async function assertDigitalForensics8HQuestionRuntimeMapping(
  candidate: DigitalForensics8HRuntimeQuestionMappingManifest,
  model: DigitalForensics8HRuntimeModel,
): Promise<void> {
  if (!candidate || typeof candidate !== "object") {
    fail("MAPPING_PROJECTION_MISMATCH", "Digital Forensics question mapping is invalid.");
  }
  const expected = await projectDigitalForensics8HQuestionRuntimeMapping(model);
  if (stableJson(candidate) !== stableJson(expected)) {
    fail(
      "MAPPING_PROJECTION_MISMATCH",
      "Digital Forensics question mapping does not match its Foundation projection.",
    );
  }
}

/**
 * Returns the learner-safe DTO. The correct answer is intentionally absent;
 * only the server-only grading bridge carries correctness.
 */
export function toDigitalForensics8HLearnerQuestion(
  mapping: DigitalForensics8HRuntimeQuestionMapping,
): Readonly<{
  id: string;
  title: string;
  content: string;
  type: typeof DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE;
  difficulty: DigitalForensics8HRuntimeDifficulty;
  explanation: string;
  choices: readonly DigitalForensics8HRuntimeQuestionChoice[];
  foundationQuestionId: string;
  foundationVersion: typeof DIGITAL_FORENSICS_8H_FOUNDATION_VERSION;
  semanticHash: string;
}> {
  assertMappingShape(mapping);
  return deepFreeze({
    id: mapping.question.id,
    title: mapping.question.title,
    content: mapping.question.content,
    type: mapping.question.type,
    difficulty: mapping.question.difficulty,
    explanation: mapping.question.explanation,
    choices: mapping.choices,
    foundationQuestionId: mapping.foundationQuestionId,
    foundationVersion: mapping.foundationVersion,
    semanticHash: mapping.semanticHash,
  });
}

/** Builds the shared-grader input without creating a course-specific grader. */
export function toDigitalForensics8HGradingQuestion(
  mapping: DigitalForensics8HRuntimeQuestionMapping,
): GradingQuestion {
  assertMappingShape(mapping);
  return {
    type: DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE,
    choices: mapping.choices.map((choice) => ({
      id: choice.id,
      content: choice.content,
      isCorrect: choice.id === mapping.serverOnlyGrading.correctChoiceId,
    })),
  };
}

/** Delegates grading to the one shared grading authority. */
export function gradeDigitalForensics8HQuestion(
  mapping: DigitalForensics8HRuntimeQuestionMapping,
  answer: SubmittedAnswer,
): GradeResult {
  return requireSupportedGrade(
    gradeQuestion(toDigitalForensics8HGradingQuestion(mapping), answer),
  );
}

export async function computeDigitalForensics8HQuestionSemanticHash(
  question: DigitalForensics8HFoundationQuestion,
): Promise<string> {
  const projection = {
    adapterContractVersion: DIGITAL_FORENSICS_8H_QUESTION_MAPPING_CONTRACT_VERSION,
    foundationManifestId: DIGITAL_FORENSICS_8H_FOUNDATION_MANIFEST_ID,
    foundationCourseId: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId,
    foundationVersion: DIGITAL_FORENSICS_8H_FOUNDATION_VERSION,
    foundationQuestionId: question.id,
    moduleId: question.moduleId,
    objectiveIds: [...question.objectiveIds].sort(),
    foundationAssessmentType: question.assessmentType,
    runtimeQuestionType: DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE,
    foundationDifficulty: question.difficulty,
    runtimeDifficulty: toRuntimeDifficulty(question.difficulty),
    prompt: question.prompt,
    choices: question.options.map((content, index) => ({
      displayOrder: index + 1,
      content,
    })),
    answerIndex: question.answerIndex,
    explanation: question.explanation,
  };
  const bytes = new TextEncoder().encode(stableJson(projection));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function assertRuntimeModel(model: DigitalForensics8HRuntimeModel): void {
  if (
    !model ||
    model.exposure !== "registration" ||
    model.runtimeIdentity.courseId !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId ||
    model.runtimeIdentity.code !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.code ||
    model.runtimeIdentity.slug !== DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.slug ||
    model.runtimeIdentity.bindingKey !== DIGITAL_FORENSICS_8H_BINDING_KEY ||
    model.runtimeIdentity.foundationVersion !== DIGITAL_FORENSICS_8H_FOUNDATION_VERSION ||
    model.foundationBinding.manifestId !== DIGITAL_FORENSICS_8H_FOUNDATION_MANIFEST_ID ||
    model.foundationBinding.bindingKey !== DIGITAL_FORENSICS_8H_BINDING_KEY ||
    model.foundationBinding.version !== DIGITAL_FORENSICS_8H_FOUNDATION_VERSION ||
    model.counts.questions !== 40 ||
    model.counts.modules !== 8 ||
    model.counts.objectives !== 32 ||
    model.counts.theoryAssets !== 24 ||
    model.counts.practicalSpecifications !== 8 ||
    model.counts.executableLabs !== 0 ||
    model.foundation.questions.length !== 40
  ) {
    fail("RUNTIME_IDENTITY_MISMATCH", "Digital Forensics runtime model does not match the mapping contract.");
  }
  assertRuntimeSourceBoundary(model);
  const questionIds = model.foundation.questions.map((question) => question.id);
  if (stableJson(questionIds) !== stableJson(model.questionIds)) {
    fail("QUESTION_ID_CONFLICT", "Digital Forensics runtime question identity is not canonical.");
  }
  for (const question of model.foundation.questions) validateProjectionQuestionShape(question);
}

function assertRuntimeSourceBoundary(model: DigitalForensics8HRuntimeModel): void {
  const sourceBoundary = model.sourceBoundary;
  if (
    !sourceBoundary ||
    typeof sourceBoundary !== "object" ||
    sourceBoundary.sourceManifestSha256 !== DIGITAL_FORENSICS_8H_SOURCE_MANIFEST_SHA256 ||
    sourceBoundary.sourceAuthorityCount !== 1 ||
    sourceBoundary.sourceMemberCount !== 22 ||
    sourceBoundary.sourcePathIntegrity !== "22/22" ||
    sourceBoundary.sourceHashIntegrity !== "22/22" ||
    sourceBoundary.rights !== "DIGITAL_FORENSICS_RIGHTS_READY_FOR_FACTS_ONLY_AUTHORING" ||
    sourceBoundary.currentness !== "DIGITAL_FORENSICS_SOURCE_CURRENTNESS_READY_WITH_LIMITATIONS" ||
    sourceBoundary.h01ToH03 !== "LOCAL_SOURCE_PARTIAL" ||
    sourceBoundary.h04ToH08 !== "SOURCE_SUPPORT_MISSING_FOR_STRUCTURE" ||
    sourceBoundary.h04ToH08LocalDependence !== 0 ||
    sourceBoundary.sourceExpressionReuse !== 0 ||
    sourceBoundary.sourceQuestionReuse !== 0 ||
    sourceBoundary.ocr !== 0 ||
    sourceBoundary.transcription !== 0 ||
    sourceBoundary.reconstruction !== 0 ||
    sourceBoundary.restrictedSourceDependence !== 0
  ) {
    fail("SOURCE_BOUNDARY_INVALID", "Digital Forensics runtime source boundary is not canonical.");
  }
}

function validateProjectionQuestionShape(question: DigitalForensics8HFoundationQuestion): void {
  if (
    !question ||
    typeof question.id !== "string" ||
    typeof question.moduleId !== "string" ||
    !Array.isArray(question.objectiveIds) ||
    !Array.isArray(question.theoryIds) ||
    typeof question.assessmentType !== "string" ||
    typeof question.difficulty !== "string" ||
    !DIFFICULTY_VALUES.has(question.difficulty) ||
    typeof question.prompt !== "string" ||
    question.prompt.trim() !== question.prompt ||
    question.prompt.length === 0 ||
    !Array.isArray(question.options) ||
    question.options.length !== 4 ||
    question.options.some((option) => typeof option !== "string" || option.trim() !== option || option.length === 0) ||
    typeof question.answerIndex !== "number" ||
    !Number.isInteger(question.answerIndex) ||
    question.answerIndex < 0 ||
    question.answerIndex >= question.options.length ||
    typeof question.explanation !== "string" ||
    question.explanation.trim() !== question.explanation ||
    question.explanation.length === 0 ||
    question.provenance !== "SECURIUM_INDEPENDENTLY_AUTHORED"
  ) {
    fail("QUESTION_AUTHORITY_INVALID", "Digital Forensics runtime question shape is invalid.");
  }
  assertCanonicalQuestionId(question.id);
}

async function createMapping(
  question: DigitalForensics8HFoundationQuestion,
): Promise<DigitalForensics8HRuntimeQuestionMapping> {
  assertCanonicalQuestionId(question.id);
  const runtimeQuestionId = digitalForensics8HRuntimeQuestionId(question.id);
  const runtimeQuestionVersionId = digitalForensics8HRuntimeQuestionVersionId(question.id, 1);
  const semanticHash = await computeDigitalForensics8HQuestionSemanticHash(question);
  const choices = question.options.map((content, index) =>
    Object.freeze({
      id: `${runtimeQuestionId}-choice-${String(index + 1).padStart(2, "0")}`,
      questionId: runtimeQuestionId,
      content,
      displayOrder: index + 1,
    }),
  );
  const questionDto = {
    id: runtimeQuestionId,
    title: `Digital Forensics 8H ${question.id}`,
    content: question.prompt,
    type: DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE,
    difficulty: toRuntimeDifficulty(question.difficulty),
    explanation: question.explanation,
    status: "DRAFT" as const,
    source: "SECURIUM_INDEPENDENTLY_AUTHORED" as const,
    version: 1 as const,
  };
  const snapshot = {
    foundation: {
      manifestId: DIGITAL_FORENSICS_8H_FOUNDATION_MANIFEST_ID,
      courseId: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId,
      version: DIGITAL_FORENSICS_8H_FOUNDATION_VERSION,
      question: {
        id: question.id,
        moduleId: question.moduleId,
        objectiveIds: [...question.objectiveIds],
        theoryIds: [...question.theoryIds],
        assessmentType: question.assessmentType,
        difficulty: question.difficulty,
        prompt: question.prompt,
        options: [...question.options],
        answerIndex: question.answerIndex,
        explanation: question.explanation,
        provenance: question.provenance,
      },
    },
    runtime: {
      id: runtimeQuestionId,
      version: 1,
      type: DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE,
      difficulty: toRuntimeDifficulty(question.difficulty),
      choices: choices.map(({ id, content, displayOrder }) => ({ id, content, displayOrder })),
    },
    semanticHash,
  };
  return deepFreeze({
    foundationQuestionId: question.id,
    foundationVersion: DIGITAL_FORENSICS_8H_FOUNDATION_VERSION,
    moduleId: question.moduleId,
    objectiveIds: [...question.objectiveIds],
    foundationAssessmentType: question.assessmentType,
    foundationDifficulty: question.difficulty,
    semanticHash,
    runtimeQuestionId,
    runtimeQuestionVersionId,
    question: questionDto,
    choices,
    courseBinding: {
      questionId: runtimeQuestionId,
      courseId: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId,
      weight: 100 as const,
    },
    version: {
      id: runtimeQuestionVersionId,
      questionId: runtimeQuestionId,
      version: 1 as const,
      snapshotJson: stableJson(snapshot),
      semanticHash,
      foundationManifestId: DIGITAL_FORENSICS_8H_FOUNDATION_MANIFEST_ID,
      foundationVersion: DIGITAL_FORENSICS_8H_FOUNDATION_VERSION,
      conceptMappingSetHash: null,
    },
    serverOnlyGrading: {
      type: DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE,
      correctChoiceId: choices[question.answerIndex].id,
    },
  });
}

export function digitalForensics8HRuntimeQuestionId(foundationQuestionId: string): string {
  assertCanonicalQuestionId(foundationQuestionId);
  return `question-${DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId}-${foundationQuestionId}`;
}

export function digitalForensics8HRuntimeQuestionVersionId(
  foundationQuestionId: string,
  version: number,
): string {
  assertCanonicalQuestionId(foundationQuestionId);
  if (!Number.isInteger(version) || version < 1) {
    fail("QUESTION_VERSION_MISMATCH", "Digital Forensics question version is invalid.");
  }
  return `version-${digitalForensics8HRuntimeQuestionId(foundationQuestionId)}-v${version}`;
}

function assertCanonicalQuestionId(id: string): void {
  if (!/^DF-H(?:0[1-8])-Q(?:0[1-5])$/.test(id)) {
    fail("QUESTION_ID_CONFLICT", "Digital Forensics Foundation question identity is invalid.");
  }
}

function assertMappingShape(mapping: DigitalForensics8HRuntimeQuestionMapping): void {
  if (
    !mapping ||
    mapping.question.type !== DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE ||
    mapping.foundationVersion !== DIGITAL_FORENSICS_8H_FOUNDATION_VERSION ||
    mapping.serverOnlyGrading.type !== DIGITAL_FORENSICS_8H_RUNTIME_QUESTION_TYPE ||
    mapping.choices.length !== 4 ||
    !mapping.choices.some((choice) => choice.id === mapping.serverOnlyGrading.correctChoiceId)
  ) {
    fail("MAPPING_PROJECTION_MISMATCH", "Digital Forensics runtime question mapping shape is invalid.");
  }
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    fail("DUPLICATE_ID", `Digital Forensics runtime mapping contains duplicate ${label} IDs.`);
  }
}

function toRuntimeDifficulty(difficulty: DigitalForensics8HFoundationQuestion["difficulty"]): DigitalForensics8HRuntimeDifficulty {
  switch (difficulty) {
    case "easy":
      return "EASY";
    case "medium":
      return "MEDIUM";
    case "hard":
      return "HARD";
    default:
      fail("DIFFICULTY_MISMATCH", "Digital Forensics Foundation difficulty is invalid.");
  }
}

const DIFFICULTY_VALUES = new Set(["easy", "medium", "hard"]);

function fail(code: string, message: string): never {
  throw new AppError(message, 409, code);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
