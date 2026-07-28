import type { AIProvider } from "./ai-provider.ts";
import {
  AI_DISCLAIMER,
  INSUFFICIENT_CONTEXT_MESSAGE,
  type AIEvidence,
  type AIResult,
  type GenericAIInput,
  type PrivacyAssessmentAIReview,
  type QuestionExplanation,
  type QuestionExplanationInput,
  type RiskScenarioAIReview,
  type SecureCodeAIExplanation,
  type WrittenAnswerAIReview,
} from "./types.ts";

export class MockAIProvider implements AIProvider {
  private readonly reason: string;

  constructor(reason = "configured_mock") {
    this.reason = reason;
  }

  async explainQuestion(
    input: QuestionExplanationInput,
  ): Promise<AIResult<QuestionExplanation>> {
    const generatedAt = new Date().toISOString();
    const hasContext = input.contexts.length > 0;
    const correctChoices = input.question.choices.filter(
      (choice) => choice.isCorrect,
    );
    return {
      provider: "mock",
      model: "mock-ai-v1",
      generatedAt,
      sourceContextIds: input.contexts.map((context) => context.id),
      disclaimer: AI_DISCLAIMER,
      reviewed: false,
      requestId: input.requestId,
      latencyMs: 0,
      status: hasContext ? "generated" : "insufficient_context",
      content: {
        intent: hasContext
          ? `Mock AI: ${input.question.title}에서 묻는 핵심 개념을 검수 해설과 내부 근거로 확인합니다.`
          : INSUFFICIENT_CONTEXT_MESSAGE,
        correctReason: hasContext
          ? input.question.explanation
          : INSUFFICIENT_CONTEXT_MESSAGE,
        wrongReasons: input.question.choices
          .filter((choice) => !choice.isCorrect)
          .map((choice) => ({
            choiceId: choice.id,
            choice: choice.content,
            reason:
              choice.explanation ||
              input.question.wrongAnswerExplanation ||
              "Mock AI 해설에는 추가 오답 근거가 없습니다.",
          })),
        relatedStandards: input.contexts
          .filter((context) => context.kind === "ISMS_STANDARD")
          .map((context) => context.title),
        relatedLaws: input.contexts
          .filter((context) => context.kind === "LEGAL_ARTICLE")
          .map((context) => context.title),
        memorySummary: hasContext
          ? `Mock AI 요약: 정답은 ${correctChoices.map((choice) => choice.content).join(", ")}입니다.`
          : INSUFFICIENT_CONTEXT_MESSAGE,
        similarQuestions: input.similarQuestions,
        internalSources: input.contexts.map((context) => ({
          id: context.id,
          title: context.title,
          kind: context.kind,
        })),
      },
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostMicros: 0 },
      ...(this.reason === "configured_mock"
        ? {}
        : { errorCode: this.reason.toUpperCase() }),
    };
  }

  async gradeWrittenAnswer(
    input: GenericAIInput,
  ): Promise<AIResult<WrittenAnswerAIReview>> {
    const referenceScore = numberValue(input.context.referenceScore);
    const maximumScore = Math.max(
      referenceScore,
      numberValue(input.context.maximumScore, 100),
    );
    return this.specializedResult(input, {
      expectedScoreRange: {
        minimum: Math.max(0, referenceScore - 5),
        maximum: Math.min(maximumScore, referenceScore + 5),
      },
      includedKeywords: stringArray(input.context.includedKeywords),
      missingKeywords: stringArray(input.context.missingKeywords),
      strengths: [
        "Mock AI: 규칙 기반 채점에서 확인된 핵심 키워드를 답안에 포함했습니다.",
      ],
      improvements: stringArray(input.context.missingKeywords).length
        ? ["누락된 핵심 키워드의 의미와 적용 근거를 보완하세요."]
        : ["주장의 근거와 적용 범위를 더 명확하게 연결하세요."],
      exampleAnswer: stringValue(input.context.modelAnswer),
      evidence: evidenceFrom(input),
      advisoryOnly: true,
    });
  }

  recommendLearning(input: GenericAIInput) {
    return this.safeGeneric(input);
  }

  async reviewRiskScenario(
    input: GenericAIInput,
  ): Promise<AIResult<RiskScenarioAIReview>> {
    const asset = stringValue(input.context.asset);
    const threat = stringValue(input.context.threat);
    const vulnerability = stringValue(input.context.vulnerability);
    const missingElements = [
      !asset ? "자산" : "",
      !threat ? "위협" : "",
      !vulnerability ? "취약점" : "",
    ].filter(Boolean);
    return this.specializedResult(input, {
      assetReview: asset
        ? `Mock AI: 자산 “${asset}”이 식별되어 있습니다.`
        : "자산 식별이 필요합니다.",
      threatReview: threat
        ? `Mock AI: 위협 “${threat}”이 식별되어 있습니다.`
        : "위협 식별이 필요합니다.",
      vulnerabilityReview: vulnerability
        ? `Mock AI: 취약점 “${vulnerability}”이 식별되어 있습니다.`
        : "취약점 식별이 필요합니다.",
      completeness: missingElements.length
        ? "핵심 구성요소 일부가 누락된 개발용 Mock 검토 결과입니다."
        : "자산·위협·취약점의 기본 연결이 포함된 개발용 Mock 검토 결과입니다.",
      missingElements,
      treatmentOptions: [
        stringValue(input.context.treatmentOption) ||
          "회피·완화·전가·수용 중 근거에 맞는 방안을 선택하세요.",
      ],
      evidence: evidenceFrom(input),
    });
  }

  async reviewPrivacyAssessment(
    input: GenericAIInput,
  ): Promise<AIResult<PrivacyAssessmentAIReview>> {
    return this.specializedResult(input, {
      missingAssessmentItems: stringArray(input.context.missingAssessmentItems),
      flowReview:
        "Mock AI: 등록된 처리 흐름 노드와 연결관계를 기준으로 수집·이용·보관·제공·파기 단계를 확인했습니다.",
      riskReview:
        stringValue(input.context.identifiedRisks) ||
        "식별된 위험요인을 추가로 작성해야 합니다.",
      improvements: [
        stringValue(input.context.modelImprovementPlan) ||
          "누락 평가항목과 개인정보 흐름별 보호조치를 연결하세요.",
      ],
      relatedAssessmentItems: stringArray(
        input.context.relatedAssessmentItems,
      ),
      referenceDate:
        stringValue(input.context.referenceDate) || "기준일 미설정",
      evidence: evidenceFrom(input),
    });
  }

  async explainSecureCode(
    input: GenericAIInput,
  ): Promise<AIResult<SecureCodeAIExplanation>> {
    return this.specializedResult(input, {
      weaknessClassification:
        stringValue(input.context.weaknessName) ||
        "분류 근거가 부족합니다.",
      cweLinks: [
        stringValue(input.context.cweCode) || "CWE 연결 정보 없음",
      ],
      vulnerableLineExplanations: [
        {
          lines: numberArray(input.context.vulnerableLines),
          explanation:
            stringValue(input.context.explanation) ||
            "Mock AI: 등록된 취약 라인과 약점 설명을 확인하세요.",
        },
      ],
      rootCause:
        stringValue(input.context.detectionGuide) ||
        "입력값 신뢰경계와 안전하지 않은 API 사용 여부를 확인하세요.",
      secureCodeExample: stringValue(input.context.secureCode),
      falsePositiveAssessment: booleanValue(
        input.context.falsePositivePossible,
      )
        ? "오탐 가능성이 등록되어 있으므로 호출 경로와 입력 통제를 함께 확인해야 합니다."
        : "등록된 샘플 기준으로 오탐 가능성이 낮지만 실제 호출 흐름 확인이 필요합니다.",
      relatedTheory: [
        stringValue(input.context.remediationGuide) ||
          "입력 검증과 안전한 API 사용 원칙",
      ],
      evidence: evidenceFrom(input),
      codeExecuted: false,
    });
  }

  private async specializedResult<T>(
    input: GenericAIInput,
    content: T,
  ): Promise<AIResult<T>> {
    const hasContext = input.sourceContextIds.length > 0;
    return {
      provider: "mock",
      model: "mock-ai-v1",
      generatedAt: new Date().toISOString(),
      sourceContextIds: input.sourceContextIds,
      disclaimer: AI_DISCLAIMER,
      reviewed: false,
      requestId: input.requestId,
      latencyMs: 0,
      status: hasContext ? "generated" : "insufficient_context",
      content,
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostMicros: 0 },
      ...(this.reason === "configured_mock"
        ? {}
        : { errorCode: this.reason.toUpperCase() }),
    };
  }

  private async safeGeneric(
    input: GenericAIInput,
  ): Promise<AIResult<Record<string, unknown>>> {
    return {
      provider: "mock",
      model: "mock-ai-v1",
      generatedAt: new Date().toISOString(),
      sourceContextIds: input.sourceContextIds,
      disclaimer: AI_DISCLAIMER,
      reviewed: false,
      requestId: input.requestId,
      latencyMs: 0,
      status: "insufficient_context",
      content: { message: INSUFFICIENT_CONTEXT_MESSAGE, mock: true },
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostMicros: 0 },
    };
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function booleanValue(value: unknown) {
  return value === true;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is number =>
          typeof item === "number" && Number.isInteger(item),
      )
    : [];
}

function evidenceFrom(input: GenericAIInput): AIEvidence[] {
  const evidence = input.context.evidence;
  if (!Array.isArray(evidence)) return [];
  return evidence.flatMap((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      !("title" in item) ||
      !("kind" in item) ||
      typeof item.id !== "string" ||
      typeof item.title !== "string" ||
      typeof item.kind !== "string"
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        title: item.title,
        kind: item.kind as AIEvidence["kind"],
      },
    ];
  });
}
