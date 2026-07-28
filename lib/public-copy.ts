export function publicCopy(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/\[개발용\s*독립\s*샘플\]\s*/g, "")
    .replace(/\[개발용\s*샘플\]\s*/g, "")
    .replace(/독립\s*제작한\s*개발용\s*샘플/g, "학습용 사례")
    .replace(/독립\s*작성한\s*개발용\s*샘플/g, "학습용 사례")
    .replace(/개발용\s*독립\s*샘플/g, "학습용 자료")
    .replace(/개발용\s*샘플/g, "학습용 자료")
    .replace(/Mock\s*개발용\s*영상/gi, "강의 영상")
    .replace(/MOCK\s+AI/g, "AI")
    .replace(/MOCK\s+EXAMS?/g, "모의고사")
    .replace(/Phase\s*\d+/gi, "")
    .replace(/COMMON\s+LEARNING\s+CORE/gi, "AI LEARNING PLATFORM")
    .replace(/\s{2,}/g, " ")
    .trim();
}
