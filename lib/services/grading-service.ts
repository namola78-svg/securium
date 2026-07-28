import { AppError } from "../errors.ts";

export const AUTO_GRADED_TYPES = [
  "TRUE_FALSE",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
] as const;

export type AutoGradedQuestionType = (typeof AUTO_GRADED_TYPES)[number];
export type QuestionType =
  | AutoGradedQuestionType
  | "ESSAY"
  | "ORDERING"
  | "FILL_BLANK"
  | "CASE_ANALYSIS"
  | "CODE_ANALYSIS"
  | "LOG_ANALYSIS"
  | "CALCULATION";

export type SubmittedAnswer = string | string[];

export type ShortAnswerConfig = {
  ignoreCase?: boolean;
  normalizeWhitespace?: boolean;
  acceptedAnswers?: string[];
  synonyms?: string[];
  useRegex?: boolean;
  regexPatterns?: string[];
  partialCreditRules?: Array<{ pattern: string; score: number }>;
};

export type GradingQuestion = {
  type: QuestionType;
  choices: Array<{ id: string; content: string; isCorrect: boolean }>;
  answerConfig?: ShortAnswerConfig;
};

export function toPublicChoices(
  type: QuestionType,
  choices: Array<{
    id: string;
    content: string;
    displayOrder: number;
    isCorrect?: boolean;
    explanation?: string;
  }>,
) {
  if (type === "SHORT_ANSWER") return [];
  return choices.map(({ id, content, displayOrder }) => ({
    id,
    content,
    displayOrder,
  }));
}

export function isPublishedQuestion(status: string) {
  return status === "PUBLISHED";
}

export type GradeResult = {
  supported: boolean;
  isCorrect: boolean | null;
  score: number | null;
  normalizedAnswer: string[];
  correctAnswer: string[];
};

function answerArray(answer: SubmittedAnswer): string[] {
  return (Array.isArray(answer) ? answer : [answer])
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function exactSet(left: string[], right: string[]) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function binaryGrade(
  answer: SubmittedAnswer,
  correctChoiceIds: string[],
): GradeResult {
  const submitted = answerArray(answer);
  const isCorrect = exactSet(submitted, correctChoiceIds);
  return {
    supported: true,
    isCorrect,
    score: isCorrect ? 100 : 0,
    normalizedAnswer: submitted,
    correctAnswer: correctChoiceIds,
  };
}

export function gradeTrueFalse(
  answer: SubmittedAnswer,
  correctChoiceId: string,
) {
  return binaryGrade(answer, [correctChoiceId]);
}

export function gradeSingleChoice(
  answer: SubmittedAnswer,
  correctChoiceId: string,
) {
  return binaryGrade(answer, [correctChoiceId]);
}

export function gradeMultipleChoice(
  answer: SubmittedAnswer,
  correctChoiceIds: string[],
) {
  return binaryGrade(answer, correctChoiceIds);
}

function normalizeShortAnswer(value: string, config: ShortAnswerConfig) {
  let normalized = value.trim();
  if (config.normalizeWhitespace !== false) {
    normalized = normalized.replace(/\s+/g, " ");
  }
  if (config.ignoreCase !== false) normalized = normalized.toLocaleLowerCase();
  return normalized;
}

export function gradeShortAnswer(
  answer: SubmittedAnswer,
  config: ShortAnswerConfig,
): GradeResult {
  const submitted = answerArray(answer);
  const submittedText = submitted.join(" ");
  const normalized = normalizeShortAnswer(submittedText, config);
  const accepted = [...(config.acceptedAnswers ?? []), ...(config.synonyms ?? [])]
    .map((value) => normalizeShortAnswer(value, config))
    .filter(Boolean);

  let isCorrect = accepted.includes(normalized);
  if (!isCorrect && config.useRegex) {
    isCorrect = (config.regexPatterns ?? []).some((pattern) => {
      try {
        return new RegExp(
          pattern,
          config.ignoreCase === false ? "" : "i",
        ).test(submittedText.trim());
      } catch {
        return false;
      }
    });
  }

  let score = isCorrect ? 100 : 0;
  if (!isCorrect) {
    for (const rule of config.partialCreditRules ?? []) {
      try {
        if (new RegExp(rule.pattern, "i").test(submittedText)) {
          score = Math.max(score, Math.min(99, Math.max(0, rule.score)));
        }
      } catch {
        // Invalid optional partial-credit rules are ignored safely.
      }
    }
  }

  return {
    supported: true,
    isCorrect,
    score,
    normalizedAnswer: [normalized],
    correctAnswer: config.acceptedAnswers ?? [],
  };
}

export function gradeEssay(): GradeResult {
  return unsupportedGrade();
}

export function gradeCalculation(): GradeResult {
  return unsupportedGrade();
}

function unsupportedGrade(): GradeResult {
  return {
    supported: false,
    isCorrect: null,
    score: null,
    normalizedAnswer: [],
    correctAnswer: [],
  };
}

export function gradeQuestion(
  question: GradingQuestion,
  answer: SubmittedAnswer,
): GradeResult {
  const correct = question.choices
    .filter((choice) => choice.isCorrect)
    .map((choice) => choice.id);
  switch (question.type) {
    case "TRUE_FALSE":
      return correct.length === 1
        ? gradeTrueFalse(answer, correct[0])
        : unsupportedGrade();
    case "SINGLE_CHOICE":
      return correct.length === 1
        ? gradeSingleChoice(answer, correct[0])
        : unsupportedGrade();
    case "MULTIPLE_CHOICE":
      return correct.length > 0
        ? gradeMultipleChoice(answer, correct)
        : unsupportedGrade();
    case "SHORT_ANSWER":
      return gradeShortAnswer(answer, question.answerConfig ?? {});
    default:
      return unsupportedGrade();
  }
}

export function requireSupportedGrade(result: GradeResult) {
  if (!result.supported) {
    throw new AppError(
      "이 문제 유형의 자동채점은 준비 중입니다.",
      422,
      "GRADING_NOT_SUPPORTED",
    );
  }
  return result;
}
