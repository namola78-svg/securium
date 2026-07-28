import { AppError } from "../errors.ts";

export type LessonCompletionPolicy =
  | "MANUAL"
  | "SCROLL_END"
  | "MINIMUM_REQUIREMENTS";

export function normalizeReadingPosition(position: number) {
  if (!Number.isFinite(position)) return 0;
  return Math.min(10000, Math.max(0, Math.round(position)));
}

export function readingProgressPercent(position: number) {
  return Math.round(normalizeReadingPosition(position) / 100);
}

export function deriveStudySeconds(
  lastViewedAt: string | null,
  now: Date,
  maxCreditedSeconds = 300,
) {
  if (!lastViewedAt) return 0;
  const previous = new Date(lastViewedAt).getTime();
  if (!Number.isFinite(previous)) return 0;
  const elapsed = Math.floor((now.getTime() - previous) / 1000);
  return Math.min(maxCreditedSeconds, Math.max(0, elapsed));
}

export function assertLessonCompletionAllowed(input: {
  policy: LessonCompletionPolicy;
  explicitRequest: boolean;
  progressPercent: number;
  studySeconds: number;
  minimumProgressPercent: number;
  minimumStudySeconds: number;
}) {
  if (input.policy === "MANUAL") {
    if (!input.explicitRequest) {
      throw new AppError(
        "완료 버튼을 눌러 학습 완료를 확정해 주세요.",
        409,
        "LESSON_MANUAL_COMPLETION_REQUIRED",
      );
    }
    return;
  }
  if (input.policy === "SCROLL_END") {
    if (input.progressPercent < 100) {
      throw new AppError(
        "본문 하단까지 학습한 뒤 완료할 수 있습니다.",
        409,
        "LESSON_SCROLL_END_REQUIRED",
      );
    }
    return;
  }
  if (
    input.progressPercent < input.minimumProgressPercent ||
    input.studySeconds < input.minimumStudySeconds
  ) {
    throw new AppError(
      "관리자가 설정한 최소 학습 조건을 아직 충족하지 않았습니다.",
      409,
      "LESSON_MINIMUM_REQUIREMENTS_NOT_MET",
    );
  }
}
