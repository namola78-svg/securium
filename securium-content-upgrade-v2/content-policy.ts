export const CONTENT_POLICY = {
  sourceRole: "REFERENCE_ONLY",
  publishDefault: "DRAFT",
  forbidden: [
    "SOURCE_THEORY_VERBATIM_COPY",
    "SOURCE_QUESTION_VERBATIM_COPY",
    "SIMPLE_PARAPHRASE",
    "CHOICE_ORDER_ONLY_CHANGE",
    "NUMBER_ONLY_CHANGE",
    "NAME_ONLY_CHANGE",
    "SOURCE_CODE_OR_LOG_REUSE_WITH_TRIVIAL_EDITS"
  ],
  requiredTheorySections: [
    "learningObjectives", "overview", "keyPoints", "practiceTip", "fieldExample", "relatedConcepts"
  ],
  requiredQuestionChecks: [
    "sameLearningObjective", "newScenarioOrReasoning", "newDistractors", "sourceSimilarityChecked", "bankSimilarityChecked"
  ]
} as const;

export function normalizedSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^0-9a-z가-힣]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const A = new Set(norm(a)); const B = new Set(norm(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export function rejectNearCopy(source: string, candidate: string, threshold = 0.62) {
  const score = normalizedSimilarity(source, candidate);
  return { ok: score < threshold, score, threshold };
}
