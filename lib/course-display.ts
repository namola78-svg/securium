import { publicCopy } from "@/lib/public-copy";

export function safeCount(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.floor(numberValue)
    : 0;
}

export function difficultyLabel(value: string | null | undefined) {
  if (value === "BEGINNER") return "입문";
  if (value === "INTERMEDIATE") return "중급";
  if (value === "ADVANCED") return "심화";
  return "수준 안내 예정";
}

export function recommendedAudience(value: string | null | undefined) {
  if (value === "BEGINNER") return "처음 준비하는 학습자 · 실무 담당자";
  if (value === "INTERMEDIATE") return "자격 준비자 · 정보보호 담당자";
  if (value === "ADVANCED") return "실무 리더 · 전문 담당자";
  return "정보보호·개인정보보호 학습자";
}

export function estimateWeeks(totalLevels: number | null | undefined) {
  const levels = safeCount(totalLevels);
  if (!levels) return 4;
  return Math.max(2, Math.min(12, Math.ceil(levels / 15)));
}

export function formatCount(value: unknown, unit: string, fallback: string) {
  const count = safeCount(value);
  return count ? `${count}${unit}` : fallback;
}

export function formatCourseDate(value: string | null | undefined) {
  if (!value) return "업데이트 예정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "업데이트 예정";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function courseDescription(value: string | null | undefined) {
  return publicCopy(value ?? "") || "과정 설명을 준비하고 있습니다.";
}

export function courseLearningGoals(courseName: string) {
  return [
    `${courseName}의 핵심 개념과 기준을 체계적으로 정리합니다.`,
    "과목과 주제 단위로 학습 범위를 나누어 현재 위치를 명확히 파악합니다.",
    "문제풀이와 복습 흐름을 연결해 실전 적용 역량을 높입니다.",
  ];
}
