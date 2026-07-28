import type {
  AIResult,
  GenericAIInput,
  PrivacyAssessmentAIReview,
  QuestionExplanation,
  QuestionExplanationInput,
  RiskScenarioAIReview,
  SecureCodeAIExplanation,
  WrittenAnswerAIReview,
} from "./types.ts";

export interface AIProvider {
  explainQuestion(
    input: QuestionExplanationInput,
  ): Promise<AIResult<QuestionExplanation>>;
  gradeWrittenAnswer(
    input: GenericAIInput,
  ): Promise<AIResult<WrittenAnswerAIReview>>;
  recommendLearning(
    input: GenericAIInput,
  ): Promise<AIResult<Record<string, unknown>>>;
  reviewRiskScenario(
    input: GenericAIInput,
  ): Promise<AIResult<RiskScenarioAIReview>>;
  reviewPrivacyAssessment(
    input: GenericAIInput,
  ): Promise<AIResult<PrivacyAssessmentAIReview>>;
  explainSecureCode(
    input: GenericAIInput,
  ): Promise<AIResult<SecureCodeAIExplanation>>;
}
