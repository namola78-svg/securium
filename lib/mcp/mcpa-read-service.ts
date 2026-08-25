import { getPublicCourseBySlug, listPublishedCourses } from "../../db/repositories.ts";
import { getSharedContentById, listCourseLessons } from "../../db/shared-content-repositories.ts";
import { listPublicQuestions } from "../../db/question-repositories.ts";
import { isPublicCourse } from "../services/catalog-service.ts";
import type { McpACourse, McpALesson, McpAQuestion, McpAReadService } from "./mcpa-core.ts";

function parseJsonArray(value: string | null | undefined): readonly string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toCourse(row: Awaited<ReturnType<typeof listPublishedCourses>>[number]): McpACourse {
  return { ...row, deletedAt: null };
}

async function getPublishedCourse(courseKey: string) {
  const row = await getPublicCourseBySlug(courseKey);
  return row ? toCourse(row) : null;
}

async function listPublishedLessons(course: McpACourse): Promise<readonly McpALesson[]> {
  const rows = await listCourseLessons(course.id);
  const published = rows.filter((row) => row.status === "PUBLISHED");
  const lessons: Array<McpALesson | null> = await Promise.all(published.map(async (row) => {
    const content = await getSharedContentById(row.contentId);
    if (!content || content.status !== "PUBLISHED" || content.deletedAt) return null;
    return {
      id: row.id,
      courseId: row.courseId,
      contentId: row.contentId,
      contentKey: content.canonicalKey,
      title: row.displayTitle || content.title,
      summary: content.summary,
      body: content.body,
      bodyFormat: content.bodyFormat,
      sortOrder: row.sortOrder,
      estimatedMinutes: row.estimatedMinutes,
      status: "PUBLISHED" as const,
      updatedAt: content.updatedAt,
      learningObjectives: parseJsonArray(content.learningObjectivesJson),
    } satisfies McpALesson;
  }));
  return lessons.filter((lesson): lesson is McpALesson => lesson !== null).sort((left, right) => left.sortOrder - right.sortOrder || left.contentKey.localeCompare(right.contentKey));
}

async function getPublishedLesson(courseKey: string, stableLessonKey: string) {
  const course = await getPublishedCourse(courseKey);
  if (!course) return null;
  const expectedPrefix = `lesson:${encodeURIComponent(course.slug)}:`;
  if (!stableLessonKey.startsWith(expectedPrefix)) return null;
  const contentKey = decodeURIComponent(stableLessonKey.slice(expectedPrefix.length));
  const lessons = await listPublishedLessons(course);
  return lessons.find((lesson) => lesson.contentKey === contentKey) ?? null;
}

async function listPublishedQuestionRows(input: Readonly<{ courseId?: string; questionIds?: readonly string[] }>): Promise<readonly McpAQuestion[]> {
  const rows = await listPublicQuestions({ courseId: input.courseId, questionIds: input.questionIds ? [...input.questionIds] : undefined, limit: 50 });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type,
    difficulty: row.difficulty,
    courseId: row.courseId,
    questionVersionId: row.questionVersionId,
    questionVersionSemanticHash: row.questionVersionSemanticHash,
    createdAt: row.createdAt,
    choices: row.choices,
  }));
}

export function createMcpAReadService(): McpAReadService {
  return Object.freeze({
    listPublishedCourses: async () => (await listPublishedCourses()).map(toCourse).filter(isPublicCourse),
    getPublicCourseByKey: getPublishedCourse,
    listPublishedLessons,
    getPublicLesson: getPublishedLesson,
    listPublishedQuestions: listPublishedQuestionRows,
  });
}
