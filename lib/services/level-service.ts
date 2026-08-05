import { AppError } from "../errors.ts";

export type LevelStatus =
  | "LOCKED"
  | "AVAILABLE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "MASTERED";

export type LevelProgressState = {
  status: LevelStatus;
  bestScore: number;
  attemptCount: number;
  completedAt: string | null;
  masteredAt: string | null;
};

export function initialLevelStatus(requiredLevelId: string | null): LevelStatus {
  return requiredLevelId ? "LOCKED" : "AVAILABLE";
}

export function assertLevelAccessible(status: LevelStatus) {
  if (status === "LOCKED") {
    throw new AppError(
      "선행 단계를 통과해야 접근할 수 있습니다.",
      403,
      "LEVEL_LOCKED",
    );
  }
}

export function levelStatusLabel(status: LevelStatus | string) {
  switch (status) {
    case "LOCKED":
      return "잠김";
    case "AVAILABLE":
      return "학습 가능";
    case "IN_PROGRESS":
      return "진행 중";
    case "COMPLETED":
      return "완료";
    case "MASTERED":
      return "숙달";
    default:
      return "단계 상태";
  }
}

export function applyLevelResult(
  current: LevelProgressState,
  score: number,
  passingScore: number,
  now = new Date(),
) {
  assertLevelAccessible(current.status);
  const passed = score >= passingScore;
  const bestScore = Math.max(current.bestScore, score);
  const previouslyCompleted = ["COMPLETED", "MASTERED"].includes(
    current.status,
  );
  const completed = previouslyCompleted || passed;
  const mastered =
    current.status === "MASTERED" ||
    (completed && bestScore >= Math.max(90, passingScore));
  return {
    progress: {
      status: mastered
        ? ("MASTERED" as const)
        : completed
          ? ("COMPLETED" as const)
          : ("IN_PROGRESS" as const),
      bestScore,
      attemptCount: current.attemptCount + 1,
      completedAt:
        completed && !current.completedAt
          ? now.toISOString()
          : current.completedAt,
      masteredAt:
        mastered && !current.masteredAt ? now.toISOString() : current.masteredAt,
    },
    passed,
    unlockNext: passed,
  };
}
