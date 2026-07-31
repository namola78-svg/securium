export type LearnOverviewCurriculumPathSummary = {
  linkedLessonCount: number;
} | null;

export const curriculumNodeTypeLabels: Record<string, string> = {
  TRACK: "필기/실기",
  SUBJECT: "과목",
  DOMAIN: "영역",
  MAJOR_ITEM: "주요항목",
  SUB_ITEM: "세부항목",
  STANDARD: "세세항목",
  LIFECYCLE: "생애주기",
  PRACTICAL: "실기",
  MODULE: "모듈",
  CHAPTER: "장",
  CUSTOM: "학습 영역",
};

export function hasPrimaryCurriculumPath(
  path: LearnOverviewCurriculumPathSummary,
) {
  return Boolean(path && path.linkedLessonCount > 0);
}

export function getCurriculumNodeLabel(nodeType: string) {
  return curriculumNodeTypeLabels[nodeType] ?? "학습 항목";
}

