import { publicCopy } from "@/lib/public-copy";

export function safeCount(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.floor(numberValue)
    : 0;
}

export function difficultyLabel(value: string | null | undefined) {
  if (value === "BEGINNER") return "처음 학습";
  if (value === "INTERMEDIATE") return "실무 기본";
  if (value === "ADVANCED") return "심화 적용";
  return "학습 수준 안내 예정";
}

export function recommendedAudience(value: string | null | undefined) {
  if (value === "BEGINNER") return "처음 준비하는 학습자 · 실무 담당자";
  if (value === "INTERMEDIATE") return "자격 준비자 · 정보보호 담당자";
  if (value === "ADVANCED") return "실무 리더 · 전문 담당자";
  return "정보보호·개인정보보호 학습자";
}

export function courseTypeLabel(course: {
  groupName?: string | null;
  name?: string | null;
  shortName?: string | null;
}) {
  const text = `${course.groupName ?? ""} ${course.name ?? ""} ${
    course.shortName ?? ""
  }`.toLowerCase();

  if (
    /ise|isie|정보보안기사|정보보안산업기사|국가기술자격|security engineer/.test(
      text,
    )
  ) {
    return "국가기술자격";
  }
  if (/isms|관리체계|인증/.test(text)) return "관리체계";
  if (/cppg|개인정보관리사|개인정보/.test(text)) return "개인정보";
  if (/isrm|위험관리/.test(text)) return "위험관리";
  if (/보안약점|진단|secure coding|weakness/.test(text)) return "실무 역량";
  return "전문 과정";
}

export function courseAudienceLabel(course: {
  difficulty?: string | null;
  groupName?: string | null;
  name?: string | null;
  shortName?: string | null;
}) {
  const courseType = courseTypeLabel(course);

  if (courseType === "국가기술자격") {
    return "자격시험 준비자 · 정보보호 담당자";
  }
  if (courseType === "관리체계") {
    return "인증 준비자 · 관리체계 담당자";
  }
  if (courseType === "개인정보") {
    return "개인정보보호 담당자 · 자격 준비자";
  }
  if (courseType === "위험관리") {
    return "위험관리 실무자 · 보안 리더";
  }
  if (courseType === "실무 역량") {
    return "개발자 · 보안 진단 담당자";
  }

  return recommendedAudience(course.difficulty);
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
  return publicCopy(value ?? "") || "과정 소개를 준비하고 있습니다.";
}

export function courseLearningGoals(courseName: string) {
  return [
    `${courseName}의 핵심 개념과 기준을 체계적으로 정리합니다.`,
    "과목과 주제 단위로 학습 범위를 나누어 현재 위치를 명확히 파악합니다.",
    "문제풀이와 복습 흐름을 연결해 실전 적용 역량을 높입니다.",
  ];
}
