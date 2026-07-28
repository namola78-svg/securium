import { AppError } from "../errors.ts";

export type ExamAnswerGrade = {
  questionId: string;
  answered: boolean;
  isCorrect: boolean;
  earnedScore: number;
  possibleScore: number;
};

export function calculateExamResult(grades: ExamAnswerGrade[]) {
  const possible = grades.reduce((sum, grade) => sum + grade.possibleScore, 0);
  const earned = grades.reduce((sum, grade) => sum + grade.earnedScore, 0);
  const correctCount = grades.filter((grade) => grade.isCorrect).length;
  const unansweredCount = grades.filter((grade) => !grade.answered).length;
  return {
    score: possible > 0 ? Math.round((earned / possible) * 100) : 0,
    correctCount,
    wrongCount: grades.length - correctCount - unansweredCount,
    unansweredCount,
  };
}

export function assertExamInProgress(input: {
  status: string;
  expiresAt: string;
  now?: Date;
}) {
  if (input.status !== "IN_PROGRESS") {
    throw new AppError(
      "이미 제출되었거나 종료된 시험입니다.",
      409,
      "EXAM_ALREADY_SUBMITTED",
    );
  }
  if (new Date(input.expiresAt).getTime() <= (input.now ?? new Date()).getTime()) {
    throw new AppError("시험 시간이 종료되었습니다.", 409, "EXAM_EXPIRED");
  }
}

export function shouldAutoSubmit(expiresAt: string, now = new Date()) {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function toPublicExamQuestion<
  T extends Record<string, unknown> & {
    isCorrect?: boolean | null;
    explanation?: string;
  },
>(value: T): Omit<T, "isCorrect" | "explanation"> {
  const safe = { ...value };
  delete safe.isCorrect;
  delete safe.explanation;
  return safe;
}
