export type CodeAnalysisSubmission = {
  selectedLines: number[];
  weaknessId: string;
  selectedCweCode: string;
  truePositive: boolean;
  userExplanation: string;
  remediationCode: string;
};

export type CodeAnalysisRule = {
  expectedLines: number[];
  weaknessId: string;
  cweCode: string;
  expectedTruePositive: boolean;
  remediationKeywords: string[];
  lineScore: number;
  weaknessScore: number;
  cweScore: number;
  judgmentScore: number;
  keywordScore: number;
  remediationCodeScore: number;
  maximumScore: number;
};

function uniqueSortedLines(lines: number[]) {
  return [...new Set(lines.filter(Number.isInteger).filter((line) => line > 0))]
    .sort((left, right) => left - right);
}

function normalizedText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export function gradeCodeAnalysis(
  submission: CodeAnalysisSubmission,
  rule: CodeAnalysisRule,
) {
  const expected = uniqueSortedLines(rule.expectedLines);
  const selected = uniqueSortedLines(submission.selectedLines);
  const expectedSet = new Set(expected);
  const correctSelections = selected.filter((line) => expectedSet.has(line));
  const incorrectSelections = selected.filter((line) => !expectedSet.has(line));
  const lineRatio =
    expected.length === 0
      ? selected.length === 0
        ? 1
        : 0
      : Math.max(
          0,
          (correctSelections.length - incorrectSelections.length) /
            expected.length,
        );
  const linePoints = Math.round(rule.lineScore * Math.min(1, lineRatio));
  const weaknessPoints =
    submission.weaknessId === rule.weaknessId ? rule.weaknessScore : 0;
  const cwePoints =
    normalizedText(submission.selectedCweCode) === normalizedText(rule.cweCode)
      ? rule.cweScore
      : 0;
  const judgmentPoints =
    submission.truePositive === rule.expectedTruePositive
      ? rule.judgmentScore
      : 0;
  const explanation = normalizedText(submission.userExplanation);
  const matchedKeywords = rule.remediationKeywords.filter((keyword) =>
    explanation.includes(normalizedText(keyword)),
  );
  const keywordPoints = rule.remediationKeywords.length
    ? Math.round(
        rule.keywordScore *
          (matchedKeywords.length / rule.remediationKeywords.length),
      )
    : rule.keywordScore;
  const remediationCodePoints = submission.remediationCode.trim()
    ? rule.remediationCodeScore
    : 0;
  const rawScore =
    linePoints +
    weaknessPoints +
    cwePoints +
    judgmentPoints +
    keywordPoints +
    remediationCodePoints;
  const score = Math.min(rule.maximumScore, rawScore);

  return {
    score,
    maximumScore: rule.maximumScore,
    isCorrect: score === rule.maximumScore,
    selectedLines: selected,
    expectedLines: expected,
    matchedKeywords,
    matchedCriteria: [
      ...(linePoints === rule.lineScore ? ["VULNERABLE_LINES"] : []),
      ...(weaknessPoints ? ["WEAKNESS"] : []),
      ...(cwePoints ? ["CWE"] : []),
      ...(judgmentPoints ? ["TRUE_FALSE_POSITIVE"] : []),
      ...(keywordPoints === rule.keywordScore ? ["REMEDIATION_KEYWORDS"] : []),
      ...(remediationCodePoints ? ["REMEDIATION_CODE_SUBMITTED"] : []),
    ],
    breakdown: {
      vulnerableLines: linePoints,
      weakness: weaknessPoints,
      cwe: cwePoints,
      judgment: judgmentPoints,
      remediationKeywords: keywordPoints,
      remediationCode: remediationCodePoints,
    },
  };
}

export type PrivacyAssessmentSubmission = {
  targetDecision: "REQUIRED" | "NOT_REQUIRED" | "REVIEW_NEEDED";
  selectedAssessmentItems: string[];
  identifiedRisks: string;
  improvementPlan: string;
};

export type PrivacyAssessmentRule = {
  correctTargetDecision: PrivacyAssessmentSubmission["targetDecision"];
  expectedAssessmentItems: string[];
  riskKeywords: string[];
  improvementKeywords: string[];
  decisionScore?: number;
  itemScore?: number;
  riskScore?: number;
  improvementScore?: number;
};

export function gradePrivacyAssessment(
  submission: PrivacyAssessmentSubmission,
  rule: PrivacyAssessmentRule,
) {
  const weights = {
    decision: rule.decisionScore ?? 30,
    items: rule.itemScore ?? 30,
    risks: rule.riskScore ?? 20,
    improvement: rule.improvementScore ?? 20,
  };
  const expectedItems = new Set(rule.expectedAssessmentItems);
  const selectedItems = new Set(submission.selectedAssessmentItems);
  const matchedItems = [...selectedItems].filter((id) => expectedItems.has(id));
  const incorrectItems = [...selectedItems].filter((id) => !expectedItems.has(id));
  const itemRatio =
    expectedItems.size === 0
      ? selectedItems.size === 0
        ? 1
        : 0
      : Math.max(0, (matchedItems.length - incorrectItems.length) / expectedItems.size);
  const riskText = normalizedText(submission.identifiedRisks);
  const improvementText = normalizedText(submission.improvementPlan);
  const matchedRiskKeywords = rule.riskKeywords.filter((keyword) =>
    riskText.includes(normalizedText(keyword)),
  );
  const matchedImprovementKeywords = rule.improvementKeywords.filter((keyword) =>
    improvementText.includes(normalizedText(keyword)),
  );
  const ratio = (matched: string[], all: string[]) =>
    all.length ? matched.length / all.length : 1;
  const breakdown = {
    targetDecision:
      submission.targetDecision === rule.correctTargetDecision
        ? weights.decision
        : 0,
    assessmentItems: Math.round(weights.items * Math.min(1, itemRatio)),
    identifiedRisks: Math.round(
      weights.risks * ratio(matchedRiskKeywords, rule.riskKeywords),
    ),
    improvementPlan: Math.round(
      weights.improvement *
        ratio(matchedImprovementKeywords, rule.improvementKeywords),
    ),
  };
  return {
    score: Math.min(
      100,
      breakdown.targetDecision +
        breakdown.assessmentItems +
        breakdown.identifiedRisks +
        breakdown.improvementPlan,
    ),
    breakdown,
    matchedItems,
    missedItems: [...expectedItems].filter((id) => !selectedItems.has(id)),
    matchedRiskKeywords,
    matchedImprovementKeywords,
  };
}

export interface CodeExecutionProvider {
  readonly name: string;
  execute(input: {
    language: string;
    sourceCode: string;
  }): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

export class DisabledCodeExecutionProvider implements CodeExecutionProvider {
  readonly name = "disabled";

  async execute(_input: {
    language: string;
    sourceCode: string;
  }): Promise<never> {
    void _input;
    throw new Error("CODE_EXECUTION_DISABLED");
  }
}
