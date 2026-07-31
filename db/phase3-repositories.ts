import {
  and,
  asc,
  desc,
  eq,
  gte,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from ".";
import {
  courses,
  contents,
  courseLessons,
  learningActivities,
  levelContents,
  levels,
  mockExamAnswers,
  mockExamAttempts,
  mockExamQuestions,
  mockExamSections,
  mockExams,
  questionAttempts,
  questionChoices,
  questionCourses,
  questionSubjects,
  questionTopics,
  questions,
  reviewSchedules,
  subjects,
  topics,
  userCourseEnrollments,
  userCourseLessonProgress,
  userLearningSettings,
  userLevelProgress,
  wrongNotes,
} from "./schema";
import { AppError } from "@/lib/errors";
import {
  applyLevelResult,
  assertLevelAccessible,
  initialLevelStatus,
  type LevelStatus,
} from "@/lib/services/level-service";
import {
  defaultReviewScheduler,
  type ReviewState,
} from "@/lib/services/review-scheduler";
import {
  assertExamInProgress,
  calculateExamResult,
  shouldAutoSubmit,
  toPublicExamQuestion,
} from "@/lib/services/mock-exam-service";
import {
  gradeQuestion,
  requireSupportedGrade,
  type QuestionType,
  type ShortAnswerConfig,
} from "@/lib/services/grading-service";
import {
  average,
  countStudyStreak,
  safeRate,
} from "@/lib/services/statistics-service";
import {
  recommendationService,
  type RecommendationCandidate,
} from "@/lib/services/recommendation-service";
import { getPublishedCurriculumPathForCourse } from "@/db/curriculum-repositories";

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

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(error.message)
  );
}

export async function ensureLevelProgress(userId: string, courseId: string) {
  const courseLevels = await getDb()
    .select({ id: levels.id, requiredLevelId: levels.requiredLevelId })
    .from(levels)
    .where(
      and(
        eq(levels.courseId, courseId),
        eq(levels.active, true),
        eq(levels.published, true),
      ),
    );
  for (const level of courseLevels) {
    await getDb()
      .insert(userLevelProgress)
      .values({
        id: crypto.randomUUID(),
        userId,
        courseId,
        levelId: level.id,
        status: initialLevelStatus(level.requiredLevelId),
      })
      .onConflictDoNothing();
  }
}

export async function listCourseLevels(userId: string, courseId: string) {
  await ensureLevelProgress(userId, courseId);
  return getDb()
    .select({
      id: levels.id,
      courseId: levels.courseId,
      code: levels.code,
      number: levels.number,
      title: levels.title,
      description: levels.description,
      passingScore: levels.passingScore,
      requiredLevelId: levels.requiredLevelId,
      displayOrder: levels.displayOrder,
      status: userLevelProgress.status,
      bestScore: userLevelProgress.bestScore,
      attemptCount: userLevelProgress.attemptCount,
      completedAt: userLevelProgress.completedAt,
      masteredAt: userLevelProgress.masteredAt,
    })
    .from(levels)
    .innerJoin(
      userLevelProgress,
      and(
        eq(levels.id, userLevelProgress.levelId),
        eq(userLevelProgress.userId, userId),
        eq(userLevelProgress.courseId, courseId),
      ),
    )
    .where(
      and(
        eq(levels.courseId, courseId),
        eq(levels.active, true),
        eq(levels.published, true),
      ),
    )
    .orderBy(asc(levels.displayOrder));
}

export async function listCourseLevelsForOverview(
  userId: string,
  courseId: string,
) {
  const rows = await getDb()
    .select({
      id: levels.id,
      courseId: levels.courseId,
      code: levels.code,
      number: levels.number,
      title: levels.title,
      description: levels.description,
      passingScore: levels.passingScore,
      requiredLevelId: levels.requiredLevelId,
      displayOrder: levels.displayOrder,
      status: userLevelProgress.status,
      bestScore: userLevelProgress.bestScore,
      attemptCount: userLevelProgress.attemptCount,
      completedAt: userLevelProgress.completedAt,
      masteredAt: userLevelProgress.masteredAt,
    })
    .from(levels)
    .leftJoin(
      userLevelProgress,
      and(
        eq(levels.id, userLevelProgress.levelId),
        eq(userLevelProgress.userId, userId),
        eq(userLevelProgress.courseId, courseId),
      ),
    )
    .where(
      and(
        eq(levels.courseId, courseId),
        eq(levels.active, true),
        eq(levels.published, true),
      ),
    )
    .orderBy(asc(levels.displayOrder));

  return rows.map((row) => ({
    ...row,
    status: (row.status ?? initialLevelStatus(row.requiredLevelId)) as LevelStatus,
    bestScore: row.bestScore ?? 0,
    attemptCount: row.attemptCount ?? 0,
  }));
}

export async function getAccessibleLevel(userId: string, levelId: string) {
  const [row] = await getDb()
    .select({
      id: levels.id,
      courseId: levels.courseId,
      title: levels.title,
      number: levels.number,
      passingScore: levels.passingScore,
      status: userLevelProgress.status,
      bestScore: userLevelProgress.bestScore,
      attemptCount: userLevelProgress.attemptCount,
      completedAt: userLevelProgress.completedAt,
      masteredAt: userLevelProgress.masteredAt,
    })
    .from(levels)
    .innerJoin(
      userLevelProgress,
      and(
        eq(levels.id, userLevelProgress.levelId),
        eq(userLevelProgress.userId, userId),
      ),
    )
    .innerJoin(
      userCourseEnrollments,
      and(
        eq(levels.courseId, userCourseEnrollments.courseId),
        eq(userCourseEnrollments.userId, userId),
      ),
    )
    .where(
      and(
        eq(levels.id, levelId),
        eq(levels.active, true),
        eq(levels.published, true),
        inArray(userCourseEnrollments.status, ["ACTIVE", "PAUSED"]),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("단계를 찾을 수 없습니다.", 404, "LEVEL_NOT_FOUND");
  assertLevelAccessible(row.status as LevelStatus);
  return row;
}

export async function startLevel(userId: string, levelId: string) {
  const level = await getAccessibleLevel(userId, levelId);
  if (level.status === "AVAILABLE") {
    await getDb()
      .update(userLevelProgress)
      .set({ status: "IN_PROGRESS", updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(
        and(
          eq(userLevelProgress.userId, userId),
          eq(userLevelProgress.levelId, levelId),
        ),
      );
  }
  return level;
}

export async function listLevelQuestionIds(levelId: string) {
  const rows = await getDb()
    .select({ questionId: levelContents.contentId })
    .from(levelContents)
    .where(
      and(
        eq(levelContents.levelId, levelId),
        eq(levelContents.contentType, "QUESTION"),
      ),
    )
    .orderBy(asc(levelContents.displayOrder));
  return rows.map((row) => row.questionId);
}

export async function completeLevel(userId: string, levelId: string) {
  const level = await getAccessibleLevel(userId, levelId);
  const questionIds = await listLevelQuestionIds(levelId);
  if (!questionIds.length) {
    throw new AppError("단계에 평가 문제가 없습니다.", 409, "LEVEL_EMPTY");
  }
  const attempts = await getDb()
    .select({
      questionId: questionAttempts.questionId,
      isCorrect: questionAttempts.isCorrect,
      attemptedAt: questionAttempts.attemptedAt,
    })
    .from(questionAttempts)
    .where(
      and(
        eq(questionAttempts.userId, userId),
        eq(questionAttempts.courseId, level.courseId),
        inArray(questionAttempts.questionId, questionIds),
      ),
    )
    .orderBy(desc(questionAttempts.attemptedAt));
  const latest = new Map<string, boolean>();
  for (const attempt of attempts) {
    if (!latest.has(attempt.questionId)) {
      latest.set(attempt.questionId, attempt.isCorrect);
    }
  }
  if (latest.size < questionIds.length) {
    throw new AppError(
      "필수 문제를 모두 푼 뒤 단계를 완료할 수 있습니다.",
      409,
      "LEVEL_REQUIREMENTS_INCOMPLETE",
    );
  }
  const score = safeRate(
    [...latest.values()].filter(Boolean).length,
    questionIds.length,
  );
  const next = applyLevelResult(
    {
      status: level.status as LevelStatus,
      bestScore: level.bestScore,
      attemptCount: level.attemptCount,
      completedAt: level.completedAt,
      masteredAt: level.masteredAt,
    },
    score,
    level.passingScore,
  );
  const [nextLevel] = await getDb()
    .select({ id: levels.id })
    .from(levels)
    .where(
      and(
        eq(levels.courseId, level.courseId),
        eq(levels.requiredLevelId, levelId),
        eq(levels.active, true),
        eq(levels.published, true),
      ),
    )
    .limit(1);
  const courseLevelRows = await listCourseLevels(userId, level.courseId);
  const completedBefore = courseLevelRows.filter((item) =>
    ["COMPLETED", "MASTERED"].includes(item.status),
  ).length;
  const completedAfter =
    completedBefore +
    (next.passed &&
    !["COMPLETED", "MASTERED"].includes(level.status)
      ? 1
      : 0);
  const operations: BatchItem<"sqlite">[] = [
    getDb()
      .update(userLevelProgress)
      .set({ ...next.progress, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(
        and(
          eq(userLevelProgress.userId, userId),
          eq(userLevelProgress.levelId, levelId),
        ),
      ),
    getDb()
      .update(userCourseEnrollments)
      .set({
        currentLevel:
          next.unlockNext && nextLevel ? level.number + 1 : level.number,
        progressPercent: safeRate(completedAfter, courseLevelRows.length),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(userCourseEnrollments.userId, userId),
          eq(userCourseEnrollments.courseId, level.courseId),
        ),
      ),
    getDb().insert(learningActivities).values({
      id: crypto.randomUUID(),
      userId,
      courseId: level.courseId,
      activityType: next.passed ? "LEVEL_COMPLETED" : "LEVEL_ATTEMPTED",
      targetId: levelId,
      metadataJson: JSON.stringify({ score, passed: next.passed }),
    }),
  ];
  if (next.unlockNext && nextLevel) {
    operations.push(
      getDb()
        .update(userLevelProgress)
        .set({ status: "AVAILABLE", updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(
          and(
            eq(userLevelProgress.userId, userId),
            eq(userLevelProgress.levelId, nextLevel.id),
            eq(userLevelProgress.status, "LOCKED"),
          ),
        ),
    );
  }
  await getDb().batch(batchItems(operations));
  return { score, passed: next.passed, nextLevelUnlocked: Boolean(next.unlockNext && nextLevel) };
}

export async function listDueReviews(userId: string, courseId?: string) {
  const now = new Date().toISOString();
  const conditions = [
    eq(reviewSchedules.userId, userId),
    lte(reviewSchedules.nextReviewAt, now),
    inArray(reviewSchedules.status, ["DUE", "SCHEDULED"]),
  ];
  if (courseId) conditions.push(eq(reviewSchedules.courseId, courseId));
  return getDb()
    .select({
      id: reviewSchedules.id,
      courseId: reviewSchedules.courseId,
      courseName: courses.shortName,
      courseSlug: courses.slug,
      targetType: reviewSchedules.targetType,
      targetId: reviewSchedules.targetId,
      nextReviewAt: reviewSchedules.nextReviewAt,
      intervalDays: reviewSchedules.intervalDays,
      consecutiveWrong: reviewSchedules.consecutiveWrong,
      reviewCount: reviewSchedules.reviewCount,
      questionTitle: questions.title,
    })
    .from(reviewSchedules)
    .innerJoin(courses, eq(reviewSchedules.courseId, courses.id))
    .leftJoin(
      questions,
      and(
        eq(reviewSchedules.targetType, "QUESTION"),
        eq(reviewSchedules.targetId, questions.id),
      ),
    )
    .where(and(...conditions))
    .orderBy(asc(reviewSchedules.nextReviewAt));
}

export async function countDueReviewsForCourse(
  userId: string,
  courseId: string,
) {
  const now = new Date().toISOString();
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(reviewSchedules)
    .where(
      and(
        eq(reviewSchedules.userId, userId),
        eq(reviewSchedules.courseId, courseId),
        lte(reviewSchedules.nextReviewAt, now),
        inArray(reviewSchedules.status, ["DUE", "SCHEDULED"]),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function getReviewSummary(userId: string) {
  const due = await listDueReviews(userId);
  const now = Date.now();
  const todayRange = utcDayRange();
  const [completedRow] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(reviewSchedules)
    .where(
      and(
        eq(reviewSchedules.userId, userId),
        gte(reviewSchedules.lastReviewedAt, todayRange.start),
        lt(reviewSchedules.lastReviewedAt, todayRange.end),
        gt(reviewSchedules.intervalDays, 0),
      ),
    );
  const byCourse = new Map<
    string,
    { name: string; slug: string; count: number }
  >();
  let overdue = 0;
  for (const item of due) {
    if (new Date(item.nextReviewAt).getTime() < now - 86_400_000) overdue += 1;
    const current = byCourse.get(item.courseId) ?? {
      name: item.courseName,
      slug: item.courseSlug,
      count: 0,
    };
    current.count += 1;
    byCourse.set(item.courseId, current);
  }
  return {
    dueCount: due.length,
    overdueCount: overdue,
    estimatedMinutes: due.length * 2,
    completedToday: Number(completedRow?.count ?? 0),
    completionRate: safeRate(
      Number(completedRow?.count ?? 0),
      Number(completedRow?.count ?? 0) + due.length,
    ),
    byCourse: [...byCourse.entries()].map(([courseId, value]) => ({
      courseId,
      ...value,
    })),
    items: due,
  };
}

async function getDashboardReviewSummary(userId: string) {
  const now = new Date().toISOString();
  const overdueCutoff = new Date(Date.now() - 86_400_000).toISOString();
  const todayRange = utcDayRange();
  const [summaryRows, completedRows, byCourseRows] = await Promise.all([
    getDb()
      .select({
        dueCount: sql<number>`count(*)`,
        overdueCount: sql<number>`coalesce(sum(case when ${reviewSchedules.nextReviewAt} < ${overdueCutoff} then 1 else 0 end), 0)`,
      })
      .from(reviewSchedules)
      .where(
        and(
          eq(reviewSchedules.userId, userId),
          lte(reviewSchedules.nextReviewAt, now),
          inArray(reviewSchedules.status, ["DUE", "SCHEDULED"]),
        ),
      ),
    getDb()
      .select({ count: sql<number>`count(*)` })
      .from(reviewSchedules)
      .where(
        and(
          eq(reviewSchedules.userId, userId),
          gte(reviewSchedules.lastReviewedAt, todayRange.start),
          lt(reviewSchedules.lastReviewedAt, todayRange.end),
          gt(reviewSchedules.intervalDays, 0),
        ),
      ),
    getDb()
      .select({
        courseId: reviewSchedules.courseId,
        name: courses.shortName,
        slug: courses.slug,
        count: sql<number>`count(*)`,
      })
      .from(reviewSchedules)
      .innerJoin(courses, eq(reviewSchedules.courseId, courses.id))
      .where(
        and(
          eq(reviewSchedules.userId, userId),
          lte(reviewSchedules.nextReviewAt, now),
          inArray(reviewSchedules.status, ["DUE", "SCHEDULED"]),
        ),
      )
      .groupBy(reviewSchedules.courseId, courses.shortName, courses.slug)
      .limit(5),
  ]);
  const summaryRow = summaryRows[0];
  const completedRow = completedRows[0];
  const dueCount = Number(summaryRow?.dueCount ?? 0);
  const completedToday = Number(completedRow?.count ?? 0);
  return {
    dueCount,
    overdueCount: Number(summaryRow?.overdueCount ?? 0),
    estimatedMinutes: dueCount * 2,
    completedToday,
    completionRate: safeRate(completedToday, completedToday + dueCount),
    byCourse: byCourseRows.map((row) => ({
      courseId: row.courseId,
      name: row.name,
      slug: row.slug,
      count: Number(row.count),
    })),
    items: [],
  };
}

export async function updateReviewScheduleForAttempt(input: {
  userId: string;
  courseId: string;
  questionId: string;
  correct: boolean;
}) {
  const [current] = await getDb()
    .select()
    .from(reviewSchedules)
    .where(
      and(
        eq(reviewSchedules.userId, input.userId),
        eq(reviewSchedules.courseId, input.courseId),
        eq(reviewSchedules.targetType, "QUESTION"),
        eq(reviewSchedules.targetId, input.questionId),
      ),
    )
    .limit(1);
  const outcome = defaultReviewScheduler.schedule(
    current
      ? ({
          intervalDays: current.intervalDays,
          easeFactor: current.easeFactor,
          consecutiveCorrect: current.consecutiveCorrect,
          consecutiveWrong: current.consecutiveWrong,
          reviewCount: current.reviewCount,
        } satisfies ReviewState)
      : null,
    input.correct,
  );
  await getDb()
    .insert(reviewSchedules)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      courseId: input.courseId,
      targetType: "QUESTION",
      targetId: input.questionId,
      lastReviewedAt: sql`CURRENT_TIMESTAMP`,
      ...outcome,
    })
    .onConflictDoUpdate({
      target: [
        reviewSchedules.userId,
        reviewSchedules.courseId,
        reviewSchedules.targetType,
        reviewSchedules.targetId,
      ],
      set: {
        lastReviewedAt: sql`CURRENT_TIMESTAMP`,
        nextReviewAt: outcome.nextReviewAt,
        intervalDays: outcome.intervalDays,
        easeFactor: outcome.easeFactor,
        consecutiveCorrect: outcome.consecutiveCorrect,
        consecutiveWrong: outcome.consecutiveWrong,
        reviewCount: outcome.reviewCount,
        status: outcome.status,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    });
  return outcome;
}

export async function listPublicMockExams(userId: string, courseId?: string) {
  const conditions = [
    eq(mockExams.published, true),
    eq(mockExams.status, "OPEN"),
    inArray(userCourseEnrollments.status, ["ACTIVE", "PAUSED"]),
  ];
  if (courseId) conditions.push(eq(mockExams.courseId, courseId));
  const rows = await getDb()
    .select({
      id: mockExams.id,
      courseId: mockExams.courseId,
      courseSlug: courses.slug,
      courseName: courses.shortName,
      title: mockExams.title,
      description: mockExams.description,
      examType: mockExams.examType,
      questionCount: mockExams.questionCount,
      timeLimitMinutes: mockExams.timeLimitMinutes,
      passingScore: mockExams.passingScore,
      maxAttempts: mockExams.maxAttempts,
    })
    .from(mockExams)
    .innerJoin(courses, eq(mockExams.courseId, courses.id))
    .innerJoin(
      userCourseEnrollments,
      and(
        eq(mockExams.courseId, userCourseEnrollments.courseId),
        eq(userCourseEnrollments.userId, userId),
      ),
    )
    .where(and(...conditions))
    .orderBy(asc(courses.displayOrder));
  const counts = await getDb()
    .select({
      mockExamId: mockExamAttempts.mockExamId,
      count: sql<number>`count(*)`,
      bestScore: sql<number>`coalesce(max(${mockExamAttempts.score}), 0)`,
    })
    .from(mockExamAttempts)
    .where(eq(mockExamAttempts.userId, userId))
    .groupBy(mockExamAttempts.mockExamId);
  return rows.map((row) => ({
    ...row,
    attemptCount: Number(
      counts.find((count) => count.mockExamId === row.id)?.count ?? 0,
    ),
    bestScore: Number(
      counts.find((count) => count.mockExamId === row.id)?.bestScore ?? 0,
    ),
  }));
}

export async function countPublicMockExamsForCourse(
  userId: string,
  courseId: string,
) {
  const conditions = [
    eq(mockExams.courseId, courseId),
    eq(mockExams.published, true),
    eq(mockExams.status, "OPEN"),
    inArray(userCourseEnrollments.status, ["ACTIVE", "PAUSED"]),
  ];
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(mockExams)
    .innerJoin(
      userCourseEnrollments,
      and(
        eq(mockExams.courseId, userCourseEnrollments.courseId),
        eq(userCourseEnrollments.userId, userId),
      ),
    )
    .where(and(...conditions));
  return Number(row?.count ?? 0);
}

function examIsOpen(exam: {
  published: boolean;
  status: string;
  startAt: string | null;
  endAt: string | null;
}) {
  const now = Date.now();
  return (
    exam.published &&
    exam.status === "OPEN" &&
    (!exam.startAt || new Date(exam.startAt).getTime() <= now) &&
    (!exam.endAt || new Date(exam.endAt).getTime() > now)
  );
}

export async function startMockExam(userId: string, mockExamId: string) {
  const [exam] = await getDb()
    .select()
    .from(mockExams)
    .where(eq(mockExams.id, mockExamId))
    .limit(1);
  if (!exam || !examIsOpen(exam)) {
    throw new AppError("응시 가능한 모의고사가 아닙니다.", 409, "EXAM_NOT_OPEN");
  }
  const [enrollment] = await getDb()
    .select({ id: userCourseEnrollments.id })
    .from(userCourseEnrollments)
    .where(
      and(
        eq(userCourseEnrollments.userId, userId),
        eq(userCourseEnrollments.courseId, exam.courseId),
        inArray(userCourseEnrollments.status, ["ACTIVE", "PAUSED"]),
      ),
    )
    .limit(1);
  if (!enrollment) {
    throw new AppError("수강 과정의 시험만 응시할 수 있습니다.", 403, "EXAM_FORBIDDEN");
  }
  const [{ count }] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(mockExamAttempts)
    .where(
      and(
        eq(mockExamAttempts.userId, userId),
        eq(mockExamAttempts.mockExamId, mockExamId),
      ),
    );
  if (Number(count) >= exam.maxAttempts) {
    throw new AppError("최대 응시 횟수를 초과했습니다.", 409, "EXAM_ATTEMPT_LIMIT");
  }
  const questionRows = await getDb()
    .select({ questionId: mockExamQuestions.questionId })
    .from(mockExamQuestions)
    .innerJoin(questions, eq(mockExamQuestions.questionId, questions.id))
    .where(
      and(
        eq(mockExamQuestions.mockExamId, mockExamId),
        eq(questions.status, "PUBLISHED"),
      ),
    )
    .orderBy(asc(mockExamQuestions.displayOrder))
    .limit(exam.questionCount);
  if (questionRows.length !== exam.questionCount) {
    throw new AppError("시험 문제 구성이 완료되지 않았습니다.", 409, "EXAM_INCOMPLETE");
  }
  const id = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + exam.timeLimitMinutes * 60_000,
  ).toISOString();
  const operations: BatchItem<"sqlite">[] = [
    getDb().insert(mockExamAttempts).values({
      id,
      mockExamId,
      userId,
      expiresAt,
      unansweredCount: questionRows.length,
    }),
    ...questionRows.map((row) =>
      getDb().insert(mockExamAnswers).values({
        id: crypto.randomUUID(),
        attemptId: id,
        questionId: row.questionId,
      }),
    ),
  ];
  await getDb().batch(batchItems(operations));
  return { id, expiresAt };
}

function deterministicRank(seed: string, value: string) {
  let hash = 2166136261;
  for (const char of `${seed}:${value}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export async function getMockExamAttempt(userId: string, attemptId: string) {
  const [attempt] = await getDb()
    .select({
      id: mockExamAttempts.id,
      mockExamId: mockExamAttempts.mockExamId,
      userId: mockExamAttempts.userId,
      startedAt: mockExamAttempts.startedAt,
      expiresAt: mockExamAttempts.expiresAt,
      submittedAt: mockExamAttempts.submittedAt,
      status: mockExamAttempts.status,
      score: mockExamAttempts.score,
      correctCount: mockExamAttempts.correctCount,
      wrongCount: mockExamAttempts.wrongCount,
      unansweredCount: mockExamAttempts.unansweredCount,
      title: mockExams.title,
      courseId: mockExams.courseId,
      resultOpenAt: mockExams.resultOpenAt,
      randomizeQuestions: mockExams.randomizeQuestions,
      randomizeChoices: mockExams.randomizeChoices,
    })
    .from(mockExamAttempts)
    .innerJoin(mockExams, eq(mockExamAttempts.mockExamId, mockExams.id))
    .where(
      and(
        eq(mockExamAttempts.id, attemptId),
        eq(mockExamAttempts.userId, userId),
      ),
    )
    .limit(1);
  if (!attempt) throw new AppError("시험 기록을 찾을 수 없습니다.", 404, "EXAM_ATTEMPT_NOT_FOUND");
  if (
    attempt.status === "IN_PROGRESS" &&
    shouldAutoSubmit(attempt.expiresAt)
  ) {
    await submitMockExam(userId, attemptId, true);
    return getMockExamAttempt(userId, attemptId);
  }
  const rows = await getDb()
    .select({
      id: questions.id,
      title: questions.title,
      content: questions.content,
      type: questions.type,
      difficulty: questions.difficulty,
      explanation: questions.explanation,
      wrongAnswerExplanation: questions.wrongAnswerExplanation,
      answerData: mockExamAnswers.answerData,
      isCorrect: mockExamAnswers.isCorrect,
      earnedScore: mockExamAnswers.score,
      possibleScore: mockExamQuestions.score,
      displayOrder: mockExamQuestions.displayOrder,
    })
    .from(mockExamAnswers)
    .innerJoin(questions, eq(mockExamAnswers.questionId, questions.id))
    .innerJoin(
      mockExamQuestions,
      and(
        eq(mockExamQuestions.mockExamId, attempt.mockExamId),
        eq(mockExamQuestions.questionId, questions.id),
      ),
    )
    .where(eq(mockExamAnswers.attemptId, attemptId))
    .orderBy(asc(mockExamQuestions.displayOrder));
  const choiceRows = rows.length
    ? await getDb()
        .select({
          id: questionChoices.id,
          questionId: questionChoices.questionId,
          content: questionChoices.content,
          displayOrder: questionChoices.displayOrder,
          isCorrect: questionChoices.isCorrect,
          explanation: questionChoices.explanation,
        })
        .from(questionChoices)
        .where(inArray(questionChoices.questionId, rows.map((row) => row.id)))
        .orderBy(asc(questionChoices.displayOrder))
    : [];
  const submitted = attempt.status !== "IN_PROGRESS";
  const resultsAvailable =
    submitted &&
    (!attempt.resultOpenAt ||
      new Date(attempt.resultOpenAt).getTime() <= Date.now());
  let publicRows = rows.map((row) => {
    let choices = choiceRows.filter((choice) => choice.questionId === row.id);
    if (attempt.randomizeChoices) {
      choices = [...choices].sort(
        (a, b) =>
          deterministicRank(attempt.id, a.id) -
          deterministicRank(attempt.id, b.id),
      );
    }
    if (!resultsAvailable) {
      return {
        ...toPublicExamQuestion(row),
        explanation: undefined,
        wrongAnswerExplanation: undefined,
        isCorrect: undefined,
        earnedScore: undefined,
        choices:
          row.type === "SHORT_ANSWER"
            ? []
            : choices.map((choice) => toPublicExamQuestion(choice)),
      };
    }
    return {
      ...row,
      choices,
      correctAnswer: choices
        .filter((choice) => choice.isCorrect)
        .map((choice) => choice.content),
    };
  });
  if (attempt.randomizeQuestions) {
    publicRows = [...publicRows].sort(
      (a, b) =>
        deterministicRank(attempt.id, a.id) -
        deterministicRank(attempt.id, b.id),
    );
  }
  let analysis:
    | {
        bySubject: Array<{
          id: string;
          name: string;
          total: number;
          correct: number;
          accuracy: number;
        }>;
        byTopic: Array<{
          id: string;
          name: string;
          total: number;
          correct: number;
          accuracy: number;
        }>;
      }
    | undefined;
  if (resultsAvailable && rows.length) {
    const questionIds = rows.map((row) => row.id);
    const [subjectRows, topicRows] = await Promise.all([
      getDb()
        .select({
          questionId: questionSubjects.questionId,
          id: subjects.id,
          name: subjects.name,
        })
        .from(questionSubjects)
        .innerJoin(subjects, eq(questionSubjects.subjectId, subjects.id))
        .where(
          and(
            inArray(questionSubjects.questionId, questionIds),
            eq(subjects.courseId, attempt.courseId),
          ),
        ),
      getDb()
        .select({
          questionId: questionTopics.questionId,
          id: topics.id,
          name: topics.name,
        })
        .from(questionTopics)
        .innerJoin(topics, eq(questionTopics.topicId, topics.id))
        .innerJoin(subjects, eq(topics.subjectId, subjects.id))
        .where(
          and(
            inArray(questionTopics.questionId, questionIds),
            eq(subjects.courseId, attempt.courseId),
          ),
        ),
    ]);
    const summarize = (
      mappings: Array<{ questionId: string; id: string; name: string }>,
    ) => {
      const groups = new Map<
        string,
        { id: string; name: string; total: number; correct: number }
      >();
      for (const row of rows) {
        const mapping = mappings.find(
          (item) => item.questionId === row.id,
        );
        if (!mapping) continue;
        const group = groups.get(mapping.id) ?? {
          id: mapping.id,
          name: mapping.name,
          total: 0,
          correct: 0,
        };
        group.total += 1;
        if (row.isCorrect) group.correct += 1;
        groups.set(mapping.id, group);
      }
      return [...groups.values()].map((group) => ({
        ...group,
        accuracy: safeRate(group.correct, group.total),
      }));
    };
    analysis = {
      bySubject: summarize(subjectRows),
      byTopic: summarize(topicRows),
    };
  }
  return {
    ...attempt,
    resultsAvailable,
    analysis,
    questions: publicRows,
  };
}

export async function saveMockExamAnswer(input: {
  userId: string;
  attemptId: string;
  questionId: string;
  answer: string | string[];
}) {
  const [attempt] = await getDb()
    .select()
    .from(mockExamAttempts)
    .where(
      and(
        eq(mockExamAttempts.id, input.attemptId),
        eq(mockExamAttempts.userId, input.userId),
      ),
    )
    .limit(1);
  if (!attempt) throw new AppError("시험 기록을 찾을 수 없습니다.", 404, "EXAM_ATTEMPT_NOT_FOUND");
  assertExamInProgress(attempt);
  const [answerRow] = await getDb()
    .update(mockExamAnswers)
    .set({
      answerData: JSON.stringify(input.answer),
      answeredAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(
      and(
        eq(mockExamAnswers.attemptId, input.attemptId),
        eq(mockExamAnswers.questionId, input.questionId),
      ),
    )
    .returning({ id: mockExamAnswers.id });
  if (!answerRow) throw new AppError("시험 문제를 찾을 수 없습니다.", 404, "EXAM_QUESTION_NOT_FOUND");
  return { saved: true };
}

export async function submitMockExam(
  userId: string,
  attemptId: string,
  autoExpired = false,
) {
  const [attempt] = await getDb()
    .select({
      id: mockExamAttempts.id,
      mockExamId: mockExamAttempts.mockExamId,
      userId: mockExamAttempts.userId,
      expiresAt: mockExamAttempts.expiresAt,
      status: mockExamAttempts.status,
      courseId: mockExams.courseId,
    })
    .from(mockExamAttempts)
    .innerJoin(mockExams, eq(mockExamAttempts.mockExamId, mockExams.id))
    .where(
      and(
        eq(mockExamAttempts.id, attemptId),
        eq(mockExamAttempts.userId, userId),
      ),
    )
    .limit(1);
  if (!attempt) throw new AppError("시험 기록을 찾을 수 없습니다.", 404, "EXAM_ATTEMPT_NOT_FOUND");
  if (attempt.status !== "IN_PROGRESS") {
    throw new AppError("이미 제출된 시험입니다.", 409, "EXAM_ALREADY_SUBMITTED");
  }
  if (!autoExpired) assertExamInProgress(attempt);
  const answerRows = await getDb()
    .select({
      answerId: mockExamAnswers.id,
      questionId: questions.id,
      type: questions.type,
      answerConfigJson: questions.answerConfigJson,
      answerData: mockExamAnswers.answerData,
      answeredAt: mockExamAnswers.answeredAt,
      possibleScore: mockExamQuestions.score,
    })
    .from(mockExamAnswers)
    .innerJoin(questions, eq(mockExamAnswers.questionId, questions.id))
    .innerJoin(
      mockExamQuestions,
      and(
        eq(mockExamQuestions.mockExamId, attempt.mockExamId),
        eq(mockExamQuestions.questionId, questions.id),
      ),
    )
    .where(eq(mockExamAnswers.attemptId, attemptId));
  const choices = answerRows.length
    ? await getDb()
        .select()
        .from(questionChoices)
        .where(
          inArray(
            questionChoices.questionId,
            answerRows.map((row) => row.questionId),
          ),
        )
    : [];
  const grades = answerRows.map((row) => {
    const answered = Boolean(row.answeredAt);
    if (!answered) {
      return {
        questionId: row.questionId,
        answered: false,
        isCorrect: false,
        earnedScore: 0,
        possibleScore: row.possibleScore,
        answerId: row.answerId,
      };
    }
    const grade = requireSupportedGrade(
      gradeQuestion(
        {
          type: row.type as QuestionType,
          choices: choices.filter(
            (choice) => choice.questionId === row.questionId,
          ),
          answerConfig: parseJson<ShortAnswerConfig>(
            row.answerConfigJson,
            {},
          ),
        },
        parseJson<string | string[]>(row.answerData, ""),
      ),
    );
    return {
      questionId: row.questionId,
      answered: true,
      isCorrect: grade.isCorrect === true,
      earnedScore: Math.round(
        row.possibleScore * ((grade.score ?? 0) / 100),
      ),
      possibleScore: row.possibleScore,
      answerId: row.answerId,
    };
  });
  const result = calculateExamResult(grades);
  const reviewedAt = new Date().toISOString();
  const submissionActivityId = `mock-exam-submitted:${attemptId}`;
  const operations: BatchItem<"sqlite">[] = [
    ...grades.map((grade) =>
      getDb()
        .update(mockExamAnswers)
        .set({
          isCorrect: grade.answered ? grade.isCorrect : null,
          score: grade.earnedScore,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(mockExamAnswers.id, grade.answerId)),
    ),
    getDb()
      .update(mockExamAttempts)
      .set({
        status: autoExpired ? "EXPIRED" : "SUBMITTED",
        submittedAt: sql`CURRENT_TIMESTAMP`,
        ...result,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(mockExamAttempts.id, attemptId),
          eq(mockExamAttempts.status, "IN_PROGRESS"),
        ),
      ),
    getDb().insert(learningActivities).values({
      id: submissionActivityId,
      userId,
      courseId: attempt.courseId,
      activityType: "MOCK_EXAM_SUBMITTED",
      targetId: attemptId,
      metadataJson: JSON.stringify(result),
    }),
    ...grades
      .filter((grade) => grade.answered && !grade.isCorrect)
      .map((grade) =>
        getDb()
          .insert(reviewSchedules)
          .values({
            id: crypto.randomUUID(),
            userId,
            courseId: attempt.courseId,
            targetType: "MOCK_EXAM_QUESTION",
            targetId: grade.questionId,
            nextReviewAt: reviewedAt,
            consecutiveWrong: 1,
            reviewCount: 1,
            status: "DUE",
          })
          .onConflictDoUpdate({
            target: [
              reviewSchedules.userId,
              reviewSchedules.courseId,
              reviewSchedules.targetType,
              reviewSchedules.targetId,
            ],
            set: {
              nextReviewAt: reviewedAt,
              consecutiveCorrect: 0,
              consecutiveWrong: sql`${reviewSchedules.consecutiveWrong} + 1`,
              reviewCount: sql`${reviewSchedules.reviewCount} + 1`,
              status: "DUE",
              updatedAt: sql`CURRENT_TIMESTAMP`,
            },
          }),
      ),
  ];
  try {
    await getDb().batch(batchItems(operations));
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const [current] = await getDb()
        .select({ status: mockExamAttempts.status })
        .from(mockExamAttempts)
        .where(
          and(
            eq(mockExamAttempts.id, attemptId),
            eq(mockExamAttempts.userId, userId),
          ),
        )
        .limit(1);
      if (current?.status !== "IN_PROGRESS") {
        throw new AppError(
          "이미 제출된 시험입니다.",
          409,
          "EXAM_ALREADY_SUBMITTED",
        );
      }
    }
    throw error;
  }
  return result;
}

export async function getCourseStatistics(userId: string, courseId: string) {
  const attempts = await getDb()
    .select({
      attemptId: questionAttempts.id,
      questionId: questionAttempts.questionId,
      isCorrect: questionAttempts.isCorrect,
      responseTime: questionAttempts.responseTime,
      attemptedAt: questionAttempts.attemptedAt,
      difficulty: questions.difficulty,
      type: questions.type,
    })
    .from(questionAttempts)
    .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
    .where(
      and(
        eq(questionAttempts.userId, userId),
        eq(questionAttempts.courseId, courseId),
      ),
    );
  const questionIds = [...new Set(attempts.map((attempt) => attempt.questionId))];
  const [subjectMappings, topicMappings] = questionIds.length
    ? await Promise.all([
        getDb()
          .select({
            questionId: questionSubjects.questionId,
            subjectId: questionSubjects.subjectId,
          })
          .from(questionSubjects)
          .innerJoin(subjects, eq(questionSubjects.subjectId, subjects.id))
          .where(
            and(
              inArray(questionSubjects.questionId, questionIds),
              eq(subjects.courseId, courseId),
            ),
          ),
        getDb()
          .select({
            questionId: questionTopics.questionId,
            topicId: questionTopics.topicId,
          })
          .from(questionTopics)
          .innerJoin(topics, eq(questionTopics.topicId, topics.id))
          .innerJoin(subjects, eq(topics.subjectId, subjects.id))
          .where(
            and(
              inArray(questionTopics.questionId, questionIds),
              eq(subjects.courseId, courseId),
            ),
          ),
      ])
    : [[], []];
  const rows = attempts.map((attempt) => ({
    ...attempt,
    subjectId:
      subjectMappings.find(
        (mapping) => mapping.questionId === attempt.questionId,
      )?.subjectId ?? null,
    topicId:
      topicMappings.find(
        (mapping) => mapping.questionId === attempt.questionId,
      )?.topicId ?? null,
  }));
  const now = Date.now();
  const days7 = rows.filter(
    (row) => now - new Date(row.attemptedAt).getTime() <= 7 * 86_400_000,
  ).length;
  const days30 = rows.filter(
    (row) => now - new Date(row.attemptedAt).getTime() <= 30 * 86_400_000,
  ).length;
  const groupStats = (key: "difficulty" | "type" | "subjectId" | "topicId") => {
    const groups = new Map<string, { total: number; correct: number }>();
    for (const row of rows) {
      const value = row[key] ?? "UNMAPPED";
      const group = groups.get(value) ?? { total: 0, correct: 0 };
      group.total += 1;
      if (row.isCorrect) group.correct += 1;
      groups.set(value, group);
    }
    return [...groups.entries()].map(([id, value]) => ({
      id,
      ...value,
      accuracy: safeRate(value.correct, value.total),
    }));
  };
  const [wrongCountRow] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(wrongNotes)
    .where(
      and(
        eq(wrongNotes.userId, userId),
        eq(wrongNotes.courseId, courseId),
        gt(wrongNotes.wrongCount, 1),
      ),
    );
  const levelRows = await listCourseLevels(userId, courseId);
  const examRows = await getDb()
    .select({ score: mockExamAttempts.score })
    .from(mockExamAttempts)
    .innerJoin(mockExams, eq(mockExamAttempts.mockExamId, mockExams.id))
    .where(
      and(
        eq(mockExamAttempts.userId, userId),
        eq(mockExams.courseId, courseId),
        inArray(mockExamAttempts.status, ["SUBMITTED", "EXPIRED"]),
      ),
    );
  const reviewRows = await getDb()
    .select({
      correct: reviewSchedules.consecutiveCorrect,
      count: reviewSchedules.reviewCount,
    })
    .from(reviewSchedules)
    .where(
      and(
        eq(reviewSchedules.userId, userId),
        eq(reviewSchedules.courseId, courseId),
      ),
    );
  return {
    totalQuestions: rows.length,
    correctAnswers: rows.filter((row) => row.isCorrect).length,
    overallAccuracy: safeRate(
      rows.filter((row) => row.isCorrect).length,
      rows.length,
    ),
    averageResponseTime: average(rows.map((row) => row.responseTime)),
    recent7Days: days7,
    recent30Days: days30,
    repeatedWrongCount: Number(wrongCountRow?.count ?? 0),
    reviewSuccessRate: safeRate(
      reviewRows.filter((row) => row.correct > 0).length,
      reviewRows.length,
    ),
    levelCompletionRate: safeRate(
      levelRows.filter((row) =>
        ["COMPLETED", "MASTERED"].includes(row.status),
      ).length,
      levelRows.length,
    ),
    mockExamAverageScore: average(examRows.map((row) => row.score)),
    byDifficulty: groupStats("difficulty"),
    byType: groupStats("type"),
    bySubject: groupStats("subjectId"),
    byTopic: groupStats("topicId"),
    studyDays: [...new Set(rows.map((row) => row.attemptedAt.slice(0, 10)))],
  };
}

export async function getCourseLearningSummary(
  userId: string,
  courseId: string,
) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [attemptSummary, recent7DaysSummary, repeatedWrongSummary] =
    await Promise.all([
      getDb()
        .select({
          total: sql<number>`count(*)`,
          correct: sql<number>`coalesce(sum(case when ${questionAttempts.isCorrect} = 1 then 1 else 0 end), 0)`,
        })
        .from(questionAttempts)
        .where(
          and(
            eq(questionAttempts.userId, userId),
            eq(questionAttempts.courseId, courseId),
          ),
        )
        .then((rows) => rows[0]),
      getDb()
        .select({ count: sql<number>`count(*)` })
        .from(questionAttempts)
        .where(
          and(
            eq(questionAttempts.userId, userId),
            eq(questionAttempts.courseId, courseId),
            gt(questionAttempts.attemptedAt, sevenDaysAgo),
          ),
        )
        .then((rows) => rows[0]),
      getDb()
        .select({ count: sql<number>`count(*)` })
        .from(wrongNotes)
        .where(
          and(
            eq(wrongNotes.userId, userId),
            eq(wrongNotes.courseId, courseId),
            gt(wrongNotes.wrongCount, 1),
            sql`${wrongNotes.mastered} = 0`,
          ),
        )
        .then((rows) => rows[0]),
    ]);

  const totalQuestions = Number(attemptSummary?.total ?? 0);
  const correctAnswers = Number(attemptSummary?.correct ?? 0);

  return {
    overallAccuracy: safeRate(correctAnswers, totalQuestions),
    recent7Days: Number(recent7DaysSummary?.count ?? 0),
    repeatedWrongCount: Number(repeatedWrongSummary?.count ?? 0),
  };
}

export async function getLearnCourseActivitySummary(
  userId: string,
  courseId: string,
) {
  const [dueReviewCount, mockExamCount, stats] = await Promise.all([
    countDueReviewsForCourse(userId, courseId),
    countPublicMockExamsForCourse(userId, courseId),
    getCourseLearningSummary(userId, courseId),
  ]);

  return {
    dueReviewCount,
    mockExamCount,
    stats,
  };
}

export async function getIntegratedStatistics(userId: string) {
  const [enrollments, activityDays] = await Promise.all([
    getDb()
      .select({
        courseId: userCourseEnrollments.courseId,
        courseSlug: courses.slug,
        courseName: courses.shortName,
        progressPercent: userCourseEnrollments.progressPercent,
      })
      .from(userCourseEnrollments)
      .innerJoin(courses, eq(userCourseEnrollments.courseId, courses.id))
      .where(eq(userCourseEnrollments.userId, userId)),
    getDb()
      .selectDistinct({
        day: sql<string>`substr(${learningActivities.createdAt}, 1, 10)`,
      })
      .from(learningActivities)
      .where(eq(learningActivities.userId, userId)),
  ]);
  const courseIds = enrollments.map((enrollment) => enrollment.courseId);
  const [attemptRows, attemptDayRows, levelRows, courseLessonRows] =
    courseIds.length
      ? await Promise.all([
        getDb()
          .select({
            courseId: questionAttempts.courseId,
            totalQuestions: sql<number>`count(*)`,
            correctAnswers: sql<number>`coalesce(sum(case when ${questionAttempts.isCorrect} = 1 then 1 else 0 end), 0)`,
          })
          .from(questionAttempts)
          .where(
            and(
              eq(questionAttempts.userId, userId),
              inArray(questionAttempts.courseId, courseIds),
            ),
          )
          .groupBy(questionAttempts.courseId),
        getDb()
          .selectDistinct({
            day: sql<string>`substr(${questionAttempts.attemptedAt}, 1, 10)`,
          })
          .from(questionAttempts)
          .where(
            and(
              eq(questionAttempts.userId, userId),
              inArray(questionAttempts.courseId, courseIds),
            ),
          ),
        getDb()
          .select({
            courseId: userLevelProgress.courseId,
            totalLevels: sql<number>`count(*)`,
            completedLevels: sql<number>`coalesce(sum(case when ${userLevelProgress.status} in ('COMPLETED', 'MASTERED') then 1 else 0 end), 0)`,
          })
          .from(userLevelProgress)
          .where(
            and(
              eq(userLevelProgress.userId, userId),
              inArray(userLevelProgress.courseId, courseIds),
            ),
          )
          .groupBy(userLevelProgress.courseId),
        getDb()
          .select({
            courseId: courseLessons.courseId,
            totalLessons: sql<number>`count(${courseLessons.id})`,
            completedLessons: sql<number>`coalesce(sum(case when ${userCourseLessonProgress.status} = 'COMPLETED' then 1 else 0 end), 0)`,
          })
          .from(courseLessons)
          .innerJoin(contents, eq(courseLessons.contentId, contents.id))
          .leftJoin(
            userCourseLessonProgress,
            and(
              eq(userCourseLessonProgress.userId, userId),
              eq(userCourseLessonProgress.courseId, courseLessons.courseId),
              eq(
                userCourseLessonProgress.courseLessonId,
                courseLessons.id,
              ),
            ),
          )
          .where(
            and(
              inArray(courseLessons.courseId, courseIds),
              eq(courseLessons.status, "PUBLISHED"),
              isNull(courseLessons.deletedAt),
              eq(contents.status, "PUBLISHED"),
              isNull(contents.deletedAt),
            ),
          )
          .groupBy(courseLessons.courseId),
      ])
    : [[], [], [], []];
  const attemptMap = new Map(
    attemptRows.map((row) => [
      row.courseId,
      {
        totalQuestions: Number(row.totalQuestions),
        correctAnswers: Number(row.correctAnswers),
      },
    ]),
  );
  const levelMap = new Map(
    levelRows.map((row) => [
      row.courseId,
      {
        totalLevels: Number(row.totalLevels),
        completedLevels: Number(row.completedLevels),
      },
    ]),
  );
  const courseLessonMap = new Map(
    courseLessonRows.map((row) => [
      row.courseId,
      {
        totalLessons: Number(row.totalLessons),
        completedLessons: Number(row.completedLessons),
      },
    ]),
  );
  const courseStats = enrollments.map((enrollment) => {
    const attempts = attemptMap.get(enrollment.courseId) ?? {
      totalQuestions: 0,
      correctAnswers: 0,
    };
    const levels = levelMap.get(enrollment.courseId) ?? {
      totalLevels: 0,
      completedLevels: 0,
    };
    const lessons = courseLessonMap.get(enrollment.courseId) ?? {
      totalLessons: 0,
      completedLessons: 0,
    };
    return {
      ...enrollment,
      stats: {
        totalQuestions: attempts.totalQuestions,
        correctAnswers: attempts.correctAnswers,
        overallAccuracy: safeRate(
          attempts.correctAnswers,
          attempts.totalQuestions,
        ),
        levelCompletionRate: safeRate(
          levels.completedLevels,
          levels.totalLevels,
        ),
        theoryProgressPercent: safeRate(
          lessons.completedLessons,
          lessons.totalLessons,
        ),
        theoryCompletedLessons: lessons.completedLessons,
        theoryTotalLessons: lessons.totalLessons,
      },
    };
  });
  const totalQuestions = courseStats.reduce(
    (sum, item) => sum + item.stats.totalQuestions,
    0,
  );
  const correctAnswers = courseStats.reduce(
    (sum, item) => sum + item.stats.correctAnswers,
    0,
  );
  const studyDays = [
    ...new Set([
      ...attemptDayRows.map((item) => item.day),
      ...activityDays.map((item) => item.day),
    ]),
  ];
  return {
    enrolledCourses: enrollments.length,
    cumulativeStudyDays: studyDays.length,
    totalQuestions,
    overallAccuracy: safeRate(correctAnswers, totalQuestions),
    studyStreak: countStudyStreak(studyDays),
    courses: courseStats,
  };
}

export async function getLearningSettings(userId: string) {
  const [settings] = await getDb()
    .select()
    .from(userLearningSettings)
    .where(eq(userLearningSettings.userId, userId))
    .limit(1);
  if (settings) return settings;

  await getDb()
    .insert(userLearningSettings)
    .values({ id: crypto.randomUUID(), userId })
    .onConflictDoNothing();
  const [createdSettings] = await getDb()
    .select()
    .from(userLearningSettings)
    .where(eq(userLearningSettings.userId, userId))
    .limit(1);
  return createdSettings;
}

export async function saveLearningSettings(input: {
  userId: string;
  dailyQuestionGoal: number;
  dailyStudyMinutes: number;
}) {
  await getDb()
    .insert(userLearningSettings)
    .values({ id: crypto.randomUUID(), ...input })
    .onConflictDoUpdate({
      target: userLearningSettings.userId,
      set: {
        dailyQuestionGoal: input.dailyQuestionGoal,
        dailyStudyMinutes: input.dailyStudyMinutes,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    });
}

type PublishedCurriculumPath = NonNullable<
  Awaited<ReturnType<typeof getPublishedCurriculumPathForCourse>>
>;
type PublishedCurriculumNode = PublishedCurriculumPath["nodes"][number];

function flattenCurriculumPathNodes(nodes: PublishedCurriculumNode[]) {
  const flattened: PublishedCurriculumNode[] = [];
  const visit = (node: PublishedCurriculumNode) => {
    flattened.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return flattened;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function utcDayRange(date = new Date()) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const end = new Date(start.getTime() + 86_400_000);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function getRecommendations(userId: string) {
  const [reviews, enrollments] = await Promise.all([
    listDueReviews(userId),
    getDb()
      .select({
        courseId: userCourseEnrollments.courseId,
        courseSlug: courses.slug,
        courseName: courses.shortName,
      })
      .from(userCourseEnrollments)
      .innerJoin(courses, eq(userCourseEnrollments.courseId, courses.id))
      .where(
        and(
          eq(userCourseEnrollments.userId, userId),
          eq(userCourseEnrollments.status, "ACTIVE"),
        ),
      ),
  ]);
  const candidates: RecommendationCandidate[] = reviews.map((review) => {
    const overdueDays = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(review.nextReviewAt).getTime()) / 86_400_000,
      ),
    );
    return {
      id: review.id,
      kind: "REVIEW",
      title: review.questionTitle ?? "예정된 복습",
      reason:
        overdueDays > 0
          ? `복습 예정일 ${overdueDays}일 경과`
          : "오늘 복습 예정",
      priority:
        overdueDays === 0 && review.targetType === "MOCK_EXAM_QUESTION"
          ? "EXAM_WRONG"
          : "OVERDUE_REVIEW",
      estimatedMinutes: 2,
      href: `/reviews?courseId=${review.courseId}`,
    };
  });
  for (const enrollment of enrollments) {
    const [levelRows, stats, exams] = await Promise.all([
      listCourseLevels(userId, enrollment.courseId),
      getCourseStatistics(userId, enrollment.courseId),
      listPublicMockExams(userId, enrollment.courseId),
    ]);
    const repeated = await getDb()
      .select({
        id: wrongNotes.id,
        questionId: wrongNotes.questionId,
        count: wrongNotes.wrongCount,
        title: questions.title,
      })
      .from(wrongNotes)
      .innerJoin(questions, eq(wrongNotes.questionId, questions.id))
      .where(
        and(
          eq(wrongNotes.userId, userId),
          eq(wrongNotes.courseId, enrollment.courseId),
          gt(wrongNotes.wrongCount, 1),
          eq(wrongNotes.mastered, false),
        ),
      )
      .orderBy(desc(wrongNotes.wrongCount))
      .limit(3);
    candidates.push(
      ...repeated.map((item) => ({
        id: item.id,
        kind: "QUESTION" as const,
        title: item.title,
        reason: `최근 ${item.count}회 반복 오답`,
        priority: "REPEATED_WRONG" as const,
        estimatedMinutes: 3,
        href: `/practice/${enrollment.courseSlug}?wrongOnly=1&count=10`,
      })),
    );
    const weakTopic = stats.byTopic
      .filter((item) => item.id !== "UNMAPPED" && item.total >= 2)
      .sort((a, b) => a.accuracy - b.accuracy)[0];
    if (weakTopic && weakTopic.accuracy < 70) {
      candidates.push({
        id: `${enrollment.courseId}-${weakTopic.id}`,
        kind: "QUESTION",
        title: `${enrollment.courseName} 취약 주제`,
        reason: `해당 주제 정답률 ${weakTopic.accuracy}%`,
        priority: "LOW_ACCURACY",
        estimatedMinutes: 10,
        href: `/practice/${enrollment.courseSlug}?topicId=${weakTopic.id}&count=10`,
      });
    }
    const nextLevel = levelRows.find((row) =>
      ["AVAILABLE", "IN_PROGRESS"].includes(row.status),
    );
    if (nextLevel) {
      candidates.push({
        id: nextLevel.id,
        kind: "LEVEL",
        title: nextLevel.title,
        reason:
          nextLevel.status === "IN_PROGRESS"
            ? "진행 중인 단계를 완료하세요"
            : "다음 학습 단계가 열려 있습니다",
        priority: "INCOMPLETE_LEVEL",
        estimatedMinutes: 15,
        href: `/learn/${enrollment.courseSlug}/levels/${nextLevel.id}`,
      });
    }
    const curriculumPath = await getPublishedCurriculumPathForCourse(
      enrollment.courseId,
      userId,
    );
    const curriculumNodes = curriculumPath
      ? flattenCurriculumPathNodes(curriculumPath.nodes)
      : [];
    const nextCurriculumNode = curriculumPath
      ? curriculumNodes.find(
        (node) =>
          node.linkedLessonCount > 0 &&
          node.linkedLessonProgressPercent < 100 &&
          Boolean(node.linkedLesson),
      )
      : null;
    if (nextCurriculumNode?.linkedLesson) {
      candidates.push({
        id: `curriculum:${nextCurriculumNode.id}:${nextCurriculumNode.linkedLesson.id}`,
        kind: "LESSON",
        title: nextCurriculumNode.linkedLesson.title,
        reason: `커리큘럼 '${nextCurriculumNode.title}'의 다음 연결 레슨`,
        priority: "CURRICULUM_LESSON",
        estimatedMinutes: 10,
        href: `/learn/${enrollment.courseSlug}/lessons/${nextCurriculumNode.linkedLesson.id}`,
      });
    }
    const curriculumTopicIds = uniqueValues(
      curriculumNodes.flatMap((node) =>
        node.linkedContent
          .filter((link) => link.type === "TOPIC")
          .map((link) => link.id),
      ),
    );
    const curriculumSubjectIds = uniqueValues(
      curriculumNodes.flatMap((node) =>
        node.linkedContent
          .filter((link) => link.type === "SUBJECT")
          .map((link) => link.id),
      ),
    );
    const nodeByLinkedContentId = new Map(
      curriculumNodes.flatMap((node) =>
        node.linkedContent.map((link) => [link.id, node] as const),
      ),
    );
    const [curriculumTopicQuestion] = curriculumTopicIds.length
      ? await getDb()
          .select({
            id: questions.id,
            title: questions.title,
            topicId: questionTopics.topicId,
          })
          .from(questionTopics)
          .innerJoin(questionCourses, eq(questionTopics.questionId, questionCourses.questionId))
          .innerJoin(questions, eq(questionTopics.questionId, questions.id))
          .leftJoin(
            questionAttempts,
            and(
              eq(questionAttempts.questionId, questions.id),
              eq(questionAttempts.userId, userId),
              eq(questionAttempts.courseId, enrollment.courseId),
            ),
          )
          .where(
            and(
              inArray(questionTopics.topicId, curriculumTopicIds),
              eq(questionCourses.courseId, enrollment.courseId),
              eq(questions.status, "PUBLISHED"),
              sql`${questionAttempts.id} IS NULL`,
            ),
          )
          .limit(1)
      : [];
    const [curriculumSubjectQuestion] =
      !curriculumTopicQuestion && curriculumSubjectIds.length
        ? await getDb()
            .select({
              id: questions.id,
              title: questions.title,
              subjectId: questionSubjects.subjectId,
            })
            .from(questionSubjects)
            .innerJoin(questionCourses, eq(questionSubjects.questionId, questionCourses.questionId))
            .innerJoin(questions, eq(questionSubjects.questionId, questions.id))
            .leftJoin(
              questionAttempts,
              and(
                eq(questionAttempts.questionId, questions.id),
                eq(questionAttempts.userId, userId),
                eq(questionAttempts.courseId, enrollment.courseId),
              ),
            )
            .where(
              and(
                inArray(questionSubjects.subjectId, curriculumSubjectIds),
                eq(questionCourses.courseId, enrollment.courseId),
                eq(questions.status, "PUBLISHED"),
                sql`${questionAttempts.id} IS NULL`,
              ),
            )
            .limit(1)
        : [];
    if (curriculumTopicQuestion) {
      const node = nodeByLinkedContentId.get(curriculumTopicQuestion.topicId);
      candidates.push({
        id: `curriculum-question:${curriculumTopicQuestion.topicId}:${curriculumTopicQuestion.id}`,
        kind: "QUESTION",
        title: node ? `${node.title} 문제풀이` : curriculumTopicQuestion.title,
        reason: "커리큘럼 연결 주제의 미풀이 문제",
        priority: "CURRICULUM_QUESTION",
        estimatedMinutes: 10,
        href: `/practice/${enrollment.courseSlug}?topicId=${curriculumTopicQuestion.topicId}&count=10`,
      });
    } else if (curriculumSubjectQuestion) {
      const node = nodeByLinkedContentId.get(curriculumSubjectQuestion.subjectId);
      candidates.push({
        id: `curriculum-question:${curriculumSubjectQuestion.subjectId}:${curriculumSubjectQuestion.id}`,
        kind: "QUESTION",
        title: node ? `${node.title} 문제풀이` : curriculumSubjectQuestion.title,
        reason: "커리큘럼 연결 과목의 미풀이 문제",
        priority: "CURRICULUM_QUESTION",
        estimatedMinutes: 10,
        href: `/practice/${enrollment.courseSlug}?subjectId=${curriculumSubjectQuestion.subjectId}&count=10`,
      });
    }
    const subjectActivity = await getDb()
      .select({
        id: subjects.id,
        name: subjects.name,
        lastStudiedAt: sql<string | null>`max(${questionAttempts.attemptedAt})`,
      })
      .from(subjects)
      .leftJoin(
        questionSubjects,
        eq(subjects.id, questionSubjects.subjectId),
      )
      .leftJoin(
        questionAttempts,
        and(
          eq(questionSubjects.questionId, questionAttempts.questionId),
          eq(questionAttempts.userId, userId),
          eq(questionAttempts.courseId, enrollment.courseId),
        ),
      )
      .where(eq(subjects.courseId, enrollment.courseId))
      .groupBy(subjects.id, subjects.name);
    const staleSubject = subjectActivity.find(
      (subject) =>
        !subject.lastStudiedAt ||
        Date.now() - new Date(subject.lastStudiedAt).getTime() >=
          14 * 86_400_000,
    );
    if (staleSubject) {
      candidates.push({
        id: staleSubject.id,
        kind: "SUBJECT",
        title: staleSubject.name,
        reason: staleSubject.lastStudiedAt
          ? "최근 14일간 학습하지 않음"
          : "아직 학습 기록이 없는 과목",
        priority: "STALE_SUBJECT",
        estimatedMinutes: 10,
        href: `/practice/${enrollment.courseSlug}?subjectId=${staleSubject.id}&count=10`,
      });
    }
    const [unseenQuestion] = await getDb()
      .select({ id: questions.id, title: questions.title })
      .from(questionCourses)
      .innerJoin(questions, eq(questionCourses.questionId, questions.id))
      .leftJoin(
        questionAttempts,
        and(
          eq(questionAttempts.questionId, questions.id),
          eq(questionAttempts.userId, userId),
          eq(questionAttempts.courseId, enrollment.courseId),
        ),
      )
      .where(
        and(
          eq(questionCourses.courseId, enrollment.courseId),
          eq(questions.status, "PUBLISHED"),
          sql`${questionAttempts.id} IS NULL`,
        ),
      )
      .limit(1);
    if (unseenQuestion) {
      candidates.push({
        id: unseenQuestion.id,
        kind: "QUESTION",
        title: unseenQuestion.title,
        reason: "아직 풀지 않은 공개 문제",
        priority: "UNSEEN_QUESTION",
        estimatedMinutes: 2,
        href: `/practice/${enrollment.courseSlug}?count=10`,
      });
    }
    if (exams[0]) {
      candidates.push({
        id: exams[0].id,
        kind: "MOCK_EXAM",
        title: exams[0].title,
        reason: "현재 실력을 점검할 수 있습니다",
        priority: "UNSEEN_QUESTION",
        estimatedMinutes: exams[0].timeLimitMinutes,
        href: `/mock-exams/${exams[0].id}`,
      });
    }
  }
  return recommendationService.recommend(candidates);
}

export async function getTodayLearningPlan(userId: string) {
  const [settings, recommendations, reviewSummary] = await Promise.all([
    getLearningSettings(userId),
    getDashboardRecommendations(userId),
    getDashboardReviewSummary(userId),
  ]);
  const todayRange = utcDayRange();
  const [activity] = await getDb()
    .select({
      completed: sql<number>`count(*)`,
    })
    .from(questionAttempts)
    .where(
      and(
        eq(questionAttempts.userId, userId),
        gte(questionAttempts.attemptedAt, todayRange.start),
        lt(questionAttempts.attemptedAt, todayRange.end),
      ),
    );
  return {
    settings,
    completedQuestions: Number(activity?.completed ?? 0),
    reviewSummary,
    recommendations,
    completionPercent: safeRate(
      Number(activity?.completed ?? 0),
      settings.dailyQuestionGoal,
    ),
  };
}

async function getDashboardRecommendations(userId: string) {
  const now = new Date().toISOString();
  const [reviews, enrollments] = await Promise.all([
    getDb()
      .select({
        id: reviewSchedules.id,
        courseId: reviewSchedules.courseId,
        targetType: reviewSchedules.targetType,
        nextReviewAt: reviewSchedules.nextReviewAt,
        questionTitle: questions.title,
      })
      .from(reviewSchedules)
      .leftJoin(
        questions,
        and(
          eq(reviewSchedules.targetType, "QUESTION"),
          eq(reviewSchedules.targetId, questions.id),
        ),
      )
      .where(
        and(
          eq(reviewSchedules.userId, userId),
          lte(reviewSchedules.nextReviewAt, now),
          inArray(reviewSchedules.status, ["DUE", "SCHEDULED"]),
        ),
      )
      .orderBy(asc(reviewSchedules.nextReviewAt))
      .limit(8),
    getDb()
      .select({
        courseId: userCourseEnrollments.courseId,
        courseSlug: courses.slug,
        courseName: courses.shortName,
      })
      .from(userCourseEnrollments)
      .innerJoin(courses, eq(userCourseEnrollments.courseId, courses.id))
      .where(
        and(
          eq(userCourseEnrollments.userId, userId),
          eq(userCourseEnrollments.status, "ACTIVE"),
        ),
      ),
  ]);
  const candidates: RecommendationCandidate[] = reviews.map((review) => {
    const overdueDays = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(review.nextReviewAt).getTime()) / 86_400_000,
      ),
    );
    return {
      id: review.id,
      kind: "REVIEW",
      title: review.questionTitle ?? "예정된 복습",
      reason:
        overdueDays > 0
          ? `복습 예정일 ${overdueDays}일 경과`
          : "오늘 복습 예정",
      priority:
        overdueDays === 0 && review.targetType === "MOCK_EXAM_QUESTION"
          ? "EXAM_WRONG"
          : "OVERDUE_REVIEW",
      estimatedMinutes: 2,
      href: `/reviews?courseId=${review.courseId}`,
    };
  });
  const courseIds = enrollments.map((enrollment) => enrollment.courseId);
  if (!courseIds.length) {
    return recommendationService.recommend(candidates, 8);
  }
  const courseById = new Map(
    enrollments.map((enrollment) => [enrollment.courseId, enrollment]),
  );
  const repeatedRows = await getDb()
    .select({
      id: wrongNotes.id,
      courseId: wrongNotes.courseId,
      questionId: wrongNotes.questionId,
      wrongCount: wrongNotes.wrongCount,
      title: questions.title,
    })
    .from(wrongNotes)
    .innerJoin(questions, eq(wrongNotes.questionId, questions.id))
    .where(
      and(
        eq(wrongNotes.userId, userId),
        inArray(wrongNotes.courseId, courseIds),
        gt(wrongNotes.wrongCount, 1),
        sql`${wrongNotes.mastered} = 0`,
      ),
    )
    .orderBy(desc(wrongNotes.wrongCount))
    .limit(8);
  candidates.push(
    ...repeatedRows.map((item) => {
      const course = courseById.get(item.courseId);
      return {
        id: item.id,
        kind: "QUESTION" as const,
        title: item.title,
        reason: `최근 ${item.wrongCount}회 반복 오답`,
        priority: "REPEATED_WRONG" as const,
        estimatedMinutes: 3,
        href: `/practice/${course?.courseSlug ?? ""}?wrongOnly=1&count=10`,
      };
    }),
  );
  const staleSubjectRows: Array<{
    courseId: string;
    subjectId: string;
    subjectName: string;
    lastStudiedAt: string | null;
  }> = [];
  const staleByCourse = new Map<
    string,
    (typeof staleSubjectRows)[number]
  >();
  for (const subject of staleSubjectRows) {
    const stale =
      !subject.lastStudiedAt ||
      Date.now() - new Date(subject.lastStudiedAt).getTime() >=
        14 * 86_400_000;
    if (stale && !staleByCourse.has(subject.courseId)) {
      staleByCourse.set(subject.courseId, subject);
    }
  }
  for (const subject of staleByCourse.values()) {
    const course = courseById.get(subject.courseId);
    if (!course) continue;
    candidates.push({
      id: subject.subjectId,
      kind: "SUBJECT",
      title: subject.subjectName,
      reason: subject.lastStudiedAt
        ? "최근 14일간 학습하지 않음"
        : "아직 학습 기록이 없는 과목",
      priority: "STALE_SUBJECT",
      estimatedMinutes: 10,
      href: `/practice/${course.courseSlug}?subjectId=${subject.subjectId}&count=10`,
    });
  }
  return recommendationService.recommend(candidates, 8);
}

export async function listAdminLevels(courseId?: string) {
  return getDb()
    .select({
      id: levels.id,
      courseId: levels.courseId,
      courseName: courses.shortName,
      code: levels.code,
      number: levels.number,
      title: levels.title,
      description: levels.description,
      passingScore: levels.passingScore,
      requiredLevelId: levels.requiredLevelId,
      displayOrder: levels.displayOrder,
      active: levels.active,
      published: levels.published,
    })
    .from(levels)
    .innerJoin(courses, eq(levels.courseId, courses.id))
    .where(courseId ? eq(levels.courseId, courseId) : undefined)
    .orderBy(asc(courses.displayOrder), asc(levels.displayOrder));
}

export async function saveLevel(input: {
  id?: string;
  courseId: string;
  code: string;
  number: number;
  title: string;
  description: string;
  passingScore: number;
  requiredLevelId?: string;
  displayOrder: number;
  active: boolean;
  published: boolean;
}) {
  if (input.requiredLevelId) {
    if (input.requiredLevelId === input.id) {
      throw new AppError(
        "단계가 자기 자신을 선행 단계로 참조할 수 없습니다.",
        400,
        "LEVEL_SELF_REFERENCE",
      );
    }
    const [requiredLevel] = await getDb()
      .select({ courseId: levels.courseId })
      .from(levels)
      .where(eq(levels.id, input.requiredLevelId))
      .limit(1);
    if (!requiredLevel || requiredLevel.courseId !== input.courseId) {
      throw new AppError(
        "같은 과정의 단계만 선행 단계로 지정할 수 있습니다.",
        400,
        "LEVEL_PREREQUISITE_INVALID",
      );
    }
  }
  const values = {
    courseId: input.courseId,
    code: input.code,
    number: input.number,
    title: input.title,
    description: input.description,
    passingScore: input.passingScore,
    requiredLevelId: input.requiredLevelId || null,
    displayOrder: input.displayOrder,
    active: input.active,
    published: input.published,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  if (input.id) {
    await getDb().update(levels).set(values).where(eq(levels.id, input.id));
    return input.id;
  }
  const id = crypto.randomUUID();
  await getDb().insert(levels).values({ id, ...values });
  return id;
}

export async function saveLevelContent(input: {
  levelId: string;
  contentType: string;
  contentId: string;
  displayOrder: number;
  required: boolean;
}) {
  const [level] = await getDb()
    .select({ courseId: levels.courseId })
    .from(levels)
    .where(eq(levels.id, input.levelId))
    .limit(1);
  if (!level) {
    throw new AppError("단계를 찾을 수 없습니다.", 404, "LEVEL_NOT_FOUND");
  }
  if (input.contentType === "QUESTION") {
    const [linked] = await getDb()
      .select({ questionId: questionCourses.questionId })
      .from(questionCourses)
      .where(
        and(
          eq(questionCourses.questionId, input.contentId),
          eq(questionCourses.courseId, level.courseId),
        ),
      )
      .limit(1);
    if (!linked) {
      throw new AppError(
        "과정에 연결된 문제만 단계에 배정할 수 있습니다.",
        400,
        "LEVEL_CONTENT_COURSE_MISMATCH",
      );
    }
  }
  if (input.contentType === "SUBJECT") {
    const [subject] = await getDb()
      .select({ courseId: subjects.courseId })
      .from(subjects)
      .where(eq(subjects.id, input.contentId))
      .limit(1);
    if (!subject || subject.courseId !== level.courseId) {
      throw new AppError(
        "같은 과정의 과목만 단계에 연결할 수 있습니다.",
        400,
        "LEVEL_CONTENT_COURSE_MISMATCH",
      );
    }
  }
  if (input.contentType === "TOPIC") {
    const [topic] = await getDb()
      .select({ courseId: subjects.courseId })
      .from(topics)
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(eq(topics.id, input.contentId))
      .limit(1);
    if (!topic || topic.courseId !== level.courseId) {
      throw new AppError(
        "같은 과정의 주제만 단계에 연결할 수 있습니다.",
        400,
        "LEVEL_CONTENT_COURSE_MISMATCH",
      );
    }
  }
  await getDb()
    .insert(levelContents)
    .values({ id: crypto.randomUUID(), ...input })
    .onConflictDoUpdate({
      target: [
        levelContents.levelId,
        levelContents.contentType,
        levelContents.contentId,
      ],
      set: {
        displayOrder: input.displayOrder,
        required: input.required,
      },
    });
}

export async function listAdminMockExams(courseId?: string) {
  return getDb()
    .select({
      id: mockExams.id,
      courseId: mockExams.courseId,
      courseName: courses.shortName,
      title: mockExams.title,
      description: mockExams.description,
      examType: mockExams.examType,
      questionCount: mockExams.questionCount,
      timeLimitMinutes: mockExams.timeLimitMinutes,
      passingScore: mockExams.passingScore,
      startAt: mockExams.startAt,
      endAt: mockExams.endAt,
      resultOpenAt: mockExams.resultOpenAt,
      maxAttempts: mockExams.maxAttempts,
      status: mockExams.status,
      published: mockExams.published,
    })
    .from(mockExams)
    .innerJoin(courses, eq(mockExams.courseId, courses.id))
    .where(courseId ? eq(mockExams.courseId, courseId) : undefined)
    .orderBy(desc(mockExams.updatedAt));
}

export async function saveMockExam(input: {
  id?: string;
  courseId: string;
  title: string;
  description: string;
  examType: string;
  questionCount: number;
  timeLimitMinutes: number;
  passingScore: number;
  startAt?: string;
  endAt?: string;
  resultOpenAt?: string;
  maxAttempts: number;
  randomizeQuestions: boolean;
  randomizeChoices: boolean;
  status: string;
  published: boolean;
}) {
  const values = {
    ...input,
    startAt: input.startAt || null,
    endAt: input.endAt || null,
    resultOpenAt: input.resultOpenAt || null,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  if (input.id) {
    await getDb().update(mockExams).set(values).where(eq(mockExams.id, input.id));
    return input.id;
  }
  const id = crypto.randomUUID();
  await getDb().insert(mockExams).values({ id, ...values });
  return id;
}

export async function saveMockExamSection(input: {
  id?: string;
  mockExamId: string;
  subjectId?: string;
  title: string;
  questionCount: number;
  scoreWeight: number;
  displayOrder: number;
}) {
  const [exam] = await getDb()
    .select({ courseId: mockExams.courseId })
    .from(mockExams)
    .where(eq(mockExams.id, input.mockExamId))
    .limit(1);
  if (!exam) {
    throw new AppError(
      "모의고사를 찾을 수 없습니다.",
      404,
      "MOCK_EXAM_NOT_FOUND",
    );
  }
  if (input.subjectId) {
    const [subject] = await getDb()
      .select({ courseId: subjects.courseId })
      .from(subjects)
      .where(eq(subjects.id, input.subjectId))
      .limit(1);
    if (!subject || subject.courseId !== exam.courseId) {
      throw new AppError(
        "시험 과정의 과목만 섹션에 연결할 수 있습니다.",
        400,
        "EXAM_SUBJECT_COURSE_MISMATCH",
      );
    }
  }
  const values = {
    mockExamId: input.mockExamId,
    subjectId: input.subjectId || null,
    title: input.title,
    questionCount: input.questionCount,
    scoreWeight: input.scoreWeight,
    displayOrder: input.displayOrder,
  };
  if (input.id) {
    await getDb()
      .update(mockExamSections)
      .set(values)
      .where(eq(mockExamSections.id, input.id));
    return input.id;
  }
  const id = crypto.randomUUID();
  await getDb().insert(mockExamSections).values({ id, ...values });
  return id;
}

export async function saveMockExamQuestion(input: {
  mockExamId: string;
  questionId: string;
  sectionId?: string;
  score: number;
  displayOrder: number;
}) {
  const [examQuestion] = await getDb()
    .select({
      questionId: questions.id,
      type: questions.type,
      status: questions.status,
    })
    .from(mockExams)
    .innerJoin(
      questionCourses,
      eq(mockExams.courseId, questionCourses.courseId),
    )
    .innerJoin(
      questions,
      eq(questionCourses.questionId, questions.id),
    )
    .where(
      and(
        eq(mockExams.id, input.mockExamId),
        eq(questions.id, input.questionId),
      ),
    )
    .limit(1);
  if (
    !examQuestion ||
    examQuestion.status !== "PUBLISHED" ||
    !["TRUE_FALSE", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_ANSWER"].includes(
      examQuestion.type,
    )
  ) {
    throw new AppError(
      "해당 과정에 연결된 공개 자동채점 문제만 배정할 수 있습니다.",
      400,
      "EXAM_QUESTION_INVALID",
    );
  }
  if (input.sectionId) {
    const [section] = await getDb()
      .select({ id: mockExamSections.id })
      .from(mockExamSections)
      .where(
        and(
          eq(mockExamSections.id, input.sectionId),
          eq(mockExamSections.mockExamId, input.mockExamId),
        ),
      )
      .limit(1);
    if (!section) {
      throw new AppError(
        "같은 모의고사의 섹션만 지정할 수 있습니다.",
        400,
        "EXAM_SECTION_INVALID",
      );
    }
  }
  await getDb()
    .insert(mockExamQuestions)
    .values({
      mockExamId: input.mockExamId,
      questionId: input.questionId,
      sectionId: input.sectionId || null,
      score: input.score,
      displayOrder: input.displayOrder,
    })
    .onConflictDoUpdate({
      target: [mockExamQuestions.mockExamId, mockExamQuestions.questionId],
      set: {
        sectionId: input.sectionId || null,
        score: input.score,
        displayOrder: input.displayOrder,
      },
    });
}

export async function getAdminMockExamConfiguration(mockExamId: string) {
  const [exam] = await getDb()
    .select()
    .from(mockExams)
    .where(eq(mockExams.id, mockExamId))
    .limit(1);
  if (!exam) return null;
  const [sections, assigned] = await Promise.all([
    getDb()
      .select()
      .from(mockExamSections)
      .where(eq(mockExamSections.mockExamId, mockExamId))
      .orderBy(asc(mockExamSections.displayOrder)),
    getDb()
      .select({
        mockExamId: mockExamQuestions.mockExamId,
        questionId: mockExamQuestions.questionId,
        title: questions.title,
        sectionId: mockExamQuestions.sectionId,
        score: mockExamQuestions.score,
        displayOrder: mockExamQuestions.displayOrder,
      })
      .from(mockExamQuestions)
      .innerJoin(questions, eq(mockExamQuestions.questionId, questions.id))
      .where(eq(mockExamQuestions.mockExamId, mockExamId))
      .orderBy(asc(mockExamQuestions.displayOrder)),
  ]);
  return { exam, sections, assigned };
}

export async function getAdminOperationalStats(courseId?: string) {
  const attemptConditions = courseId
    ? eq(mockExams.courseId, courseId)
    : undefined;
  const attempts = await getDb()
    .select({
      score: mockExamAttempts.score,
      status: mockExamAttempts.status,
    })
    .from(mockExamAttempts)
    .innerJoin(mockExams, eq(mockExamAttempts.mockExamId, mockExams.id))
    .where(attemptConditions);
  const wrong = await getDb()
    .select({
      questionId: wrongNotes.questionId,
      title: questions.title,
      count: sql<number>`sum(${wrongNotes.wrongCount})`,
    })
    .from(wrongNotes)
    .innerJoin(questions, eq(wrongNotes.questionId, questions.id))
    .where(courseId ? eq(wrongNotes.courseId, courseId) : undefined)
    .groupBy(wrongNotes.questionId, questions.title)
    .orderBy(desc(sql`sum(${wrongNotes.wrongCount})`))
    .limit(10);
  const weakTopics = await getDb()
    .select({
      topicId: topics.id,
      topicName: topics.name,
      subjectName: subjects.name,
      wrongCount: sql<number>`sum(${wrongNotes.wrongCount})`,
    })
    .from(wrongNotes)
    .innerJoin(
      questionTopics,
      eq(wrongNotes.questionId, questionTopics.questionId),
    )
    .innerJoin(topics, eq(questionTopics.topicId, topics.id))
    .innerJoin(subjects, eq(topics.subjectId, subjects.id))
    .where(courseId ? eq(wrongNotes.courseId, courseId) : undefined)
    .groupBy(topics.id, topics.name, subjects.name)
    .orderBy(desc(sql`sum(${wrongNotes.wrongCount})`))
    .limit(10);
  return {
    attemptCount: attempts.length,
    submittedCount: attempts.filter((item) =>
      ["SUBMITTED", "EXPIRED"].includes(item.status),
    ).length,
    averageScore: average(
      attempts
        .filter((item) => ["SUBMITTED", "EXPIRED"].includes(item.status))
        .map((item) => item.score),
    ),
    scoreDistribution: [0, 20, 40, 60, 80].map((start) => ({
      label: `${start}-${start + 19}`,
      count: attempts.filter(
        (item) => item.score >= start && item.score < start + 20,
      ).length,
    })),
    mostWrong: wrong.map((item) => ({ ...item, count: Number(item.count) })),
    weakTopics: weakTopics.map((item) => ({
      ...item,
      wrongCount: Number(item.wrongCount),
    })),
  };
}
