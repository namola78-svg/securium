import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  like,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from ".";
import {
  aiGenerationRecords,
  aiReviewedContents,
  contentRevisions,
  contentCourseLinks,
  courseSpecializations,
  courses,
  ismsDefectCases,
  ismsStandards,
  learningUnits,
  legalArticles,
  lessons,
  privacyImpactAssessmentItems,
  questionAttempts,
  questionChoices,
  questionCourses,
  questionTopics,
  questions,
  riskScenarios,
  secureCodeSamples,
  secureCodingWeaknesses,
  userCourseEnrollments,
} from "./schema";
import type { AIProvider } from "@/lib/ai/ai-provider";
import {
  clampRetrievalLimit,
  type RetrievalProvider,
  type RetrievalSearchOptions,
} from "@/lib/ai/retrieval-provider";
import { assertDailyAILimit } from "@/lib/ai/safety";
import type {
  AIResult,
  QuestionExplanation,
  RetrievalContext,
} from "@/lib/ai/types";
import { AppError } from "@/lib/errors";

type SearchScope = {
  courseId?: string;
  topicId?: string;
};

export class DatabaseRetrievalProvider implements RetrievalProvider {
  search(options: RetrievalSearchOptions) {
    return this.searchScope({}, options);
  }

  searchByCourse(courseId: string, options: RetrievalSearchOptions) {
    return this.searchScope({ courseId }, options);
  }

  searchByTopic(
    courseId: string,
    topicId: string,
    options: RetrievalSearchOptions,
  ) {
    return this.searchScope({ courseId, topicId }, options);
  }

  async getContextByIds(ids: string[]) {
    const uniqueIds = [...new Set(ids)].slice(0, 12);
    const contexts = await Promise.all(
      uniqueIds.map((id) => this.getContextById(id)),
    );
    return contexts.filter(
      (context): context is RetrievalContext => context !== null,
    );
  }

  private async searchScope(
    scope: SearchScope,
    options: RetrievalSearchOptions,
  ) {
    const limit = clampRetrievalLimit(options.limit);
    // D1/SQLite may enforce a small byte limit for LIKE patterns. Bound the
    // UTF-8 payload rather than JavaScript code units so Korean titles cannot
    // make an otherwise valid retrieval request fail.
    const query = truncateUtf8(options.query.trim(), 48);
    const pattern = `%${query.replaceAll("%", "").replaceAll("_", "")}%`;
    const courseCondition = scope.courseId
      ? eq(courses.id, scope.courseId)
      : undefined;
    const topicCondition = scope.topicId
      ? eq(lessons.topicId, scope.topicId)
      : undefined;

    const [
      lessonRows,
      unitRows,
      questionRows,
      lawRows,
      standardRows,
      defectRows,
      riskRows,
      secureRows,
      privacyRows,
      reviewedRows,
    ] = await Promise.all([
      getDb()
        .select({
          id: lessons.id,
          title: lessons.title,
          excerpt: lessons.summary,
          courseId: lessons.courseId,
          topicId: lessons.topicId,
          version: sql<string>`cast(${lessons.version} as text)`,
          reviewedAt: lessons.updatedAt,
        })
        .from(lessons)
        .innerJoin(courses, eq(lessons.courseId, courses.id))
        .where(
          and(
            eq(lessons.active, true),
            eq(lessons.published, true),
            isNull(lessons.deletedAt),
            eq(courses.active, true),
            eq(courses.published, true),
            isNull(courses.deletedAt),
            courseCondition,
            topicCondition,
            query
              ? or(
                  like(lessons.id, pattern),
                  like(lessons.title, pattern),
                  like(lessons.summary, pattern),
                  like(lessons.content, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(desc(lessons.updatedAt))
        .limit(limit),
      getDb()
        .select({
          id: learningUnits.id,
          title: learningUnits.title,
          excerpt: learningUnits.description,
          courseId: learningUnits.courseId,
          topicId: learningUnits.topicId,
          reviewedAt: learningUnits.updatedAt,
        })
        .from(learningUnits)
        .innerJoin(courses, eq(learningUnits.courseId, courses.id))
        .where(
          and(
            eq(learningUnits.active, true),
            eq(learningUnits.published, true),
            isNull(learningUnits.deletedAt),
            eq(courses.active, true),
            eq(courses.published, true),
            isNull(courses.deletedAt),
            courseCondition,
            scope.topicId
              ? eq(learningUnits.topicId, scope.topicId)
              : undefined,
            query
              ? or(
                  like(learningUnits.id, pattern),
                  like(learningUnits.title, pattern),
                  like(learningUnits.description, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(desc(learningUnits.updatedAt))
        .limit(limit),
      getDb()
        .selectDistinct({
          id: questions.id,
          title: questions.title,
          explanation: questions.explanation,
          wrongAnswerExplanation: questions.wrongAnswerExplanation,
          courseId: questionCourses.courseId,
          topicId: questionTopics.topicId,
          version: sql<string>`cast(${questions.version} as text)`,
          reviewedAt: questions.publishedAt,
        })
        .from(questions)
        .innerJoin(questionCourses, eq(questions.id, questionCourses.questionId))
        .innerJoin(courses, eq(questionCourses.courseId, courses.id))
        .leftJoin(questionTopics, eq(questions.id, questionTopics.questionId))
        .where(
          and(
            eq(questions.status, "PUBLISHED"),
            eq(courses.active, true),
            eq(courses.published, true),
            isNull(courses.deletedAt),
            courseCondition,
            scope.topicId
              ? eq(questionTopics.topicId, scope.topicId)
              : undefined,
            query
              ? or(
                  like(questions.id, pattern),
                  like(questions.title, pattern),
                  like(questions.content, pattern),
                  like(questions.explanation, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(desc(questions.publishedAt))
        .limit(limit),
      getDb()
        .select({
          id: legalArticles.id,
          title: sql<string>`${legalArticles.lawName} || ' ' || ${legalArticles.articleNumber} || ' ' || ${legalArticles.articleTitle}`,
          excerpt: legalArticles.content,
          courseId: contentCourseLinks.courseId,
          version: legalArticles.version,
          reviewedAt: legalArticles.revisionDate,
        })
        .from(legalArticles)
        .innerJoin(
          contentCourseLinks,
          and(
            eq(contentCourseLinks.contentType, "LEGAL_ARTICLE"),
            eq(contentCourseLinks.contentId, legalArticles.id),
          ),
        )
        .innerJoin(courses, eq(contentCourseLinks.courseId, courses.id))
        .where(
          and(
            eq(legalArticles.active, true),
            eq(courses.active, true),
            eq(courses.published, true),
            isNull(courses.deletedAt),
            scope.courseId
              ? eq(contentCourseLinks.courseId, scope.courseId)
              : undefined,
            query
              ? or(
                  like(legalArticles.id, pattern),
                  like(legalArticles.lawName, pattern),
                  like(legalArticles.articleTitle, pattern),
                  like(legalArticles.content, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(desc(legalArticles.revisionDate))
        .limit(limit),
      getDb()
        .select({
          id: ismsStandards.id,
          title: sql<string>`${ismsStandards.code} || ' ' || ${ismsStandards.title}`,
          excerpt: ismsStandards.description,
          courseId: contentCourseLinks.courseId,
          version: ismsStandards.version,
          reviewedAt: ismsStandards.effectiveDate,
        })
        .from(ismsStandards)
        .innerJoin(
          contentCourseLinks,
          and(
            eq(contentCourseLinks.contentType, "ISMS_STANDARD"),
            eq(contentCourseLinks.contentId, ismsStandards.id),
          ),
        )
        .innerJoin(courses, eq(contentCourseLinks.courseId, courses.id))
        .where(
          and(
            eq(ismsStandards.active, true),
            eq(courses.active, true),
            eq(courses.published, true),
            isNull(courses.deletedAt),
            scope.courseId
              ? eq(contentCourseLinks.courseId, scope.courseId)
              : undefined,
            query
              ? or(
                  like(ismsStandards.id, pattern),
                  like(ismsStandards.code, pattern),
                  like(ismsStandards.title, pattern),
                  like(ismsStandards.description, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(desc(ismsStandards.effectiveDate))
        .limit(limit),
      getDb()
        .select({
          id: ismsDefectCases.id,
          title: ismsDefectCases.title,
          excerpt: ismsDefectCases.defectDescription,
          courseId: contentCourseLinks.courseId,
          version: sql<string>`null`,
          reviewedAt: ismsDefectCases.sourceDate,
        })
        .from(ismsDefectCases)
        .innerJoin(
          contentCourseLinks,
          and(
            eq(contentCourseLinks.contentType, "ISMS_DEFECT_CASE"),
            eq(contentCourseLinks.contentId, ismsDefectCases.id),
          ),
        )
        .innerJoin(courses, eq(contentCourseLinks.courseId, courses.id))
        .where(
          and(
            eq(courses.active, true),
            eq(courses.published, true),
            isNull(courses.deletedAt),
            scope.courseId
              ? eq(contentCourseLinks.courseId, scope.courseId)
              : undefined,
            query
              ? or(
                  like(ismsDefectCases.id, pattern),
                  like(ismsDefectCases.title, pattern),
                  like(ismsDefectCases.situation, pattern),
                  like(ismsDefectCases.defectDescription, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(desc(ismsDefectCases.sourceDate))
        .limit(limit),
      getDb()
        .select({
          id: riskScenarios.id,
          title: riskScenarios.title,
          excerpt: riskScenarios.description,
          courseId: riskScenarios.courseId,
          reviewedAt: riskScenarios.referenceDate,
        })
        .from(riskScenarios)
        .innerJoin(courses, eq(riskScenarios.courseId, courses.id))
        .where(
          and(
            eq(courses.active, true),
            eq(courses.published, true),
            isNull(courses.deletedAt),
            courseCondition,
            query
              ? or(
                  like(riskScenarios.id, pattern),
                  like(riskScenarios.title, pattern),
                  like(riskScenarios.description, pattern),
                  like(riskScenarios.asset, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(desc(riskScenarios.updatedAt))
        .limit(limit),
      getDb()
        .selectDistinct({
          id: secureCodingWeaknesses.id,
          title: sql<string>`${secureCodingWeaknesses.code} || ' ' || ${secureCodingWeaknesses.name}`,
          excerpt: secureCodingWeaknesses.description,
          courseId: contentCourseLinks.courseId,
          version: secureCodingWeaknesses.version,
          reviewedAt: secureCodingWeaknesses.updatedAt,
        })
        .from(secureCodingWeaknesses)
        .innerJoin(
          secureCodeSamples,
          eq(secureCodeSamples.weaknessId, secureCodingWeaknesses.id),
        )
        .innerJoin(
          contentCourseLinks,
          and(
            eq(contentCourseLinks.contentType, "SECURE_CODE_SAMPLE"),
            eq(contentCourseLinks.contentId, secureCodeSamples.id),
          ),
        )
        .innerJoin(courses, eq(contentCourseLinks.courseId, courses.id))
        .where(
          and(
            eq(secureCodingWeaknesses.active, true),
            eq(secureCodeSamples.active, true),
            eq(courses.active, true),
            eq(courses.published, true),
            isNull(courses.deletedAt),
            courseCondition,
            query
              ? or(
                  like(secureCodingWeaknesses.id, pattern),
                  like(secureCodingWeaknesses.code, pattern),
                  like(secureCodingWeaknesses.name, pattern),
                  like(secureCodingWeaknesses.description, pattern),
                  like(secureCodingWeaknesses.cweCode, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(desc(secureCodingWeaknesses.updatedAt))
        .limit(limit),
      getDb()
        .selectDistinct({
          id: privacyImpactAssessmentItems.id,
          title: sql<string>`${privacyImpactAssessmentItems.code} || ' ' || ${privacyImpactAssessmentItems.title}`,
          excerpt: privacyImpactAssessmentItems.description,
          courseId: courseSpecializations.courseId,
          version: privacyImpactAssessmentItems.version,
          reviewedAt: privacyImpactAssessmentItems.effectiveDate,
        })
        .from(privacyImpactAssessmentItems)
        .innerJoin(
          courseSpecializations,
          eq(courseSpecializations.featureType, "PRIVACY_IMPACT_ASSESSMENT"),
        )
        .innerJoin(courses, eq(courseSpecializations.courseId, courses.id))
        .where(
          and(
            eq(privacyImpactAssessmentItems.active, true),
            eq(courseSpecializations.active, true),
            eq(courses.active, true),
            eq(courses.published, true),
            isNull(courses.deletedAt),
            courseCondition,
            query
              ? or(
                  like(privacyImpactAssessmentItems.id, pattern),
                  like(privacyImpactAssessmentItems.code, pattern),
                  like(privacyImpactAssessmentItems.title, pattern),
                  like(privacyImpactAssessmentItems.description, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(desc(privacyImpactAssessmentItems.effectiveDate))
        .limit(limit),
      getDb()
        .select({
          id: aiReviewedContents.id,
          title: aiReviewedContents.title,
          excerpt: aiReviewedContents.contentJson,
          courseId: aiReviewedContents.courseId,
          reviewedAt: aiReviewedContents.updatedAt,
        })
        .from(aiReviewedContents)
        .innerJoin(courses, eq(aiReviewedContents.courseId, courses.id))
        .where(
          and(
            eq(aiReviewedContents.active, true),
            eq(courses.active, true),
            eq(courses.published, true),
            isNull(courses.deletedAt),
            courseCondition,
            query
              ? or(
                  like(aiReviewedContents.id, pattern),
                  like(aiReviewedContents.title, pattern),
                  like(aiReviewedContents.contentJson, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(desc(aiReviewedContents.updatedAt))
        .limit(limit),
    ]);

    const contexts: RetrievalContext[] = [
      ...lessonRows.map((row) => ({
        ...row,
        id: `LESSON:${row.id}`,
        kind: "LESSON" as const,
      })),
      ...unitRows.map((row) => ({
        ...row,
        id: `LEARNING_UNIT:${row.id}`,
        kind: "LEARNING_UNIT" as const,
        version: null,
      })),
      ...questionRows.map((row) => ({
        id: `QUESTION:${row.id}`,
        kind: "QUESTION_EXPLANATION" as const,
        excerpt: [row.explanation, row.wrongAnswerExplanation]
          .filter(Boolean)
          .join("\n"),
        title: row.title,
        courseId: row.courseId,
        topicId: row.topicId,
        version: row.version,
        reviewedAt: row.reviewedAt,
      })),
      ...lawRows.map((row) => this.linkedRow(row, "LEGAL_ARTICLE")),
      ...standardRows.map((row) => this.linkedRow(row, "ISMS_STANDARD")),
      ...defectRows.map((row) => this.linkedRow(row, "CASE_STUDY")),
      ...riskRows.map((row) => ({
        id: `RISK_SCENARIO:${row.id}`,
        kind: "CASE_STUDY" as const,
        title: row.title,
        excerpt: row.excerpt,
        courseId: row.courseId,
        topicId: null,
        version: null,
        reviewedAt: row.reviewedAt,
      })),
      ...secureRows.map((row) => ({
        id: `SECURE_WEAKNESS:${row.id}`,
        kind: "SECURE_WEAKNESS" as const,
        title: row.title,
        excerpt: row.excerpt,
        courseId: row.courseId,
        topicId: null,
        version: row.version,
        reviewedAt: row.reviewedAt,
      })),
      ...privacyRows.map((row) => ({
        id: `PRIVACY_ITEM:${row.id}`,
        kind: "PRIVACY_ITEM" as const,
        title: row.title,
        excerpt: row.excerpt,
        courseId: row.courseId,
        topicId: null,
        version: row.version,
        reviewedAt: row.reviewedAt,
      })),
      ...reviewedRows.map((row) => ({
        id: `AI_REVIEWED_CONTENT:${row.id}`,
        kind: "AI_REVIEWED_CONTENT" as const,
        title: row.title,
        excerpt: row.excerpt,
        courseId: row.courseId,
        topicId: null,
        version: null,
        reviewedAt: row.reviewedAt,
      })),
    ];

    const deduplicated = deduplicateContexts(contexts);
    const revisionTargets = deduplicated
      .map((context) => revisionTargetFromContextId(context.id))
      .filter(
        (
          target,
        ): target is { contentType: string; contentId: string } =>
          target !== null,
      );
    const latestRevisions = revisionTargets.length
      ? await getDb()
          .select({
            contentType: contentRevisions.contentType,
            contentId: contentRevisions.contentId,
            version: contentRevisions.version,
            reviewedAt: contentRevisions.reviewedAt,
          })
          .from(contentRevisions)
          .where(
            and(
              eq(contentRevisions.revisionStatus, "published"),
              eq(contentRevisions.isLatest, true),
              inArray(
                contentRevisions.contentId,
                revisionTargets.map((target) => target.contentId),
              ),
            ),
          )
          .limit(120)
      : [];
    const revisionMap = new Map(
      latestRevisions.map((revision) => [
        `${revision.contentType}:${revision.contentId}`,
        revision,
      ]),
    );
    return deduplicated
      .map((context) => {
        const target = revisionTargetFromContextId(context.id);
        const revision = target
          ? revisionMap.get(`${target.contentType}:${target.contentId}`)
          : null;
        return {
          context: revision
            ? {
                ...context,
                version: revision.version,
                reviewedAt: revision.reviewedAt,
              }
            : context,
          verifiedRevision: Boolean(revision),
        };
      })
      .sort(
        (left, right) =>
          Number(right.verifiedRevision) - Number(left.verifiedRevision),
      )
      .map((item) => item.context)
      .slice(0, limit);
  }

  private linkedRow(
    row: {
      id: string;
      title: string;
      excerpt: string;
      courseId: string;
      version: string | null;
      reviewedAt: string | null;
    },
    kind: "LEGAL_ARTICLE" | "ISMS_STANDARD" | "CASE_STUDY",
  ): RetrievalContext {
    const prefix =
      kind === "CASE_STUDY"
        ? "ISMS_DEFECT_CASE"
        : kind;
    return {
      id: `${prefix}:${row.id}`,
      kind,
      title: row.title,
      excerpt: row.excerpt,
      courseId: row.courseId,
      topicId: null,
      version: row.version,
      reviewedAt: row.reviewedAt,
    };
  }

  private async getContextById(id: string) {
    const separator = id.indexOf(":");
    if (separator < 1) return null;
    const prefix = id.slice(0, separator);
    const targetId = id.slice(separator + 1);
    if (!targetId) return null;

    if (prefix === "LESSON") {
      const [row] = await getDb()
        .select({
          id: lessons.id,
          title: lessons.title,
          excerpt: lessons.summary,
          courseId: lessons.courseId,
          topicId: lessons.topicId,
          version: sql<string>`cast(${lessons.version} as text)`,
          reviewedAt: lessons.updatedAt,
        })
        .from(lessons)
        .innerJoin(courses, eq(lessons.courseId, courses.id))
        .where(
          and(
            eq(lessons.id, targetId),
            eq(lessons.active, true),
            eq(lessons.published, true),
            isNull(lessons.deletedAt),
            eq(courses.active, true),
            eq(courses.published, true),
            isNull(courses.deletedAt),
          ),
        )
        .limit(1);
      return row
        ? ({ ...row, id, kind: "LESSON" } satisfies RetrievalContext)
        : null;
    }

    if (prefix === "QUESTION") {
      const [row] = await getDb()
        .select({
          id: questions.id,
          title: questions.title,
          explanation: questions.explanation,
          wrongAnswerExplanation: questions.wrongAnswerExplanation,
          courseId: questionCourses.courseId,
          topicId: questionTopics.topicId,
          version: sql<string>`cast(${questions.version} as text)`,
          reviewedAt: questions.publishedAt,
        })
        .from(questions)
        .innerJoin(questionCourses, eq(questions.id, questionCourses.questionId))
        .leftJoin(questionTopics, eq(questions.id, questionTopics.questionId))
        .where(
          and(
            eq(questions.id, targetId),
            eq(questions.status, "PUBLISHED"),
          ),
        )
        .limit(1);
      return row
        ? ({
            id,
            kind: "QUESTION_EXPLANATION",
            title: row.title,
            excerpt: [row.explanation, row.wrongAnswerExplanation]
              .filter(Boolean)
              .join("\n"),
            courseId: row.courseId,
            topicId: row.topicId,
            version: row.version,
            reviewedAt: row.reviewedAt,
          } satisfies RetrievalContext)
        : null;
    }

    const results = await this.search({
      query: targetId,
      limit: 12,
    });
    return results.find((context) => context.id === id) ?? null;
  }
}

function truncateUtf8(value: string, maxBytes: number) {
  const encoder = new TextEncoder();
  if (encoder.encode(value).byteLength <= maxBytes) return value;

  let result = "";
  for (const character of value) {
    if (encoder.encode(result + character).byteLength > maxBytes) break;
    result += character;
  }
  return result;
}

export async function generateQuestionAIExplanation(input: {
  userId: string;
  courseId: string;
  questionId: string;
  provider: AIProvider;
  dailyLimit: number;
  retentionDays: number;
}) {
  await requireEnrolledCourse(input.userId, input.courseId);
  await requireQuestionAttempt(
    input.userId,
    input.courseId,
    input.questionId,
  );
  const dailyCount = await countTodayAIGenerations(input.userId);
  assertDailyAILimit(dailyCount, input.dailyLimit);

  const question = await getQuestionForAI(input.questionId, input.courseId);
  const retrieval = new DatabaseRetrievalProvider();
  const primaryContext: RetrievalContext | null =
    question.explanation || question.wrongAnswerExplanation
      ? {
          id: `QUESTION:${question.id}`,
          kind: "QUESTION_EXPLANATION",
          title: question.title,
          excerpt: [question.explanation, question.wrongAnswerExplanation]
            .filter(Boolean)
            .join("\n"),
          courseId: input.courseId,
          topicId: question.topicId,
          version: String(question.version),
          reviewedAt: question.publishedAt,
        }
      : null;
  const relatedContexts = question.topicId
    ? await retrieval.searchByTopic(input.courseId, question.topicId, {
        query: "",
        limit: 8,
      })
    : await retrieval.searchByCourse(input.courseId, { query: "", limit: 8 });
  const contexts = deduplicateContexts(
    [primaryContext, ...relatedContexts].filter(
      (context): context is RetrievalContext => context !== null,
    ),
  ).slice(0, 8);
  const similarQuestions = await listSimilarQuestions({
    courseId: input.courseId,
    questionId: input.questionId,
    topicId: question.topicId,
  });
  const requestId = crypto.randomUUID();
  const result = await input.provider.explainQuestion({
    requestId,
    question: {
      id: question.id,
      title: question.title,
      content: question.content,
      type: question.type,
      explanation: question.explanation,
      wrongAnswerExplanation: question.wrongAnswerExplanation,
      choices: question.choices,
    },
    contexts,
    similarQuestions,
  });
  const retentionUntil = new Date(
    Date.now() + input.retentionDays * 86_400_000,
  ).toISOString();
  const promptFingerprint = await createFingerprint([
    input.courseId,
    input.questionId,
    ...result.sourceContextIds,
  ]);
  await getDb().insert(aiGenerationRecords).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    courseId: input.courseId,
    questionId: input.questionId,
    provider: result.provider,
    model: result.model,
    generatedAt: result.generatedAt,
    sourceContextIdsJson: JSON.stringify(result.sourceContextIds),
    disclaimer: result.disclaimer,
    reviewed: result.reviewed,
    requestId: result.requestId,
    latencyMs: result.latencyMs,
    status: result.status,
    resultJson: JSON.stringify(result.content),
    errorCode: result.errorCode ?? null,
    promptFingerprint,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
    estimatedCostMicros: result.usage?.estimatedCostMicros ?? 0,
    retentionUntil,
  });
  return result;
}

export async function getAIExplanationRecord(
  userId: string,
  requestId: string,
): Promise<AIResult<QuestionExplanation> | null> {
  const [row] = await getDb()
    .select()
    .from(aiGenerationRecords)
    .where(
      and(
        eq(aiGenerationRecords.userId, userId),
        eq(aiGenerationRecords.requestId, requestId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    provider: row.provider as AIResult<QuestionExplanation>["provider"],
    model: row.model,
    generatedAt: row.generatedAt,
    sourceContextIds: parseJson<string[]>(row.sourceContextIdsJson, []),
    disclaimer: row.disclaimer,
    reviewed: row.reviewed,
    requestId: row.requestId,
    latencyMs: row.latencyMs,
    status: row.status as AIResult<QuestionExplanation>["status"],
    content: parseJson<QuestionExplanation>(row.resultJson, {
      intent: "",
      correctReason: "",
      wrongReasons: [],
      relatedStandards: [],
      relatedLaws: [],
      memorySummary: "",
      similarQuestions: [],
      internalSources: [],
    }),
    usage: {
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      estimatedCostMicros: row.estimatedCostMicros,
    },
    ...(row.errorCode ? { errorCode: row.errorCode } : {}),
  };
}

async function requireEnrolledCourse(userId: string, courseId: string) {
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
      "수강 중인 과정의 문제만 AI 해설을 요청할 수 있습니다.",
      403,
      "AI_ENROLLMENT_REQUIRED",
    );
  }
}

async function requireQuestionAttempt(
  userId: string,
  courseId: string,
  questionId: string,
) {
  const [attempt] = await getDb()
    .select({ id: questionAttempts.id })
    .from(questionAttempts)
    .where(
      and(
        eq(questionAttempts.userId, userId),
        eq(questionAttempts.courseId, courseId),
        eq(questionAttempts.questionId, questionId),
      ),
    )
    .limit(1);
  if (!attempt) {
    throw new AppError(
      "답안을 제출한 문제만 AI 해설을 요청할 수 있습니다.",
      403,
      "AI_ATTEMPT_REQUIRED",
    );
  }
}

async function countTodayAIGenerations(userId: string) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(aiGenerationRecords)
    .where(
      and(
        eq(aiGenerationRecords.userId, userId),
        gt(aiGenerationRecords.generatedAt, start.toISOString()),
      ),
    );
  return Number(row?.count ?? 0);
}

async function getQuestionForAI(questionId: string, courseId: string) {
  const [row] = await getDb()
    .select({
      id: questions.id,
      title: questions.title,
      content: questions.content,
      type: questions.type,
      explanation: questions.explanation,
      wrongAnswerExplanation: questions.wrongAnswerExplanation,
      version: questions.version,
      publishedAt: questions.publishedAt,
      topicId: questionTopics.topicId,
    })
    .from(questions)
    .innerJoin(
      questionCourses,
      and(
        eq(questions.id, questionCourses.questionId),
        eq(questionCourses.courseId, courseId),
      ),
    )
    .innerJoin(courses, eq(questionCourses.courseId, courses.id))
    .leftJoin(questionTopics, eq(questions.id, questionTopics.questionId))
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.status, "PUBLISHED"),
        eq(courses.active, true),
        eq(courses.published, true),
        isNull(courses.deletedAt),
      ),
    )
    .limit(1);
  if (!row) {
    throw new AppError(
      "공개된 문제를 찾을 수 없습니다.",
      404,
      "AI_QUESTION_NOT_FOUND",
    );
  }
  const choices = await getDb()
    .select({
      id: questionChoices.id,
      content: questionChoices.content,
      isCorrect: questionChoices.isCorrect,
      explanation: questionChoices.explanation,
    })
    .from(questionChoices)
    .where(eq(questionChoices.questionId, questionId))
    .orderBy(asc(questionChoices.displayOrder));
  return { ...row, choices };
}

async function listSimilarQuestions(input: {
  courseId: string;
  questionId: string;
  topicId: string | null;
}) {
  return getDb()
    .selectDistinct({ id: questions.id, title: questions.title })
    .from(questions)
    .innerJoin(
      questionCourses,
      and(
        eq(questions.id, questionCourses.questionId),
        eq(questionCourses.courseId, input.courseId),
      ),
    )
    .leftJoin(questionTopics, eq(questions.id, questionTopics.questionId))
    .where(
      and(
        eq(questions.status, "PUBLISHED"),
        ne(questions.id, input.questionId),
        input.topicId
          ? eq(questionTopics.topicId, input.topicId)
          : undefined,
      ),
    )
    .orderBy(desc(questions.publishedAt))
    .limit(3);
}

function deduplicateContexts(contexts: RetrievalContext[]) {
  return [...new Map(contexts.map((context) => [context.id, context])).values()];
}

function revisionTargetFromContextId(id: string) {
  const separator = id.indexOf(":");
  if (separator < 1) return null;
  const prefix = id.slice(0, separator);
  const contentId = id.slice(separator + 1);
  const contentType = {
    LESSON: "LESSON",
    LEARNING_UNIT: "LEARNING_UNIT",
    QUESTION: "QUESTION_EXPLANATION",
    LEGAL_ARTICLE: "LEGAL_ARTICLE",
    ISMS_STANDARD: "ISMS_STANDARD",
    SECURE_WEAKNESS: "SECURE_CODING_WEAKNESS",
    PRIVACY_ITEM: "PRIVACY_IMPACT_ITEM",
  }[prefix];
  return contentType && contentId ? { contentType, contentId } : null;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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
