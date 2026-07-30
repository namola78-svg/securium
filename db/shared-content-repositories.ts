import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from ".";
import {
  contents,
  courseLessonExtensions,
  courseLessons,
  courses,
  curriculumNodes,
  curriculumTrees,
} from "./schema";
import { createAuditInsert } from "./audit-repositories";
import { AppError } from "@/lib/errors";
import {
  assertContentCanBeLinked,
  normalizeCanonicalKey,
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
      bodyFormat: contents.bodyFormat,
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
      contentTitle: contents.title,
      displayTitle: courseLessons.displayTitle,
      sortOrder: courseLessons.sortOrder,
      difficulty: courseLessons.difficulty,
      importance: courseLessons.importance,
      estimatedMinutes: courseLessons.estimatedMinutes,
      isRequired: courseLessons.isRequired,
      completionRule: courseLessons.completionRule,
      status: courseLessons.status,
      updatedAt: courseLessons.updatedAt,
    })
    .from(courseLessons)
    .innerJoin(contents, eq(courseLessons.contentId, contents.id))
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

  const [course, content, node] = await Promise.all([
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

  const values = {
    courseId: input.courseId,
    curriculumNodeId: optionalText(input.curriculumNodeId),
    contentId: input.contentId,
    displayTitle: input.displayTitle,
    sortOrder: input.sortOrder,
    difficulty: optionalText(input.difficulty),
    importance: input.importance ?? null,
    estimatedMinutes: input.estimatedMinutes,
    isRequired: input.isRequired,
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
