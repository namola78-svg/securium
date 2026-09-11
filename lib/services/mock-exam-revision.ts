import { AppError } from "../errors.ts";
import type { QuestionType, ShortAnswerConfig } from "./grading-service.ts";

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
