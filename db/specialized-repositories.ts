import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from ".";
import {
  contentBookmarks,
  contentCourseLinks,
  contentQuestionLinks,
  courseSpecializations,
  courses,
  ismsDefectCases,
  ismsStandards,
  legalArticles,
  legalArticleVersions,
  questionCourses,
  questions,
  riskCalculationMethods,
  riskGradeCriteria,
  riskRegisterItems,
  riskScenarios,
  userCourseEnrollments,
  writtenAnswerRules,
} from "./schema";
import { AppError } from "@/lib/errors";
import type { Cs1aPolicyRequest } from "@/lib/policy/cs1a-contract";
import { assertCs1aMutationAllowed } from "@/lib/policy/cs1a-mutation-gate";
import {
  calculateRisk,
  gradeWrittenAnswer,
  type RiskCalculationConfiguration,
  type WrittenAnswerRuleInput,
} from "@/lib/services/specialized-learning-service";
import type { z } from "zod";
import type {
  riskRegisterSchema,
  specializedAdminSchema,
} from "@/lib/validation";

type SpecializedAdminInput = z.infer<typeof specializedAdminSchema>;
type RiskRegisterInput = z.infer<typeof riskRegisterSchema>;

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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
      "수강 중인 과정의 특화 콘텐츠만 이용할 수 있습니다.",
      403,
      "SPECIALIZED_CONTENT_FORBIDDEN",
    );
  }
}

export async function listCourseSpecializations(courseId: string) {
  return getDb()
    .select()
    .from(courseSpecializations)
    .where(
      and(
        eq(courseSpecializations.courseId, courseId),
        eq(courseSpecializations.active, true),
      ),
    )
    .orderBy(asc(courseSpecializations.displayOrder));
}

export async function getSpecializedOverview(
  userId: string,
  courseId: string,
) {
  await requireEnrollment(userId, courseId);
  const [features, links] = await Promise.all([
    listCourseSpecializations(courseId),
    getDb()
      .select({
        contentType: contentCourseLinks.contentType,
        contentId: contentCourseLinks.contentId,
        relationType: contentCourseLinks.relationType,
        displayOrder: contentCourseLinks.displayOrder,
      })
      .from(contentCourseLinks)
      .where(eq(contentCourseLinks.courseId, courseId))
      .orderBy(asc(contentCourseLinks.displayOrder)),
  ]);
  const standards = links.filter(
    (link) => link.contentType === "ISMS_STANDARD",
  );
  const defects = links.filter(
    (link) => link.contentType === "ISMS_DEFECT_CASE",
  );
  const laws = links.filter((link) => link.contentType === "LEGAL_ARTICLE");
  const risks = links.filter((link) => link.contentType === "RISK_SCENARIO");
  const [standardRows, defectRows, legalRows, riskRows, writtenRows] =
    await Promise.all([
      standards.length
        ? getDb()
            .select()
            .from(ismsStandards)
            .where(
              and(
                inArray(
                  ismsStandards.id,
                  standards.map((item) => item.contentId),
                ),
                eq(ismsStandards.active, true),
              ),
            )
            .orderBy(asc(ismsStandards.code))
        : [],
      defects.length
        ? getDb()
            .select()
            .from(ismsDefectCases)
            .where(
              inArray(
                ismsDefectCases.id,
                defects.map((item) => item.contentId),
              ),
            )
            .orderBy(desc(ismsDefectCases.sourceDate))
        : [],
      laws.length
        ? getDb()
            .select()
            .from(legalArticles)
            .where(
              and(
                inArray(
                  legalArticles.id,
                  laws.map((item) => item.contentId),
                ),
                eq(legalArticles.active, true),
              ),
            )
            .orderBy(
              asc(legalArticles.lawName),
              asc(legalArticles.articleNumber),
            )
        : [],
      risks.length
        ? getDb()
            .select()
            .from(riskScenarios)
            .where(
              inArray(
                riskScenarios.id,
                risks.map((item) => item.contentId),
              ),
            )
            .orderBy(desc(riskScenarios.riskValue))
        : [],
      getDb()
        .select({
          questionId: questions.id,
          title: questions.title,
          type: questions.type,
          difficulty: questions.difficulty,
          maximumScore: writtenAnswerRules.maximumScore,
          referenceDate: writtenAnswerRules.referenceDate,
        })
        .from(writtenAnswerRules)
        .innerJoin(questions, eq(writtenAnswerRules.questionId, questions.id))
        .innerJoin(
          questionCourses,
          eq(writtenAnswerRules.questionId, questionCourses.questionId),
        )
        .where(
          and(
            eq(questionCourses.courseId, courseId),
            eq(questions.status, "PUBLISHED"),
          ),
        )
        .orderBy(asc(questions.title)),
    ]);
  return {
    features,
    standards: standardRows,
    defectCases: defectRows,
    legalArticles: legalRows,
    riskScenarios: riskRows,
    writtenQuestions: writtenRows,
  };
}

export async function getSpecializedContent(
  userId: string,
  courseId: string,
  contentType: string,
  contentId: string,
) {
  await requireEnrollment(userId, courseId);
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
      "과정에 연결된 특화 콘텐츠를 찾을 수 없습니다.",
      404,
      "SPECIALIZED_CONTENT_NOT_FOUND",
    );
  }
  let content: Record<string, unknown> | null = null;
  let versions: Array<Record<string, unknown>> = [];
  let cases: Array<Record<string, unknown>> = [];
  if (contentType === "ISMS_STANDARD") {
    const [row] = await getDb()
      .select()
      .from(ismsStandards)
      .where(
        and(eq(ismsStandards.id, contentId), eq(ismsStandards.active, true)),
      )
      .limit(1);
    content = row ?? null;
    cases = await getDb()
      .select()
      .from(ismsDefectCases)
      .where(eq(ismsDefectCases.relatedStandardId, contentId))
      .orderBy(desc(ismsDefectCases.sourceDate));
  } else if (contentType === "ISMS_DEFECT_CASE") {
    const [row] = await getDb()
      .select()
      .from(ismsDefectCases)
      .where(eq(ismsDefectCases.id, contentId))
      .limit(1);
    content = row ?? null;
  } else if (contentType === "LEGAL_ARTICLE") {
    const [row] = await getDb()
      .select()
      .from(legalArticles)
      .where(
        and(eq(legalArticles.id, contentId), eq(legalArticles.active, true)),
      )
      .limit(1);
    content = row ?? null;
    versions = await getDb()
      .select()
      .from(legalArticleVersions)
      .where(eq(legalArticleVersions.legalArticleId, contentId))
      .orderBy(desc(legalArticleVersions.effectiveDate));
  } else if (contentType === "RISK_SCENARIO") {
    const [row] = await getDb()
      .select()
      .from(riskScenarios)
      .where(eq(riskScenarios.id, contentId))
      .limit(1);
    content = row ?? null;
  }
  if (!content) {
    throw new AppError(
      "특화 콘텐츠를 찾을 수 없습니다.",
      404,
      "SPECIALIZED_CONTENT_NOT_FOUND",
    );
  }
  const [relatedCourses, relatedLegalArticles, relatedQuestions, bookmark] =
    await Promise.all([
    getDb()
      .select({
        id: courses.id,
        slug: courses.slug,
        name: courses.shortName,
      })
      .from(contentCourseLinks)
      .innerJoin(courses, eq(contentCourseLinks.courseId, courses.id))
      .where(
        and(
          eq(contentCourseLinks.contentType, contentType),
          eq(contentCourseLinks.contentId, contentId),
        ),
      ),
    contentType === "LEGAL_ARTICLE"
      ? []
      : getDb()
          .select({
            id: legalArticles.id,
            lawName: legalArticles.lawName,
            articleNumber: legalArticles.articleNumber,
            articleTitle: legalArticles.articleTitle,
            effectiveDate: legalArticles.effectiveDate,
          })
          .from(contentCourseLinks)
          .innerJoin(
            legalArticles,
            eq(contentCourseLinks.contentId, legalArticles.id),
          )
          .where(
            and(
              eq(contentCourseLinks.courseId, courseId),
              eq(contentCourseLinks.contentType, "LEGAL_ARTICLE"),
              eq(legalArticles.active, true),
            ),
          )
          .limit(10),
    getDb()
      .select({
        id: questions.id,
        title: questions.title,
        type: questions.type,
        difficulty: questions.difficulty,
      })
      .from(contentQuestionLinks)
      .innerJoin(questions, eq(contentQuestionLinks.questionId, questions.id))
      .where(
        and(
          eq(contentQuestionLinks.contentType, contentType),
          eq(contentQuestionLinks.contentId, contentId),
          eq(questions.status, "PUBLISHED"),
        ),
      ),
    getDb()
      .select({ id: contentBookmarks.id })
      .from(contentBookmarks)
      .where(
        and(
          eq(contentBookmarks.userId, userId),
          eq(contentBookmarks.courseId, courseId),
          eq(contentBookmarks.contentType, contentType),
          eq(contentBookmarks.contentId, contentId),
        ),
      )
      .limit(1),
  ]);
  return {
    content,
    versions,
    cases,
    relatedCourses,
    relatedQuestions,
    relatedLegalArticles,
    bookmarked: Boolean(bookmark[0]),
  };
}

export async function toggleContentBookmark(input: {
  userId: string;
  courseId: string;
  contentType: string;
  contentId: string;
}) {
  await requireEnrollment(input.userId, input.courseId);
  const [existing] = await getDb()
    .select({ id: contentBookmarks.id })
    .from(contentBookmarks)
    .where(
      and(
        eq(contentBookmarks.userId, input.userId),
        eq(contentBookmarks.courseId, input.courseId),
        eq(contentBookmarks.contentType, input.contentType),
        eq(contentBookmarks.contentId, input.contentId),
      ),
    )
    .limit(1);
  if (existing) {
    await getDb()
      .delete(contentBookmarks)
      .where(eq(contentBookmarks.id, existing.id));
    return { bookmarked: false };
  }
  await getDb().insert(contentBookmarks).values({
    id: crypto.randomUUID(),
    ...input,
  });
  return { bookmarked: true };
}

export async function gradeWrittenQuestion(input: {
  userId: string;
  questionId: string;
  answer: string;
}) {
  const [row] = await getDb()
    .select({
      modelAnswer: writtenAnswerRules.modelAnswer,
      requiredKeywordsJson: writtenAnswerRules.requiredKeywordsJson,
      optionalKeywordsJson: writtenAnswerRules.optionalKeywordsJson,
      maximumScore: writtenAnswerRules.maximumScore,
      partialScoreRulesJson: writtenAnswerRules.partialScoreRulesJson,
      guidance: writtenAnswerRules.guidance,
      courseId: questionCourses.courseId,
    })
    .from(writtenAnswerRules)
    .innerJoin(
      questionCourses,
      eq(writtenAnswerRules.questionId, questionCourses.questionId),
    )
    .where(eq(writtenAnswerRules.questionId, input.questionId))
    .limit(1);
  if (!row) {
    throw new AppError(
      "서술형 보조채점 규칙을 찾을 수 없습니다.",
      404,
      "WRITTEN_RULE_NOT_FOUND",
    );
  }
  await requireEnrollment(input.userId, row.courseId);
  return gradeWrittenAnswer(input.answer, {
    modelAnswer: row.modelAnswer,
    requiredKeywords: parseJson<string[]>(row.requiredKeywordsJson, []),
    optionalKeywords: parseJson<string[]>(row.optionalKeywordsJson, []),
    maximumScore: row.maximumScore,
    partialScoreRules: parseJson<
      WrittenAnswerRuleInput["partialScoreRules"]
    >(row.partialScoreRulesJson, []),
    guidance: row.guidance,
  });
}

export async function listRiskMethods() {
  const methods = await getDb()
    .select()
    .from(riskCalculationMethods)
    .where(eq(riskCalculationMethods.active, true))
    .orderBy(asc(riskCalculationMethods.name));
  const criteria = await getDb()
    .select()
    .from(riskGradeCriteria)
    .orderBy(
      asc(riskGradeCriteria.calculationMethodId),
      asc(riskGradeCriteria.displayOrder),
    );
  return methods.map((method) => ({
    ...method,
    criteria: criteria.filter(
      (criterion) => criterion.calculationMethodId === method.id,
    ),
  }));
}

export async function calculateRiskWithMethod(input: {
  methodId: string;
  likelihood: number;
  impact: number;
}) {
  const [method] = await getDb()
    .select()
    .from(riskCalculationMethods)
    .where(
      and(
        eq(riskCalculationMethods.id, input.methodId),
        eq(riskCalculationMethods.active, true),
      ),
    )
    .limit(1);
  if (!method) {
    throw new AppError(
      "위험 계산 방법을 찾을 수 없습니다.",
      404,
      "RISK_METHOD_NOT_FOUND",
    );
  }
  const grades = await getDb()
    .select()
    .from(riskGradeCriteria)
    .where(eq(riskGradeCriteria.calculationMethodId, method.id))
    .orderBy(asc(riskGradeCriteria.displayOrder));
  return {
    method: { id: method.id, name: method.name, formulaType: method.formulaType },
    ...calculateRisk({
      formulaType: method.formulaType,
      likelihood: input.likelihood,
      impact: input.impact,
      configuration: parseJson<RiskCalculationConfiguration>(
        method.configurationJson,
        {},
      ),
      grades,
    }),
  };
}

export async function listRiskRegister(userId: string) {
  return getDb()
    .select({
      id: riskRegisterItems.id,
      scenarioId: riskRegisterItems.scenarioId,
      scenarioTitle: riskScenarios.title,
      asset: riskRegisterItems.asset,
      threat: riskRegisterItems.threat,
      vulnerability: riskRegisterItems.vulnerability,
      likelihood: riskRegisterItems.likelihood,
      impact: riskRegisterItems.impact,
      riskValue: riskRegisterItems.riskValue,
      treatment: riskRegisterItems.treatment,
      owner: riskRegisterItems.owner,
      dueDate: riskRegisterItems.dueDate,
      status: riskRegisterItems.status,
    })
    .from(riskRegisterItems)
    .innerJoin(
      riskScenarios,
      eq(riskRegisterItems.scenarioId, riskScenarios.id),
    )
    .where(eq(riskRegisterItems.userId, userId))
    .orderBy(desc(riskRegisterItems.updatedAt));
}

export async function saveRiskRegisterItem(
  userId: string,
  input: RiskRegisterInput,
  policy?: Cs1aPolicyRequest,
) {
  assertCs1aMutationAllowed(policy, "CANONICAL_MUTATION");
  const [scenario] = await getDb()
    .select({
      courseId: riskScenarios.courseId,
      calculationMethodId: riskScenarios.calculationMethodId,
    })
    .from(riskScenarios)
    .where(eq(riskScenarios.id, input.scenarioId))
    .limit(1);
  if (!scenario || !scenario.calculationMethodId) {
    throw new AppError(
      "위험 시나리오 또는 계산 방법을 찾을 수 없습니다.",
      404,
      "RISK_SCENARIO_NOT_FOUND",
    );
  }
  await requireEnrollment(userId, scenario.courseId);
  const calculated = await calculateRiskWithMethod({
    methodId: scenario.calculationMethodId,
    likelihood: input.likelihood,
    impact: input.impact,
  });
  const values = {
    userId,
    scenarioId: input.scenarioId,
    asset: input.asset,
    threat: input.threat,
    vulnerability: input.vulnerability,
    likelihood: input.likelihood,
    impact: input.impact,
    riskValue: calculated.riskValue,
    treatment: input.treatment,
    owner: input.owner,
    dueDate: input.dueDate || null,
    status: input.status,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  if (input.id) {
    const [updated] = await getDb()
      .update(riskRegisterItems)
      .set(values)
      .where(
        and(
          eq(riskRegisterItems.id, input.id),
          eq(riskRegisterItems.userId, userId),
        ),
      )
      .returning({ id: riskRegisterItems.id });
    if (!updated) {
      throw new AppError(
        "본인의 위험등록부 항목만 수정할 수 있습니다.",
        403,
        "RISK_REGISTER_FORBIDDEN",
      );
    }
    return updated.id;
  }
  const id = crypto.randomUUID();
  await getDb().insert(riskRegisterItems).values({ id, ...values });
  return id;
}

export async function getAdminSpecializedData() {
  const [
    standards,
    defectCases,
    legal,
    writtenRules,
    methods,
    scenarios,
    links,
  ] = await Promise.all([
    getDb().select().from(ismsStandards).orderBy(asc(ismsStandards.code)),
    getDb()
      .select()
      .from(ismsDefectCases)
      .orderBy(desc(ismsDefectCases.sourceDate)),
    getDb()
      .select()
      .from(legalArticles)
      .orderBy(asc(legalArticles.lawName), asc(legalArticles.articleNumber)),
    getDb()
      .select({
        questionId: writtenAnswerRules.questionId,
        title: questions.title,
        maximumScore: writtenAnswerRules.maximumScore,
        referenceDate: writtenAnswerRules.referenceDate,
      })
      .from(writtenAnswerRules)
      .innerJoin(questions, eq(writtenAnswerRules.questionId, questions.id)),
    listRiskMethods(),
    getDb().select().from(riskScenarios).orderBy(desc(riskScenarios.createdAt)),
    getDb()
      .select()
      .from(contentCourseLinks)
      .orderBy(
        asc(contentCourseLinks.contentType),
        asc(contentCourseLinks.displayOrder),
      ),
  ]);
  return { standards, defectCases, legal, writtenRules, methods, scenarios, links };
}

export async function saveSpecializedContent(
  actorUserId: string,
  input: SpecializedAdminInput,
  policy?: Cs1aPolicyRequest,
) {
  assertCs1aMutationAllowed(policy, "DRAFT_MUTATION");
  const id = "id" in input && input.id ? input.id : crypto.randomUUID();
  switch (input.entity) {
    case "ISMS_STANDARD": {
      const values = {
        code: input.code,
        title: input.title,
        majorCategory: input.majorCategory,
        middleCategory: input.middleCategory,
        description: input.description,
        keyPoints: input.keyPoints,
        evidenceExamples: input.evidenceExamples,
        defectExamples: input.defectExamples,
        auditPoints: input.auditPoints,
        version: input.version,
        effectiveDate: input.effectiveDate,
        sourceUrl: input.sourceUrl || null,
        active: input.active,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      if (input.id) {
        await getDb().update(ismsStandards).set(values).where(eq(ismsStandards.id, id));
      } else {
        await getDb().insert(ismsStandards).values({ id, ...values });
      }
      break;
    }
    case "ISMS_DEFECT_CASE": {
      const values = {
        title: input.title,
        situation: input.situation,
        defectDescription: input.defectDescription,
        relatedStandardId: input.relatedStandardId,
        evidence: input.evidence,
        correctiveAction: input.correctiveAction,
        source: input.source,
        sourceDate: input.sourceDate,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      if (input.id) {
        await getDb().update(ismsDefectCases).set(values).where(eq(ismsDefectCases.id, id));
      } else {
        await getDb().insert(ismsDefectCases).values({ id, ...values });
      }
      break;
    }
    case "LEGAL_ARTICLE": {
      const values = {
        lawName: input.lawName,
        articleNumber: input.articleNumber,
        articleTitle: input.articleTitle,
        content: input.content,
        effectiveDate: input.effectiveDate,
        revisionDate: input.revisionDate,
        sourceUrl: input.sourceUrl || null,
        version: input.version,
        active: input.active,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      if (input.id) {
        await getDb().update(legalArticles).set(values).where(eq(legalArticles.id, id));
      } else {
        await getDb().insert(legalArticles).values({ id, ...values });
      }
      await getDb()
        .insert(legalArticleVersions)
        .values({
          id: crypto.randomUUID(),
          legalArticleId: id,
          version: input.version,
          content: input.content,
          effectiveDate: input.effectiveDate,
          revisionDate: input.revisionDate,
          changeSummary: "관리자 저장 버전",
          sourceUrl: input.sourceUrl || null,
          createdBy: actorUserId,
        })
        .onConflictDoNothing();
      break;
    }
    case "WRITTEN_RULE":
      await getDb()
        .insert(writtenAnswerRules)
        .values({
          questionId: input.questionId,
          modelAnswer: input.modelAnswer,
          requiredKeywordsJson: JSON.stringify(input.requiredKeywords),
          optionalKeywordsJson: JSON.stringify(input.optionalKeywords),
          maximumScore: input.maximumScore,
          partialScoreRulesJson: JSON.stringify(input.partialScoreRules),
          guidance: input.guidance,
          referenceDate: input.referenceDate,
        })
        .onConflictDoUpdate({
          target: writtenAnswerRules.questionId,
          set: {
            modelAnswer: input.modelAnswer,
            requiredKeywordsJson: JSON.stringify(input.requiredKeywords),
            optionalKeywordsJson: JSON.stringify(input.optionalKeywords),
            maximumScore: input.maximumScore,
            partialScoreRulesJson: JSON.stringify(input.partialScoreRules),
            guidance: input.guidance,
            referenceDate: input.referenceDate,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });
      return input.questionId;
    case "RISK_METHOD": {
      const values = {
        name: input.name,
        description: input.description,
        formulaType: input.formulaType,
        configurationJson: JSON.stringify(input.configuration),
        active: input.active,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      if (input.id) {
        await getDb().update(riskCalculationMethods).set(values).where(eq(riskCalculationMethods.id, id));
      } else {
        await getDb().insert(riskCalculationMethods).values({ id, ...values });
      }
      break;
    }
    case "RISK_GRADE": {
      const values = {
        calculationMethodId: input.calculationMethodId,
        code: input.code,
        label: input.label,
        minValue: input.minValue,
        maxValue: input.maxValue,
        treatmentGuidance: input.treatmentGuidance,
        displayOrder: input.displayOrder,
      };
      if (input.id) {
        await getDb().update(riskGradeCriteria).set(values).where(eq(riskGradeCriteria.id, id));
      } else {
        await getDb().insert(riskGradeCriteria).values({ id, ...values });
      }
      break;
    }
    case "RISK_SCENARIO": {
      const calculated = await calculateRiskWithMethod({
        methodId: input.calculationMethodId,
        likelihood: input.likelihood,
        impact: input.impact,
      });
      const values = {
        courseId: input.courseId,
        calculationMethodId: input.calculationMethodId,
        title: input.title,
        asset: input.asset,
        threat: input.threat,
        vulnerability: input.vulnerability,
        existingControls: input.existingControls,
        likelihood: input.likelihood,
        impact: input.impact,
        riskValue: calculated.riskValue,
        riskLevel: calculated.riskLevel,
        treatmentOption: input.treatmentOption,
        residualRisk: input.residualRisk,
        description: input.description,
        referenceDate: input.referenceDate,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      if (input.id) {
        await getDb().update(riskScenarios).set(values).where(eq(riskScenarios.id, id));
      } else {
        await getDb().insert(riskScenarios).values({ id, ...values });
      }
      break;
    }
    case "CONTENT_LINK":
      await getDb()
        .insert(contentCourseLinks)
        .values({
          id,
          contentType: input.contentType,
          contentId: input.contentId,
          courseId: input.courseId,
          relationType: input.relationType,
          displayOrder: input.displayOrder,
        })
        .onConflictDoNothing();
      if (input.questionId) {
        await getDb()
          .insert(contentQuestionLinks)
          .values({
            id: crypto.randomUUID(),
            contentType: input.contentType,
            contentId: input.contentId,
            questionId: input.questionId,
            relationType: input.relationType,
          })
          .onConflictDoNothing();
      }
      break;
  }
  return id;
}
