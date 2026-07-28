import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from ".";
import {
  courses,
  learningActivities,
  learningUnits,
  lessons,
  subjects,
  topics,
  userCourseEnrollments,
  userLessonProgress,
  userProgress,
} from "./schema";
import type {
  LearningUnitInput,
  LessonInput,
} from "@/lib/validation";
import { AppError } from "@/lib/errors";
import {
  assertLessonCompletionAllowed,
  deriveStudySeconds,
  normalizeReadingPosition,
  readingProgressPercent,
  type LessonCompletionPolicy,
} from "@/lib/services/lesson-service";
import { createAuditInsert } from "./audit-repositories";

function batchItems(items: BatchItem<"sqlite">[]) {
  return items as unknown as Parameters<ReturnType<typeof getDb>["batch"]>[0];
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(error.message)
  );
}

async function getHierarchyScope(input: {
  courseId: string;
  subjectId: string;
  topicId?: string;
}) {
  const [subject] = await getDb()
    .select({ id: subjects.id, courseId: subjects.courseId })
    .from(subjects)
    .where(
      and(
        eq(subjects.id, input.subjectId),
        isNull(subjects.deletedAt),
      ),
    )
    .limit(1);
  if (!subject || subject.courseId !== input.courseId) {
    throw new AppError(
      "선택한 과목이 과정에 속하지 않습니다.",
      400,
      "LEARNING_UNIT_SUBJECT_SCOPE_MISMATCH",
    );
  }
  if (input.topicId) {
    const [topic] = await getDb()
      .select({ id: topics.id, subjectId: topics.subjectId })
      .from(topics)
      .where(and(eq(topics.id, input.topicId), isNull(topics.deletedAt)))
      .limit(1);
    if (!topic || topic.subjectId !== input.subjectId) {
      throw new AppError(
        "선택한 주제가 과목에 속하지 않습니다.",
        400,
        "LEARNING_UNIT_TOPIC_SCOPE_MISMATCH",
      );
    }
  }
  return {
    courseId: input.courseId,
    subjectId: input.subjectId,
    topicId: input.topicId || null,
  };
}

export async function listLearningScopeOptions() {
  const [courseRows, subjectRows, topicRows] = await Promise.all([
    getDb()
      .select({ id: courses.id, name: courses.name })
      .from(courses)
      .where(isNull(courses.deletedAt))
      .orderBy(asc(courses.displayOrder)),
    getDb()
      .select({
        id: subjects.id,
        courseId: subjects.courseId,
        name: subjects.name,
      })
      .from(subjects)
      .where(isNull(subjects.deletedAt))
      .orderBy(asc(subjects.displayOrder)),
    getDb()
      .select({
        id: topics.id,
        subjectId: topics.subjectId,
        name: topics.name,
      })
      .from(topics)
      .where(isNull(topics.deletedAt))
      .orderBy(asc(topics.displayOrder)),
  ]);
  return { courses: courseRows, subjects: subjectRows, topics: topicRows };
}

export async function listAdminLearningUnits() {
  return getDb()
    .select({
      id: learningUnits.id,
      courseId: learningUnits.courseId,
      courseName: courses.name,
      subjectId: learningUnits.subjectId,
      subjectName: subjects.name,
      topicId: learningUnits.topicId,
      topicName: topics.name,
      code: learningUnits.code,
      title: learningUnits.title,
      description: learningUnits.description,
      displayOrder: learningUnits.displayOrder,
      active: learningUnits.active,
      published: learningUnits.published,
      completionPolicy: learningUnits.completionPolicy,
      minimumProgressPercent: learningUnits.minimumProgressPercent,
      minimumStudySeconds: learningUnits.minimumStudySeconds,
      isSample: learningUnits.isSample,
      updatedAt: learningUnits.updatedAt,
    })
    .from(learningUnits)
    .innerJoin(courses, eq(learningUnits.courseId, courses.id))
    .innerJoin(subjects, eq(learningUnits.subjectId, subjects.id))
    .leftJoin(topics, eq(learningUnits.topicId, topics.id))
    .where(isNull(learningUnits.deletedAt))
    .orderBy(
      asc(courses.displayOrder),
      asc(subjects.displayOrder),
      asc(learningUnits.displayOrder),
    );
}

export async function saveLearningUnit(
  input: LearningUnitInput,
  actorUserId: string,
) {
  const scope = await getHierarchyScope(input);
  const existing = input.id
    ? (
        await getDb()
          .select({
            id: learningUnits.id,
            courseId: learningUnits.courseId,
            subjectId: learningUnits.subjectId,
            topicId: learningUnits.topicId,
          })
          .from(learningUnits)
          .where(
            and(
              eq(learningUnits.id, input.id),
              isNull(learningUnits.deletedAt),
            ),
          )
          .limit(1)
      )[0]
    : null;
  if (input.id && !existing) {
    throw new AppError(
      "학습단위를 찾을 수 없습니다.",
      404,
      "LEARNING_UNIT_NOT_FOUND",
    );
  }
  if (
    existing &&
    (existing.courseId !== scope.courseId ||
      existing.subjectId !== scope.subjectId)
  ) {
    throw new AppError(
      "진도 보호를 위해 학습단위의 과정과 과목은 변경할 수 없습니다.",
      409,
      "LEARNING_UNIT_SCOPE_IMMUTABLE",
    );
  }
  if (existing && existing.topicId !== scope.topicId) {
    const linkedLesson = (
      await getDb()
        .select({ id: lessons.id })
        .from(lessons)
        .where(eq(lessons.learningUnitId, existing.id))
        .limit(1)
    )[0];
    if (linkedLesson) {
      throw new AppError(
        "진도 기록의 연결을 보호하기 위해 레슨이 있는 학습 단위의 주제는 변경할 수 없습니다.",
        409,
        "LEARNING_UNIT_TOPIC_IMMUTABLE",
      );
    }
  }
  const id = input.id ?? crypto.randomUUID();
  const values = {
    ...scope,
    code: input.code,
    title: input.title,
    description: input.description,
    displayOrder: input.displayOrder,
    active: input.active,
    published: input.published,
    completionPolicy: input.completionPolicy,
    minimumProgressPercent: input.minimumProgressPercent,
    minimumStudySeconds: input.minimumStudySeconds,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  await getDb().batch(
    batchItems([
      existing
        ? getDb()
            .update(learningUnits)
            .set(values)
            .where(eq(learningUnits.id, id))
        : getDb().insert(learningUnits).values({ id, ...values }),
      createAuditInsert({
        actorUserId,
        action: existing
          ? "LEARNING_UNIT_UPDATED"
          : "LEARNING_UNIT_CREATED",
        resourceType: "LEARNING_UNIT",
        resourceId: id,
        courseId: scope.courseId,
      }),
    ]),
  );
  return { id, courseId: scope.courseId };
}

export async function archiveLearningUnit(
  id: string,
  actorUserId: string,
) {
  const [unit] = await getDb()
    .select({ id: learningUnits.id, courseId: learningUnits.courseId })
    .from(learningUnits)
    .where(and(eq(learningUnits.id, id), isNull(learningUnits.deletedAt)))
    .limit(1);
  if (!unit) {
    throw new AppError(
      "학습단위를 찾을 수 없습니다.",
      404,
      "LEARNING_UNIT_NOT_FOUND",
    );
  }
  await getDb().batch(
    batchItems([
      getDb()
        .update(learningUnits)
        .set({
          active: false,
          published: false,
          deletedAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(learningUnits.id, id)),
      getDb()
        .update(lessons)
        .set({
          active: false,
          published: false,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(lessons.learningUnitId, id)),
      createAuditInsert({
        actorUserId,
        action: "LEARNING_UNIT_ARCHIVED",
        resourceType: "LEARNING_UNIT",
        resourceId: id,
        courseId: unit.courseId,
      }),
    ]),
  );
  return { archived: true };
}

export async function listAdminLessons() {
  return getDb()
    .select({
      id: lessons.id,
      learningUnitId: lessons.learningUnitId,
      learningUnitTitle: learningUnits.title,
      courseId: lessons.courseId,
      courseName: courses.name,
      subjectId: lessons.subjectId,
      subjectName: subjects.name,
      topicId: lessons.topicId,
      topicName: topics.name,
      code: lessons.code,
      title: lessons.title,
      summary: lessons.summary,
      content: lessons.content,
      contentFormat: lessons.contentFormat,
      estimatedMinutes: lessons.estimatedMinutes,
      displayOrder: lessons.displayOrder,
      active: lessons.active,
      published: lessons.published,
      isSample: lessons.isSample,
      version: lessons.version,
      updatedAt: lessons.updatedAt,
    })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .innerJoin(subjects, eq(lessons.subjectId, subjects.id))
    .innerJoin(topics, eq(lessons.topicId, topics.id))
    .leftJoin(learningUnits, eq(lessons.learningUnitId, learningUnits.id))
    .where(isNull(lessons.deletedAt))
    .orderBy(
      asc(courses.displayOrder),
      asc(subjects.displayOrder),
      asc(learningUnits.displayOrder),
      asc(lessons.displayOrder),
    );
}

async function requireLessonUnit(learningUnitId: string, topicId: string) {
  const [unit] = await getDb()
    .select({
      id: learningUnits.id,
      courseId: learningUnits.courseId,
      subjectId: learningUnits.subjectId,
      topicId: learningUnits.topicId,
    })
    .from(learningUnits)
    .where(
      and(
        eq(learningUnits.id, learningUnitId),
        isNull(learningUnits.deletedAt),
      ),
    )
    .limit(1);
  if (!unit) {
    throw new AppError(
      "학습단위를 찾을 수 없습니다.",
      404,
      "LEARNING_UNIT_NOT_FOUND",
    );
  }
  const scope = await getHierarchyScope({
    courseId: unit.courseId,
    subjectId: unit.subjectId,
    topicId,
  });
  if (unit.topicId && unit.topicId !== topicId) {
    throw new AppError(
      "레슨 주제가 학습단위의 주제와 일치하지 않습니다.",
      400,
      "LESSON_TOPIC_SCOPE_MISMATCH",
    );
  }
  return {
    courseId: scope.courseId,
    subjectId: scope.subjectId,
    topicId,
    learningUnitId: unit.id,
  };
}

export async function saveLesson(input: LessonInput, actorUserId: string) {
  const scope = await requireLessonUnit(input.learningUnitId, input.topicId);
  const existing = input.id
    ? (
        await getDb()
          .select({
            id: lessons.id,
            learningUnitId: lessons.learningUnitId,
            topicId: lessons.topicId,
            version: lessons.version,
          })
          .from(lessons)
          .where(and(eq(lessons.id, input.id), isNull(lessons.deletedAt)))
          .limit(1)
      )[0]
    : null;
  if (input.id && !existing) {
    throw new AppError("레슨을 찾을 수 없습니다.", 404, "LESSON_NOT_FOUND");
  }
  if (
    existing &&
    (existing.learningUnitId !== input.learningUnitId ||
      existing.topicId !== input.topicId)
  ) {
    throw new AppError(
      "완료 기록 보호를 위해 레슨의 학습단위와 주제는 변경할 수 없습니다.",
      409,
      "LESSON_SCOPE_IMMUTABLE",
    );
  }
  const id = input.id ?? crypto.randomUUID();
  const version = (existing?.version ?? 0) + 1;
  const values = {
    ...scope,
    code: input.code,
    title: input.title,
    summary: input.summary,
    content: input.content,
    contentFormat: input.contentFormat,
    estimatedMinutes: input.estimatedMinutes,
    displayOrder: input.displayOrder,
    active: input.active,
    published: input.published,
    version,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  await getDb().batch(
    batchItems([
      existing
        ? getDb().update(lessons).set(values).where(eq(lessons.id, id))
        : getDb().insert(lessons).values({ id, ...values }),
      createAuditInsert({
        actorUserId,
        action: existing ? "LESSON_UPDATED" : "LESSON_CREATED",
        resourceType: "LESSON",
        resourceId: id,
        courseId: scope.courseId,
        metadata: { version },
      }),
    ]),
  );
  return { id, courseId: scope.courseId };
}

export async function archiveLesson(id: string, actorUserId: string) {
  const [lesson] = await getDb()
    .select({ id: lessons.id, courseId: lessons.courseId })
    .from(lessons)
    .where(and(eq(lessons.id, id), isNull(lessons.deletedAt)))
    .limit(1);
  if (!lesson) {
    throw new AppError("레슨을 찾을 수 없습니다.", 404, "LESSON_NOT_FOUND");
  }
  await getDb().batch(
    batchItems([
      getDb()
        .update(lessons)
        .set({
          active: false,
          published: false,
          deletedAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(lessons.id, id)),
      createAuditInsert({
        actorUserId,
        action: "LESSON_ARCHIVED",
        resourceType: "LESSON",
        resourceId: id,
        courseId: lesson.courseId,
      }),
    ]),
  );
  return { archived: true };
}

export async function getAdminLessonPreview(lessonId: string) {
  const [lesson] = await getDb()
    .select({
      id: lessons.id,
      title: lessons.title,
      summary: lessons.summary,
      content: lessons.content,
      contentFormat: lessons.contentFormat,
      estimatedMinutes: lessons.estimatedMinutes,
      version: lessons.version,
      published: lessons.published,
      courseName: courses.name,
      subjectName: subjects.name,
      topicName: topics.name,
      learningUnitTitle: learningUnits.title,
    })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .innerJoin(subjects, eq(lessons.subjectId, subjects.id))
    .innerJoin(topics, eq(lessons.topicId, topics.id))
    .leftJoin(learningUnits, eq(lessons.learningUnitId, learningUnits.id))
    .where(and(eq(lessons.id, lessonId), isNull(lessons.deletedAt)))
    .limit(1);
  return lesson ?? null;
}

export async function listPublishedLearningUnitsForSubject(
  userId: string,
  courseId: string,
  subjectId: string,
) {
  const rows = await getDb()
    .select({
      unitId: learningUnits.id,
      unitTitle: learningUnits.title,
      unitDescription: learningUnits.description,
      unitTopicId: learningUnits.topicId,
      unitTopicName: topics.name,
      unitDisplayOrder: learningUnits.displayOrder,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      lessonSummary: lessons.summary,
      lessonTopicId: lessons.topicId,
      estimatedMinutes: lessons.estimatedMinutes,
      lessonDisplayOrder: lessons.displayOrder,
      lessonIsSample: lessons.isSample,
      status: sql<string>`coalesce(${userLessonProgress.status}, 'NOT_STARTED')`,
      progressPercent: sql<number>`coalesce(${userLessonProgress.progressPercent}, 0)`,
      completedAt: userLessonProgress.completedAt,
    })
    .from(learningUnits)
    .leftJoin(topics, eq(learningUnits.topicId, topics.id))
    .leftJoin(
      lessons,
      and(
        eq(lessons.learningUnitId, learningUnits.id),
        eq(lessons.active, true),
        eq(lessons.published, true),
        isNull(lessons.deletedAt),
      ),
    )
    .leftJoin(
      userLessonProgress,
      and(
        eq(userLessonProgress.lessonId, lessons.id),
        eq(userLessonProgress.userId, userId),
      ),
    )
    .where(
      and(
        eq(learningUnits.courseId, courseId),
        eq(learningUnits.subjectId, subjectId),
        eq(learningUnits.active, true),
        eq(learningUnits.published, true),
        isNull(learningUnits.deletedAt),
      ),
    )
    .orderBy(asc(learningUnits.displayOrder), asc(lessons.displayOrder));

  return rows.reduce<
    Array<{
      id: string;
      title: string;
      description: string;
      topicId: string | null;
      topicName: string | null;
      displayOrder: number;
      totalLessons: number;
      completedLessons: number;
      progressPercent: number;
      lessons: Array<{
        id: string;
        title: string;
        summary: string;
        topicId: string;
        estimatedMinutes: number;
        displayOrder: number;
        isSample: boolean;
        status: string;
        progressPercent: number;
        completedAt: string | null;
      }>;
    }>
  >((units, row) => {
    let unit = units.find((item) => item.id === row.unitId);
    if (!unit) {
      unit = {
        id: row.unitId,
        title: row.unitTitle,
        description: row.unitDescription,
        topicId: row.unitTopicId,
        topicName: row.unitTopicName,
        displayOrder: row.unitDisplayOrder,
        totalLessons: 0,
        completedLessons: 0,
        progressPercent: 0,
        lessons: [],
      };
      units.push(unit);
    }
    if (row.lessonId && row.lessonTitle && row.lessonTopicId) {
      unit.lessons.push({
        id: row.lessonId,
        title: row.lessonTitle,
        summary: row.lessonSummary ?? "",
        topicId: row.lessonTopicId,
        estimatedMinutes: row.estimatedMinutes ?? 0,
        displayOrder: row.lessonDisplayOrder ?? 0,
        isSample: row.lessonIsSample ?? false,
        status: row.status,
        progressPercent: row.progressPercent,
        completedAt: row.completedAt,
      });
      unit.totalLessons += 1;
      if (row.status === "COMPLETED") unit.completedLessons += 1;
      unit.progressPercent = unit.totalLessons
        ? Math.round((unit.completedLessons / unit.totalLessons) * 100)
        : 0;
    }
    return units;
  }, []);
}

export async function getCourseTheoryProgress(
  userId: string,
  courseId: string,
) {
  const [summary] = await getDb()
    .select({
      totalLessons: sql<number>`count(${lessons.id})`,
      completedLessons: sql<number>`coalesce(sum(case when ${userLessonProgress.status} = 'COMPLETED' then 1 else 0 end), 0)`,
    })
    .from(lessons)
    .innerJoin(
      learningUnits,
      eq(lessons.learningUnitId, learningUnits.id),
    )
    .leftJoin(
      userLessonProgress,
      and(
        eq(userLessonProgress.lessonId, lessons.id),
        eq(userLessonProgress.userId, userId),
      ),
    )
    .where(
      and(
        eq(lessons.courseId, courseId),
        eq(lessons.active, true),
        eq(lessons.published, true),
        isNull(lessons.deletedAt),
        eq(learningUnits.active, true),
        eq(learningUnits.published, true),
        isNull(learningUnits.deletedAt),
      ),
    );
  const [latest] = await getDb()
    .select({
      id: lessons.id,
      title: lessons.title,
      subjectId: lessons.subjectId,
      lastViewedAt: userLessonProgress.lastViewedAt,
      status: userLessonProgress.status,
    })
    .from(userLessonProgress)
    .innerJoin(lessons, eq(userLessonProgress.lessonId, lessons.id))
    .where(
      and(
        eq(userLessonProgress.userId, userId),
        eq(userLessonProgress.courseId, courseId),
        isNull(lessons.deletedAt),
      ),
    )
    .orderBy(desc(userLessonProgress.lastViewedAt))
    .limit(1);
  const [nextLesson] = await getDb()
    .select({
      id: lessons.id,
      title: lessons.title,
      subjectId: lessons.subjectId,
    })
    .from(lessons)
    .innerJoin(
      learningUnits,
      eq(lessons.learningUnitId, learningUnits.id),
    )
    .leftJoin(
      userLessonProgress,
      and(
        eq(userLessonProgress.lessonId, lessons.id),
        eq(userLessonProgress.userId, userId),
      ),
    )
    .where(
      and(
        eq(lessons.courseId, courseId),
        eq(lessons.active, true),
        eq(lessons.published, true),
        isNull(lessons.deletedAt),
        eq(learningUnits.active, true),
        eq(learningUnits.published, true),
        isNull(learningUnits.deletedAt),
        sql`coalesce(${userLessonProgress.status}, 'NOT_STARTED') <> 'COMPLETED'`,
      ),
    )
    .orderBy(asc(learningUnits.displayOrder), asc(lessons.displayOrder))
    .limit(1);
  const totalLessons = Number(summary?.totalLessons ?? 0);
  const completedLessons = Number(summary?.completedLessons ?? 0);
  return {
    totalLessons,
    completedLessons,
    progressPercent: totalLessons
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0,
    latestLesson: latest ?? null,
    nextLesson: nextLesson ?? null,
  };
}

export async function listCourseTheoryProgress(
  userId: string,
  courseIds: string[],
) {
  if (!courseIds.length) return [];
  const rows = await getDb()
    .select({
      courseId: lessons.courseId,
      totalLessons: sql<number>`count(${lessons.id})`,
      completedLessons: sql<number>`coalesce(sum(case when ${userLessonProgress.status} = 'COMPLETED' then 1 else 0 end), 0)`,
    })
    .from(lessons)
    .innerJoin(
      learningUnits,
      eq(lessons.learningUnitId, learningUnits.id),
    )
    .leftJoin(
      userLessonProgress,
      and(
        eq(userLessonProgress.lessonId, lessons.id),
        eq(userLessonProgress.userId, userId),
      ),
    )
    .where(
      and(
        inArray(lessons.courseId, courseIds),
        eq(lessons.active, true),
        eq(lessons.published, true),
        isNull(lessons.deletedAt),
        eq(learningUnits.active, true),
        eq(learningUnits.published, true),
        isNull(learningUnits.deletedAt),
      ),
    )
    .groupBy(lessons.courseId);
  return rows.map((row) => {
    const totalLessons = Number(row.totalLessons);
    const completedLessons = Number(row.completedLessons);
    return {
      courseId: row.courseId,
      totalLessons,
      completedLessons,
      progressPercent: totalLessons
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0,
    };
  });
}

export async function getSubjectTheoryProgress(
  userId: string,
  courseId: string,
  subjectId: string,
) {
  const [summary] = await getDb()
    .select({
      totalLessons: sql<number>`count(${lessons.id})`,
      completedLessons: sql<number>`coalesce(sum(case when ${userLessonProgress.status} = 'COMPLETED' then 1 else 0 end), 0)`,
    })
    .from(lessons)
    .innerJoin(
      learningUnits,
      eq(lessons.learningUnitId, learningUnits.id),
    )
    .leftJoin(
      userLessonProgress,
      and(
        eq(userLessonProgress.lessonId, lessons.id),
        eq(userLessonProgress.userId, userId),
      ),
    )
    .where(
      and(
        eq(lessons.courseId, courseId),
        eq(lessons.subjectId, subjectId),
        eq(lessons.active, true),
        eq(lessons.published, true),
        isNull(lessons.deletedAt),
        eq(learningUnits.active, true),
        eq(learningUnits.published, true),
        isNull(learningUnits.deletedAt),
      ),
    );
  const totalLessons = Number(summary?.totalLessons ?? 0);
  const completedLessons = Number(summary?.completedLessons ?? 0);
  return {
    totalLessons,
    completedLessons,
    progressPercent: totalLessons
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0,
  };
}

export async function listSubjectTheoryProgress(
  userId: string,
  courseId: string,
) {
  const rows = await getDb()
    .select({
      subjectId: lessons.subjectId,
      totalLessons: sql<number>`count(${lessons.id})`,
      completedLessons: sql<number>`coalesce(sum(case when ${userLessonProgress.status} = 'COMPLETED' then 1 else 0 end), 0)`,
    })
    .from(lessons)
    .innerJoin(
      learningUnits,
      eq(lessons.learningUnitId, learningUnits.id),
    )
    .leftJoin(
      userLessonProgress,
      and(
        eq(userLessonProgress.lessonId, lessons.id),
        eq(userLessonProgress.userId, userId),
      ),
    )
    .where(
      and(
        eq(lessons.courseId, courseId),
        eq(lessons.active, true),
        eq(lessons.published, true),
        isNull(lessons.deletedAt),
        eq(learningUnits.active, true),
        eq(learningUnits.published, true),
        isNull(learningUnits.deletedAt),
      ),
    )
    .groupBy(lessons.subjectId);
  return rows.map((row) => {
    const totalLessons = Number(row.totalLessons);
    const completedLessons = Number(row.completedLessons);
    return {
      subjectId: row.subjectId,
      totalLessons,
      completedLessons,
      progressPercent: totalLessons
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0,
    };
  });
}

export async function getPublishedLessonForUser(
  userId: string,
  courseId: string,
  lessonId: string,
) {
  const [lesson] = await getDb()
    .select({
      id: lessons.id,
      courseId: lessons.courseId,
      subjectId: lessons.subjectId,
      topicId: lessons.topicId,
      subjectName: subjects.name,
      topicName: topics.name,
      learningUnitId: learningUnits.id,
      learningUnitTitle: learningUnits.title,
      title: lessons.title,
      summary: lessons.summary,
      content: lessons.content,
      contentFormat: lessons.contentFormat,
      estimatedMinutes: lessons.estimatedMinutes,
      isSample: lessons.isSample,
      completionPolicy: learningUnits.completionPolicy,
      minimumProgressPercent: learningUnits.minimumProgressPercent,
      minimumStudySeconds: learningUnits.minimumStudySeconds,
      status: sql<string>`coalesce(${userLessonProgress.status}, 'NOT_STARTED')`,
      progressPercent: sql<number>`coalesce(${userLessonProgress.progressPercent}, 0)`,
      lastPosition: sql<number>`coalesce(${userLessonProgress.lastPosition}, 0)`,
      studySeconds: sql<number>`coalesce(${userLessonProgress.studySeconds}, 0)`,
      completedAt: userLessonProgress.completedAt,
    })
    .from(lessons)
    .innerJoin(subjects, eq(lessons.subjectId, subjects.id))
    .innerJoin(topics, eq(lessons.topicId, topics.id))
    .innerJoin(
      learningUnits,
      eq(lessons.learningUnitId, learningUnits.id),
    )
    .leftJoin(
      userLessonProgress,
      and(
        eq(userLessonProgress.lessonId, lessons.id),
        eq(userLessonProgress.userId, userId),
      ),
    )
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(lessons.courseId, courseId),
        eq(lessons.active, true),
        eq(lessons.published, true),
        isNull(lessons.deletedAt),
        eq(learningUnits.active, true),
        eq(learningUnits.published, true),
        isNull(learningUnits.deletedAt),
        eq(subjects.active, true),
        eq(topics.active, true),
        isNull(subjects.deletedAt),
        isNull(topics.deletedAt),
      ),
    )
    .limit(1);
  if (!lesson) return null;
  const navigation = await getDb()
    .select({
      id: lessons.id,
      title: lessons.title,
      subjectId: lessons.subjectId,
    })
    .from(lessons)
    .innerJoin(subjects, eq(lessons.subjectId, subjects.id))
    .innerJoin(
      learningUnits,
      eq(lessons.learningUnitId, learningUnits.id),
    )
    .where(
      and(
        eq(lessons.courseId, courseId),
        eq(lessons.active, true),
        eq(lessons.published, true),
        isNull(lessons.deletedAt),
        eq(learningUnits.active, true),
        eq(learningUnits.published, true),
        isNull(learningUnits.deletedAt),
      ),
    )
    .orderBy(
      asc(subjects.displayOrder),
      asc(learningUnits.displayOrder),
      asc(lessons.displayOrder),
    );
  const index = navigation.findIndex((item) => item.id === lesson.id);
  return {
    ...lesson,
    previousLesson: index > 0 ? navigation[index - 1] : null,
    nextLesson:
      index >= 0 && index < navigation.length - 1
        ? navigation[index + 1]
        : null,
  };
}

async function requireAccessibleLesson(userId: string, lessonId: string) {
  const [lesson] = await getDb()
    .select({
      id: lessons.id,
      courseId: lessons.courseId,
      subjectId: lessons.subjectId,
      topicId: lessons.topicId,
      completionPolicy: learningUnits.completionPolicy,
      minimumProgressPercent: learningUnits.minimumProgressPercent,
      minimumStudySeconds: learningUnits.minimumStudySeconds,
      enrollmentStatus: userCourseEnrollments.status,
    })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .innerJoin(subjects, eq(lessons.subjectId, subjects.id))
    .innerJoin(topics, eq(lessons.topicId, topics.id))
    .innerJoin(
      learningUnits,
      eq(lessons.learningUnitId, learningUnits.id),
    )
    .innerJoin(
      userCourseEnrollments,
      and(
        eq(userCourseEnrollments.courseId, lessons.courseId),
        eq(userCourseEnrollments.userId, userId),
      ),
    )
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(lessons.active, true),
        eq(lessons.published, true),
        isNull(lessons.deletedAt),
        eq(learningUnits.active, true),
        eq(learningUnits.published, true),
        isNull(learningUnits.deletedAt),
        eq(courses.active, true),
        eq(courses.published, true),
        eq(subjects.active, true),
        eq(topics.active, true),
        isNull(courses.deletedAt),
        isNull(subjects.deletedAt),
        isNull(topics.deletedAt),
      ),
    )
    .limit(1);
  if (!lesson) {
    throw new AppError(
      "수강 가능한 레슨을 찾을 수 없습니다.",
      404,
      "LESSON_NOT_FOUND",
    );
  }
  if (lesson.enrollmentStatus === "CANCELLED") {
    throw new AppError(
      "취소된 수강 과정의 레슨에는 접근할 수 없습니다.",
      403,
      "LESSON_ENROLLMENT_INACTIVE",
    );
  }
  return lesson;
}

async function readCurrentProgress(userId: string, lessonId: string) {
  return (
    await getDb()
      .select()
      .from(userLessonProgress)
      .where(
        and(
          eq(userLessonProgress.userId, userId),
          eq(userLessonProgress.lessonId, lessonId),
        ),
      )
      .limit(1)
  )[0];
}

export async function updateLessonProgress(input: {
  userId: string;
  lessonId: string;
  action: "START" | "UPDATE" | "COMPLETE";
  lastPosition: number;
}) {
  const lesson = await requireAccessibleLesson(input.userId, input.lessonId);
  const current = await readCurrentProgress(input.userId, input.lessonId);
  const now = new Date();
  const nowIso = now.toISOString();
  const position = Math.max(
    current?.lastPosition ?? 0,
    normalizeReadingPosition(input.lastPosition),
  );
  const progressPercent = Math.max(
    current?.progressPercent ?? 0,
    readingProgressPercent(position),
  );
  const studySeconds =
    (current?.studySeconds ?? 0) +
    deriveStudySeconds(current?.lastViewedAt ?? null, now);

  if (current?.status === "COMPLETED") {
    await getDb()
      .update(userLessonProgress)
      .set({
        lastViewedAt: nowIso,
        lastStudiedAt: nowIso,
        lastPosition: position,
        progressPercent: 100,
        updatedAt: nowIso,
      })
      .where(eq(userLessonProgress.id, current.id));
    const theory = await getCourseTheoryProgress(input.userId, lesson.courseId);
    return {
      status: "COMPLETED",
      progressPercent: 100,
      lastPosition: position,
      completedAt: current.completedAt,
      idempotentReplay: true,
      courseProgressPercent: theory.progressPercent,
    };
  }

  if (input.action !== "COMPLETE") {
    const progressId = current?.id ?? crypto.randomUUID();
    await getDb()
      .insert(userLessonProgress)
      .values({
        id: progressId,
        userId: input.userId,
        courseId: lesson.courseId,
        lessonId: input.lessonId,
        status: "IN_PROGRESS",
        progressPercent,
        startedAt: current?.startedAt ?? nowIso,
        lastViewedAt: nowIso,
        lastPosition: position,
        studySeconds,
        lastStudiedAt: nowIso,
      })
      .onConflictDoUpdate({
        target: [userLessonProgress.userId, userLessonProgress.lessonId],
        set: {
          progressPercent: sql`max(${userLessonProgress.progressPercent}, ${progressPercent})`,
          lastViewedAt: nowIso,
          lastPosition: sql`max(${userLessonProgress.lastPosition}, ${position})`,
          studySeconds,
          lastStudiedAt: nowIso,
          updatedAt: nowIso,
        },
      });
    return {
      status: "IN_PROGRESS",
      progressPercent,
      lastPosition: position,
      completedAt: null,
      idempotentReplay: Boolean(current),
    };
  }

  assertLessonCompletionAllowed({
    policy: lesson.completionPolicy as LessonCompletionPolicy,
    explicitRequest: true,
    progressPercent,
    studySeconds,
    minimumProgressPercent: lesson.minimumProgressPercent,
    minimumStudySeconds: lesson.minimumStudySeconds,
  });

  const completionActivityId = `lesson-completed:${input.userId}:${input.lessonId}`;
  const operations: BatchItem<"sqlite">[] = [
    getDb()
      .insert(userLessonProgress)
      .values({
        id: current?.id ?? crypto.randomUUID(),
        userId: input.userId,
        courseId: lesson.courseId,
        lessonId: input.lessonId,
        status: "COMPLETED",
        progressPercent: 100,
        startedAt: current?.startedAt ?? nowIso,
        completedAt: nowIso,
        lastViewedAt: nowIso,
        lastPosition: position,
        studySeconds,
        lastStudiedAt: nowIso,
      })
      .onConflictDoUpdate({
        target: [userLessonProgress.userId, userLessonProgress.lessonId],
        set: {
          status: "COMPLETED",
          progressPercent: 100,
          completedAt: nowIso,
          lastViewedAt: nowIso,
          lastPosition: position,
          studySeconds,
          lastStudiedAt: nowIso,
          updatedAt: nowIso,
        },
      }),
    getDb().insert(learningActivities).values({
      id: completionActivityId,
      userId: input.userId,
      courseId: lesson.courseId,
      activityType: "LESSON_COMPLETED",
      targetId: input.lessonId,
      metadataJson: JSON.stringify({
        subjectId: lesson.subjectId,
        topicId: lesson.topicId,
      }),
    }),
    getDb()
      .insert(userProgress)
      .values({
        id: crypto.randomUUID(),
        userId: input.userId,
        courseId: lesson.courseId,
        subjectId: lesson.subjectId,
        topicId: lesson.topicId,
        completedLessons: 1,
        lastStudiedAt: nowIso,
      })
      .onConflictDoUpdate({
        target: [
          userProgress.userId,
          userProgress.courseId,
          userProgress.subjectId,
          userProgress.topicId,
        ],
        set: {
          completedLessons: sql`${userProgress.completedLessons} + 1`,
          lastStudiedAt: nowIso,
          updatedAt: nowIso,
        },
      }),
    getDb()
      .update(userCourseEnrollments)
      .set({
        progressPercent: sql<number>`max(${userCourseEnrollments.progressPercent}, coalesce((
          SELECT round(
            100.0 * count(ulp.lesson_id) /
            nullif((SELECT count(*) FROM lessons l
              JOIN learning_units lu ON lu.id = l.learning_unit_id
              WHERE l.course_id = ${lesson.courseId}
                AND l.active = 1 AND l.published = 1 AND l.deleted_at IS NULL
                AND lu.active = 1 AND lu.published = 1 AND lu.deleted_at IS NULL), 0)
          )
          FROM user_lesson_progress ulp
          JOIN lessons completed_lesson ON completed_lesson.id = ulp.lesson_id
          WHERE ulp.user_id = ${input.userId}
            AND ulp.course_id = ${lesson.courseId}
            AND ulp.status = 'COMPLETED'
            AND completed_lesson.active = 1
            AND completed_lesson.published = 1
            AND completed_lesson.deleted_at IS NULL
        ), 0))`,
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(userCourseEnrollments.userId, input.userId),
          eq(userCourseEnrollments.courseId, lesson.courseId),
        ),
      ),
  ];
  try {
    await getDb().batch(batchItems(operations));
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const completed = await readCurrentProgress(
        input.userId,
        input.lessonId,
      );
      if (completed?.status === "COMPLETED") {
        const theory = await getCourseTheoryProgress(
          input.userId,
          lesson.courseId,
        );
        return {
          status: "COMPLETED",
          progressPercent: 100,
          lastPosition: completed.lastPosition,
          completedAt: completed.completedAt,
          idempotentReplay: true,
          courseProgressPercent: theory.progressPercent,
        };
      }
    }
    throw error;
  }
  const theory = await getCourseTheoryProgress(input.userId, lesson.courseId);
  return {
    status: "COMPLETED",
    progressPercent: 100,
    lastPosition: position,
    completedAt: nowIso,
    idempotentReplay: false,
    courseProgressPercent: theory.progressPercent,
  };
}

export function startLesson(userId: string, lessonId: string) {
  return updateLessonProgress({
    userId,
    lessonId,
    action: "START",
    lastPosition: 0,
  });
}

export function completeLesson(userId: string, lessonId: string) {
  return updateLessonProgress({
    userId,
    lessonId,
    action: "COMPLETE",
    lastPosition: 0,
  });
}
