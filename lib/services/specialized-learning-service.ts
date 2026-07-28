import { AppError } from "../errors.ts";

export type WrittenAnswerRuleInput = {
  modelAnswer: string;
  requiredKeywords: string[];
  optionalKeywords: string[];
  maximumScore: number;
  partialScoreRules?: Array<{
    keywords: string[];
    score: number;
    mode?: "ANY" | "ALL";
  }>;
  guidance?: string;
};

function normalizeKeyword(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function gradeWrittenAnswer(
  answer: string,
  rule: WrittenAnswerRuleInput,
) {
  const normalizedAnswer = normalizeKeyword(answer);
  const includes = (keyword: string) =>
    normalizedAnswer.includes(normalizeKeyword(keyword));
  const fulfilledRequired = rule.requiredKeywords.filter(includes);
  const missingRequired = rule.requiredKeywords.filter(
    (keyword) => !includes(keyword),
  );
  const fulfilledOptional = rule.optionalKeywords.filter(includes);
  const requiredPool = Math.round(rule.maximumScore * 0.7);
  const optionalPool = rule.maximumScore - requiredPool;
  const requiredScore = rule.requiredKeywords.length
    ? (fulfilledRequired.length / rule.requiredKeywords.length) * requiredPool
    : requiredPool;
  const optionalScore = rule.optionalKeywords.length
    ? (fulfilledOptional.length / rule.optionalKeywords.length) * optionalPool
    : optionalPool;
  let bonusScore = 0;
  for (const partialRule of rule.partialScoreRules ?? []) {
    const matches = partialRule.keywords.map(includes);
    const matched =
      partialRule.mode === "ALL" ? matches.every(Boolean) : matches.some(Boolean);
    if (matched) bonusScore += Math.max(0, partialRule.score);
  }
  const earnedScore = Math.min(
    rule.maximumScore,
    Math.round(requiredScore + optionalScore + bonusScore),
  );
  return {
    earnedScore,
    maximumScore: rule.maximumScore,
    fulfilledRequired,
    missingRequired,
    fulfilledOptional,
    modelAnswer: rule.modelAnswer,
    guidance:
      rule.guidance ||
      "이 결과는 키워드 기반 학습 보조채점이며 공식 시험 채점 결과가 아닙니다.",
    advisoryOnly: true,
  };
}

export type RiskCalculationConfiguration = {
  likelihoodWeight?: number;
  impactWeight?: number;
  multiplier?: number;
  minimum?: number;
  maximum?: number;
  matrix?: Record<string, number>;
};

export type RiskGrade = {
  code: string;
  label: string;
  minValue: number;
  maxValue: number;
  treatmentGuidance?: string;
};

export function calculateRisk(input: {
  formulaType: string;
  likelihood: number;
  impact: number;
  configuration?: RiskCalculationConfiguration;
  grades?: RiskGrade[];
}) {
  const configuration = input.configuration ?? {};
  let rawValue: number;
  switch (input.formulaType) {
    case "MULTIPLY":
      rawValue =
        input.likelihood *
        input.impact *
        (configuration.multiplier ?? 1);
      break;
    case "ADD":
      rawValue =
        input.likelihood +
        input.impact * (configuration.multiplier ?? 1);
      break;
    case "WEIGHTED":
      rawValue =
        input.likelihood * (configuration.likelihoodWeight ?? 1) +
        input.impact * (configuration.impactWeight ?? 1);
      break;
    case "MATRIX": {
      const key = `${input.likelihood}:${input.impact}`;
      const matrixValue = configuration.matrix?.[key];
      if (typeof matrixValue !== "number") {
        throw new AppError(
          "선택한 가능성과 영향도에 대한 매트릭스 값이 없습니다.",
          400,
          "RISK_MATRIX_VALUE_MISSING",
        );
      }
      rawValue = matrixValue;
      break;
    }
    default:
      throw new AppError(
        "지원하지 않는 위험 계산 방식입니다.",
        400,
        "RISK_FORMULA_UNSUPPORTED",
      );
  }
  const riskValue = Math.round(
    Math.min(
      configuration.maximum ?? Number.MAX_SAFE_INTEGER,
      Math.max(configuration.minimum ?? 0, rawValue),
    ),
  );
  const grade = input.grades
    ?.slice()
    .sort((left, right) => left.minValue - right.minValue)
    .find(
      (candidate) =>
        riskValue >= candidate.minValue && riskValue <= candidate.maxValue,
    );
  return {
    riskValue,
    riskLevel: grade?.code ?? "UNCLASSIFIED",
    riskLabel: grade?.label ?? "등급 미설정",
    treatmentGuidance: grade?.treatmentGuidance ?? "",
  };
}
