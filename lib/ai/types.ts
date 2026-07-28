export const AI_DISCLAIMER =
  "AI가 생성한 참고용 설명이며 공식 기준·법령·시험 채점 결과가 아닙니다.";

export const INSUFFICIENT_CONTEXT_MESSAGE =
  "검수된 근거가 부족하여 확정적인 설명을 제공하기 어렵습니다.";

export type AIStatus =
  | "generated"
  | "failed"
  | "insufficient_context"
  | "reviewed"
  | "rejected";

export type AIProviderName = "mock" | "openai";

export type RetrievalContext = {
  id: string;
  kind:
    | "LEARNING_UNIT"
    | "LESSON"
    | "LEGAL_ARTICLE"
    | "ISMS_STANDARD"
    | "QUESTION_EXPLANATION"
    | "CASE_STUDY"
    | "SECURE_WEAKNESS"
    | "PRIVACY_ITEM"
    | "AI_REVIEWED_CONTENT";
  title: string;
  excerpt: string;
  courseId: string | null;
  topicId: string | null;
  version: string | null;
  reviewedAt: string | null;
};

export type QuestionExplanation = {
  intent: string;
  correctReason: string;
  wrongReasons: Array<{
    choiceId: string;
    choice: string;
    reason: string;
  }>;
  relatedStandards: string[];
  relatedLaws: string[];
  memorySummary: string;
  similarQuestions: Array<{ id: string; title: string }>;
  internalSources: Array<{
    id: string;
    title: string;
    kind: RetrievalContext["kind"];
  }>;
};

export type AIResult<T> = {
  provider: AIProviderName;
  model: string;
  generatedAt: string;
  sourceContextIds: string[];
  disclaimer: string;
  reviewed: boolean;
  requestId: string;
  latencyMs: number;
  status: AIStatus;
  content: T;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostMicros: number;
  };
  errorCode?: string;
};

export type QuestionExplanationInput = {
  requestId: string;
  question: {
    id: string;
    title: string;
    content: string;
    type: string;
    explanation: string;
    wrongAnswerExplanation: string;
    choices: Array<{
      id: string;
      content: string;
      isCorrect: boolean;
      explanation: string;
    }>;
  };
  contexts: RetrievalContext[];
  similarQuestions: Array<{ id: string; title: string }>;
};

export type GenericAIInput = {
  requestId: string;
  sourceContextIds: string[];
  context: Record<string, unknown>;
};

export type AIEvidence = {
  id: string;
  title: string;
  kind: RetrievalContext["kind"];
};

export type WrittenAnswerAIReview = {
  expectedScoreRange: { minimum: number; maximum: number };
  includedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  improvements: string[];
  exampleAnswer: string;
  evidence: AIEvidence[];
  advisoryOnly: true;
};

export type RiskScenarioAIReview = {
  assetReview: string;
  threatReview: string;
  vulnerabilityReview: string;
  completeness: string;
  missingElements: string[];
  treatmentOptions: string[];
  evidence: AIEvidence[];
};

export type PrivacyAssessmentAIReview = {
  missingAssessmentItems: string[];
  flowReview: string;
  riskReview: string;
  improvements: string[];
  relatedAssessmentItems: string[];
  referenceDate: string;
  evidence: AIEvidence[];
};

export type SecureCodeAIExplanation = {
  weaknessClassification: string;
  cweLinks: string[];
  vulnerableLineExplanations: Array<{
    lines: number[];
    explanation: string;
  }>;
  rootCause: string;
  secureCodeExample: string;
  falsePositiveAssessment: string;
  relatedTheory: string[];
  evidence: AIEvidence[];
  codeExecuted: false;
};

export type SpecializedAIResult =
  | WrittenAnswerAIReview
  | RiskScenarioAIReview
  | PrivacyAssessmentAIReview
  | SecureCodeAIExplanation;
