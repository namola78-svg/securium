export function formatQuestionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    TRUE_FALSE: "OX",
    SINGLE_CHOICE: "단일선택형",
    MULTIPLE_CHOICE: "복수선택형",
    SHORT_ANSWER: "단답형",
    ESSAY: "서술형",
    CALCULATION: "계산형",
    COMMAND: "명령어 작성",
    LOG_ANALYSIS: "로그 분석",
    CONFIG_ANALYSIS: "설정 분석",
    CODE_ANALYSIS: "코드 분석",
  };

  return labels[type] ?? "문제 유형";
}

export function formatDifficultyLabel(difficulty: string) {
  const labels: Record<string, string> = {
    EASY: "쉬움",
    MEDIUM: "보통",
    HARD: "어려움",
  };

  return labels[difficulty] ?? "난이도";
}

export function formatAIExplanationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    generated: "생성됨",
    failed: "생성 실패",
    insufficient_context: "근거 부족",
    reviewed: "검수 완료",
    rejected: "반려됨",
  };

  return labels[status] ?? "상태 확인";
}
