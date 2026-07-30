export function publicCopy(value: string | null | undefined) {
  if (!value) return "";

  return value
    .replace(/\[개발용\s*샘플\s*본문\]\s*/g, "")
    .replace(/\[개발용\s*샘플\]\s*/g, "")
    .replace(/\[개발용[^\]]*\]\s*/g, "")
    .replace(
      /과정별 이론 학습과 완료 기록을 검증하기 위한 샘플 레슨입니다\./g,
      "과정별 이론 학습 흐름과 완료 기록을 이해하는 기초 레슨입니다.",
    )
    .replace(/검증하기 위한/g, "이해하기 위한")
    .replace(/샘플\s*레슨/g, "기초 레슨")
    .replace(/개발용\s*샘플/g, "학습 자료")
    .replace(/독립\s*작성\s*학습 자료/g, "학습 자료")
    .replace(/독립\s*제작\s*학습 자료/g, "학습 자료")
    .replace(/학습 자료\s*콘텐츠/g, "학습 콘텐츠")
    .replace(/Mock\s*학습 자료\s*영상/gi, "강의 영상")
    .replace(/Mock\s*개발용\s*영상/gi, "강의 영상")
    .replace(/개발용\s*가상\s*강사/g, "강사 정보 준비 중")
    .replace(/영상\s*Provider/g, "영상 제공 방식")
    .replace(/MOCK\s+AI/gi, "AI")
    .replace(/MOCK\s+EXAMS?/gi, "모의고사")
    .replace(/Phase\s*\d+/gi, "")
    .replace(/COMMON\s+LEARNING\s+CORE/gi, "AI LEARNING PLATFORM")
    .replace(/[^\S\r\n]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
