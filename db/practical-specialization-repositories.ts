import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { z } from "zod";
import { getDb } from ".";
import {
  codeAnalysisAnswers,
  contentCourseLinks,
  learningActivities,
  privacyAssessmentAnswers,
  privacyAssessmentScenarios,
  privacyFlowEdges,
  privacyFlowNodes,
  privacyImpactAssessmentItems,
  questionAttempts,
  questions,
  secureCodeGradingRules,
  secureCodeSamples,
  secureCodingWeaknesses,
  userCourseEnrollments,
  wrongNotes,
} from "./schema";
import { AppError } from "@/lib/errors";
import type { Cs1aPolicyRequest } from "@/lib/policy/cs1a-contract";
import { assertCs1aMutationAllowed } from "@/lib/policy/cs1a-mutation-gate";
import {
  gradeCodeAnalysis,
  gradePrivacyAssessment,
  type PrivacyAssessmentRule,
} from "@/lib/services/practical-specialization-service";
import type {
  codeAnalysisSubmissionSchema,
  practicalSpecializedAdminSchema,
  privacyAssessmentAnswerSchema,
} from "@/lib/validation";
import { createAuditInsert } from "./audit-repositories";

type CodeSubmission = z.infer<typeof codeAnalysisSubmissionSchema>;
type PrivacySubmission = z.infer<typeof privacyAssessmentAnswerSchema>;
type AdminInput = z.infer<typeof practicalSpecializedAdminSchema>;

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function batchItems(items: BatchItem<"sqlite">[]) {
  return items as unknown as Parameters<ReturnType<typeof getDb>["batch"]>[0];
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
      "수강 중인 과정의 실무 콘텐츠만 이용할 수 있습니다.",
      403,
      "PRACTICAL_ENROLLMENT_REQUIRED",
    );
  }
  return enrollment;
}

async function requireContentLink(
  courseId: string,
  contentType: "SECURE_CODE_SAMPLE" | "PRIVACY_SCENARIO",
  contentId: string,
) {
  const [link] = await getDb()
    .select({ id: contentCourseLinks.id })
    .from(contentCourseLinks)
    .where(
      and(
        eq(contentCourseLinks.courseId, courseId),
        eq(contentCourseLinks.contentType, contentType),
        eq(contentCourseLinks.contentId, contentId),
      ),
    )
    .limit(1);
  if (!link) {
    throw new AppError(
      "과정에 연결된 실무 콘텐츠를 찾을 수 없습니다.",
      404,
      "PRACTICAL_CONTENT_NOT_FOUND",
    );
  }
}

export async function getPracticalOverview(userId: string, courseId: string) {
  await requireEnrollment(userId, courseId);
  const links = await getDb()
    .select({
      contentType: contentCourseLinks.contentType,
      contentId: contentCourseLinks.contentId,
      displayOrder: contentCourseLinks.displayOrder,
    })
    .from(contentCourseLinks)
    .where(eq(contentCourseLinks.courseId, courseId))
    .orderBy(asc(contentCourseLinks.displayOrder));
  const codeIds = links
    .filter((link) => link.contentType === "SECURE_CODE_SAMPLE")
    .map((link) => link.contentId);
  const scenarioIds = links
    .filter((link) => link.contentType === "PRIVACY_SCENARIO")
    .map((link) => link.contentId);
  const [codeSamples, privacyScenarios] = await Promise.all([
    codeIds.length
      ? getDb()
          .select({
            id: secureCodeSamples.id,
            title: secureCodeSamples.title,
            language: secureCodeSamples.language,
            sourceDate: secureCodeSamples.sourceDate,
            sampleOnly: secureCodeSamples.sampleOnly,
            weaknessCode: secureCodingWeaknesses.code,
            weaknessName: secureCodingWeaknesses.name,
            cweCode: secureCodingWeaknesses.cweCode,
            risk: secureCodingWeaknesses.risk,
          })
          .from(secureCodeSamples)
          .innerJoin(
            secureCodingWeaknesses,
            eq(secureCodeSamples.weaknessId, secureCodingWeaknesses.id),
          )
          .where(
            and(
              inArray(secureCodeSamples.id, codeIds),
              eq(secureCodeSamples.active, true),
              eq(secureCodingWeaknesses.active, true),
            ),
          )
          .orderBy(asc(secureCodeSamples.language), asc(secureCodeSamples.title))
      : [],
    scenarioIds.length
      ? getDb()
          .select({
            id: privacyAssessmentScenarios.id,
            title: privacyAssessmentScenarios.title,
            description: privacyAssessmentScenarios.description,
            organizationType: privacyAssessmentScenarios.organizationType,
            systemType: privacyAssessmentScenarios.systemType,
            track: privacyAssessmentScenarios.track,
            sampleOnly: privacyAssessmentScenarios.sampleOnly,
          })
          .from(privacyAssessmentScenarios)
          .where(
            and(
              inArray(privacyAssessmentScenarios.id, scenarioIds),
              eq(privacyAssessmentScenarios.active, true),
            ),
          )
          .orderBy(
            asc(privacyAssessmentScenarios.track),
            asc(privacyAssessmentScenarios.title),
          )
      : [],
  ]);
  return { codeSamples, privacyScenarios };
}

export async function getCodeSampleForUser(
  userId: string,
  courseId: string,
  sampleId: string,
) {
  await requireEnrollment(userId, courseId);
  await requireContentLink(courseId, "SECURE_CODE_SAMPLE", sampleId);
  const [sample] = await getDb()
    .select({
      id: secureCodeSamples.id,
      title: secureCodeSamples.title,
      language: secureCodeSamples.language,
      vulnerableCode: secureCodeSamples.vulnerableCode,
      explanation: secureCodeSamples.explanation,
      falsePositivePossible: secureCodeSamples.falsePositivePossible,
      callRelation: secureCodeSamples.callRelation,
      executionFlow: secureCodeSamples.executionFlow,
      sourceDate: secureCodeSamples.sourceDate,
      sampleOnly: secureCodeSamples.sampleOnly,
      weaknessId: secureCodingWeaknesses.id,
      weaknessName: secureCodingWeaknesses.name,
      weaknessCode: secureCodingWeaknesses.code,
      cweCode: secureCodingWeaknesses.cweCode,
      risk: secureCodingWeaknesses.risk,
    })
    .from(secureCodeSamples)
    .innerJoin(
      secureCodingWeaknesses,
      eq(secureCodeSamples.weaknessId, secureCodingWeaknesses.id),
    )
    .where(
      and(
        eq(secureCodeSamples.id, sampleId),
        eq(secureCodeSamples.active, true),
        eq(secureCodingWeaknesses.active, true),
      ),
    )
    .limit(1);
  if (!sample) {
    throw new AppError(
      "공개된 코드 분석 샘플을 찾을 수 없습니다.",
      404,
      "CODE_SAMPLE_NOT_FOUND",
    );
  }
  const weaknesses = await getDb()
    .select({
      id: secureCodingWeaknesses.id,
      code: secureCodingWeaknesses.code,
      name: secureCodingWeaknesses.name,
      cweCode: secureCodingWeaknesses.cweCode,
      language: secureCodingWeaknesses.language,
    })
    .from(secureCodingWeaknesses)
    .where(eq(secureCodingWeaknesses.active, true))
    .orderBy(asc(secureCodingWeaknesses.code));
  return { sample, weaknesses };
}

export async function submitCodeAnalysis(
  userId: string,
  input: CodeSubmission,
) {
  await requireEnrollment(userId, input.courseId);
  await requireContentLink(input.courseId, "SECURE_CODE_SAMPLE", input.sampleId);
  const [existing] = await getDb()
    .select({
      attemptId: questionAttempts.id,
      score: codeAnalysisAnswers.score,
      isCorrect: codeAnalysisAnswers.isCorrect,
      matchedCriteriaJson: codeAnalysisAnswers.matchedCriteriaJson,
    })
    .from(questionAttempts)
    .innerJoin(
      codeAnalysisAnswers,
      eq(questionAttempts.id, codeAnalysisAnswers.attemptId),
    )
    .where(
      and(
        eq(questionAttempts.userId, userId),
        eq(questionAttempts.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      attemptId: existing.attemptId,
      score: existing.score,
      isCorrect: existing.isCorrect,
      matchedCriteria: parseJson<string[]>(existing.matchedCriteriaJson, []),
      idempotentReplay: true,
    };
  }
  const [row] = await getDb()
    .select({
      questionId: secureCodeSamples.questionId,
      expectedLinesJson: secureCodeSamples.vulnerableLinesJson,
      expectedTruePositive: secureCodeSamples.expectedTruePositive,
      remediationKeywordsJson: secureCodeSamples.remediationKeywordsJson,
      secureCode: secureCodeSamples.secureCode,
      explanation: secureCodeSamples.explanation,
      weaknessId: secureCodingWeaknesses.id,
      weaknessName: secureCodingWeaknesses.name,
      cweCode: secureCodingWeaknesses.cweCode,
      remediationGuide: secureCodingWeaknesses.remediationGuide,
      lineScore: secureCodeGradingRules.lineScore,
      weaknessScore: secureCodeGradingRules.weaknessScore,
      cweScore: secureCodeGradingRules.cweScore,
      judgmentScore: secureCodeGradingRules.judgmentScore,
      keywordScore: secureCodeGradingRules.keywordScore,
      remediationCodeScore: secureCodeGradingRules.remediationCodeScore,
      maximumScore: secureCodeGradingRules.maximumScore,
    })
    .from(secureCodeSamples)
    .innerJoin(
      secureCodingWeaknesses,
      eq(secureCodeSamples.weaknessId, secureCodingWeaknesses.id),
    )
    .innerJoin(
      secureCodeGradingRules,
      eq(secureCodeSamples.id, secureCodeGradingRules.sampleId),
    )
    .where(
      and(
        eq(secureCodeSamples.id, input.sampleId),
        eq(secureCodeSamples.active, true),
      ),
    )
    .limit(1);
  if (!row?.questionId) {
    throw new AppError(
      "코드 분석 문제와 채점 규칙이 준비되지 않았습니다.",
      409,
      "CODE_GRADING_RULE_NOT_READY",
    );
  }
  const [question] = await getDb()
    .select({ status: questions.status })
    .from(questions)
    .where(eq(questions.id, row.questionId))
    .limit(1);
  if (question?.status !== "PUBLISHED") {
    throw new AppError(
      "게시되지 않은 코드 분석 문제입니다.",
      404,
      "CODE_QUESTION_NOT_PUBLISHED",
    );
  }
  const grade = gradeCodeAnalysis(input, {
    expectedLines: parseJson<number[]>(row.expectedLinesJson, []),
    weaknessId: row.weaknessId,
    cweCode: row.cweCode,
    expectedTruePositive: row.expectedTruePositive,
    remediationKeywords: parseJson<string[]>(
      row.remediationKeywordsJson,
      [],
    ),
    lineScore: row.lineScore,
    weaknessScore: row.weaknessScore,
    cweScore: row.cweScore,
    judgmentScore: row.judgmentScore,
    keywordScore: row.keywordScore,
    remediationCodeScore: row.remediationCodeScore,
    maximumScore: row.maximumScore,
  });
  const attemptId = crypto.randomUUID();
  const answerId = crypto.randomUUID();
  const normalizedAttemptScore = Math.round(
    (grade.score / grade.maximumScore) * 100,
  );
  const operations: BatchItem<"sqlite">[] = [
    getDb().insert(questionAttempts).values({
      id: attemptId,
      idempotencyKey: input.idempotencyKey,
      userId,
      questionId: row.questionId,
      courseId: input.courseId,
      selectedAnswer: JSON.stringify({
        selectedLines: grade.selectedLines,
        weaknessId: input.weaknessId,
        selectedCweCode: input.selectedCweCode,
        truePositive: input.truePositive,
      }),
      isCorrect: grade.isCorrect,
      score: normalizedAttemptScore,
      responseTime: input.responseTime,
    }),
    getDb().insert(codeAnalysisAnswers).values({
      id: answerId,
      attemptId,
      sampleId: input.sampleId,
      selectedLinesJson: JSON.stringify(grade.selectedLines),
      weaknessId: input.weaknessId,
      selectedCweCode: input.selectedCweCode,
      truePositive: input.truePositive,
      userExplanation: input.userExplanation,
      remediationCode: input.remediationCode,
      matchedCriteriaJson: JSON.stringify(grade.matchedCriteria),
      isCorrect: grade.isCorrect,
      score: grade.score,
    }),
    getDb().insert(learningActivities).values({
      id: `code-analysis:${attemptId}`,
      userId,
      courseId: input.courseId,
      activityType: "QUESTION_ATTEMPT",
      targetId: row.questionId,
      metadataJson: JSON.stringify({
        attemptId,
        specializedType: "CODE_ANALYSIS",
        score: normalizedAttemptScore,
      }),
    }),
  ];
  if (!grade.isCorrect) {
    operations.push(
      getDb()
        .insert(wrongNotes)
        .values({
          id: crypto.randomUUID(),
          userId,
          questionId: row.questionId,
          courseId: input.courseId,
          lastAttemptId: attemptId,
          wrongCount: 1,
          mastered: false,
        })
        .onConflictDoUpdate({
          target: [wrongNotes.userId, wrongNotes.questionId, wrongNotes.courseId],
          set: {
            lastAttemptId: attemptId,
            wrongCount: sql`${wrongNotes.wrongCount} + 1`,
            mastered: false,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        }),
    );
  }
  await getDb().batch(batchItems(operations));
  return {
    attemptId,
    idempotentReplay: false,
    ...grade,
    secureCode: row.secureCode,
    explanation: row.explanation,
    weaknessName: row.weaknessName,
    cweCode: row.cweCode,
    remediationGuide: row.remediationGuide,
  };
}

export async function getPrivacyScenarioForUser(
  userId: string,
  courseId: string,
  scenarioId: string,
) {
  await requireEnrollment(userId, courseId);
  await requireContentLink(courseId, "PRIVACY_SCENARIO", scenarioId);
  const [scenario] = await getDb()
    .select({
      id: privacyAssessmentScenarios.id,
      title: privacyAssessmentScenarios.title,
      description: privacyAssessmentScenarios.description,
      organizationType: privacyAssessmentScenarios.organizationType,
      systemType: privacyAssessmentScenarios.systemType,
      processedData: privacyAssessmentScenarios.processedData,
      dataSubjects: privacyAssessmentScenarios.dataSubjects,
      processingPurpose: privacyAssessmentScenarios.processingPurpose,
      track: privacyAssessmentScenarios.track,
      sampleOnly: privacyAssessmentScenarios.sampleOnly,
    })
    .from(privacyAssessmentScenarios)
    .where(
      and(
        eq(privacyAssessmentScenarios.id, scenarioId),
        eq(privacyAssessmentScenarios.courseId, courseId),
        eq(privacyAssessmentScenarios.active, true),
      ),
    )
    .limit(1);
  if (!scenario) {
    throw new AppError(
      "공개된 영향평가 시나리오를 찾을 수 없습니다.",
      404,
      "PRIVACY_SCENARIO_NOT_FOUND",
    );
  }
  const [nodes, edges, items, previousAnswer] = await Promise.all([
    getDb()
      .select()
      .from(privacyFlowNodes)
      .where(eq(privacyFlowNodes.scenarioId, scenarioId))
      .orderBy(asc(privacyFlowNodes.displayOrder)),
    getDb()
      .select()
      .from(privacyFlowEdges)
      .where(eq(privacyFlowEdges.scenarioId, scenarioId))
      .orderBy(asc(privacyFlowEdges.createdAt)),
    getDb()
      .select()
      .from(privacyImpactAssessmentItems)
      .where(eq(privacyImpactAssessmentItems.active, true))
      .orderBy(
        asc(privacyImpactAssessmentItems.category),
        asc(privacyImpactAssessmentItems.code),
      ),
    getDb()
      .select({
        id: privacyAssessmentAnswers.id,
        targetDecision: privacyAssessmentAnswers.targetDecision,
        selectedAssessmentItemsJson:
          privacyAssessmentAnswers.selectedAssessmentItemsJson,
        identifiedRisks: privacyAssessmentAnswers.identifiedRisks,
        improvementPlan: privacyAssessmentAnswers.improvementPlan,
        score: privacyAssessmentAnswers.score,
        updatedAt: privacyAssessmentAnswers.updatedAt,
      })
      .from(privacyAssessmentAnswers)
      .where(
        and(
          eq(privacyAssessmentAnswers.userId, userId),
          eq(privacyAssessmentAnswers.scenarioId, scenarioId),
        ),
      )
      .limit(1),
  ]);
  return {
    scenario,
    nodes,
    edges,
    items,
    previousAnswer: previousAnswer[0]
      ? {
          ...previousAnswer[0],
          selectedAssessmentItems: parseJson<string[]>(
            previousAnswer[0].selectedAssessmentItemsJson,
            [],
          ),
        }
      : null,
  };
}

export async function savePrivacyAssessmentAnswer(
  userId: string,
  input: PrivacySubmission,
) {
  const [scenario] = await getDb()
    .select({
      courseId: privacyAssessmentScenarios.courseId,
      correctTargetDecision: privacyAssessmentScenarios.correctTargetDecision,
      expectedAssessmentItemsJson:
        privacyAssessmentScenarios.expectedAssessmentItemsJson,
      scoringRulesJson: privacyAssessmentScenarios.scoringRulesJson,
      modelImprovementPlan: privacyAssessmentScenarios.modelImprovementPlan,
    })
    .from(privacyAssessmentScenarios)
    .where(
      and(
        eq(privacyAssessmentScenarios.id, input.scenarioId),
        eq(privacyAssessmentScenarios.active, true),
      ),
    )
    .limit(1);
  if (!scenario) {
    throw new AppError(
      "영향평가 시나리오를 찾을 수 없습니다.",
      404,
      "PRIVACY_SCENARIO_NOT_FOUND",
    );
  }
  await requireEnrollment(userId, scenario.courseId);
  await requireContentLink(
    scenario.courseId,
    "PRIVACY_SCENARIO",
    input.scenarioId,
  );
  const selectedItems = [...new Set(input.selectedAssessmentItems)];
  if (selectedItems.length) {
    const existingItems = await getDb()
      .select({ id: privacyImpactAssessmentItems.id })
      .from(privacyImpactAssessmentItems)
      .where(
        and(
          inArray(privacyImpactAssessmentItems.id, selectedItems),
          eq(privacyImpactAssessmentItems.active, true),
        ),
      );
    if (existingItems.length !== selectedItems.length) {
      throw new AppError(
        "선택한 평가항목 중 사용할 수 없는 항목이 있습니다.",
        400,
        "PRIVACY_ITEM_INVALID",
      );
    }
  }
  const configuration = parseJson<
    Omit<
      PrivacyAssessmentRule,
      "correctTargetDecision" | "expectedAssessmentItems"
    >
  >(scenario.scoringRulesJson, {
    riskKeywords: [],
    improvementKeywords: [],
  });
  const grade = gradePrivacyAssessment(
    { ...input, selectedAssessmentItems: selectedItems },
    {
      ...configuration,
      correctTargetDecision:
        scenario.correctTargetDecision as PrivacyAssessmentRule["correctTargetDecision"],
      expectedAssessmentItems: parseJson<string[]>(
        scenario.expectedAssessmentItemsJson,
        [],
      ),
    },
  );
  const id = crypto.randomUUID();
  await getDb().batch(
    batchItems([
      getDb()
        .insert(privacyAssessmentAnswers)
        .values({
          id,
          userId,
          scenarioId: input.scenarioId,
          targetDecision: input.targetDecision,
          selectedAssessmentItemsJson: JSON.stringify(selectedItems),
          identifiedRisks: input.identifiedRisks,
          improvementPlan: input.improvementPlan,
          score: grade.score,
          feedbackJson: JSON.stringify(grade),
        })
        .onConflictDoUpdate({
          target: [
            privacyAssessmentAnswers.userId,
            privacyAssessmentAnswers.scenarioId,
          ],
          set: {
            targetDecision: input.targetDecision,
            selectedAssessmentItemsJson: JSON.stringify(selectedItems),
            identifiedRisks: input.identifiedRisks,
            improvementPlan: input.improvementPlan,
            score: grade.score,
            feedbackJson: JSON.stringify(grade),
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        }),
      getDb()
        .insert(learningActivities)
        .values({
          id: `privacy-assessment:${userId}:${input.scenarioId}`,
          userId,
          courseId: scenario.courseId,
          activityType: "CONTENT_STUDY",
          targetId: input.scenarioId,
          metadataJson: JSON.stringify({
            specializedType: "PRIVACY_ASSESSMENT",
            score: grade.score,
          }),
        })
        .onConflictDoUpdate({
          target: learningActivities.id,
          set: {
            metadataJson: JSON.stringify({
              specializedType: "PRIVACY_ASSESSMENT",
              score: grade.score,
            }),
            createdAt: sql`CURRENT_TIMESTAMP`,
          },
        }),
    ]),
  );
  const [savedAnswer] = await getDb()
    .select({ id: privacyAssessmentAnswers.id })
    .from(privacyAssessmentAnswers)
    .where(
      and(
        eq(privacyAssessmentAnswers.userId, userId),
        eq(privacyAssessmentAnswers.scenarioId, input.scenarioId),
      ),
    )
    .limit(1);
  return {
    answerId: savedAnswer?.id ?? id,
    ...grade,
    modelImprovementPlan: scenario.modelImprovementPlan,
  };
}

export async function getPrivacyAssessmentAnswer(
  userId: string,
  answerId: string,
) {
  const [answer] = await getDb()
    .select()
    .from(privacyAssessmentAnswers)
    .where(
      and(
        eq(privacyAssessmentAnswers.id, answerId),
        eq(privacyAssessmentAnswers.userId, userId),
      ),
    )
    .limit(1);
  if (!answer) {
    throw new AppError(
      "본인의 영향평가 답안만 조회할 수 있습니다.",
      404,
      "PRIVACY_ANSWER_NOT_FOUND",
    );
  }
  return answer;
}

export async function getAdminPracticalData() {
  const [weaknesses, samples, rules, items, scenarios, nodes, edges] =
    await Promise.all([
      getDb()
        .select()
        .from(secureCodingWeaknesses)
        .orderBy(asc(secureCodingWeaknesses.code)),
      getDb()
        .select()
        .from(secureCodeSamples)
        .orderBy(asc(secureCodeSamples.language), asc(secureCodeSamples.title)),
      getDb().select().from(secureCodeGradingRules),
      getDb()
        .select()
        .from(privacyImpactAssessmentItems)
        .orderBy(asc(privacyImpactAssessmentItems.code)),
      getDb()
        .select()
        .from(privacyAssessmentScenarios)
        .orderBy(desc(privacyAssessmentScenarios.createdAt)),
      getDb()
        .select()
        .from(privacyFlowNodes)
        .orderBy(
          asc(privacyFlowNodes.scenarioId),
          asc(privacyFlowNodes.displayOrder),
        ),
      getDb()
        .select()
        .from(privacyFlowEdges)
        .orderBy(asc(privacyFlowEdges.scenarioId)),
    ]);
  return { weaknesses, samples, rules, items, scenarios, nodes, edges };
}

export async function savePracticalSpecializedContent(
  actorUserId: string,
  input: AdminInput,
  policy?: Cs1aPolicyRequest,
) {
  assertCs1aMutationAllowed(policy, "DRAFT_MUTATION");
  const id = "id" in input && input.id ? input.id : crypto.randomUUID();
  let courseId: string | null = null;
  switch (input.entity) {
    case "SECURE_WEAKNESS": {
      const values = {
        code: input.code,
        name: input.name,
        category: input.category,
        description: input.description,
        language: input.language,
        cweCode: input.cweCode,
        risk: input.risk,
        detectionGuide: input.detectionGuide,
        remediationGuide: input.remediationGuide,
        reference: input.reference,
        version: input.version,
        active: input.active,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      await (input.id
        ? getDb()
            .update(secureCodingWeaknesses)
            .set(values)
            .where(eq(secureCodingWeaknesses.id, id))
        : getDb().insert(secureCodingWeaknesses).values({ id, ...values }));
      break;
    }
    case "SECURE_CODE_SAMPLE": {
      courseId = input.courseId;
      const values = {
        weaknessId: input.weaknessId,
        questionId: input.questionId || null,
        language: input.language,
        title: input.title,
        vulnerableCode: input.vulnerableCode,
        secureCode: input.secureCode,
        vulnerableLinesJson: JSON.stringify([...new Set(input.vulnerableLines)]),
        explanation: input.explanation,
        falsePositivePossible: input.falsePositivePossible,
        expectedTruePositive: input.expectedTruePositive,
        callRelation: input.callRelation,
        executionFlow: input.executionFlow,
        remediationKeywordsJson: JSON.stringify(input.remediationKeywords),
        sourceDate: input.sourceDate,
        active: input.active,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      await (input.id
        ? getDb()
            .update(secureCodeSamples)
            .set(values)
            .where(eq(secureCodeSamples.id, id))
        : getDb().insert(secureCodeSamples).values({ id, ...values }));
      await getDb()
        .insert(contentCourseLinks)
        .values({
          id: crypto.randomUUID(),
          contentType: "SECURE_CODE_SAMPLE",
          contentId: id,
          courseId: input.courseId,
          relationType: "PRACTICE",
        })
        .onConflictDoNothing();
      break;
    }
    case "SECURE_CODE_RULE": {
      const values = {
        sampleId: input.sampleId,
        lineScore: input.lineScore,
        weaknessScore: input.weaknessScore,
        cweScore: input.cweScore,
        judgmentScore: input.judgmentScore,
        keywordScore: input.keywordScore,
        remediationCodeScore: input.remediationCodeScore,
        maximumScore: input.maximumScore,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      await getDb()
        .insert(secureCodeGradingRules)
        .values({ id, ...values })
        .onConflictDoUpdate({
          target: secureCodeGradingRules.sampleId,
          set: values,
        });
      break;
    }
    case "PRIVACY_ITEM": {
      const values = {
        code: input.code,
        category: input.category,
        title: input.title,
        description: input.description,
        checkPoints: input.checkPoints,
        evidenceExamples: input.evidenceExamples,
        riskExamples: input.riskExamples,
        improvementExamples: input.improvementExamples,
        version: input.version,
        effectiveDate: input.effectiveDate,
        active: input.active,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      await (input.id
        ? getDb()
            .update(privacyImpactAssessmentItems)
            .set(values)
            .where(eq(privacyImpactAssessmentItems.id, id))
        : getDb().insert(privacyImpactAssessmentItems).values({ id, ...values }));
      break;
    }
    case "PRIVACY_SCENARIO": {
      courseId = input.courseId;
      const values = {
        courseId: input.courseId,
        title: input.title,
        description: input.description,
        organizationType: input.organizationType,
        systemType: input.systemType,
        processedData: input.processedData,
        dataSubjects: input.dataSubjects,
        processingPurpose: input.processingPurpose,
        track: input.track,
        correctTargetDecision: input.correctTargetDecision,
        expectedAssessmentItemsJson: JSON.stringify(
          input.expectedAssessmentItems,
        ),
        modelImprovementPlan: input.modelImprovementPlan,
        scoringRulesJson: JSON.stringify({
          riskKeywords: input.riskKeywords,
          improvementKeywords: input.improvementKeywords,
        }),
        active: input.active,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      await (input.id
        ? getDb()
            .update(privacyAssessmentScenarios)
            .set(values)
            .where(eq(privacyAssessmentScenarios.id, id))
        : getDb().insert(privacyAssessmentScenarios).values({ id, ...values }));
      await getDb()
        .insert(contentCourseLinks)
        .values({
          id: crypto.randomUUID(),
          contentType: "PRIVACY_SCENARIO",
          contentId: id,
          courseId: input.courseId,
          relationType: "PRACTICE",
        })
        .onConflictDoNothing();
      break;
    }
    case "PRIVACY_NODE": {
      const values = {
        scenarioId: input.scenarioId,
        nodeType: input.nodeType,
        title: input.title,
        description: input.description,
        systemName: input.systemName,
        organizationName: input.organizationName,
        displayX: input.displayX,
        displayY: input.displayY,
        displayOrder: input.displayOrder,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      await (input.id
        ? getDb()
            .update(privacyFlowNodes)
            .set(values)
            .where(eq(privacyFlowNodes.id, id))
        : getDb().insert(privacyFlowNodes).values({ id, ...values }));
      break;
    }
    case "PRIVACY_EDGE": {
      const values = {
        scenarioId: input.scenarioId,
        sourceNodeId: input.sourceNodeId,
        targetNodeId: input.targetNodeId,
        dataTypes: input.dataTypes,
        transferMethod: input.transferMethod,
        purpose: input.purpose,
        protectionMeasures: input.protectionMeasures,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      await (input.id
        ? getDb()
            .update(privacyFlowEdges)
            .set(values)
            .where(eq(privacyFlowEdges.id, id))
        : getDb().insert(privacyFlowEdges).values({ id, ...values }));
      break;
    }
  }
  await createAuditInsert({
    actorUserId,
    action: `PRACTICAL_${input.entity}_SAVED`,
    resourceType: input.entity,
    resourceId: id,
    courseId,
  });
  return id;
}
