import type { BatchItem } from "drizzle-orm/batch";
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import { getDb } from ".";
import {
  aiGenerationRecords,
  aiReviewedContents,
  aiSpecializedGenerationRecords,
  aiSpecializedReviews,
  codeAnalysisAnswers,
  courses,
  privacyAssessmentAnswers,
  privacyAssessmentScenarios,
  privacyFlowEdges,
  privacyFlowNodes,
  privacyImpactAssessmentItems,
  questionAttempts,
  questionCourses,
  questions,
  riskScenarios,
  secureCodeSamples,
  secureCodingWeaknesses,
  userCourseEnrollments,
  users,
  writtenAnswerRules,
} from "./schema";
import { DatabaseRetrievalProvider } from "./ai-repositories";
import type { AIProvider } from "@/lib/ai/ai-provider";
import { assertDailyAILimit } from "@/lib/ai/safety";
import type {
  AIEvidence,
  AIResult,
  RetrievalContext,
  SpecializedAIResult,
} from "@/lib/ai/types";
import { AppError } from "@/lib/errors";
import {
  gradeWrittenAnswer,
  type WrittenAnswerRuleInput,
} from "@/lib/services/specialized-learning-service";

export type SpecializedAITarget =
  | {
      targetType: "WRITTEN_ANSWER";
      courseId: string;
      questionId: string;
      answer: string;
    }
  | {
      targetType: "RISK_SCENARIO";
      courseId: string;
      scenarioId: string;
    }
  | {
      targetType: "PRIVACY_ASSESSMENT";
      courseId: string;
      answerId: string;
    }
  | {
      targetType: "SECURE_CODE";
      courseId: string;
      attemptId: string;
    };

export type AIReviewAction =
  | "REVIEWED"
  | "APPROVED_WITH_EDITS"
  | "REJECTED"
  | "DELETED"
  | "COPIED";

type PreparedSpecializedAI = {
  targetId: string;
  contexts: RetrievalContext[];
  inputFingerprintParts: string[];
  generate: (
    provider: AIProvider,
    requestId: string,
    contexts: RetrievalContext[],
  ) => Promise<AIResult<SpecializedAIResult>>;
};

export async function generateSpecializedAI(input: {
  userId: string;
  target: SpecializedAITarget;
  provider: AIProvider;
  dailyLimit: number;
  retentionDays: number;
}) {
  await requireEnrollment(input.userId, input.target.courseId);
  assertDailyAILimit(
    await countTodayAIGenerations(input.userId),
    input.dailyLimit,
  );

  const prepared = await prepareTarget(input.userId, input.target);
  const requestId = crypto.randomUUID();
  const result = await prepared.generate(
    input.provider,
    requestId,
    prepared.contexts,
  );
  const recordId = crypto.randomUUID();
  const retentionUntil = new Date(
    Date.now() + input.retentionDays * 86_400_000,
  ).toISOString();
  await getDb().insert(aiSpecializedGenerationRecords).values({
    id: recordId,
    userId: input.userId,
    courseId: input.target.courseId,
    targetType: input.target.targetType,
    targetId: prepared.targetId,
    provider: result.provider,
    model: result.model,
    generatedAt: result.generatedAt,
    sourceContextIdsJson: JSON.stringify(result.sourceContextIds),
    disclaimer: result.disclaimer,
    requestId: result.requestId,
    latencyMs: result.latencyMs,
    generationStatus: result.status,
    reviewStatus: "PENDING",
    originalResultJson: JSON.stringify(result.content),
    errorCode: result.errorCode ?? null,
    inputFingerprint: await createFingerprint(
      prepared.inputFingerprintParts,
    ),
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
    estimatedCostMicros: result.usage?.estimatedCostMicros ?? 0,
    retentionUntil,
  });

  return {
    recordId,
    targetType: input.target.targetType,
    reviewStatus: "PENDING" as const,
    ...result,
  };
}

export async function getSpecializedAIRecord(
  userId: string,
  requestId: string,
) {
  const [row] = await getDb()
    .select()
    .from(aiSpecializedGenerationRecords)
    .where(
      and(
        eq(aiSpecializedGenerationRecords.userId, userId),
        eq(aiSpecializedGenerationRecords.requestId, requestId),
        isNull(aiSpecializedGenerationRecords.deletedAt),
      ),
    )
    .limit(1);
  return row ? toPublicRecord(row) : null;
}

export async function listAdminSpecializedAIRecords(limit = 100) {
  const records = await getDb()
    .select({
      id: aiSpecializedGenerationRecords.id,
      requestId: aiSpecializedGenerationRecords.requestId,
      targetType: aiSpecializedGenerationRecords.targetType,
      targetId: aiSpecializedGenerationRecords.targetId,
      courseId: aiSpecializedGenerationRecords.courseId,
      courseName: courses.shortName,
      userEmail: users.email,
      provider: aiSpecializedGenerationRecords.provider,
      model: aiSpecializedGenerationRecords.model,
      generationStatus: aiSpecializedGenerationRecords.generationStatus,
      reviewStatus: aiSpecializedGenerationRecords.reviewStatus,
      originalResultJson:
        aiSpecializedGenerationRecords.originalResultJson,
      disclaimer: aiSpecializedGenerationRecords.disclaimer,
      generatedAt: aiSpecializedGenerationRecords.generatedAt,
      deletedAt: aiSpecializedGenerationRecords.deletedAt,
    })
    .from(aiSpecializedGenerationRecords)
    .innerJoin(
      courses,
      eq(aiSpecializedGenerationRecords.courseId, courses.id),
    )
    .innerJoin(
      users,
      eq(aiSpecializedGenerationRecords.userId, users.id),
    )
    .orderBy(desc(aiSpecializedGenerationRecords.generatedAt))
    .limit(Math.max(1, Math.min(limit, 200)));
  const ids = records.map((record) => record.id);
  const reviews = (
    await Promise.all(
      chunkIds(ids, 50).map((chunk) =>
        getDb()
          .select({
            id: aiSpecializedReviews.id,
            generationId: aiSpecializedReviews.generationId,
            reviewerEmail: users.email,
            revision: aiSpecializedReviews.revision,
            action: aiSpecializedReviews.action,
            editedResultJson: aiSpecializedReviews.editedResultJson,
            reviewNote: aiSpecializedReviews.reviewNote,
            createdAt: aiSpecializedReviews.createdAt,
          })
          .from(aiSpecializedReviews)
          .innerJoin(users, eq(aiSpecializedReviews.reviewerId, users.id))
          .where(inArray(aiSpecializedReviews.generationId, chunk))
          .orderBy(
            desc(aiSpecializedReviews.createdAt),
            desc(aiSpecializedReviews.revision),
          ),
      ),
    )
  ).flat();
  return records.map((record) => ({
    ...record,
    originalResult: parseJson<Record<string, unknown>>(
      record.originalResultJson,
      {},
    ),
    reviews: reviews
      .filter((review) => review.generationId === record.id)
      .map((review) => ({
        ...review,
        editedResult: parseJson<Record<string, unknown>>(
          review.editedResultJson,
          {},
        ),
      })),
  }));
}

function chunkIds<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function reviewSpecializedAI(input: {
  reviewerId: string;
  generationId: string;
  action: AIReviewAction;
  reviewNote: string;
  editedResult: Record<string, unknown>;
  reviewedContentTitle: string;
}) {
  const [generation] = await getDb()
    .select()
    .from(aiSpecializedGenerationRecords)
    .where(eq(aiSpecializedGenerationRecords.id, input.generationId))
    .limit(1);
  if (!generation) {
    throw new AppError(
      "검수할 AI 결과를 찾을 수 없습니다.",
      404,
      "AI_REVIEW_NOT_FOUND",
    );
  }
  if (
    input.action === "APPROVED_WITH_EDITS" &&
    !Object.keys(input.editedResult).length
  ) {
    throw new AppError(
      "수정 후 승인에는 관리자 수정본이 필요합니다.",
      400,
      "AI_REVIEW_EDIT_REQUIRED",
    );
  }
  if (input.action === "COPIED" && !input.reviewedContentTitle.trim()) {
    throw new AppError(
      "검수 콘텐츠 제목이 필요합니다.",
      400,
      "AI_REVIEW_TITLE_REQUIRED",
    );
  }
  const [revisionRow] = await getDb()
    .select({
      revision: sql<number>`coalesce(max(${aiSpecializedReviews.revision}), 0)`,
    })
    .from(aiSpecializedReviews)
    .where(eq(aiSpecializedReviews.generationId, generation.id));
  const revision = Number(revisionRow?.revision ?? 0) + 1;
  const effectiveContent =
    Object.keys(input.editedResult).length > 0
      ? input.editedResult
      : parseJson<Record<string, unknown>>(
          generation.originalResultJson,
          {},
        );
  const reviewId = crypto.randomUUID();
  const operations: BatchItem<"sqlite">[] = [
    getDb().insert(aiSpecializedReviews).values({
      id: reviewId,
      generationId: generation.id,
      reviewerId: input.reviewerId,
      revision,
      action: input.action,
      editedResultJson: JSON.stringify(input.editedResult),
      reviewNote: input.reviewNote,
    }),
    getDb()
      .update(aiSpecializedGenerationRecords)
      .set({
        reviewStatus: input.action,
        deletedAt:
          input.action === "DELETED" ? sql`CURRENT_TIMESTAMP` : null,
      })
      .where(eq(aiSpecializedGenerationRecords.id, generation.id)),
  ];
  if (input.action === "COPIED") {
    operations.push(
      getDb()
        .insert(aiReviewedContents)
        .values({
          id: crypto.randomUUID(),
          generationId: generation.id,
          courseId: generation.courseId,
          targetType: generation.targetType,
          targetId: generation.targetId,
          title: input.reviewedContentTitle,
          contentJson: JSON.stringify(effectiveContent),
          createdBy: input.reviewerId,
        })
        .onConflictDoUpdate({
          target: aiReviewedContents.generationId,
          set: {
            title: input.reviewedContentTitle,
            contentJson: JSON.stringify(effectiveContent),
            createdBy: input.reviewerId,
            active: true,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        }),
    );
  }
  await getDb().batch(batchItems(operations));
  return { reviewId, revision, status: input.action };
}

async function prepareTarget(
  userId: string,
  target: SpecializedAITarget,
): Promise<PreparedSpecializedAI> {
  switch (target.targetType) {
    case "WRITTEN_ANSWER":
      return prepareWrittenTarget(target);
    case "RISK_SCENARIO":
      return prepareRiskTarget(target);
    case "PRIVACY_ASSESSMENT":
      return preparePrivacyTarget(userId, target);
    case "SECURE_CODE":
      return prepareCodeTarget(userId, target);
  }
}

async function prepareWrittenTarget(
  target: Extract<SpecializedAITarget, { targetType: "WRITTEN_ANSWER" }>,
): Promise<PreparedSpecializedAI> {
  const [row] = await getDb()
    .select({
      questionId: questions.id,
      title: questions.title,
      content: questions.content,
      modelAnswer: writtenAnswerRules.modelAnswer,
      requiredKeywordsJson: writtenAnswerRules.requiredKeywordsJson,
      optionalKeywordsJson: writtenAnswerRules.optionalKeywordsJson,
      maximumScore: writtenAnswerRules.maximumScore,
      partialScoreRulesJson: writtenAnswerRules.partialScoreRulesJson,
      guidance: writtenAnswerRules.guidance,
      referenceDate: writtenAnswerRules.referenceDate,
    })
    .from(writtenAnswerRules)
    .innerJoin(questions, eq(writtenAnswerRules.questionId, questions.id))
    .innerJoin(
      questionCourses,
      and(
        eq(writtenAnswerRules.questionId, questionCourses.questionId),
        eq(questionCourses.courseId, target.courseId),
      ),
    )
    .where(
      and(
        eq(writtenAnswerRules.questionId, target.questionId),
        eq(questions.status, "PUBLISHED"),
      ),
    )
    .limit(1);
  if (!row) {
    throw new AppError(
      "과정에 연결된 서술형 문제를 찾을 수 없습니다.",
      404,
      "AI_WRITTEN_TARGET_NOT_FOUND",
    );
  }
  const grade = gradeWrittenAnswer(target.answer, {
    modelAnswer: row.modelAnswer,
    requiredKeywords: parseJson<string[]>(row.requiredKeywordsJson, []),
    optionalKeywords: parseJson<string[]>(row.optionalKeywordsJson, []),
    maximumScore: row.maximumScore,
    partialScoreRules: parseJson<
      WrittenAnswerRuleInput["partialScoreRules"]
    >(row.partialScoreRulesJson, []),
    guidance: row.guidance,
  });
  const contexts = await courseContexts(target.courseId, row.title, {
    id: `QUESTION:${row.questionId}`,
    kind: "QUESTION_EXPLANATION",
    title: row.title,
    excerpt: `${row.content}\n${row.modelAnswer}`,
    courseId: target.courseId,
    topicId: null,
    version: null,
    reviewedAt: row.referenceDate,
  });
  const evidence = toEvidence(contexts);
  return {
    targetId: row.questionId,
    contexts,
    inputFingerprintParts: [
      target.courseId,
      row.questionId,
      target.answer,
    ],
    generate: (provider, requestId, preparedContexts) =>
      provider.gradeWrittenAnswer({
        requestId,
        sourceContextIds: preparedContexts.map((context) => context.id),
        context: {
          question: row.content,
          answer: target.answer,
          referenceScore: grade.earnedScore,
          maximumScore: grade.maximumScore,
          includedKeywords: [
            ...grade.fulfilledRequired,
            ...grade.fulfilledOptional,
          ],
          missingKeywords: grade.missingRequired,
          modelAnswer: row.modelAnswer,
          guidance: row.guidance,
          referenceDate: row.referenceDate,
          evidence,
          officialScoreMustRemainUnchanged: true,
        },
      }),
  };
}

async function prepareRiskTarget(
  target: Extract<SpecializedAITarget, { targetType: "RISK_SCENARIO" }>,
): Promise<PreparedSpecializedAI> {
  const [row] = await getDb()
    .select()
    .from(riskScenarios)
    .where(
      and(
        eq(riskScenarios.id, target.scenarioId),
        eq(riskScenarios.courseId, target.courseId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new AppError(
      "과정에 연결된 위험 시나리오를 찾을 수 없습니다.",
      404,
      "AI_RISK_TARGET_NOT_FOUND",
    );
  }
  const contexts = await courseContexts(target.courseId, row.title, {
    id: `RISK_SCENARIO:${row.id}`,
    kind: "CASE_STUDY",
    title: row.title,
    excerpt: row.description,
    courseId: row.courseId,
    topicId: null,
    version: null,
    reviewedAt: row.referenceDate,
  });
  return {
    targetId: row.id,
    contexts,
    inputFingerprintParts: [target.courseId, row.id, row.updatedAt],
    generate: (provider, requestId, preparedContexts) =>
      provider.reviewRiskScenario({
        requestId,
        sourceContextIds: preparedContexts.map((context) => context.id),
        context: {
          asset: row.asset,
          threat: row.threat,
          vulnerability: row.vulnerability,
          existingControls: row.existingControls,
          likelihood: row.likelihood,
          impact: row.impact,
          riskValue: row.riskValue,
          riskLevel: row.riskLevel,
          treatmentOption: row.treatmentOption,
          residualRisk: row.residualRisk,
          description: row.description,
          referenceDate: row.referenceDate,
          evidence: toEvidence(preparedContexts),
        },
      }),
  };
}

async function preparePrivacyTarget(
  userId: string,
  target: Extract<
    SpecializedAITarget,
    { targetType: "PRIVACY_ASSESSMENT" }
  >,
): Promise<PreparedSpecializedAI> {
  const [row] = await getDb()
    .select({
      answerId: privacyAssessmentAnswers.id,
      scenarioId: privacyAssessmentScenarios.id,
      title: privacyAssessmentScenarios.title,
      description: privacyAssessmentScenarios.description,
      processedData: privacyAssessmentScenarios.processedData,
      processingPurpose: privacyAssessmentScenarios.processingPurpose,
      expectedItemsJson:
        privacyAssessmentScenarios.expectedAssessmentItemsJson,
      modelImprovementPlan:
        privacyAssessmentScenarios.modelImprovementPlan,
      selectedItemsJson:
        privacyAssessmentAnswers.selectedAssessmentItemsJson,
      targetDecision: privacyAssessmentAnswers.targetDecision,
      identifiedRisks: privacyAssessmentAnswers.identifiedRisks,
      improvementPlan: privacyAssessmentAnswers.improvementPlan,
      score: privacyAssessmentAnswers.score,
      updatedAt: privacyAssessmentAnswers.updatedAt,
    })
    .from(privacyAssessmentAnswers)
    .innerJoin(
      privacyAssessmentScenarios,
      and(
        eq(
          privacyAssessmentAnswers.scenarioId,
          privacyAssessmentScenarios.id,
        ),
        eq(privacyAssessmentScenarios.courseId, target.courseId),
      ),
    )
    .where(
      and(
        eq(privacyAssessmentAnswers.id, target.answerId),
        eq(privacyAssessmentAnswers.userId, userId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new AppError(
      "본인의 해당 과정 영향평가 답안을 찾을 수 없습니다.",
      404,
      "AI_PRIVACY_TARGET_NOT_FOUND",
    );
  }
  const selectedIds = parseJson<string[]>(row.selectedItemsJson, []);
  const expectedIds = parseJson<string[]>(row.expectedItemsJson, []);
  const itemIds = [...new Set([...selectedIds, ...expectedIds])];
  const [items, nodes, edges] = await Promise.all([
    itemIds.length
      ? getDb()
          .select({
            id: privacyImpactAssessmentItems.id,
            code: privacyImpactAssessmentItems.code,
            title: privacyImpactAssessmentItems.title,
            effectiveDate: privacyImpactAssessmentItems.effectiveDate,
          })
          .from(privacyImpactAssessmentItems)
          .where(
            and(
              inArray(privacyImpactAssessmentItems.id, itemIds),
              eq(privacyImpactAssessmentItems.active, true),
            ),
          )
      : [],
    getDb()
      .select()
      .from(privacyFlowNodes)
      .where(eq(privacyFlowNodes.scenarioId, row.scenarioId)),
    getDb()
      .select()
      .from(privacyFlowEdges)
      .where(eq(privacyFlowEdges.scenarioId, row.scenarioId)),
  ]);
  const itemName = new Map(
    items.map((item) => [item.id, `${item.code} ${item.title}`]),
  );
  const missingAssessmentItems = expectedIds
    .filter((id) => !selectedIds.includes(id))
    .map((id) => itemName.get(id) ?? id);
  const referenceDate =
    items
      .map((item) => item.effectiveDate)
      .sort()
      .at(-1) ?? "";
  const contexts = await courseContexts(target.courseId, row.title, {
    id: `PRIVACY_ANSWER:${row.answerId}`,
    kind: "PRIVACY_ITEM",
    title: row.title,
    excerpt: row.description,
    courseId: target.courseId,
    topicId: null,
    version: null,
    reviewedAt: referenceDate || row.updatedAt,
  });
  return {
    targetId: row.answerId,
    contexts,
    inputFingerprintParts: [
      target.courseId,
      row.answerId,
      row.updatedAt,
    ],
    generate: (provider, requestId, preparedContexts) =>
      provider.reviewPrivacyAssessment({
        requestId,
        sourceContextIds: preparedContexts.map((context) => context.id),
        context: {
          scenario: row.description,
          processedData: row.processedData,
          processingPurpose: row.processingPurpose,
          targetDecision: row.targetDecision,
          selectedAssessmentItems: selectedIds.map(
            (id) => itemName.get(id) ?? id,
          ),
          missingAssessmentItems,
          relatedAssessmentItems: items.map(
            (item) => `${item.code} ${item.title}`,
          ),
          identifiedRisks: row.identifiedRisks,
          improvementPlan: row.improvementPlan,
          modelImprovementPlan: row.modelImprovementPlan,
          flowNodes: nodes,
          flowEdges: edges,
          referenceDate,
          existingReferenceScore: row.score,
          evidence: toEvidence(preparedContexts),
        },
      }),
  };
}

async function prepareCodeTarget(
  userId: string,
  target: Extract<SpecializedAITarget, { targetType: "SECURE_CODE" }>,
): Promise<PreparedSpecializedAI> {
  const [row] = await getDb()
    .select({
      attemptId: questionAttempts.id,
      sampleId: secureCodeSamples.id,
      sampleTitle: secureCodeSamples.title,
      language: secureCodeSamples.language,
      vulnerableCode: secureCodeSamples.vulnerableCode,
      secureCode: secureCodeSamples.secureCode,
      vulnerableLinesJson: secureCodeSamples.vulnerableLinesJson,
      sampleExplanation: secureCodeSamples.explanation,
      falsePositivePossible: secureCodeSamples.falsePositivePossible,
      sourceDate: secureCodeSamples.sourceDate,
      selectedLinesJson: codeAnalysisAnswers.selectedLinesJson,
      userExplanation: codeAnalysisAnswers.userExplanation,
      remediationCode: codeAnalysisAnswers.remediationCode,
      weaknessName: secureCodingWeaknesses.name,
      cweCode: secureCodingWeaknesses.cweCode,
      detectionGuide: secureCodingWeaknesses.detectionGuide,
      remediationGuide: secureCodingWeaknesses.remediationGuide,
      version: secureCodingWeaknesses.version,
    })
    .from(questionAttempts)
    .innerJoin(
      codeAnalysisAnswers,
      eq(questionAttempts.id, codeAnalysisAnswers.attemptId),
    )
    .innerJoin(
      secureCodeSamples,
      eq(codeAnalysisAnswers.sampleId, secureCodeSamples.id),
    )
    .innerJoin(
      secureCodingWeaknesses,
      eq(codeAnalysisAnswers.weaknessId, secureCodingWeaknesses.id),
    )
    .where(
      and(
        eq(questionAttempts.id, target.attemptId),
        eq(questionAttempts.userId, userId),
        eq(questionAttempts.courseId, target.courseId),
        eq(secureCodeSamples.active, true),
        eq(secureCodingWeaknesses.active, true),
      ),
    )
    .limit(1);
  if (!row) {
    throw new AppError(
      "본인의 해당 과정 코드 분석 답안을 찾을 수 없습니다.",
      404,
      "AI_CODE_TARGET_NOT_FOUND",
    );
  }
  const contexts = await courseContexts(
    target.courseId,
    row.weaknessName,
    {
      id: `SECURE_WEAKNESS:${row.sampleId}`,
      kind: "SECURE_WEAKNESS",
      title: row.sampleTitle,
      excerpt: `${row.sampleExplanation}\n${row.detectionGuide}\n${row.remediationGuide}`,
      courseId: target.courseId,
      topicId: null,
      version: row.version,
      reviewedAt: row.sourceDate,
    },
  );
  return {
    targetId: row.attemptId,
    contexts,
    inputFingerprintParts: [
      target.courseId,
      row.attemptId,
      row.userExplanation,
      row.remediationCode,
    ],
    generate: (provider, requestId, preparedContexts) =>
      provider.explainSecureCode({
        requestId,
        sourceContextIds: preparedContexts.map((context) => context.id),
        context: {
          language: row.language,
          vulnerableCode: row.vulnerableCode,
          secureCode: row.secureCode,
          vulnerableLines: parseJson<number[]>(
            row.vulnerableLinesJson,
            [],
          ),
          selectedLines: parseJson<number[]>(
            row.selectedLinesJson,
            [],
          ),
          userExplanation: row.userExplanation,
          remediationCode: row.remediationCode,
          weaknessName: row.weaknessName,
          cweCode: row.cweCode,
          explanation: row.sampleExplanation,
          detectionGuide: row.detectionGuide,
          remediationGuide: row.remediationGuide,
          falsePositivePossible: row.falsePositivePossible,
          evidence: toEvidence(preparedContexts),
          codeExecutionAllowed: false,
        },
      }),
  };
}

async function courseContexts(
  courseId: string,
  query: string,
  primary: RetrievalContext,
) {
  const retrieval = new DatabaseRetrievalProvider();
  const related = await retrieval.searchByCourse(courseId, {
    query,
    limit: 7,
  });
  return deduplicateContexts([primary, ...related]).slice(0, 8);
}

async function requireEnrollment(userId: string, courseId: string) {
  const [enrollment] = await getDb()
    .select({ id: userCourseEnrollments.id })
    .from(userCourseEnrollments)
    .where(
      and(
        eq(userCourseEnrollments.userId, userId),
        eq(userCourseEnrollments.courseId, courseId),
        inArray(userCourseEnrollments.status, ["ACTIVE", "PAUSED"]),
      ),
    )
    .limit(1);
  if (!enrollment) {
    throw new AppError(
      "수강 중인 과정의 AI 기능만 이용할 수 있습니다.",
      403,
      "AI_ENROLLMENT_REQUIRED",
    );
  }
}

async function countTodayAIGenerations(userId: string) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [[questionCount], [specializedCount]] = await Promise.all([
    getDb()
      .select({ count: sql<number>`count(*)` })
      .from(aiGenerationRecords)
      .where(
        and(
          eq(aiGenerationRecords.userId, userId),
          gt(aiGenerationRecords.generatedAt, start.toISOString()),
        ),
      ),
    getDb()
      .select({ count: sql<number>`count(*)` })
      .from(aiSpecializedGenerationRecords)
      .where(
        and(
          eq(aiSpecializedGenerationRecords.userId, userId),
          gt(
            aiSpecializedGenerationRecords.generatedAt,
            start.toISOString(),
          ),
        ),
      ),
  ]);
  return Number(questionCount?.count ?? 0) +
    Number(specializedCount?.count ?? 0);
}

function toPublicRecord(
  row: typeof aiSpecializedGenerationRecords.$inferSelect,
) {
  return {
    recordId: row.id,
    targetType: row.targetType,
    reviewStatus: row.reviewStatus,
    provider: row.provider,
    model: row.model,
    generatedAt: row.generatedAt,
    sourceContextIds: parseJson<string[]>(row.sourceContextIdsJson, []),
    disclaimer: row.disclaimer,
    reviewed: row.reviewStatus !== "PENDING",
    requestId: row.requestId,
    latencyMs: row.latencyMs,
    status: row.generationStatus,
    content: parseJson<SpecializedAIResult>(
      row.originalResultJson,
      {} as SpecializedAIResult,
    ),
    usage: {
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      estimatedCostMicros: row.estimatedCostMicros,
    },
    ...(row.errorCode ? { errorCode: row.errorCode } : {}),
  };
}

function toEvidence(contexts: RetrievalContext[]): AIEvidence[] {
  return contexts.map((context) => ({
    id: context.id,
    title: context.title,
    kind: context.kind,
  }));
}

function deduplicateContexts(contexts: RetrievalContext[]) {
  return [...new Map(contexts.map((context) => [context.id, context])).values()];
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function batchItems(items: BatchItem<"sqlite">[]) {
  return items as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];
}

async function createFingerprint(parts: string[]) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(parts.join("|")),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
