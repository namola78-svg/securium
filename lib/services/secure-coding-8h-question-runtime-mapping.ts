import { AppError } from "../errors.ts";
import {
  loadSecureCoding8HRuntimeModel,
  type SecureCoding8HRuntimeModel,
} from "./secure-coding-8h-runtime-adapter.ts";
import { stableJson } from "./question-governance.ts";

const COURSE_ID = "developer-secure-coding-8h-python-vibe" as const;
const COURSE_SLUG = "secure-coding-8h-python-vibe" as const;
const FOUNDATION_CANDIDATE_ID =
  "securium-developer-secure-coding-8h-python-vibe-foundation-v1" as const;
const FOUNDATION_VERSION = "v1" as const;
const MAPPING_CONTRACT_VERSION =
  "SECURIUM_SECURE_CODING_8H_QUESTION_MAPPING_V1" as const;
const QUESTION_COUNT = 40;
const RUNTIME_QUESTION_TYPE = "SINGLE_CHOICE" as const;
const RUNTIME_DIFFICULTY = "MEDIUM" as const;

type FoundationQuestion = Readonly<{
  id: string;
  module: string;
  objectiveIds: readonly string[];
  prompt: string;
  options: readonly string[];
  answer: number;
  explanation: string;
  provenance: string;
}>;

type NormalizedQuestion = Readonly<{
  source: FoundationQuestion;
  moduleId: string;
  objectiveIds: readonly string[];
  semanticHash: string;
}>;

export type SecureCoding8HRuntimeQuestionChoice = Readonly<{
  id: string;
  questionId: string;
  content: string;
  displayOrder: number;
  isCorrect: boolean;
  explanation: string;
}>;

export type SecureCoding8HRuntimeQuestionMapping = Readonly<{
  foundationQuestionId: string;
  foundationVersion: typeof FOUNDATION_VERSION;
  moduleId: string;
  objectiveIds: readonly string[];
  semanticHash: string;
  runtimeQuestionId: string;
  runtimeQuestionVersionId: string;
  question: Readonly<{
    id: string;
    title: string;
    content: string;
    type: typeof RUNTIME_QUESTION_TYPE;
    difficulty: typeof RUNTIME_DIFFICULTY;
    explanation: string;
    wrongAnswerExplanation: "";
    status: "DRAFT";
    source: "SECURIUM_INDEPENDENTLY_AUTHORED";
    sourceDate: null;
    version: 1;
    answerConfigJson: "{}";
    isSample: false;
  }>;
  choices: readonly SecureCoding8HRuntimeQuestionChoice[];
  courseBinding: Readonly<{
    questionId: string;
    courseId: typeof COURSE_ID;
    weight: 100;
  }>;
  version: Readonly<{
    id: string;
    questionId: string;
    version: 1;
    snapshotJson: string;
    semanticHash: string;
    blueprintId: null;
    qualificationJson: null;
    provenanceJson: string;
    governanceJson: null;
    humanReviewHash: null;
  }>;
  conceptMappingSetHash: null;
}>;

export type SecureCoding8HRuntimeQuestionMappingManifest = Readonly<{
  contractVersion: typeof MAPPING_CONTRACT_VERSION;
  courseId: typeof COURSE_ID;
  courseSlug: typeof COURSE_SLUG;
  foundationCandidateId: typeof FOUNDATION_CANDIDATE_ID;
  foundationVersion: typeof FOUNDATION_VERSION;
  questionCount: 40;
  mappings: readonly SecureCoding8HRuntimeQuestionMapping[];
}>;

/**
 * Returns the one stable runtime identity for a canonical Foundation question.
 * The course is intentionally fixed; callers cannot select another Foundation.
 */
export function secureCoding8HRuntimeQuestionId(
  foundationQuestionId: string,
): string {
  assertCanonicalQuestionId(foundationQuestionId);
  return `question-${COURSE_ID}-${foundationQuestionId}`;
}

/** Returns the deterministic runtime QuestionVersion identity for a revision. */
export function secureCoding8HRuntimeQuestionVersionId(
  foundationQuestionId: string,
  version: number,
): string {
  assertCanonicalQuestionId(foundationQuestionId);
  if (!Number.isInteger(version) || version < 1) {
    throw new AppError(
      "Secure Coding QuestionVersion identity is invalid.",
      409,
      "QUESTION_VERSION_MISMATCH",
    );
  }
  return `version-${secureCoding8HRuntimeQuestionId(foundationQuestionId)}-v${version}`;
}

/**
 * Builds the deterministic 40-question projection from the fixed Foundation.
 * This function has no database, network, filesystem-write, or learner-state
 * dependency. The imported adapter performs the fixed server-side file load.
 */
export async function buildSecureCoding8HQuestionRuntimeMapping(): Promise<SecureCoding8HRuntimeQuestionMappingManifest> {
  const model = loadSecureCoding8HRuntimeModel({
    runtimeCourse: {
      id: COURSE_ID,
      slug: COURSE_SLUG,
      active: false,
      published: false,
      deletedAt: null,
    },
    exposure: "registration",
  });
  return projectSecureCoding8HQuestionRuntimeMapping(model);
}

/**
 * Projects a previously loaded fixed Secure Coding runtime model. The exact
 * identity and Foundation candidate are rechecked so a forged model fails
 * closed instead of becoming a second content authority.
 */
export async function projectSecureCoding8HQuestionRuntimeMapping(
  model: SecureCoding8HRuntimeModel,
): Promise<SecureCoding8HRuntimeQuestionMappingManifest> {
  const normalized = await normalizeFoundationQuestions(model);
  const mappings = normalized.map((question) => createMapping(question));
  return deepFreeze({
    contractVersion: MAPPING_CONTRACT_VERSION,
    courseId: COURSE_ID,
    courseSlug: COURSE_SLUG,
    foundationCandidateId: FOUNDATION_CANDIDATE_ID,
    foundationVersion: FOUNDATION_VERSION,
    questionCount: QUESTION_COUNT,
    mappings,
  });
}

/**
 * Revalidates a candidate projection against the fixed Foundation. This is a
 * pure, fail-closed guard for a future materializer; it performs no persistence
 * and does not accept an arbitrary content path.
 */
export async function assertSecureCoding8HQuestionRuntimeMapping(
  candidate: SecureCoding8HRuntimeQuestionMappingManifest,
  model: SecureCoding8HRuntimeModel,
): Promise<void> {
  if (!candidate || typeof candidate !== "object") {
    throw new AppError(
      "Secure Coding question mapping is invalid.",
      409,
      "MAPPING_PROJECTION_MISMATCH",
    );
  }
  const expected = await projectSecureCoding8HQuestionRuntimeMapping(model);
  if (stableJson(candidate) !== stableJson(expected)) {
    throw new AppError(
      "Secure Coding question mapping does not match its Foundation projection.",
      409,
      "MAPPING_PROJECTION_MISMATCH",
    );
  }
}

async function normalizeFoundationQuestions(
  model: SecureCoding8HRuntimeModel,
): Promise<readonly NormalizedQuestion[]> {
  assertRuntimeModelIdentity(model);
  const foundation = asRecord(model.foundation, "foundation");
  const manifest = asRecord(foundation.manifest, "manifest");
  const manifestIdentity = asRecord(
    manifest.canonicalCourseIdentity,
    "manifest.canonicalCourseIdentity",
  );
  if (
    manifestIdentity.courseId !== COURSE_ID ||
    manifest.candidateId !== FOUNDATION_CANDIDATE_ID
  ) {
    throw new AppError(
      "Secure Coding Foundation identity does not match the mapping contract.",
      409,
      "RUNTIME_IDENTITY_MISMATCH",
    );
  }

  if (
    model.counts.modules !== 8 ||
    model.counts.objectives !== 32 ||
    model.counts.questions !== QUESTION_COUNT ||
    model.counts.practicalSpecs !== 8 ||
    model.counts.executableLabs !== 0
  ) {
    throw new AppError(
      "Secure Coding Foundation counts are outside the mapping contract.",
      409,
      "COUNT_MISMATCH",
    );
  }

  const modules = arrayField(manifest, "modules", "manifest.modules");
  const moduleQuestionIds = new Map<string, readonly string[]>();
  const moduleObjectiveIds = new Map<string, readonly string[]>();
  for (const [index, value] of modules.entries()) {
    const module = asRecord(value, `manifest.modules[${index}]`);
    const id = stringField(module, "id", `manifest.modules[${index}].id`);
    const questionIds = stringArrayField(
      module,
      "questionIds",
      `manifest.modules[${index}].questionIds`,
    );
    const objectiveIds = stringArrayField(
      module,
      "objectiveIds",
      `manifest.modules[${index}].objectiveIds`,
    );
    moduleQuestionIds.set(id, questionIds);
    moduleObjectiveIds.set(id, objectiveIds);
  }

  const questionBundle = asRecord(foundation.questions, "questions");
  const questions = arrayField(questionBundle, "questions", "questions.questions");
  if (questions.length !== QUESTION_COUNT) {
    throw new AppError(
      "Secure Coding Foundation question cardinality is invalid.",
      409,
      "COUNT_MISMATCH",
    );
  }

  const normalized: NormalizedQuestion[] = [];
  const seenIds = new Set<string>();
  for (const [index, value] of questions.entries()) {
    const question = asRecord(value, `questions.questions[${index}]`);
    const id = stringField(question, "id", `questions.questions[${index}].id`);
    assertCanonicalQuestionId(id);
    if (seenIds.has(id)) {
      throw new AppError(
        "Secure Coding Foundation question IDs are duplicated.",
        409,
        "QUESTION_ID_CONFLICT",
      );
    }
    seenIds.add(id);

    const expectedId = `Q${String(index + 1).padStart(2, "0")}`;
    if (id !== expectedId) {
      throw new AppError(
        "Secure Coding Foundation question IDs are missing or unexpected.",
        409,
        "QUESTION_ID_CONFLICT",
      );
    }

    const moduleId = stringField(
      question,
      "module",
      `questions.questions[${index}].module`,
    );
    const objectiveIds = stringArrayField(
      question,
      "objectiveIds",
      `questions.questions[${index}].objectiveIds`,
    );
    if (
      !moduleQuestionIds.has(moduleId) ||
      !moduleQuestionIds.get(moduleId)!.includes(id) ||
      objectiveIds.some((objectiveId) => !model.objectiveIds.includes(objectiveId)) ||
      objectiveIds.some(
        (objectiveId) => !moduleObjectiveIds.get(moduleId)!.includes(objectiveId),
      ) ||
      new Set(objectiveIds).size !== objectiveIds.length
    ) {
      throw new AppError(
        "Secure Coding question module or objective binding is invalid.",
        409,
        "FOUNDATION_INVALID",
      );
    }

    if ("type" in question && question.type !== RUNTIME_QUESTION_TYPE) {
      throw new AppError(
        "Secure Coding Foundation question type is unsupported.",
        409,
        "QUESTION_TYPE_UNSUPPORTED",
      );
    }
    if ("difficulty" in question) {
      throw new AppError(
        "Secure Coding Foundation difficulty is not part of the approved source shape.",
        409,
        "FOUNDATION_INVALID",
      );
    }

    const prompt = nonEmptyTextField(
      question,
      "prompt",
      `questions.questions[${index}].prompt`,
    );
    const options = stringArrayField(
      question,
      "options",
      `questions.questions[${index}].options`,
    );
    const answer = question.answer;
    if (
      typeof answer !== "number" ||
      options.length !== 4 ||
      options.some((option) => option.trim() !== option || option.length === 0) ||
      !Number.isInteger(answer) ||
      answer < 0 ||
      answer >= options.length
    ) {
      throw new AppError(
        "Secure Coding Foundation answer choices are invalid or conflicting.",
        409,
        "QUESTION_ANSWER_CONFLICT",
      );
    }
    const explanation = nonEmptyTextField(
      question,
      "explanation",
      `questions.questions[${index}].explanation`,
    );
    const provenance = stringField(
      question,
      "provenance",
      `questions.questions[${index}].provenance`,
    );
    if (provenance !== "SECURIUM_INDEPENDENTLY_AUTHORED") {
      throw new AppError(
        "Secure Coding question provenance is invalid.",
        409,
        "FOUNDATION_INVALID",
      );
    }
    const review = asRecord(
      question.review,
      `questions.questions[${index}].review`,
    );
    if (
      review.status !== "ACCEPT" ||
      review.independentReview !== true ||
      review.semanticDrift !== false
    ) {
      throw new AppError(
        "Secure Coding question review binding is invalid.",
        409,
        "FOUNDATION_INVALID",
      );
    }

    const source = Object.freeze({
      id,
      module: moduleId,
      objectiveIds: Object.freeze([...objectiveIds]),
      prompt,
      options: Object.freeze([...options]),
      answer,
      explanation,
      provenance,
    });
    const semanticHash = await computeFoundationQuestionSemanticHash({
      question: source,
      objectiveIds,
    });
    normalized.push(
      Object.freeze({
        source,
        moduleId,
        objectiveIds: Object.freeze([...objectiveIds]),
        semanticHash,
      }),
    );
  }

  if (
    seenIds.size !== QUESTION_COUNT ||
    model.questionIds.length !== QUESTION_COUNT ||
    model.questionIds.some((id, index) => id !== `Q${String(index + 1).padStart(2, "0")}`)
  ) {
    throw new AppError(
      "Secure Coding Foundation question identity cardinality is invalid.",
      409,
      "QUESTION_ID_CONFLICT",
    );
  }
  return Object.freeze(normalized);
}

async function computeFoundationQuestionSemanticHash(input: {
  question: FoundationQuestion;
  objectiveIds: readonly string[];
}): Promise<string> {
  const semanticProjection = {
    foundationCourseId: COURSE_ID,
    foundationCandidateId: FOUNDATION_CANDIDATE_ID,
    foundationQuestionId: input.question.id,
    moduleId: input.question.module,
    objectiveIds: [...input.objectiveIds].sort(),
    type: RUNTIME_QUESTION_TYPE,
    prompt: input.question.prompt,
    options: input.question.options.map((content, index) => ({
      displayOrder: index + 1,
      content,
    })),
    answerIndex: input.question.answer,
    explanation: input.question.explanation,
  };
  const bytes = new TextEncoder().encode(stableJson(semanticProjection));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createMapping(
  normalized: NormalizedQuestion,
): SecureCoding8HRuntimeQuestionMapping {
  const source = normalized.source;
  const runtimeQuestionId = secureCoding8HRuntimeQuestionId(source.id);
  const runtimeQuestionVersionId = secureCoding8HRuntimeQuestionVersionId(
    source.id,
    1,
  );
  const choices = source.options.map((content, index) =>
    Object.freeze({
      id: `${runtimeQuestionId}-choice-${String(index + 1).padStart(2, "0")}`,
      questionId: runtimeQuestionId,
      content,
      displayOrder: index + 1,
      isCorrect: index === source.answer,
      explanation: "",
    }),
  );
  const question = Object.freeze({
    id: runtimeQuestionId,
    title: `Secure Coding 8H ${source.id}`,
    content: source.prompt,
    type: RUNTIME_QUESTION_TYPE,
    difficulty: RUNTIME_DIFFICULTY,
    explanation: source.explanation,
    wrongAnswerExplanation: "" as const,
    status: "DRAFT" as const,
    source: "SECURIUM_INDEPENDENTLY_AUTHORED" as const,
    sourceDate: null,
    version: 1 as const,
    answerConfigJson: "{}" as const,
    isSample: false as const,
  });
  const provenance = {
    mappingContractVersion: MAPPING_CONTRACT_VERSION,
    foundationCourseId: COURSE_ID,
    foundationCandidateId: FOUNDATION_CANDIDATE_ID,
    foundationVersion: FOUNDATION_VERSION,
    foundationQuestionId: source.id,
    moduleId: normalized.moduleId,
    objectiveIds: [...normalized.objectiveIds],
    sourceSemanticHash: normalized.semanticHash,
  };
  const snapshot = {
    foundation: {
      courseId: COURSE_ID,
      candidateId: FOUNDATION_CANDIDATE_ID,
      version: FOUNDATION_VERSION,
      question: {
        id: source.id,
        module: source.module,
        objectiveIds: [...source.objectiveIds],
        prompt: source.prompt,
        options: [...source.options],
        answer: source.answer,
        explanation: source.explanation,
        provenance: source.provenance,
      },
    },
    runtime: question,
  };
  return Object.freeze({
    foundationQuestionId: source.id,
    foundationVersion: FOUNDATION_VERSION,
    moduleId: normalized.moduleId,
    objectiveIds: Object.freeze([...normalized.objectiveIds]),
    semanticHash: normalized.semanticHash,
    runtimeQuestionId,
    runtimeQuestionVersionId,
    question,
    choices: Object.freeze(choices),
    courseBinding: Object.freeze({
      questionId: runtimeQuestionId,
      courseId: COURSE_ID,
      weight: 100 as const,
    }),
    version: Object.freeze({
      id: runtimeQuestionVersionId,
      questionId: runtimeQuestionId,
      version: 1 as const,
      snapshotJson: stableJson(snapshot),
      semanticHash: normalized.semanticHash,
      blueprintId: null,
      qualificationJson: null,
      provenanceJson: stableJson(provenance),
      governanceJson: null,
      humanReviewHash: null,
    }),
    conceptMappingSetHash: null,
  });
}

function assertRuntimeModelIdentity(model: SecureCoding8HRuntimeModel): void {
  if (
    !model ||
    model.exposure !== "registration" ||
    model.runtimeIdentity.courseId !== COURSE_ID ||
    model.runtimeIdentity.slug !== COURSE_SLUG ||
    model.foundationIdentity.courseId !== COURSE_ID ||
    model.foundationIdentity.candidateId !== FOUNDATION_CANDIDATE_ID
  ) {
    throw new AppError(
      "Secure Coding runtime/Foundation identity does not match the mapping contract.",
      409,
      "RUNTIME_IDENTITY_MISMATCH",
    );
  }
}

function assertCanonicalQuestionId(id: string): void {
  if (!/^Q(?:0[1-9]|[1-3][0-9]|40)$/.test(id)) {
    throw new AppError(
      "Secure Coding Foundation question identity is outside Q01-Q40.",
      409,
      "QUESTION_ID_CONFLICT",
    );
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(`Secure Coding ${label} is invalid.`, 409, "FOUNDATION_INVALID");
  }
  return value as Record<string, unknown>;
}

function arrayField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): unknown[] {
  if (!Array.isArray(record[key])) {
    throw new AppError(`Secure Coding ${label} is invalid.`, 409, "FOUNDATION_INVALID");
  }
  return record[key] as unknown[];
}

function stringArrayField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string[] {
  const values = arrayField(record, key, label);
  if (values.some((value) => typeof value !== "string" || value.trim() !== value)) {
    throw new AppError(`Secure Coding ${label} is invalid.`, 409, "FOUNDATION_INVALID");
  }
  return values as string[];
}

function stringField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  if (typeof record[key] !== "string" || record[key].trim() !== record[key]) {
    throw new AppError(`Secure Coding ${label} is invalid.`, 409, "FOUNDATION_INVALID");
  }
  return record[key] as string;
}

function nonEmptyTextField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = stringField(record, key, label);
  if (!value) {
    throw new AppError(`Secure Coding ${label} is empty.`, 409, "FOUNDATION_INVALID");
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}
