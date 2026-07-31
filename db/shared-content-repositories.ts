import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from ".";
import {
  contents,
  courseLessonExtensions,
  courseLessons,
  courses,
  curriculumNodes,
  curriculumTrees,
  learningActivities,
  lessons,
  userCourseEnrollments,
  userCourseLessonProgress,
} from "./schema";
import { createAuditInsert } from "./audit-repositories";
import { AppError } from "@/lib/errors";
import {
  assertCourseLessonCompletionAllowed,
  assertContentCanBeLinked,
  normalizeCanonicalKey,
  normalizeCourseLessonProgressPercent,
  normalizeCourseLessonTimeSpentSeconds,
  mergeCourseLessonPresentation,
} from "@/lib/services/shared-content-service";
import type {
  courseLessonExtensionSchema,
  courseLessonSchema,
  sharedContentSchema,
} from "@/lib/validation";
import type { z } from "zod";

type SharedContentInput = z.infer<typeof sharedContentSchema>;
type CourseLessonInput = z.infer<typeof courseLessonSchema>;
type CourseLessonExtensionInput = z.infer<typeof courseLessonExtensionSchema>;

function batchItems(items: BatchItem<"sqlite">[]) {
  return items as unknown as Parameters<ReturnType<typeof getDb>["batch"]>[0];
}

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function listSharedContents(status?: string) {
  return getDb()
    .select({
      id: contents.id,
      slug: contents.slug,
      canonicalKey: contents.canonicalKey,
      title: contents.title,
      summary: contents.summary,
      body: contents.body,
      bodyFormat: contents.bodyFormat,
      learningObjectivesJson: contents.learningObjectivesJson,
      coreConceptsJson: contents.coreConceptsJson,
      practicalExamplesJson: contents.practicalExamplesJson,
      version: contents.version,
      status: contents.status,
      updatedAt: contents.updatedAt,
    })
    .from(contents)
    .where(
      and(
        isNull(contents.deletedAt),
        status ? eq(contents.status, status) : undefined,
      ),
    )
    .orderBy(asc(contents.title), asc(contents.version));
}

export async function getSharedContentById(contentId: string) {
  const [content] = await getDb()
    .select()
    .from(contents)
    .where(and(eq(contents.id, contentId), isNull(contents.deletedAt)))
    .limit(1);
  return content ?? null;
}

export async function saveSharedContent(
  input: SharedContentInput,
  actorUserId: string,
) {
  const id = input.id ?? crypto.randomUUID();
  const existing = input.id ? await getSharedContentById(input.id) : null;
  if (input.id && !existing) {
    throw new AppError(
      "공통 콘텐츠를 찾을 수 없습니다.",
      404,
      "SHARED_CONTENT_NOT_FOUND",
    );
  }

  const values = {
    slug: input.slug,
    canonicalKey: normalizeCanonicalKey(input.canonicalKey),
    title: input.title,
    summary: input.summary,
    body: input.body,
    bodyFormat: input.bodyFormat,
    learningObjectivesJson: input.learningObjectivesJson,
    coreConceptsJson: input.coreConceptsJson,
    practicalExamplesJson: input.practicalExamplesJson,
    diagramsJson: input.diagramsJson,
    mediaJson: input.mediaJson,
    version: input.version,
    status: input.status,
    createdBy: existing?.createdBy ?? actorUserId,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };

  await getDb().batch(
    batchItems([
      existing
        ? getDb().update(contents).set(values).where(eq(contents.id, id))
        : getDb().insert(contents).values({ id, ...values }),
      createAuditInsert({
        actorUserId,
        action: existing ? "SHARED_CONTENT_UPDATED" : "SHARED_CONTENT_CREATED",
        resourceType: "CONTENT",
        resourceId: id,
      }),
    ]),
  );
  return { id };
}

export async function listCourseLessons(courseId: string) {
  return getDb()
    .select({
      id: courseLessons.id,
      courseId: courseLessons.courseId,
      curriculumNodeId: courseLessons.curriculumNodeId,
      contentId: courseLessons.contentId,
      lessonId: courseLessons.lessonId,
      contentTitle: contents.title,
      displayTitle: courseLessons.displayTitle,
      sortOrder: courseLessons.sortOrder,
      difficulty: courseLessons.difficulty,
      importance: courseLessons.importance,
      estimatedMinutes: courseLessons.estimatedMinutes,
      isRequired: courseLessons.isRequired,
      unlockCondition: courseLessons.unlockCondition,
      completionRule: courseLessons.completionRule,
      status: courseLessons.status,
      updatedAt: courseLessons.updatedAt,
      extensionId: courseLessonExtensions.id,
      extensionLearningObjectivesOverrideJson:
        courseLessonExtensions.learningObjectivesOverrideJson,
      extensionAdditionalBody: courseLessonExtensions.additionalBody,
      extensionExamPointsJson: courseLessonExtensions.examPointsJson,
      extensionPracticalNotes: courseLessonExtensions.practicalNotes,
      extensionLegalNotes: courseLessonExtensions.legalNotes,
      extensionStandardNotes: courseLessonExtensions.standardNotes,
      extensionEvidenceNotes: courseLessonExtensions.evidenceNotes,
      extensionCommonMistakes: courseLessonExtensions.commonMistakes,
      extensionInstructorNotes: courseLessonExtensions.instructorNotes,
      extensionVersion: courseLessonExtensions.version,
      extensionStatus: courseLessonExtensions.status,
    })
    .from(courseLessons)
    .innerJoin(contents, eq(courseLessons.contentId, contents.id))
    .leftJoin(
      courseLessonExtensions,
      eq(courseLessonExtensions.courseLessonId, courseLessons.id),
    )
    .where(
      and(eq(courseLessons.courseId, courseId), isNull(courseLessons.deletedAt)),
    )
    .orderBy(asc(courseLessons.sortOrder), asc(courseLessons.displayTitle));
}

export async function getCourseLessonById(courseLessonId: string) {
  const [row] = await getDb()
    .select()
    .from(courseLessons)
    .where(
      and(eq(courseLessons.id, courseLessonId), isNull(courseLessons.deletedAt)),
    )
    .limit(1);
  return row ?? null;
}

export async function saveCourseLesson(
  input: CourseLessonInput,
  actorUserId: string,
) {
  const id = input.id ?? crypto.randomUUID();
  const existing = input.id ? await getCourseLessonById(input.id) : null;
  if (input.id && !existing) {
    throw new AppError(
      "과정 레슨을 찾을 수 없습니다.",
      404,
      "COURSE_LESSON_NOT_FOUND",
    );
  }
  if (existing && existing.courseId !== input.courseId) {
    throw new AppError(
      "기존 과정 레슨의 과정은 변경할 수 없습니다.",
      409,
      "COURSE_LESSON_COURSE_IMMUTABLE",
    );
  }

  const [course, content, node, linkedLesson] = await Promise.all([
    getDb()
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, input.courseId), isNull(courses.deletedAt)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getSharedContentById(input.contentId),
    optionalText(input.curriculumNodeId)
      ? getDb()
          .select({
            id: curriculumNodes.id,
            courseId: curriculumTrees.courseId,
            status: curriculumNodes.status,
          })
          .from(curriculumNodes)
          .innerJoin(
            curriculumTrees,
            eq(curriculumNodes.curriculumTreeId, curriculumTrees.id),
          )
          .where(eq(curriculumNodes.id, input.curriculumNodeId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    optionalText(input.lessonId)
      ? getDb()
          .select({
            id: lessons.id,
            courseId: lessons.courseId,
            active: lessons.active,
            published: lessons.published,
            deletedAt: lessons.deletedAt,
          })
          .from(lessons)
          .where(eq(lessons.id, input.lessonId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  if (!course) {
    throw new AppError("과정을 찾을 수 없습니다.", 404, "COURSE_NOT_FOUND");
  }
  assertContentCanBeLinked(content);
  if (input.curriculumNodeId && !node) {
    throw new AppError(
      "커리큘럼 노드를 찾을 수 없습니다.",
      404,
      "CURRICULUM_NODE_NOT_FOUND",
    );
  }
  if (node && node.courseId !== input.courseId) {
    throw new AppError(
      "커리큘럼 노드가 요청한 과정에 속하지 않습니다.",
      400,
      "COURSE_LESSON_NODE_SCOPE_MISMATCH",
    );
  }
  if (node?.status === "ARCHIVED") {
    throw new AppError(
      "보관된 커리큘럼 노드에는 과정 레슨을 연결할 수 없습니다.",
      409,
      "COURSE_LESSON_NODE_ARCHIVED",
    );
  }
  if (input.lessonId && !linkedLesson) {
    throw new AppError(
      "연결할 이론 레슨을 찾을 수 없습니다.",
      404,
      "LESSON_NOT_FOUND",
    );
  }
  if (linkedLesson && linkedLesson.courseId !== input.courseId) {
    throw new AppError(
      "다른 과정의 이론 레슨은 이 과정 연결에 사용할 수 없습니다.",
      400,
      "COURSE_LESSON_LESSON_SCOPE_MISMATCH",
    );
  }
  if (linkedLesson && (!linkedLesson.active || linkedLesson.deletedAt)) {
    throw new AppError(
      "비활성 또는 삭제된 이론 레슨은 과정 레슨에 연결할 수 없습니다.",
      409,
      "COURSE_LESSON_LESSON_INACTIVE",
    );
  }

  const values = {
    courseId: input.courseId,
    curriculumNodeId: optionalText(input.curriculumNodeId),
    contentId: input.contentId,
    lessonId: optionalText(input.lessonId),
    displayTitle: input.displayTitle,
    sortOrder: input.sortOrder,
    difficulty: optionalText(input.difficulty),
    importance: input.importance ?? null,
    estimatedMinutes: input.estimatedMinutes,
    isRequired: input.isRequired,
    unlockCondition: optionalText(input.unlockCondition),
    completionRule: input.completionRule,
    status: input.status,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };

  await getDb().batch(
    batchItems([
      existing
        ? getDb().update(courseLessons).set(values).where(eq(courseLessons.id, id))
        : getDb().insert(courseLessons).values({ id, ...values }),
      createAuditInsert({
        actorUserId,
        action: existing ? "COURSE_LESSON_UPDATED" : "COURSE_LESSON_CREATED",
        resourceType: "COURSE_LESSON",
        resourceId: id,
        courseId: input.courseId,
      }),
    ]),
  );
  return { id };
}

export async function saveCourseLessonExtension(
  input: CourseLessonExtensionInput,
  actorUserId: string,
) {
  const courseLesson = await getCourseLessonById(input.courseLessonId);
  if (!courseLesson) {
    throw new AppError(
      "과정 레슨을 찾을 수 없습니다.",
      404,
      "COURSE_LESSON_NOT_FOUND",
    );
  }

  const [existing] = await getDb()
    .select()
    .from(courseLessonExtensions)
    .where(eq(courseLessonExtensions.courseLessonId, input.courseLessonId))
    .limit(1);
  const id = input.id ?? existing?.id ?? crypto.randomUUID();

  const values = {
    courseLessonId: input.courseLessonId,
    learningObjectivesOverrideJson: optionalText(
      input.learningObjectivesOverrideJson,
    ),
    additionalBody: optionalText(input.additionalBody),
    examPointsJson: input.examPointsJson,
    practicalNotes: input.practicalNotes,
    legalNotes: input.legalNotes,
    standardNotes: input.standardNotes,
    evidenceNotes: input.evidenceNotes,
    commonMistakes: input.commonMistakes,
    instructorNotes: input.instructorNotes,
    version: input.version,
    status: input.status,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };

  await getDb().batch(
    batchItems([
      existing
        ? getDb()
            .update(courseLessonExtensions)
            .set(values)
            .where(eq(courseLessonExtensions.id, id))
        : getDb().insert(courseLessonExtensions).values({ id, ...values }),
      createAuditInsert({
        actorUserId,
        action: existing
          ? "COURSE_LESSON_EXTENSION_UPDATED"
          : "COURSE_LESSON_EXTENSION_CREATED",
        resourceType: "COURSE_LESSON_EXTENSION",
        resourceId: id,
        courseId: courseLesson.courseId,
      }),
    ]),
  );
  return { id };
}

export async function listSharedContentUsage(contentId: string) {
  return getDb()
    .select({
      courseLessonId: courseLessons.id,
      courseId: courseLessons.courseId,
      courseName: courses.name,
      displayTitle: courseLessons.displayTitle,
      status: courseLessons.status,
    })
    .from(courseLessons)
    .innerJoin(courses, eq(courseLessons.courseId, courses.id))
    .where(
      and(eq(courseLessons.contentId, contentId), isNull(courseLessons.deletedAt)),
    )
    .orderBy(asc(courses.displayOrder), asc(courseLessons.sortOrder));
}

export async function listPublishedCourseLessonsForUser(
  userId: string,
  courseId: string,
) {
  const rows = await getDb()
    .select({
      id: courseLessons.id,
      courseId: courseLessons.courseId,
      contentId: courseLessons.contentId,
      lessonId: courseLessons.lessonId,
      contentTitle: contents.title,
      contentSummary: contents.summary,
      displayTitle: courseLessons.displayTitle,
      sortOrder: courseLessons.sortOrder,
      difficulty: courseLessons.difficulty,
      importance: courseLessons.importance,
      estimatedMinutes: courseLessons.estimatedMinutes,
      isRequired: courseLessons.isRequired,
      completionRule: courseLessons.completionRule,
      unlockCondition: courseLessons.unlockCondition,
      curriculumNodeId: courseLessons.curriculumNodeId,
      status: courseLessons.status,
      progressStatus: sql<string>`coalesce(${userCourseLessonProgress.status}, 'NOT_STARTED')`,
      progressPercent: sql<number>`coalesce(${userCourseLessonProgress.progressPercent}, 0)`,
      completedAt: userCourseLessonProgress.completedAt,
    })
    .from(courseLessons)
    .innerJoin(contents, eq(courseLessons.contentId, contents.id))
    .leftJoin(
      userCourseLessonProgress,
      and(
        eq(userCourseLessonProgress.userId, userId),
        eq(userCourseLessonProgress.courseId, courseLessons.courseId),
        eq(userCourseLessonProgress.courseLessonId, courseLessons.id),
      ),
    )
    .where(
      and(
        eq(courseLessons.courseId, courseId),
        eq(courseLessons.status, "PUBLISHED"),
        isNull(courseLessons.deletedAt),
        eq(contents.status, "PUBLISHED"),
        isNull(contents.deletedAt),
      ),
    )
    .orderBy(asc(courseLessons.sortOrder), asc(courseLessons.displayTitle));

  const totalLessons = rows.length;
  const completedLessons = rows.filter(
    (row) => row.progressStatus === "COMPLETED",
  ).length;

  return {
    totalLessons,
    completedLessons,
    progressPercent: totalLessons
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0,
    lessons: rows.map((row) => ({
      id: row.id,
      courseId: row.courseId,
      contentId: row.contentId,
      lessonId: row.lessonId,
      title: row.displayTitle || row.contentTitle,
      summary: row.contentSummary,
      sortOrder: row.sortOrder,
      difficulty: row.difficulty,
      importance: row.importance,
      estimatedMinutes: row.estimatedMinutes,
      isRequired: row.isRequired,
      completionRule: row.completionRule,
      unlockCondition: row.unlockCondition,
      curriculumNodeId: row.curriculumNodeId,
      status: row.progressStatus,
      progressPercent: Number(row.progressPercent ?? 0),
      completedAt: row.completedAt,
    })),
  };
}

export async function getPublishedCourseLessonProgressSummary(
  userId: string,
  courseId: string,
) {
  const [summary] = await getDb()
    .select({
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
        eq(userCourseLessonProgress.courseLessonId, courseLessons.id),
      ),
    )
    .where(
      and(
        eq(courseLessons.courseId, courseId),
        eq(courseLessons.status, "PUBLISHED"),
        isNull(courseLessons.deletedAt),
        eq(contents.status, "PUBLISHED"),
        isNull(contents.deletedAt),
      ),
    );

  const [nextLesson] = await getDb()
    .select({
      id: courseLessons.id,
      title: courseLessons.displayTitle,
      contentTitle: contents.title,
      status: sql<string>`coalesce(${userCourseLessonProgress.status}, 'NOT_STARTED')`,
    })
    .from(courseLessons)
    .innerJoin(contents, eq(courseLessons.contentId, contents.id))
    .leftJoin(
      userCourseLessonProgress,
      and(
        eq(userCourseLessonProgress.userId, userId),
        eq(userCourseLessonProgress.courseId, courseLessons.courseId),
        eq(userCourseLessonProgress.courseLessonId, courseLessons.id),
      ),
    )
    .where(
      and(
        eq(courseLessons.courseId, courseId),
        eq(courseLessons.status, "PUBLISHED"),
        isNull(courseLessons.deletedAt),
        eq(contents.status, "PUBLISHED"),
        isNull(contents.deletedAt),
        sql`coalesce(${userCourseLessonProgress.status}, 'NOT_STARTED') <> 'COMPLETED'`,
      ),
    )
    .orderBy(asc(courseLessons.sortOrder), asc(courseLessons.displayTitle))
    .limit(1);

  const [latestLesson] = await getDb()
    .select({
      id: courseLessons.id,
      title: courseLessons.displayTitle,
      contentTitle: contents.title,
      status: userCourseLessonProgress.status,
      lastViewedAt: userCourseLessonProgress.lastViewedAt,
    })
    .from(userCourseLessonProgress)
    .innerJoin(
      courseLessons,
      eq(userCourseLessonProgress.courseLessonId, courseLessons.id),
    )
    .innerJoin(contents, eq(courseLessons.contentId, contents.id))
    .where(
      and(
        eq(userCourseLessonProgress.userId, userId),
        eq(userCourseLessonProgress.courseId, courseId),
        eq(courseLessons.courseId, courseId),
        eq(courseLessons.status, "PUBLISHED"),
        isNull(courseLessons.deletedAt),
        eq(contents.status, "PUBLISHED"),
        isNull(contents.deletedAt),
      ),
    )
    .orderBy(desc(userCourseLessonProgress.lastViewedAt))
    .limit(1);

  const totalLessons = Number(summary?.totalLessons ?? 0);
  const completedLessons = Number(summary?.completedLessons ?? 0);
  return {
    totalLessons,
    completedLessons,
    progressPercent: totalLessons
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0,
    nextLesson: nextLesson
      ? {
          id: nextLesson.id,
          title: nextLesson.title || nextLesson.contentTitle,
          status: nextLesson.status ?? "NOT_STARTED",
        }
      : null,
    latestLesson: latestLesson
      ? {
          id: latestLesson.id,
          title: latestLesson.title || latestLesson.contentTitle,
          status: latestLesson.status ?? "NOT_STARTED",
        }
      : null,
    lessons: [] as Array<{
      id: string;
      title: string;
      summary: string | null;
      estimatedMinutes: number;
      status: string;
      isRequired: boolean;
      difficulty: string | null;
      importance: number | null;
    }>,
  };
}

export async function getPublishedCourseLessonForUser(input: {
  userId: string;
  courseId: string;
  courseLessonId: string;
}) {
  const [row] = await getDb()
    .select({
      id: courseLessons.id,
      courseId: courseLessons.courseId,
      contentId: courseLessons.contentId,
      lessonId: courseLessons.lessonId,
      displayTitle: courseLessons.displayTitle,
      estimatedMinutes: courseLessons.estimatedMinutes,
      isRequired: courseLessons.isRequired,
      unlockCondition: courseLessons.unlockCondition,
      completionRule: courseLessons.completionRule,
      contentTitle: contents.title,
      contentSummary: contents.summary,
      contentBody: contents.body,
      contentBodyFormat: contents.bodyFormat,
      contentVersion: contents.version,
      extensionAdditionalBody: courseLessonExtensions.additionalBody,
      extensionExamPointsJson: courseLessonExtensions.examPointsJson,
      extensionPracticalNotes: courseLessonExtensions.practicalNotes,
      extensionLegalNotes: courseLessonExtensions.legalNotes,
      extensionStandardNotes: courseLessonExtensions.standardNotes,
      extensionEvidenceNotes: courseLessonExtensions.evidenceNotes,
      extensionCommonMistakes: courseLessonExtensions.commonMistakes,
      progressStatus: sql<string>`coalesce(${userCourseLessonProgress.status}, 'NOT_STARTED')`,
      progressPercent: sql<number>`coalesce(${userCourseLessonProgress.progressPercent}, 0)`,
      completedAt: userCourseLessonProgress.completedAt,
    })
    .from(courseLessons)
    .innerJoin(contents, eq(courseLessons.contentId, contents.id))
    .leftJoin(
      courseLessonExtensions,
      and(
        eq(courseLessonExtensions.courseLessonId, courseLessons.id),
        eq(courseLessonExtensions.status, "PUBLISHED"),
      ),
    )
    .leftJoin(
      userCourseLessonProgress,
      and(
        eq(userCourseLessonProgress.userId, input.userId),
        eq(userCourseLessonProgress.courseId, courseLessons.courseId),
        eq(userCourseLessonProgress.courseLessonId, courseLessons.id),
      ),
    )
    .where(
      and(
        eq(courseLessons.id, input.courseLessonId),
        eq(courseLessons.courseId, input.courseId),
        eq(courseLessons.status, "PUBLISHED"),
        isNull(courseLessons.deletedAt),
        eq(contents.status, "PUBLISHED"),
        isNull(contents.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;

  const navigation = await getDb()
    .select({
      id: courseLessons.id,
      title: courseLessons.displayTitle,
    })
    .from(courseLessons)
    .innerJoin(contents, eq(courseLessons.contentId, contents.id))
    .where(
      and(
        eq(courseLessons.courseId, input.courseId),
        eq(courseLessons.status, "PUBLISHED"),
        isNull(courseLessons.deletedAt),
        eq(contents.status, "PUBLISHED"),
        isNull(contents.deletedAt),
      ),
    )
    .orderBy(asc(courseLessons.sortOrder), asc(courseLessons.displayTitle));
  const index = navigation.findIndex((lesson) => lesson.id === row.id);
  const presentation = mergeCourseLessonPresentation({
    content: {
      id: row.contentId,
      title: row.contentTitle,
      summary: row.contentSummary,
      body: row.contentBody,
    },
    courseLesson: {
      id: row.id,
      displayTitle: row.displayTitle,
    },
    extension: {
      additionalBody: row.extensionAdditionalBody,
      examPointsJson: row.extensionExamPointsJson ?? "[]",
      practicalNotes: row.extensionPracticalNotes ?? "",
      legalNotes: row.extensionLegalNotes ?? "",
      standardNotes: row.extensionStandardNotes ?? "",
      evidenceNotes: row.extensionEvidenceNotes ?? "",
      commonMistakes: row.extensionCommonMistakes ?? "",
    },
  });

  return {
    id: row.id,
    courseId: row.courseId,
    contentId: row.contentId,
    lessonId: row.lessonId,
    title: presentation.title,
    summary: presentation.summary,
    body: presentation.body,
    bodyFormat: row.contentBodyFormat,
    version: row.contentVersion,
    estimatedMinutes: row.estimatedMinutes,
    isRequired: row.isRequired,
    unlockCondition: row.unlockCondition,
    completionRule: row.completionRule,
    examPoints: presentation.examPoints,
    practicalNotes: presentation.practicalNotes,
    legalNotes: presentation.legalNotes,
    standardNotes: presentation.standardNotes,
    evidenceNotes: presentation.evidenceNotes,
    commonMistakes: presentation.commonMistakes,
    status: row.progressStatus,
    progressPercent: Number(row.progressPercent ?? 0),
    completedAt: row.completedAt,
    previousLesson: index > 0 ? navigation[index - 1] : null,
    nextLesson:
      index >= 0 && index < navigation.length - 1
        ? navigation[index + 1]
        : null,
  };
}

async function requireAccessibleCourseLesson(input: {
  userId: string;
  courseLessonId: string;
}) {
  const [row] = await getDb()
    .select({
      id: courseLessons.id,
      courseId: courseLessons.courseId,
      completionRule: courseLessons.completionRule,
      enrollmentStatus: userCourseEnrollments.status,
    })
    .from(courseLessons)
    .innerJoin(courses, eq(courseLessons.courseId, courses.id))
    .innerJoin(contents, eq(courseLessons.contentId, contents.id))
    .innerJoin(
      userCourseEnrollments,
      and(
        eq(userCourseEnrollments.userId, input.userId),
        eq(userCourseEnrollments.courseId, courseLessons.courseId),
      ),
    )
    .where(
      and(
        eq(courseLessons.id, input.courseLessonId),
        eq(courseLessons.status, "PUBLISHED"),
        isNull(courseLessons.deletedAt),
        eq(contents.status, "PUBLISHED"),
        isNull(contents.deletedAt),
        eq(courses.active, true),
        eq(courses.published, true),
        isNull(courses.deletedAt),
      ),
    )
    .limit(1);
  if (!row) {
    throw new AppError(
      "수강 가능한 공통 레슨을 찾을 수 없습니다.",
      404,
      "COURSE_LESSON_NOT_FOUND",
    );
  }
  if (row.enrollmentStatus === "CANCELLED") {
    throw new AppError(
      "취소된 수강 과정의 레슨에는 접근할 수 없습니다.",
      403,
      "COURSE_LESSON_ENROLLMENT_INACTIVE",
    );
  }
  return row;
}

export async function updateCourseLessonProgress(input: {
  userId: string;
  courseLessonId: string;
  action: "START" | "UPDATE" | "COMPLETE";
  progressPercent: number;
  timeSpentSeconds?: number;
}) {
  const lesson = await requireAccessibleCourseLesson(input);
  const progressPercent = normalizeCourseLessonProgressPercent(
    input.progressPercent,
  );
  const nowIso = new Date().toISOString();
  const timeSpentSeconds = normalizeCourseLessonTimeSpentSeconds(
    input.timeSpentSeconds ?? 0,
  );
  const [current] = await getDb()
    .select()
    .from(userCourseLessonProgress)
    .where(
      and(
        eq(userCourseLessonProgress.userId, input.userId),
        eq(userCourseLessonProgress.courseId, lesson.courseId),
        eq(userCourseLessonProgress.courseLessonId, lesson.id),
      ),
    )
    .limit(1);

  if (current?.status === "COMPLETED") {
    await getDb()
      .update(userCourseLessonProgress)
      .set({
        progressPercent: 100,
        lastViewedAt: nowIso,
        timeSpentSeconds: sql`max(${userCourseLessonProgress.timeSpentSeconds}, ${timeSpentSeconds})`,
        lastStudiedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(userCourseLessonProgress.id, current.id));
    return {
      status: "COMPLETED",
      progressPercent: 100,
      completedAt: current.completedAt,
      idempotentReplay: true,
    };
  }

  if (input.action !== "COMPLETE") {
    await getDb()
      .insert(userCourseLessonProgress)
      .values({
        id: current?.id ?? crypto.randomUUID(),
        userId: input.userId,
        courseId: lesson.courseId,
        courseLessonId: lesson.id,
        status: "IN_PROGRESS",
        progressPercent: Math.max(current?.progressPercent ?? 0, progressPercent),
        lastViewedAt: nowIso,
        timeSpentSeconds: Math.max(
          current?.timeSpentSeconds ?? 0,
          timeSpentSeconds,
        ),
        lastStudiedAt: nowIso,
      })
      .onConflictDoUpdate({
        target: [
          userCourseLessonProgress.userId,
          userCourseLessonProgress.courseId,
          userCourseLessonProgress.courseLessonId,
        ],
        set: {
          status: "IN_PROGRESS",
          progressPercent: sql`max(${userCourseLessonProgress.progressPercent}, ${progressPercent})`,
          lastViewedAt: nowIso,
          timeSpentSeconds: sql`max(${userCourseLessonProgress.timeSpentSeconds}, ${timeSpentSeconds})`,
          lastStudiedAt: nowIso,
          updatedAt: nowIso,
        },
      });
    return {
      status: "IN_PROGRESS",
      progressPercent: Math.max(current?.progressPercent ?? 0, progressPercent),
      completedAt: null,
      idempotentReplay: Boolean(current),
    };
  }

  assertCourseLessonCompletionAllowed({
    completionRule: lesson.completionRule,
    explicitRequest: true,
    progressPercent,
  });

  const activityId = `course-lesson-completed:${input.userId}:${lesson.id}`;
  await getDb().batch(
    batchItems([
      getDb()
        .insert(userCourseLessonProgress)
        .values({
          id: current?.id ?? crypto.randomUUID(),
          userId: input.userId,
          courseId: lesson.courseId,
          courseLessonId: lesson.id,
          status: "COMPLETED",
          progressPercent: 100,
          completedAt: nowIso,
          lastViewedAt: nowIso,
          timeSpentSeconds: Math.max(
            current?.timeSpentSeconds ?? 0,
            timeSpentSeconds,
          ),
          lastStudiedAt: nowIso,
        })
        .onConflictDoUpdate({
          target: [
            userCourseLessonProgress.userId,
            userCourseLessonProgress.courseId,
            userCourseLessonProgress.courseLessonId,
          ],
          set: {
            status: "COMPLETED",
            progressPercent: 100,
            completedAt: sql`coalesce(${userCourseLessonProgress.completedAt}, ${nowIso})`,
            lastViewedAt: nowIso,
            timeSpentSeconds: sql`max(${userCourseLessonProgress.timeSpentSeconds}, ${timeSpentSeconds})`,
            lastStudiedAt: nowIso,
            updatedAt: nowIso,
          },
        }),
      getDb()
        .insert(learningActivities)
        .values({
          id: activityId,
          userId: input.userId,
          courseId: lesson.courseId,
          activityType: "COURSE_LESSON_COMPLETED",
          targetId: lesson.id,
          metadataJson: JSON.stringify({ contentModel: "COURSE_LESSON" }),
        })
        .onConflictDoNothing(),
      getDb()
        .update(userCourseEnrollments)
        .set({
          progressPercent: sql<number>`max(${userCourseEnrollments.progressPercent}, coalesce((
            SELECT round(
              100.0 * count(uclp.course_lesson_id) /
              nullif((SELECT count(*) FROM course_lessons cl
                JOIN contents c ON c.id = cl.content_id
                WHERE cl.course_id = ${lesson.courseId}
                  AND cl.status = 'PUBLISHED'
                  AND cl.deleted_at IS NULL
                  AND c.status = 'PUBLISHED'
                  AND c.deleted_at IS NULL), 0)
            )
            FROM user_course_lesson_progress uclp
            WHERE uclp.user_id = ${input.userId}
              AND uclp.course_id = ${lesson.courseId}
              AND uclp.status = 'COMPLETED'
          ), 0))`,
          updatedAt: nowIso,
        })
        .where(
          and(
            eq(userCourseEnrollments.userId, input.userId),
            eq(userCourseEnrollments.courseId, lesson.courseId),
          ),
        ),
    ]),
  );

  return {
    status: "COMPLETED",
    progressPercent: 100,
    completedAt: nowIso,
    idempotentReplay: false,
  };
}
