import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  like,
  or,
  sql,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from ".";
import {
  bookmarks,
  contentRevisions,
  courses,
  learningActivities,
  ontologyConcepts,
  questionAttempts,
  questionChoices,
  questionConcepts,
  questionCourses,
  questionReports,
  questionSubjects,
  questionTopics,
  questionVersions,
  questions,
  subjects,
  topics,
  userCourseEnrollments,
  userProgress,
  wrongNotes,
} from "./schema";
import type { QuestionInput } from "@/lib/validation";
import {
  gradeQuestion,
  requireSupportedGrade,
  toPublicChoices,
  type QuestionType,
  type ShortAnswerConfig,
  type SubmittedAnswer,
} from "@/lib/services/grading-service";
import {
  createQuestionVersionSnapshot,
  assertGovernedQuestionApproval,
  resolveQuestionTransition,
  type QuestionStatus,
  type WorkflowAction,
} from "@/lib/services/question-workflow-service";
import { AppError } from "@/lib/errors";
import { updateReviewScheduleForAttempt } from "./phase3-repositories";
import { createAuditInsert } from "./audit-repositories";
import {
  computeConceptMappingSetHash,
  type GovernedConceptMapping,
} from "@/lib/services/learning-event-contracts";

function batchItems(items: BatchItem<"sqlite">[]) {
  return items as unknown as Parameters<ReturnType<typeof getDb>["batch"]>[0];
}

export type QuestionFilters = {
  courseId?: string;
  subjectId?: string;
  topicId?: string;
  type?: string;
  difficulty?: string;
  status?: string;
  keyword?: string;
  createdBy?: string;
  reviewedBy?: string;
  questionIds?: string[];
  limit?: number;
  random?: boolean;
};

function safeAnswerConfig(value: string): ShortAnswerConfig {
  try {
    return JSON.parse(value) as ShortAnswerConfig;
  } catch {
    return {};
  }
}

export async function listPublicQuestions(filters: QuestionFilters) {
  if (filters.questionIds && !filters.questionIds.length) return [];
  const conditions = [
    eq(questions.status, "PUBLISHED"),
    eq(courses.active, true),
    eq(courses.published, true),
    isNull(courses.deletedAt),
  ];
  if (filters.courseId) conditions.push(eq(questionCourses.courseId, filters.courseId));
  if (filters.questionIds) conditions.push(inArray(questions.id, filters.questionIds));
  if (filters.type) conditions.push(eq(questions.type, filters.type));
  if (filters.difficulty) {
    conditions.push(eq(questions.difficulty, filters.difficulty));
  }
  if (filters.subjectId) {
    conditions.push(eq(questionSubjects.subjectId, filters.subjectId));
  }
  if (filters.topicId) conditions.push(eq(questionTopics.topicId, filters.topicId));

  const rows = await getDb()
    .selectDistinct({
      id: questions.id,
      title: questions.title,
      content: questions.content,
      type: questions.type,
      difficulty: questions.difficulty,
      isSample: questions.isSample,
      courseId: questionCourses.courseId,
      questionVersionId: questionVersions.id,
      questionVersionSemanticHash: questionVersions.semanticHash,
      questionVersionHumanReviewHash: questionVersions.humanReviewHash,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .innerJoin(questionCourses, eq(questions.id, questionCourses.questionId))
    .innerJoin(courses, eq(questionCourses.courseId, courses.id))
    .leftJoin(
      questionVersions,
      and(
        eq(questionVersions.questionId, questions.id),
        eq(questionVersions.version, questions.version),
      ),
    )
    .leftJoin(questionSubjects, eq(questions.id, questionSubjects.questionId))
    .leftJoin(questionTopics, eq(questions.id, questionTopics.questionId))
    .where(and(...conditions))
    .orderBy(
      asc(questions.createdAt),
      asc(questions.id),
    )
    .limit(Math.min(filters.limit ?? 10, 50));

  if (filters.random) {
    rows.sort(() => Math.random() - 0.5);
  }

  const ids = rows.map((row) => row.id);
  const choiceRows = ids.length
    ? await getDb()
        .select({
          id: questionChoices.id,
          questionId: questionChoices.questionId,
          content: questionChoices.content,
          displayOrder: questionChoices.displayOrder,
        })
        .from(questionChoices)
        .where(inArray(questionChoices.questionId, ids))
        .orderBy(asc(questionChoices.displayOrder))
    : [];

  const bindings = await resolveQuestionVersionBindings(
    rows.map((row) => ({
      questionId: row.id,
      questionVersionId: row.questionVersionId,
      semanticHash: row.questionVersionSemanticHash,
      humanReviewHash: row.questionVersionHumanReviewHash,
    })),
  );
  return rows.map((row) => {
    const binding = bindings.get(row.id) ?? null;
    return {
      ...row,
      questionVersionId: binding?.questionVersionId ?? null,
      automaticGradingAvailable: [
        "TRUE_FALSE",
        "SINGLE_CHOICE",
        "MULTIPLE_CHOICE",
        "SHORT_ANSWER",
      ].includes(row.type),
      choices: toPublicChoices(
        row.type as QuestionType,
        choiceRows.filter((choice) => choice.questionId === row.id),
      ),
    };
  });
}

export async function listQuestionFilterSubjectsForCourse(courseId: string) {
  return getDb()
    .selectDistinct({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
      displayOrder: subjects.displayOrder,
    })
    .from(subjects)
    .innerJoin(questionSubjects, eq(questionSubjects.subjectId, subjects.id))
    .innerJoin(questions, eq(questionSubjects.questionId, questions.id))
    .innerJoin(questionCourses, eq(questionCourses.questionId, questions.id))
    .innerJoin(courses, eq(questionCourses.courseId, courses.id))
    .where(
      and(
        eq(questionCourses.courseId, courseId),
        eq(subjects.courseId, courseId),
        eq(subjects.active, true),
        eq(questions.status, "PUBLISHED"),
        eq(courses.active, true),
        eq(courses.published, true),
        isNull(courses.deletedAt),
        isNull(subjects.deletedAt),
      ),
    )
    .orderBy(asc(subjects.displayOrder), asc(subjects.name));
}

export async function listQuestionFilterTopicsForSubject(
  courseId: string,
  subjectId: string,
) {
  return getDb()
    .selectDistinct({
      id: topics.id,
      name: topics.name,
      code: topics.code,
      displayOrder: topics.displayOrder,
    })
    .from(topics)
    .innerJoin(questionTopics, eq(questionTopics.topicId, topics.id))
    .innerJoin(subjects, eq(topics.subjectId, subjects.id))
    .innerJoin(questions, eq(questionTopics.questionId, questions.id))
    .innerJoin(questionCourses, eq(questionCourses.questionId, questions.id))
    .innerJoin(courses, eq(questionCourses.courseId, courses.id))
    .where(
      and(
        eq(questionCourses.courseId, courseId),
        eq(topics.subjectId, subjectId),
        eq(subjects.courseId, courseId),
        eq(subjects.active, true),
        eq(questions.status, "PUBLISHED"),
        eq(courses.active, true),
        eq(courses.published, true),
        isNull(courses.deletedAt),
        isNull(subjects.deletedAt),
        isNull(topics.deletedAt),
      ),
    )
    .orderBy(asc(topics.displayOrder), asc(topics.name));
}

export async function getQuestionForGrading(
  questionId: string,
  courseId: string,
  expectedQuestionVersionId?: string | null,
) {
  const [row] = await getDb()
    .select({
      id: questions.id,
      type: questions.type,
      status: questions.status,
      title: questions.title,
      explanation: questions.explanation,
      wrongAnswerExplanation: questions.wrongAnswerExplanation,
      explanationContentDate: contentRevisions.contentDate,
      explanationVersion: contentRevisions.version,
      explanationReviewedAt: contentRevisions.reviewedAt,
      answerConfigJson: questions.answerConfigJson,
      version: questions.version,
      subjectId: subjects.id,
      topicId: topics.id,
    })
    .from(questions)
    .innerJoin(
      questionCourses,
      and(
        eq(questions.id, questionCourses.questionId),
        eq(questionCourses.courseId, courseId),
      ),
    )
    .leftJoin(questionSubjects, eq(questions.id, questionSubjects.questionId))
    .leftJoin(
      subjects,
      and(
        eq(questionSubjects.subjectId, subjects.id),
        eq(subjects.courseId, courseId),
      ),
    )
    .leftJoin(questionTopics, eq(questions.id, questionTopics.questionId))
    .leftJoin(
      topics,
      and(
        eq(questionTopics.topicId, topics.id),
        eq(topics.subjectId, subjects.id),
      ),
    )
    .leftJoin(
      contentRevisions,
      and(
        eq(contentRevisions.contentType, "QUESTION_EXPLANATION"),
        eq(contentRevisions.contentId, questions.id),
        eq(contentRevisions.revisionStatus, "published"),
        eq(contentRevisions.isLatest, true),
      ),
    )
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!row || row.status !== "PUBLISHED") {
    throw new AppError(
      "공개된 문제를 찾을 수 없습니다.",
      404,
      "QUESTION_NOT_FOUND",
    );
  }
  const choices = await getDb()
    .select()
    .from(questionChoices)
    .where(eq(questionChoices.questionId, questionId))
    .orderBy(asc(questionChoices.displayOrder));
  const binding = await resolveQuestionVersionBinding({
    questionId,
    expectedQuestionVersionId: expectedQuestionVersionId ?? null,
    currentVersion: row.version,
  });
  return { ...row, choices, binding };
}

export async function submitQuestionAttempt(input: {
  userId: string;
  questionId: string;
  courseId: string;
  answer: SubmittedAnswer;
  responseTime: number;
  idempotencyKey: string;
  questionVersionId?: string | null;
}) {
  const [enrollment] = await getDb()
    .select({ id: userCourseEnrollments.id })
    .from(userCourseEnrollments)
    .where(
      and(
        eq(userCourseEnrollments.userId, input.userId),
        eq(userCourseEnrollments.courseId, input.courseId),
        inArray(userCourseEnrollments.status, ["ACTIVE", "PAUSED"]),
      ),
    )
    .limit(1);
  if (!enrollment) {
    throw new AppError(
      "수강 중인 과정의 문제만 풀 수 있습니다.",
      403,
      "ENROLLMENT_REQUIRED",
    );
  }

  const [existing] = await getDb()
    .select()
    .from(questionAttempts)
    .where(
      and(
        eq(questionAttempts.userId, input.userId),
        eq(questionAttempts.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing) {
    if ((existing.questionVersionId ?? null) !== (input.questionVersionId ?? null)) {
      throw new AppError(
        "The replayed attempt uses a different QuestionVersion.",
        409,
        "QUESTION_VERSION_MISMATCH",
      );
    }
    const question = await getQuestionForGrading(
      input.questionId,
      input.courseId,
      existing.questionVersionId,
    );
    return {
      attemptId: existing.id,
      idempotentReplay: true,
      isCorrect: existing.isCorrect,
      score: existing.score,
      explanation: question.explanation,
      wrongAnswerExplanation: question.wrongAnswerExplanation,
      explanationVersion: {
        contentDate: question.explanationContentDate,
        version: question.explanationVersion,
        reviewedAt: question.explanationReviewedAt,
      },
      correctAnswer: question.choices
        .filter((choice) => choice.isCorrect)
        .map((choice) => choice.content),
    };
  }

  const question = await getQuestionForGrading(
    input.questionId,
    input.courseId,
    input.questionVersionId,
  );

  const grade = requireSupportedGrade(
    gradeQuestion(
      {
        type: question.type as QuestionType,
        choices: question.choices,
        answerConfig: safeAnswerConfig(question.answerConfigJson),
      },
      input.answer,
    ),
  );
  const attemptId = crypto.randomUUID();
  const activityId = crypto.randomUUID();
  const progressId = crypto.randomUUID();
  const selectedAnswer = JSON.stringify(input.answer);
  const operations: BatchItem<"sqlite">[] = [
    getDb().insert(questionAttempts).values({
      id: attemptId,
      idempotencyKey: input.idempotencyKey,
      userId: input.userId,
      questionId: input.questionId,
      questionVersionId: question.binding?.questionVersionId ?? null,
      conceptMappingSetHash: question.binding?.conceptMappingSetHash ?? null,
      courseId: input.courseId,
      selectedAnswer,
      isCorrect: grade.isCorrect === true,
      score: grade.score ?? 0,
      responseTime: input.responseTime,
    }),
    getDb().insert(learningActivities).values({
      id: activityId,
      userId: input.userId,
      courseId: input.courseId,
      activityType: "QUESTION_ATTEMPT",
      targetId: input.questionId,
      metadataJson: JSON.stringify({
        attemptId,
        isCorrect: grade.isCorrect,
        score: grade.score,
      }),
    }),
  ];

  if (question.subjectId && question.topicId) {
    operations.push(
      getDb()
        .insert(userProgress)
        .values({
          id: progressId,
          userId: input.userId,
          courseId: input.courseId,
          subjectId: question.subjectId,
          topicId: question.topicId,
          completedQuestions: 1,
          correctAnswers: grade.isCorrect ? 1 : 0,
          totalAnswers: 1,
          lastStudiedAt: sql`CURRENT_TIMESTAMP`,
        })
        .onConflictDoUpdate({
          target: [
            userProgress.userId,
            userProgress.courseId,
            userProgress.subjectId,
            userProgress.topicId,
          ],
          set: {
            completedQuestions: sql`${userProgress.completedQuestions} + 1`,
            correctAnswers: sql`${userProgress.correctAnswers} + ${grade.isCorrect ? 1 : 0}`,
            totalAnswers: sql`${userProgress.totalAnswers} + 1`,
            lastStudiedAt: sql`CURRENT_TIMESTAMP`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        }),
    );
  }

  if (!grade.isCorrect) {
    operations.push(
      getDb()
        .insert(wrongNotes)
        .values({
          id: crypto.randomUUID(),
          userId: input.userId,
          questionId: input.questionId,
          courseId: input.courseId,
          lastAttemptId: attemptId,
          wrongCount: 1,
          mastered: false,
        })
        .onConflictDoUpdate({
          target: [
            wrongNotes.userId,
            wrongNotes.questionId,
            wrongNotes.courseId,
          ],
          set: {
            lastAttemptId: attemptId,
            wrongCount: sql`${wrongNotes.wrongCount} + 1`,
            mastered: false,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        }),
    );
  }

  await getDb().batch(
    operations as unknown as Parameters<ReturnType<typeof getDb>["batch"]>[0],
  );
  await updateReviewScheduleForAttempt({
    userId: input.userId,
    courseId: input.courseId,
    questionId: input.questionId,
    correct: grade.isCorrect === true,
  });
  return {
    attemptId,
    idempotentReplay: false,
    isCorrect: grade.isCorrect,
    score: grade.score,
    explanation: question.explanation,
    wrongAnswerExplanation: question.wrongAnswerExplanation,
    explanationVersion: {
      contentDate: question.explanationContentDate,
      version: question.explanationVersion,
      reviewedAt: question.explanationReviewedAt,
    },
    correctAnswer:
      question.type === "SHORT_ANSWER"
        ? grade.correctAnswer
        : question.choices
            .filter((choice) => choice.isCorrect)
            .map((choice) => choice.content),
  };
}

type QuestionBindingSeed = Readonly<{
  questionId: string;
  questionVersionId: string | null;
  semanticHash: string | null;
  humanReviewHash: string | null;
}>;

async function resolveQuestionVersionBindings(seeds: readonly QuestionBindingSeed[]) {
  const result = new Map<
    string,
    Readonly<{ questionVersionId: string; conceptMappingSetHash: string }>
  >();
  const eligible = seeds.filter(
    (seed): seed is QuestionBindingSeed & { questionVersionId: string; semanticHash: string; humanReviewHash: string } =>
      Boolean(seed.questionVersionId && seed.semanticHash && seed.humanReviewHash),
  );
  if (!eligible.length) return result;
  const mappings = await getDb()
    .select({
      questionVersionId: questionConcepts.questionVersionId,
      conceptIdentity: ontologyConcepts.conceptKey,
      mappingVersion: questionConcepts.mappingVersion,
      qualificationJson: questionConcepts.qualificationJson,
      provenanceJson: questionConcepts.provenanceJson,
      status: questionConcepts.mappingStatus,
    })
    .from(questionConcepts)
    .innerJoin(ontologyConcepts, eq(questionConcepts.conceptId, ontologyConcepts.id))
    .where(
      and(
        inArray(
          questionConcepts.questionVersionId,
          eligible.map((seed) => seed.questionVersionId),
        ),
        eq(questionConcepts.mappingStatus, "APPROVED"),
      ),
    );
  for (const seed of eligible) {
    const rows = mappings.filter(
      (mapping) => mapping.questionVersionId === seed.questionVersionId,
    );
    if (!rows.length) continue;
    const conceptMappingSetHash = await computeConceptMappingSetHash(
      rows.map(toGovernedConceptMapping),
    );
    result.set(seed.questionId, {
      questionVersionId: seed.questionVersionId,
      conceptMappingSetHash,
    });
  }
  return result;
}

async function resolveQuestionVersionBinding(input: Readonly<{
  questionId: string;
  expectedQuestionVersionId: string | null;
  currentVersion: number;
}>) {
  const [version] = await getDb()
    .select({
      id: questionVersions.id,
      questionId: questionVersions.questionId,
      version: questionVersions.version,
      semanticHash: questionVersions.semanticHash,
      humanReviewHash: questionVersions.humanReviewHash,
    })
    .from(questionVersions)
    .where(
      input.expectedQuestionVersionId
        ? eq(questionVersions.id, input.expectedQuestionVersionId)
        : and(
            eq(questionVersions.questionId, input.questionId),
            eq(questionVersions.version, input.currentVersion),
          ),
    )
    .limit(1);
  if (!version || !version.semanticHash || !version.humanReviewHash) {
    if (input.expectedQuestionVersionId) {
      throw new AppError("QuestionVersion was not found.", 404, "QUESTION_VERSION_NOT_FOUND");
    }
    return null;
  }
  if (
    version.questionId !== input.questionId ||
    version.version !== input.currentVersion
  ) {
    throw new AppError(
      "QuestionVersion does not match the current question semantics.",
      409,
      "QUESTION_VERSION_MISMATCH",
    );
  }
  const bindings = await resolveQuestionVersionBindings([
    {
      questionId: input.questionId,
      questionVersionId: version.id,
      semanticHash: version.semanticHash,
      humanReviewHash: version.humanReviewHash,
    },
  ]);
  const binding = bindings.get(input.questionId) ?? null;
  if (!binding) {
    if (input.expectedQuestionVersionId) {
      throw new AppError(
        "QuestionVersion lacks an approved Concept mapping set.",
        409,
        "QUESTION_VERSION_NOT_ELIGIBLE",
      );
    }
    return null;
  }
  if (!input.expectedQuestionVersionId) {
    throw new AppError(
      "A governed QuestionVersion must be supplied for this attempt.",
      409,
      "QUESTION_VERSION_MISMATCH",
    );
  }
  return binding;
}

function toGovernedConceptMapping(row: Readonly<{
  conceptIdentity: string;
  mappingVersion: number;
  qualificationJson: string | null;
  provenanceJson: string | null;
  status: string;
}>): GovernedConceptMapping {
  return {
    conceptIdentity: row.conceptIdentity,
    mappingVersion: Number(row.mappingVersion),
    qualification: parseGovernanceJson(row.qualificationJson),
    provenance: parseGovernanceJson(row.provenanceJson),
    status: "APPROVED",
  };
}

function parseGovernanceJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new AppError(
      "Governed Concept mapping metadata is invalid.",
      409,
      "CONCEPT_MAPPING_SET_MISMATCH",
    );
  }
}

export async function toggleBookmark(input: {
  userId: string;
  targetType: "QUESTION" | "TOPIC" | "SUBJECT";
  targetId: string;
  courseId: string;
}) {
  if (input.targetType === "QUESTION") {
    const [target] = await getDb()
      .select({ id: questions.id })
      .from(questions)
      .innerJoin(
        questionCourses,
        and(
          eq(questionCourses.questionId, questions.id),
          eq(questionCourses.courseId, input.courseId),
        ),
      )
      .where(
        and(
          eq(questions.id, input.targetId),
          eq(questions.status, "PUBLISHED"),
        ),
      )
      .limit(1);
    if (!target) {
      throw new AppError("즐겨찾기 대상을 찾을 수 없습니다.", 404, "BOOKMARK_TARGET_NOT_FOUND");
    }
  }
  const [existing] = await getDb()
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, input.userId),
        eq(bookmarks.targetType, input.targetType),
        eq(bookmarks.targetId, input.targetId),
        eq(bookmarks.courseId, input.courseId),
      ),
    )
    .limit(1);
  if (existing) {
    await getDb().delete(bookmarks).where(eq(bookmarks.id, existing.id));
    return { bookmarked: false };
  }
  await getDb().insert(bookmarks).values({ id: crypto.randomUUID(), ...input });
  return { bookmarked: true };
}

export async function listQuestionBookmarks(userId: string, courseId?: string) {
  return getDb()
    .select({
      id: bookmarks.id,
      courseId: bookmarks.courseId,
      courseSlug: courses.slug,
      questionId: questions.id,
      title: questions.title,
      content: questions.content,
      difficulty: questions.difficulty,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .innerJoin(
      questions,
      and(
        eq(bookmarks.targetType, "QUESTION"),
        eq(bookmarks.targetId, questions.id),
      ),
    )
    .innerJoin(courses, eq(bookmarks.courseId, courses.id))
    .where(
      courseId
        ? and(eq(bookmarks.userId, userId), eq(bookmarks.courseId, courseId))
        : eq(bookmarks.userId, userId),
    )
    .orderBy(desc(bookmarks.createdAt));
}

export async function listWrongNotes(
  userId: string,
  filters: {
    courseId?: string;
    subjectId?: string;
    topicId?: string;
    difficulty?: string;
    mastered?: boolean;
    repeated?: boolean;
  },
) {
  const conditions = [eq(wrongNotes.userId, userId)];
  if (filters.courseId) conditions.push(eq(wrongNotes.courseId, filters.courseId));
  if (filters.difficulty) {
    conditions.push(eq(questions.difficulty, filters.difficulty));
  }
  if (filters.mastered !== undefined) {
    conditions.push(eq(wrongNotes.mastered, filters.mastered));
  }
  if (filters.repeated) conditions.push(gt(wrongNotes.wrongCount, 1));
  if (filters.subjectId) {
    conditions.push(eq(questionSubjects.subjectId, filters.subjectId));
  }
  if (filters.topicId) conditions.push(eq(questionTopics.topicId, filters.topicId));
  return getDb()
    .selectDistinct({
      id: wrongNotes.id,
      questionId: wrongNotes.questionId,
      courseId: wrongNotes.courseId,
      courseSlug: courses.slug,
      title: questions.title,
      content: questions.content,
      difficulty: questions.difficulty,
      wrongCount: wrongNotes.wrongCount,
      mastered: wrongNotes.mastered,
      userMemo: wrongNotes.userMemo,
      updatedAt: wrongNotes.updatedAt,
    })
    .from(wrongNotes)
    .innerJoin(questions, eq(wrongNotes.questionId, questions.id))
    .innerJoin(courses, eq(wrongNotes.courseId, courses.id))
    .leftJoin(questionSubjects, eq(questions.id, questionSubjects.questionId))
    .leftJoin(questionTopics, eq(questions.id, questionTopics.questionId))
    .where(and(...conditions))
    .orderBy(desc(wrongNotes.updatedAt));
}

export async function listWrongQuestionIds(userId: string, courseId: string) {
  const rows = await getDb()
    .select({ questionId: wrongNotes.questionId })
    .from(wrongNotes)
    .where(
      and(
        eq(wrongNotes.userId, userId),
        eq(wrongNotes.courseId, courseId),
        eq(wrongNotes.mastered, false),
      ),
    )
    .orderBy(desc(wrongNotes.updatedAt));
  return rows.map((row) => row.questionId);
}

export async function updateWrongNote(input: {
  id: string;
  userId: string;
  userMemo: string;
  mastered: boolean;
}) {
  const [row] = await getDb()
    .update(wrongNotes)
    .set({
      userMemo: input.userMemo,
      mastered: input.mastered,
      lastReviewedAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(and(eq(wrongNotes.id, input.id), eq(wrongNotes.userId, input.userId)))
    .returning({ id: wrongNotes.id });
  if (!row) {
    throw new AppError("오답노트를 찾을 수 없습니다.", 404, "WRONG_NOTE_NOT_FOUND");
  }
  return row;
}

export async function createQuestionReport(input: {
  userId: string;
  questionId: string;
  reason: string;
  content: string;
}) {
  const [question] = await getDb()
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.id, input.questionId), eq(questions.status, "PUBLISHED")))
    .limit(1);
  if (!question) throw new AppError("문제를 찾을 수 없습니다.", 404, "QUESTION_NOT_FOUND");
  const id = crypto.randomUUID();
  await getDb().insert(questionReports).values({ id, ...input });
  return id;
}

export async function listAdminQuestions(filters: QuestionFilters) {
  const conditions = [];
  if (filters.status) conditions.push(eq(questions.status, filters.status));
  if (filters.type) conditions.push(eq(questions.type, filters.type));
  if (filters.difficulty) conditions.push(eq(questions.difficulty, filters.difficulty));
  if (filters.courseId) conditions.push(eq(questionCourses.courseId, filters.courseId));
  if (filters.subjectId) conditions.push(eq(questionSubjects.subjectId, filters.subjectId));
  if (filters.topicId) conditions.push(eq(questionTopics.topicId, filters.topicId));
  if (filters.createdBy) conditions.push(eq(questions.createdBy, filters.createdBy));
  if (filters.reviewedBy) conditions.push(eq(questions.reviewedBy, filters.reviewedBy));
  if (filters.keyword) {
    conditions.push(
      or(
        like(questions.title, `%${filters.keyword}%`),
        like(questions.content, `%${filters.keyword}%`),
      )!,
    );
  }
  return getDb()
    .selectDistinct({
      id: questions.id,
      title: questions.title,
      type: questions.type,
      difficulty: questions.difficulty,
      status: questions.status,
      version: questions.version,
      isSample: questions.isSample,
      createdBy: questions.createdBy,
      reviewedBy: questions.reviewedBy,
      updatedAt: questions.updatedAt,
    })
    .from(questions)
    .leftJoin(questionCourses, eq(questions.id, questionCourses.questionId))
    .leftJoin(questionSubjects, eq(questions.id, questionSubjects.questionId))
    .leftJoin(questionTopics, eq(questions.id, questionTopics.questionId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(questions.updatedAt))
    .limit(Math.min(filters.limit ?? 100, 200));
}

export async function getAdminQuestion(questionId: string) {
  const [question] = await getDb()
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!question) return null;
  const [choices, courseRows, subjectRows, topicRows, versions] =
    await Promise.all([
      getDb()
        .select()
        .from(questionChoices)
        .where(eq(questionChoices.questionId, questionId))
        .orderBy(asc(questionChoices.displayOrder)),
      getDb().select().from(questionCourses).where(eq(questionCourses.questionId, questionId)),
      getDb().select().from(questionSubjects).where(eq(questionSubjects.questionId, questionId)),
      getDb().select().from(questionTopics).where(eq(questionTopics.questionId, questionId)),
      getDb()
        .select()
        .from(questionVersions)
        .where(eq(questionVersions.questionId, questionId))
        .orderBy(desc(questionVersions.version)),
    ]);
  return {
    ...question,
    choices,
    courseIds: courseRows.map((row) => row.courseId),
    subjectIds: subjectRows.map((row) => row.subjectId),
    topicIds: topicRows.map((row) => row.topicId),
    versions,
  };
}

export async function saveQuestion(input: QuestionInput, actorUserId: string) {
  if (input.subjectIds.length) {
    const subjectRows = await getDb()
      .select({ id: subjects.id, courseId: subjects.courseId })
      .from(subjects)
      .where(inArray(subjects.id, input.subjectIds));
    if (
      subjectRows.length !== new Set(input.subjectIds).size ||
      subjectRows.some((subject) => !input.courseIds.includes(subject.courseId))
    ) {
      throw new AppError(
        "선택한 과목이 연결 과정에 속하지 않습니다.",
        400,
        "INVALID_QUESTION_SUBJECT_SCOPE",
      );
    }
  }
  if (input.topicIds.length) {
    const topicRows = await getDb()
      .select({ id: topics.id, subjectId: topics.subjectId })
      .from(topics)
      .where(inArray(topics.id, input.topicIds));
    if (
      topicRows.length !== new Set(input.topicIds).size ||
      topicRows.some((topic) => !input.subjectIds.includes(topic.subjectId))
    ) {
      throw new AppError(
        "선택한 주제가 연결 과목에 속하지 않습니다.",
        400,
        "INVALID_QUESTION_TOPIC_SCOPE",
      );
    }
  }
  const id = input.id ?? crypto.randomUUID();
  const existing = input.id ? await getAdminQuestion(input.id) : null;
  if (input.id && !existing) {
    throw new AppError("문제를 찾을 수 없습니다.", 404, "QUESTION_NOT_FOUND");
  }
  if (existing) {
    throw new AppError(
      "Semantic question updates require an explicit governed version operation.",
      500,
      "QUESTION_GOVERNED_VERSION_REQUIRED",
    );
  }
  const version = 1;
  const values = {
    title: input.title,
    content: input.content,
    type: input.type,
    difficulty: input.difficulty,
    explanation: input.explanation,
    wrongAnswerExplanation: input.wrongAnswerExplanation,
    source: input.source || null,
    sourceDate: input.sourceDate || null,
    answerConfigJson: input.answerConfigJson,
    version,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  const operations: BatchItem<"sqlite">[] = [];
  if (existing) {
    operations.push(
      getDb().update(questions).set(values).where(eq(questions.id, id)),
      getDb().delete(questionChoices).where(eq(questionChoices.questionId, id)),
      getDb().delete(questionCourses).where(eq(questionCourses.questionId, id)),
      getDb().delete(questionSubjects).where(eq(questionSubjects.questionId, id)),
      getDb().delete(questionTopics).where(eq(questionTopics.questionId, id)),
    );
  } else {
    operations.push(
      getDb().insert(questions).values({
        id,
        ...values,
        status: "DRAFT",
        createdBy: actorUserId,
      }),
    );
  }
  if (input.choices.length) {
    operations.push(
      getDb().insert(questionChoices).values(
        input.choices.map((choice) => ({
          id: choice.id ?? crypto.randomUUID(),
          questionId: id,
          content: choice.content,
          displayOrder: choice.displayOrder,
          isCorrect: choice.isCorrect,
          explanation: choice.explanation,
        })),
      ),
    );
  }
  operations.push(
    getDb().insert(questionCourses).values(
      input.courseIds.map((courseId) => ({
        questionId: id,
        courseId,
        weight: 100,
      })),
    ),
  );
  if (input.subjectIds.length) {
    operations.push(
      getDb().insert(questionSubjects).values(
        input.subjectIds.map((subjectId) => ({ questionId: id, subjectId })),
      ),
    );
  }
  if (input.topicIds.length) {
    operations.push(
      getDb().insert(questionTopics).values(
        input.topicIds.map((topicId) => ({ questionId: id, topicId })),
      ),
    );
  }
  operations.push(
    getDb().insert(questionVersions).values({
      id: crypto.randomUUID(),
      questionId: id,
      version,
      snapshotJson: createQuestionVersionSnapshot({ ...input, id, version }),
      createdBy: actorUserId,
    }),
    createAuditInsert({
      actorUserId,
      action: existing ? "QUESTION_UPDATED" : "QUESTION_CREATED",
      resourceType: "QUESTION",
      resourceId: id,
      metadata: { version },
    }),
  );
  await getDb().batch(batchItems(operations));
  return id;
}

export async function cloneQuestion(questionId: string, actorUserId: string) {
  const source = await getAdminQuestion(questionId);
  if (!source) throw new AppError("문제를 찾을 수 없습니다.", 404, "QUESTION_NOT_FOUND");
  return saveQuestion(
    {
      title: `${source.title} (복제본)`,
      content: source.content,
      type: source.type as QuestionInput["type"],
      difficulty: source.difficulty as QuestionInput["difficulty"],
      explanation: source.explanation,
      wrongAnswerExplanation: source.wrongAnswerExplanation,
      source: source.source ?? "",
      sourceDate: source.sourceDate ?? "",
      answerConfigJson: source.answerConfigJson,
      choices: source.choices.map((choice) => ({
        content: choice.content,
        displayOrder: choice.displayOrder,
        isCorrect: choice.isCorrect,
        explanation: choice.explanation,
      })),
      courseIds: source.courseIds,
      subjectIds: source.subjectIds,
      topicIds: source.topicIds,
    },
    actorUserId,
  );
}

export async function transitionQuestion(input: {
  questionId: string;
  action: WorkflowAction;
  comment: string;
  actorUserId: string;
  actorRoles: string[];
}) {
  const question = await getAdminQuestion(input.questionId);
  if (!question) throw new AppError("문제를 찾을 수 없습니다.", 404, "QUESTION_NOT_FOUND");
  const nextStatus = resolveQuestionTransition({
    action: input.action,
    status: question.status as QuestionStatus,
    roles: input.actorRoles,
    actorId: input.actorUserId,
    createdBy: question.createdBy,
  });
  if (["APPROVE", "PUBLISH"].includes(input.action)) {
    const currentVersion = question.versions.find(
      (version) => version.version === question.version,
    );
    assertGovernedQuestionApproval(currentVersion ?? {});
  }
  const isReview = ["START_REVIEW", "APPROVE", "REJECT"].includes(input.action);
  await getDb()
    .update(questions)
    .set({
      status: nextStatus,
      reviewedBy: isReview ? input.actorUserId : question.reviewedBy,
      publishedAt: nextStatus === "PUBLISHED" ? sql`CURRENT_TIMESTAMP` : question.publishedAt,
      archivedAt: nextStatus === "ARCHIVED" ? sql`CURRENT_TIMESTAMP` : null,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(questions.id, input.questionId));
  await getDb().insert(questionVersions).values({
    id: crypto.randomUUID(),
    questionId: input.questionId,
    version: question.version,
    snapshotJson: createQuestionVersionSnapshot({ ...question, status: nextStatus }),
    reviewComment: input.comment,
    createdBy: input.actorUserId,
  }).onConflictDoUpdate({
    target: [questionVersions.questionId, questionVersions.version],
    set: { reviewComment: input.comment },
  });
  return nextStatus;
}

export async function listQuestionReports() {
  return getDb()
    .select({
      id: questionReports.id,
      questionId: questionReports.questionId,
      questionTitle: questions.title,
      reason: questionReports.reason,
      content: questionReports.content,
      status: questionReports.status,
      createdAt: questionReports.createdAt,
    })
    .from(questionReports)
    .innerJoin(questions, eq(questionReports.questionId, questions.id))
    .orderBy(desc(questionReports.createdAt));
}

export async function updateQuestionReport(input: {
  id: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
  resolutionNote: string;
  actorUserId: string;
}) {
  await getDb()
    .update(questionReports)
    .set({
      status: input.status,
      resolutionNote: input.resolutionNote,
      handledBy: input.actorUserId,
      handledAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(questionReports.id, input.id));
}
