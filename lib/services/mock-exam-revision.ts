import { AppError } from "../errors.ts";
import type { QuestionType, ShortAnswerConfig } from "./grading-service.ts";
import {
  computeQuestionSemanticHash,
  type QuestionSemanticProjection,
} from "./question-governance.ts";

const questionTypes: readonly QuestionType[] = [
  "TRUE_FALSE",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "ESSAY",
  "ORDERING",
  "FILL_BLANK",
  "CASE_ANALYSIS",
  "CODE_ANALYSIS",
  "LOG_ANALYSIS",
  "CALCULATION",
];

export type MockQuestionRevision = Readonly<{
  id: string;
  title: string;
  content: string;
  type: QuestionType;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  explanation: string;
  wrongAnswerExplanation: string;
  answerConfigJson: string;
  choices: readonly Readonly<{
    id: string;
    content: string;
    displayOrder: number;
    isCorrect: boolean;
    explanation: string;
  }>[];
}>;

/**
 * Restores only the immutable, server-written QuestionVersion snapshot.
 * A mock attempt must never fall back to the mutable question row when this
 * snapshot is missing or incomplete.
 */
export function resolveMockQuestionVersionSnapshot(
  snapshotJson: string | null | undefined,
  expectedQuestionId: string,
): MockQuestionRevision {
  const value = parseObject(snapshotJson);
  if (
    value.id !== expectedQuestionId ||
    typeof value.title !== "string" ||
    typeof value.content !== "string" ||
    typeof value.explanation !== "string" ||
    typeof value.wrongAnswerExplanation !== "string"
  ) {
    unavailable();
  }

  const type = value.type;
  if (!isQuestionType(type)) unavailable();
  const difficulty = value.difficulty;
  if (difficulty !== "EASY" && difficulty !== "MEDIUM" && difficulty !== "HARD") {
    unavailable();
  }

  const rawChoices = value.choices;
  if (!Array.isArray(rawChoices)) unavailable();
  const choices = rawChoices.map((choice) => parseChoice(choice));
  if (new Set(choices.map((choice) => choice.id)).size !== choices.length) {
    unavailable();
  }
  if (
    new Set(choices.map((choice) => choice.displayOrder)).size !== choices.length
  ) {
    unavailable();
  }

  return Object.freeze({
    id: expectedQuestionId,
    title: value.title,
    content: value.content,
    type,
    difficulty,
    explanation: value.explanation,
    wrongAnswerExplanation: value.wrongAnswerExplanation,
    answerConfigJson: serializeAnswerConfig(value.answerConfigJson),
    choices: Object.freeze(choices),
  });
}

export async function resolveMockQuestionVersionSnapshotVerified(
  snapshotJson: string | null | undefined,
  expectedQuestionId: string,
  expectedSemanticHash: string | null | undefined,
  expectedVersion?: number | null,
): Promise<MockQuestionRevision> {
  const revision = resolveMockQuestionVersionSnapshot(
    snapshotJson,
    expectedQuestionId,
  );
  const value = parseObject(snapshotJson);
  const version = value.version;
  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1 ||
    (expectedVersion !== undefined && version !== expectedVersion) ||
    typeof expectedSemanticHash !== "string" ||
    !/^[0-9a-f]{64}$/.test(expectedSemanticHash)
  ) {
    unavailable();
  }
  const semanticProjection = parseSemanticProjection(value, revision);
  const actualSemanticHash = await computeQuestionSemanticHash(semanticProjection);
  if (actualSemanticHash !== expectedSemanticHash) {
    throw new AppError(
      "The QuestionVersion semantic hash does not match its immutable snapshot.",
      409,
      "QUESTION_VERSION_SEMANTIC_HASH_MISMATCH",
    );
  }
  return revision;
}

/** Computes the semantic identity of a canonical QuestionVersion snapshot. */
export async function computeMockQuestionVersionSemanticHash(
  snapshotJson: string | null | undefined,
  expectedQuestionId: string,
): Promise<string> {
  const revision = resolveMockQuestionVersionSnapshot(
    snapshotJson,
    expectedQuestionId,
  );
  const value = parseObject(snapshotJson);
  const version = value.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    unavailable();
  }
  return computeQuestionSemanticHash(parseSemanticProjection(value, revision));
}

function parseObject(snapshotJson: string | null | undefined) {
  if (!snapshotJson) unavailable();
  try {
    const value: unknown = JSON.parse(snapshotJson);
    if (!value || typeof value !== "object" || Array.isArray(value)) unavailable();
    return value as Record<string, unknown>;
  } catch {
    unavailable();
  }
}

function parseChoice(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) unavailable();
  const choice = value as Record<string, unknown>;
  if (
    typeof choice.id !== "string" ||
    !choice.id.trim() ||
    typeof choice.content !== "string" ||
    typeof choice.displayOrder !== "number" ||
    !Number.isInteger(choice.displayOrder) ||
    (typeof choice.isCorrect !== "boolean" &&
      choice.isCorrect !== 0 &&
      choice.isCorrect !== 1)
  ) {
    unavailable();
  }
  return {
    id: choice.id,
    content: choice.content,
    displayOrder: choice.displayOrder,
    isCorrect: choice.isCorrect === true || choice.isCorrect === 1,
    explanation: typeof choice.explanation === "string" ? choice.explanation : "",
  };
}

function serializeAnswerConfig(value: unknown) {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return value;
    } catch {
      // Fall through to the explicit unavailable error.
    }
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify(value as ShortAnswerConfig);
  }
  unavailable();
}

function parseSemanticProjection(
  value: Record<string, unknown>,
  revision: MockQuestionRevision,
): QuestionSemanticProjection {
  const source = value.source;
  const sourceDate = value.sourceDate;
  const courseIds = value.courseIds;
  const conceptMappings = value.conceptMappings;
  const governance = value.governance;
  if (
    (source !== undefined && source !== null && typeof source !== "string") ||
    (sourceDate !== undefined && sourceDate !== null && typeof sourceDate !== "string") ||
    !Array.isArray(courseIds) ||
    !courseIds.every((courseId) => typeof courseId === "string" && courseId.trim()) ||
    !Array.isArray(conceptMappings) ||
    !governance ||
    typeof governance !== "object" ||
    Array.isArray(governance)
  ) {
    unavailable();
  }
  return {
    id: revision.id,
    version: value.version as number,
    title: revision.title,
    content: revision.content,
    type: revision.type,
    difficulty: revision.difficulty,
    explanation: revision.explanation,
    wrongAnswerExplanation: revision.wrongAnswerExplanation,
    answerConfigJson: JSON.parse(revision.answerConfigJson),
    source: source == null ? null : source,
    sourceDate: sourceDate == null ? null : sourceDate,
    choices: revision.choices.map((choice) => {
      const { id: ignoredId, ...semanticChoice } = choice;
      void ignoredId;
      return semanticChoice;
    }),
    courseIds: [...(courseIds as string[])].sort(),
    conceptMappings: conceptMappings as QuestionSemanticProjection["conceptMappings"],
    governance: governance as QuestionSemanticProjection["governance"],
  };
}

function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && questionTypes.includes(value as QuestionType);
}

function unavailable(): never {
  throw new AppError(
    "The immutable mock exam question revision cannot be restored.",
    409,
    "MOCK_QUESTION_VERSION_UNAVAILABLE",
  );
}
