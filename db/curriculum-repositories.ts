import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from ".";
import {
  contents,
  courseLessons,
  courses,
  curriculumNodes,
  curriculumTrees,
  learningUnits,
  lessons,
  questionAttempts,
  questionCourses,
  questionSubjects,
  questionTopics,
  questions,
  reviewSchedules,
  subjects,
  topics,
  userCourseLessonProgress,
  userLessonProgress,
  wrongNotes,
} from "./schema";
import { AppError } from "@/lib/errors";
import type {
  curriculumNodeArchiveSchema,
  curriculumNodeSchema,
  curriculumTreeSchema,
} from "@/lib/validation";
import type { z } from "zod";
import {
  assertNoDuplicateSortOrder,
  assertValidParentSelection,
  buildCurriculumTree,
  computeNodeDepth,
  computeNodePath,
  normalizeMetadata,
  normalizeOptionalText,
  recalculateSubtreePaths,
  type CurriculumNodeRecord,
} from "@/lib/services/curriculum-service";
import { createAuditInsert } from "./audit-repositories";

type CurriculumTreeInput = z.infer<typeof curriculumTreeSchema>;
type CurriculumNodeInput = z.infer<typeof curriculumNodeSchema>;
type CurriculumNodeArchiveInput = z.infer<typeof curriculumNodeArchiveSchema>;
type LinkedContentType = "SUBJECT" | "TOPIC" | "LEARNING_UNIT" | "LESSON";
type LinkedContent = { type: LinkedContentType; id: string };

function batchItems(items: BatchItem<"sqlite">[]) {
  return items as unknown as Parameters<ReturnType<typeof getDb>["batch"]>[0];
}

export async function listCurriculumTrees(courseId?: string) {
  return getDb()
    .select({
      id: curriculumTrees.id,
      courseId: curriculumTrees.courseId,
      courseName: courses.name,
      title: curriculumTrees.title,
      version: curriculumTrees.version,
      sourceType: curriculumTrees.sourceType,
      sourceDocument: curriculumTrees.sourceDocument,
      effectiveFrom: curriculumTrees.effectiveFrom,
      effectiveTo: curriculumTrees.effectiveTo,
      status: curriculumTrees.status,
      createdAt: curriculumTrees.createdAt,
      updatedAt: curriculumTrees.updatedAt,
    })
    .from(curriculumTrees)
    .innerJoin(courses, eq(curriculumTrees.courseId, courses.id))
    .where(courseId ? eq(curriculumTrees.courseId, courseId) : undefined)
    .orderBy(asc(courses.displayOrder), asc(curriculumTrees.version));
}

export async function listCurriculumLinkableContent(courseId: string) {
  const [subjectRows, topicRows, unitRows, lessonRows] = await Promise.all([
    getDb()
      .select({
        type: sql<"SUBJECT">`'SUBJECT'`,
        id: subjects.id,
        title: subjects.name,
        subtitle: subjects.code,
        active: subjects.active,
        published: sql<boolean>`1`,
        displayOrder: subjects.displayOrder,
      })
      .from(subjects)
      .where(and(eq(subjects.courseId, courseId), isNull(subjects.deletedAt)))
      .orderBy(asc(subjects.displayOrder), asc(subjects.name)),
    getDb()
      .select({
        type: sql<"TOPIC">`'TOPIC'`,
        id: topics.id,
        title: topics.name,
        subtitle: sql<string>`${subjects.name} || ' · ' || ${topics.code}`,
        active: topics.active,
        published: sql<boolean>`1`,
        displayOrder: topics.displayOrder,
      })
      .from(topics)
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(and(eq(subjects.courseId, courseId), isNull(topics.deletedAt)))
      .orderBy(asc(subjects.displayOrder), asc(topics.displayOrder), asc(topics.name)),
    getDb()
      .select({
        type: sql<"LEARNING_UNIT">`'LEARNING_UNIT'`,
        id: learningUnits.id,
        title: learningUnits.title,
        subtitle: sql<string>`${subjects.name} || ' · ' || ${learningUnits.code}`,
        active: learningUnits.active,
        published: learningUnits.published,
        displayOrder: learningUnits.displayOrder,
      })
      .from(learningUnits)
      .innerJoin(subjects, eq(learningUnits.subjectId, subjects.id))
      .where(and(eq(learningUnits.courseId, courseId), isNull(learningUnits.deletedAt)))
      .orderBy(asc(subjects.displayOrder), asc(learningUnits.displayOrder), asc(learningUnits.title)),
    getDb()
      .select({
        type: sql<"LESSON">`'LESSON'`,
        id: lessons.id,
        title: lessons.title,
        subtitle: sql<string>`${subjects.name} || ' · ' || ${topics.name}`,
        active: lessons.active,
        published: lessons.published,
        displayOrder: lessons.displayOrder,
      })
      .from(lessons)
      .innerJoin(subjects, eq(lessons.subjectId, subjects.id))
      .innerJoin(topics, eq(lessons.topicId, topics.id))
      .where(and(eq(lessons.courseId, courseId), isNull(lessons.deletedAt)))
      .orderBy(asc(subjects.displayOrder), asc(topics.displayOrder), asc(lessons.displayOrder), asc(lessons.title)),
  ]);

  return [...subjectRows, ...topicRows, ...unitRows, ...lessonRows];
}

function parseLinkedContent(metadata: string | null | undefined): LinkedContent[] {
  if (!metadata) return [];
  const parsed = JSON.parse(metadata) as {
    linkedContent?: Array<{ type?: unknown; id?: unknown }>;
  };
  if (!Array.isArray(parsed.linkedContent)) return [];
  return parsed.linkedContent
    .filter(
      (link): link is LinkedContent =>
        typeof link.type === "string" &&
        typeof link.id === "string" &&
        ["SUBJECT", "TOPIC", "LEARNING_UNIT", "LESSON"].includes(link.type),
    )
    .map((link) => ({ type: link.type, id: link.id }));
}

function safeRate(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0;
}

function chunkValues<T>(values: T[], size = 75) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function assertLinkedContentBelongsToCourse(input: {
  courseId: string;
  metadata: string | null | undefined;
}) {
  const links = parseLinkedContent(input.metadata);
  if (!links.length) return;

  const byType = new Map<string, string[]>();
  for (const link of links) {
    const ids = byType.get(link.type) ?? [];
    ids.push(link.id);
    byType.set(link.type, ids);
  }

  const validate = async (
    type: string,
    ids: string[],
    loader: (ids: string[]) => Promise<Array<{ id: string }>>,
  ) => {
    const uniqueIds = [...new Set(ids)];
    const rows = await loader(uniqueIds);
    if (rows.length !== uniqueIds.length) {
      throw new AppError(
        "선택한 연결 콘텐츠 중 현재 과정에 속하지 않는 항목이 있습니다.",
        400,
        "CURRICULUM_LINK_SCOPE_MISMATCH",
      );
    }
  };

  const subjectIds = byType.get("SUBJECT") ?? [];
  if (subjectIds.length) {
    await validate("SUBJECT", subjectIds, (ids) =>
      getDb()
        .select({ id: subjects.id })
        .from(subjects)
        .where(
          and(
            inArray(subjects.id, ids),
            eq(subjects.courseId, input.courseId),
            isNull(subjects.deletedAt),
          ),
        ),
    );
  }

  const topicIds = byType.get("TOPIC") ?? [];
  if (topicIds.length) {
    await validate("TOPIC", topicIds, (ids) =>
      getDb()
        .select({ id: topics.id })
        .from(topics)
        .innerJoin(subjects, eq(topics.subjectId, subjects.id))
        .where(
          and(
            inArray(topics.id, ids),
            eq(subjects.courseId, input.courseId),
            isNull(topics.deletedAt),
          ),
        ),
    );
  }

  const unitIds = byType.get("LEARNING_UNIT") ?? [];
  if (unitIds.length) {
    await validate("LEARNING_UNIT", unitIds, (ids) =>
      getDb()
        .select({ id: learningUnits.id })
        .from(learningUnits)
        .where(
          and(
            inArray(learningUnits.id, ids),
            eq(learningUnits.courseId, input.courseId),
            isNull(learningUnits.deletedAt),
          ),
        ),
    );
  }

  const lessonIds = byType.get("LESSON") ?? [];
  if (lessonIds.length) {
    await validate("LESSON", lessonIds, (ids) =>
      getDb()
        .select({ id: lessons.id })
        .from(lessons)
        .where(
          and(
            inArray(lessons.id, ids),
            eq(lessons.courseId, input.courseId),
            isNull(lessons.deletedAt),
          ),
        ),
    );
  }
}

export async function getCurriculumTreeById(treeId: string) {
  const [tree] = await getDb()
    .select()
    .from(curriculumTrees)
    .where(eq(curriculumTrees.id, treeId))
    .limit(1);
  return tree ?? null;
}

export async function getActiveCurriculumTreeForCourse(courseId: string) {
  const [tree] = await getDb()
    .select()
    .from(curriculumTrees)
    .where(
      and(
        eq(curriculumTrees.courseId, courseId),
        eq(curriculumTrees.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return tree ?? null;
}

export async function getPublishedCurriculumPathOverviewForCourse(
  courseId: string,
  userId?: string,
) {
  const tree = await getActiveCurriculumTreeForCourse(courseId);
  if (!tree) return null;

  const nodeRows = await getDb()
    .select({
      id: curriculumNodes.id,
      curriculumTreeId: curriculumNodes.curriculumTreeId,
      parentId: curriculumNodes.parentId,
      nodeType: curriculumNodes.nodeType,
      title: curriculumNodes.title,
      description: curriculumNodes.description,
      officialCode: curriculumNodes.officialCode,
      officialTitle: curriculumNodes.officialTitle,
      sortOrder: curriculumNodes.sortOrder,
      depth: curriculumNodes.depth,
      path: curriculumNodes.path,
      isRequired: curriculumNodes.isRequired,
      isPractical: curriculumNodes.isPractical,
      difficulty: curriculumNodes.difficulty,
      importance: curriculumNodes.importance,
      metadata: curriculumNodes.metadata,
      status: curriculumNodes.status,
    })
    .from(curriculumNodes)
    .where(
      and(
        eq(curriculumNodes.curriculumTreeId, tree.id),
        eq(curriculumNodes.status, "ACTIVE"),
      ),
    )
    .orderBy(
      asc(curriculumNodes.depth),
      asc(curriculumNodes.sortOrder),
      asc(curriculumNodes.title),
      asc(curriculumNodes.id),
    );

  const nodeIds = nodeRows.map((node) => node.id);
  const linkedContentByNodeId = new Map(
    nodeRows.map((node) => [node.id, parseLinkedContent(node.metadata)]),
  );
  const allLinkedContent = [...linkedContentByNodeId.values()].flat();
  const subjectIds = [
    ...new Set(
      allLinkedContent
        .filter((link) => link.type === "SUBJECT")
        .map((link) => link.id),
    ),
  ];
  const topicIds = [
    ...new Set(
      allLinkedContent
        .filter((link) => link.type === "TOPIC")
        .map((link) => link.id),
    ),
  ];
  const [courseLessonRows, subjectQuestionRows, topicQuestionRows] =
    await Promise.all([
      nodeIds.length
        ? getDb()
            .select({
              id: courseLessons.id,
              curriculumNodeId: courseLessons.curriculumNodeId,
              displayTitle: courseLessons.displayTitle,
              contentTitle: contents.title,
              progressStatus: sql<string>`coalesce(${userCourseLessonProgress.status}, 'NOT_STARTED')`,
            })
            .from(courseLessons)
            .innerJoin(contents, eq(courseLessons.contentId, contents.id))
            .leftJoin(
              userCourseLessonProgress,
              and(
                eq(userCourseLessonProgress.userId, userId ?? ""),
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
                inArray(courseLessons.curriculumNodeId, nodeIds),
              ),
            )
            .orderBy(asc(courseLessons.sortOrder), asc(courseLessons.displayTitle))
        : [],
      subjectIds.length
        ? getDb()
            .select({
              subjectId: questionSubjects.subjectId,
              questionId: questionSubjects.questionId,
            })
            .from(questionSubjects)
            .where(inArray(questionSubjects.subjectId, subjectIds))
        : [],
      topicIds.length
        ? getDb()
            .select({
              topicId: questionTopics.topicId,
              questionId: questionTopics.questionId,
            })
            .from(questionTopics)
            .where(inArray(questionTopics.topicId, topicIds))
        : [],
    ]);

  const lessonsByNodeId = new Map<
    string,
    Array<{ id: string; title: string; status: string }>
  >();
  for (const lesson of courseLessonRows) {
    if (!lesson.curriculumNodeId) continue;
    const rows = lessonsByNodeId.get(lesson.curriculumNodeId) ?? [];
    rows.push({
      id: lesson.id,
      title: lesson.displayTitle || lesson.contentTitle,
      status: lesson.progressStatus ?? "NOT_STARTED",
    });
    lessonsByNodeId.set(lesson.curriculumNodeId, rows);
  }
  const questionIdsBySubject = new Map<string, Set<string>>();
  for (const row of subjectQuestionRows) {
    const set = questionIdsBySubject.get(row.subjectId) ?? new Set<string>();
    set.add(row.questionId);
    questionIdsBySubject.set(row.subjectId, set);
  }
  const questionIdsByTopic = new Map<string, Set<string>>();
  for (const row of topicQuestionRows) {
    const set = questionIdsByTopic.get(row.topicId) ?? new Set<string>();
    set.add(row.questionId);
    questionIdsByTopic.set(row.topicId, set);
  }

  const nodes = nodeRows.map((node) => {
    const linkedContent = linkedContentByNodeId.get(node.id) ?? [];
    const linkedLessons = lessonsByNodeId.get(node.id) ?? [];
    const completedLinkedLessons = linkedLessons.filter(
      (lesson) => lesson.status === "COMPLETED",
    ).length;
    const firstLesson =
      linkedLessons.find((lesson) => lesson.status !== "COMPLETED") ??
      linkedLessons[0] ??
      null;
    const nodeQuestionIds = new Set<string>();
    for (const link of linkedContent) {
      if (link.type === "SUBJECT") {
        for (const questionId of questionIdsBySubject.get(link.id) ?? []) {
          nodeQuestionIds.add(questionId);
        }
      }
      if (link.type === "TOPIC") {
        for (const questionId of questionIdsByTopic.get(link.id) ?? []) {
          nodeQuestionIds.add(questionId);
        }
      }
    }

    return {
      ...node,
      linkedContent,
      linkedContentCount: linkedContent.length,
      linkedLessonCount: linkedLessons.length,
      completedLinkedLessons,
      linkedLessonProgressPercent: linkedLessons.length
        ? Math.round((completedLinkedLessons / linkedLessons.length) * 100)
        : 0,
      linkedLessons,
      linkedLesson: firstLesson
        ? { id: firstLesson.id, title: firstLesson.title }
        : null,
      questionStats: {
        questionCount: nodeQuestionIds.size,
        attemptCount: 0,
        correctAttempts: 0,
        accuracy: 0,
        wrongQuestionCount: 0,
        wrongAttemptCount: 0,
        dueReviewCount: 0,
      },
    };
  });
  const completedLinkedLessons = courseLessonRows.filter(
    (lesson) => lesson.progressStatus === "COMPLETED",
  ).length;

  return {
    tree: {
      id: tree.id,
      title: tree.title,
      version: tree.version,
      effectiveFrom: tree.effectiveFrom,
      effectiveTo: tree.effectiveTo,
      sourceType: tree.sourceType,
      sourceDocument: tree.sourceDocument,
    },
    nodes: buildCurriculumTree(nodes),
    nodeCount: nodes.length,
    linkedLessonCount: courseLessonRows.length,
    completedLinkedLessons,
    progressPercent: courseLessonRows.length
      ? Math.round((completedLinkedLessons / courseLessonRows.length) * 100)
      : 0,
  };
}

export async function getPublishedCurriculumPathForCourse(
  courseId: string,
  userId?: string,
) {
  const tree = await getActiveCurriculumTreeForCourse(courseId);
  if (!tree) return null;

  const nodeRows = await getDb()
    .select({
      id: curriculumNodes.id,
      curriculumTreeId: curriculumNodes.curriculumTreeId,
      parentId: curriculumNodes.parentId,
      nodeType: curriculumNodes.nodeType,
      title: curriculumNodes.title,
      description: curriculumNodes.description,
      officialCode: curriculumNodes.officialCode,
      officialTitle: curriculumNodes.officialTitle,
      sortOrder: curriculumNodes.sortOrder,
      depth: curriculumNodes.depth,
      path: curriculumNodes.path,
      isRequired: curriculumNodes.isRequired,
      isPractical: curriculumNodes.isPractical,
      difficulty: curriculumNodes.difficulty,
      importance: curriculumNodes.importance,
      metadata: curriculumNodes.metadata,
      status: curriculumNodes.status,
    })
    .from(curriculumNodes)
    .where(
      and(
        eq(curriculumNodes.curriculumTreeId, tree.id),
        eq(curriculumNodes.status, "ACTIVE"),
      ),
    )
    .orderBy(
      asc(curriculumNodes.depth),
      asc(curriculumNodes.sortOrder),
      asc(curriculumNodes.title),
      asc(curriculumNodes.id),
    );

  const lessonIds = [
    ...new Set(
      nodeRows.flatMap((node) =>
        parseLinkedContent(node.metadata)
          .filter((link) => link.type === "LESSON")
          .map((link) => link.id),
      ),
    ),
  ];
  const lessonRows = lessonIds.length
    ? await getDb()
        .select({
          id: lessons.id,
          title: lessons.title,
        })
        .from(lessons)
        .where(
          and(
            inArray(lessons.id, lessonIds),
            eq(lessons.courseId, courseId),
            eq(lessons.active, true),
            eq(lessons.published, true),
            isNull(lessons.deletedAt),
          ),
        )
    : [];
  const visibleLessonIds = lessonRows.map((lesson) => lesson.id);
  const progressRows =
    userId && visibleLessonIds.length
      ? await getDb()
          .select({
            lessonId: userLessonProgress.lessonId,
            status: userLessonProgress.status,
            progressPercent: userLessonProgress.progressPercent,
          })
          .from(userLessonProgress)
          .where(
            and(
              eq(userLessonProgress.userId, userId),
              eq(userLessonProgress.courseId, courseId),
              inArray(userLessonProgress.lessonId, visibleLessonIds),
            ),
          )
      : [];
  const lessonById = new Map(lessonRows.map((lesson) => [lesson.id, lesson]));
  const progressByLessonId = new Map(
    progressRows.map((progress) => [progress.lessonId, progress]),
  );
  const allLinkedContent = nodeRows.flatMap((node) =>
    parseLinkedContent(node.metadata),
  );
  const subjectIds = [
    ...new Set(
      allLinkedContent
        .filter((link) => link.type === "SUBJECT")
        .map((link) => link.id),
    ),
  ];
  const topicIds = [
    ...new Set(
      allLinkedContent
        .filter((link) => link.type === "TOPIC")
        .map((link) => link.id),
    ),
  ];
  const [subjectQuestionRows, topicQuestionRows] = await Promise.all([
    subjectIds.length
      ? getDb()
          .select({
            subjectId: questionSubjects.subjectId,
            questionId: questionSubjects.questionId,
          })
          .from(questionSubjects)
          .where(inArray(questionSubjects.subjectId, subjectIds))
      : [],
    topicIds.length
      ? getDb()
          .select({
            topicId: questionTopics.topicId,
            questionId: questionTopics.questionId,
          })
          .from(questionTopics)
          .where(inArray(questionTopics.topicId, topicIds))
      : [],
  ]);
  const questionIdsBySubject = new Map<string, Set<string>>();
  for (const row of subjectQuestionRows) {
    const set = questionIdsBySubject.get(row.subjectId) ?? new Set<string>();
    set.add(row.questionId);
    questionIdsBySubject.set(row.subjectId, set);
  }
  const questionIdsByTopic = new Map<string, Set<string>>();
  for (const row of topicQuestionRows) {
    const set = questionIdsByTopic.get(row.topicId) ?? new Set<string>();
    set.add(row.questionId);
    questionIdsByTopic.set(row.topicId, set);
  }
  const mappedQuestionIds = [
    ...new Set([
      ...subjectQuestionRows.map((row) => row.questionId),
      ...topicQuestionRows.map((row) => row.questionId),
    ]),
  ];
  const nowIso = new Date().toISOString();
  const [attemptRows, wrongRows, reviewRows] =
    userId && mappedQuestionIds.length
      ? await Promise.all([
          Promise.all(
            chunkValues(mappedQuestionIds).map((questionIdChunk) =>
              getDb()
                .select({
                  questionId: questionAttempts.questionId,
                  isCorrect: questionAttempts.isCorrect,
                })
                .from(questionAttempts)
                .where(
                  and(
                    eq(questionAttempts.userId, userId),
                    eq(questionAttempts.courseId, courseId),
                    inArray(questionAttempts.questionId, questionIdChunk),
                  ),
                ),
            ),
          ).then((chunks) => chunks.flat()),
          Promise.all(
            chunkValues(mappedQuestionIds).map((questionIdChunk) =>
              getDb()
                .select({
                  questionId: wrongNotes.questionId,
                  wrongCount: wrongNotes.wrongCount,
                })
                .from(wrongNotes)
                .where(
                  and(
                    eq(wrongNotes.userId, userId),
                    eq(wrongNotes.courseId, courseId),
                    eq(wrongNotes.mastered, false),
                    inArray(wrongNotes.questionId, questionIdChunk),
                  ),
                ),
            ),
          ).then((chunks) => chunks.flat()),
          Promise.all(
            chunkValues(mappedQuestionIds).map((questionIdChunk) =>
              getDb()
                .select({
                  questionId: reviewSchedules.targetId,
                })
                .from(reviewSchedules)
                .where(
                  and(
                    eq(reviewSchedules.userId, userId),
                    eq(reviewSchedules.courseId, courseId),
                    eq(reviewSchedules.targetType, "QUESTION"),
                    inArray(reviewSchedules.status, ["DUE", "SCHEDULED"]),
                    sql`${reviewSchedules.nextReviewAt} <= ${nowIso}`,
                    inArray(reviewSchedules.targetId, questionIdChunk),
                  ),
                ),
            ),
          ).then((chunks) => chunks.flat()),
        ])
      : [[], [], []];
  const attemptsByQuestionId = new Map<
    string,
    Array<{ isCorrect: boolean }>
  >();
  for (const attempt of attemptRows) {
    const rows = attemptsByQuestionId.get(attempt.questionId) ?? [];
    rows.push({ isCorrect: attempt.isCorrect });
    attemptsByQuestionId.set(attempt.questionId, rows);
  }
  const wrongCountByQuestionId = new Map(
    wrongRows.map((row) => [row.questionId, row.wrongCount]),
  );
  const dueReviewQuestionIds = new Set(
    reviewRows.map((row) => row.questionId),
  );
  const nodes = nodeRows.map((node) => {
    const linkedContent = parseLinkedContent(node.metadata);
    const linkedLessons = linkedContent
      .filter((link) => link.type === "LESSON")
      .map((link) => lessonById.get(link.id))
      .filter((lesson): lesson is { id: string; title: string } =>
        Boolean(lesson),
      );
    const linkedLessonProgress = linkedLessons.map((lesson) => {
      const progress = progressByLessonId.get(lesson.id);
      return {
        id: lesson.id,
        title: lesson.title,
        status: progress?.status ?? "NOT_STARTED",
        progressPercent: progress?.progressPercent ?? 0,
      };
    });
    const firstLesson =
      linkedLessonProgress.find((lesson) => lesson.status !== "COMPLETED") ??
      linkedLessonProgress[0] ??
      null;
    const completedLinkedLessons = linkedLessons.filter(
      (lesson) => progressByLessonId.get(lesson.id)?.status === "COMPLETED",
    ).length;
    const nodeQuestionIds = new Set<string>();
    for (const link of linkedContent) {
      if (link.type === "SUBJECT") {
        for (const questionId of questionIdsBySubject.get(link.id) ?? []) {
          nodeQuestionIds.add(questionId);
        }
      }
      if (link.type === "TOPIC") {
        for (const questionId of questionIdsByTopic.get(link.id) ?? []) {
          nodeQuestionIds.add(questionId);
        }
      }
    }
    const nodeAttempts = [...nodeQuestionIds].flatMap(
      (questionId) => attemptsByQuestionId.get(questionId) ?? [],
    );
    const correctAttempts = nodeAttempts.filter(
      (attempt) => attempt.isCorrect,
    ).length;
    const wrongQuestionCount = [...nodeQuestionIds].filter(
      (questionId) => (wrongCountByQuestionId.get(questionId) ?? 0) > 0,
    ).length;
    const wrongAttemptCount = [...nodeQuestionIds].reduce(
      (sum, questionId) => sum + (wrongCountByQuestionId.get(questionId) ?? 0),
      0,
    );
    const dueReviewCount = [...nodeQuestionIds].filter((questionId) =>
      dueReviewQuestionIds.has(questionId),
    ).length;
    return {
      ...node,
      linkedContent,
      linkedContentCount: linkedContent.length,
      linkedLessonCount: linkedLessons.length,
      completedLinkedLessons,
      linkedLessonProgressPercent: linkedLessons.length
        ? Math.round((completedLinkedLessons / linkedLessons.length) * 100)
        : 0,
      linkedLessons: linkedLessonProgress,
      linkedLesson: firstLesson
        ? { id: firstLesson.id, title: firstLesson.title }
        : null,
      questionStats: {
        questionCount: nodeQuestionIds.size,
        attemptCount: nodeAttempts.length,
        correctAttempts,
        accuracy: safeRate(correctAttempts, nodeAttempts.length),
        wrongQuestionCount,
        wrongAttemptCount,
        dueReviewCount,
      },
    };
  });
  const completedLinkedLessons = visibleLessonIds.filter(
    (lessonId) => progressByLessonId.get(lessonId)?.status === "COMPLETED",
  ).length;

  return {
    tree: {
      id: tree.id,
      title: tree.title,
      version: tree.version,
      effectiveFrom: tree.effectiveFrom,
      effectiveTo: tree.effectiveTo,
      sourceType: tree.sourceType,
      sourceDocument: tree.sourceDocument,
    },
    nodes: buildCurriculumTree(nodes),
    nodeCount: nodes.length,
    linkedLessonCount: visibleLessonIds.length,
    completedLinkedLessons,
    progressPercent: visibleLessonIds.length
      ? Math.round((completedLinkedLessons / visibleLessonIds.length) * 100)
      : 0,
  };
}

export async function saveCurriculumTree(
  input: CurriculumTreeInput,
  actorUserId: string,
) {
  const [course] = await getDb()
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, input.courseId), isNull(courses.deletedAt)))
    .limit(1);
  if (!course) {
    throw new AppError(
      "커리큘럼을 연결할 과정을 찾을 수 없습니다.",
      404,
      "CURRICULUM_COURSE_NOT_FOUND",
    );
  }

  const existing = input.id
    ? await getCurriculumTreeById(input.id)
    : null;
  if (input.id && !existing) {
    throw new AppError(
      "커리큘럼 트리를 찾을 수 없습니다.",
      404,
      "CURRICULUM_TREE_NOT_FOUND",
    );
  }
  if (existing && existing.courseId !== input.courseId) {
    throw new AppError(
      "기존 커리큘럼 트리의 과정은 변경할 수 없습니다.",
      409,
      "CURRICULUM_TREE_COURSE_IMMUTABLE",
    );
  }

  const duplicateVersionFilters = [
    eq(curriculumTrees.courseId, input.courseId),
    eq(curriculumTrees.version, input.version),
    input.id ? ne(curriculumTrees.id, input.id) : undefined,
  ];
  const [duplicateVersion] = await getDb()
    .select({ id: curriculumTrees.id })
    .from(curriculumTrees)
    .where(and(...duplicateVersionFilters))
    .limit(1);
  if (duplicateVersion) {
    throw new AppError(
      "같은 과정에 동일한 커리큘럼 버전이 이미 존재합니다.",
      409,
      "CURRICULUM_TREE_VERSION_DUPLICATE",
    );
  }

  if (input.status === "ACTIVE") {
    const activeTreeFilters = [
      eq(curriculumTrees.courseId, input.courseId),
      eq(curriculumTrees.status, "ACTIVE"),
      input.id ? ne(curriculumTrees.id, input.id) : undefined,
    ];
    const [activeTree] = await getDb()
      .select({ id: curriculumTrees.id })
      .from(curriculumTrees)
      .where(and(...activeTreeFilters))
      .limit(1);
    if (activeTree) {
      throw new AppError(
        "같은 과정에 활성 커리큘럼 트리가 이미 존재합니다.",
        409,
        "CURRICULUM_TREE_ACTIVE_DUPLICATE",
      );
    }
  }

  const id = input.id ?? crypto.randomUUID();
  const values = {
    courseId: input.courseId,
    title: input.title,
    version: input.version,
    sourceType: normalizeOptionalText(input.sourceType),
    sourceDocument: normalizeOptionalText(input.sourceDocument),
    effectiveFrom: normalizeOptionalText(input.effectiveFrom),
    effectiveTo: normalizeOptionalText(input.effectiveTo),
    status: input.status,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };

  await getDb().batch(
    batchItems([
      existing
        ? getDb()
            .update(curriculumTrees)
            .set(values)
            .where(eq(curriculumTrees.id, id))
        : getDb().insert(curriculumTrees).values({ id, ...values }),
      createAuditInsert({
        actorUserId,
        action: existing
          ? "CURRICULUM_TREE_UPDATED"
          : "CURRICULUM_TREE_CREATED",
        resourceType: "CURRICULUM_TREE",
        resourceId: id,
        courseId: input.courseId,
      }),
    ]),
  );
  return { id };
}

export async function listCurriculumNodes(treeId: string) {
  return getDb()
    .select()
    .from(curriculumNodes)
    .where(
      and(
        eq(curriculumNodes.curriculumTreeId, treeId),
        ne(curriculumNodes.status, "ARCHIVED"),
      ),
    )
    .orderBy(
      asc(curriculumNodes.depth),
      asc(curriculumNodes.sortOrder),
      asc(curriculumNodes.title),
      asc(curriculumNodes.id),
    );
}

export async function listCurriculumNodeOperationalStats(treeId: string) {
  const tree = await getCurriculumTreeById(treeId);
  if (!tree) return [];

  const nodes = await listCurriculumNodes(treeId);
  const linkedContent = nodes.flatMap((node) =>
    parseLinkedContent(node.metadata).map((link) => ({
      nodeId: node.id,
      ...link,
    })),
  );
  const subjectIds = [
    ...new Set(
      linkedContent
        .filter((link) => link.type === "SUBJECT")
        .map((link) => link.id),
    ),
  ];
  const topicIds = [
    ...new Set(
      linkedContent
        .filter((link) => link.type === "TOPIC")
        .map((link) => link.id),
    ),
  ];

  const [subjectQuestionRows, topicQuestionRows] = await Promise.all([
    subjectIds.length
      ? getDb()
          .select({
            subjectId: questionSubjects.subjectId,
            questionId: questionSubjects.questionId,
          })
          .from(questionSubjects)
          .innerJoin(subjects, eq(questionSubjects.subjectId, subjects.id))
          .where(
            and(
              eq(subjects.courseId, tree.courseId),
              inArray(questionSubjects.subjectId, subjectIds),
            ),
          )
      : [],
    topicIds.length
      ? getDb()
          .select({
            topicId: questionTopics.topicId,
            questionId: questionTopics.questionId,
          })
          .from(questionTopics)
          .innerJoin(topics, eq(questionTopics.topicId, topics.id))
          .innerJoin(subjects, eq(topics.subjectId, subjects.id))
          .where(
            and(
              eq(subjects.courseId, tree.courseId),
              inArray(questionTopics.topicId, topicIds),
            ),
          )
      : [],
  ]);

  const questionIdsBySubject = new Map<string, Set<string>>();
  for (const row of subjectQuestionRows) {
    const set = questionIdsBySubject.get(row.subjectId) ?? new Set<string>();
    set.add(row.questionId);
    questionIdsBySubject.set(row.subjectId, set);
  }
  const questionIdsByTopic = new Map<string, Set<string>>();
  for (const row of topicQuestionRows) {
    const set = questionIdsByTopic.get(row.topicId) ?? new Set<string>();
    set.add(row.questionId);
    questionIdsByTopic.set(row.topicId, set);
  }

  const mappedQuestionIds = [
    ...new Set([
      ...subjectQuestionRows.map((row) => row.questionId),
      ...topicQuestionRows.map((row) => row.questionId),
    ]),
  ];
  const nowIso = new Date().toISOString();
  const [attemptRows, wrongRows, reviewRows] = mappedQuestionIds.length
    ? await Promise.all([
        Promise.all(
          chunkValues(mappedQuestionIds).map((questionIdChunk) =>
            getDb()
              .select({
                questionId: questionAttempts.questionId,
                isCorrect: questionAttempts.isCorrect,
              })
              .from(questionAttempts)
              .where(
                and(
                  eq(questionAttempts.courseId, tree.courseId),
                  inArray(questionAttempts.questionId, questionIdChunk),
                ),
              ),
          ),
        ).then((chunks) => chunks.flat()),
        Promise.all(
          chunkValues(mappedQuestionIds).map((questionIdChunk) =>
            getDb()
              .select({
                questionId: wrongNotes.questionId,
                wrongCount: wrongNotes.wrongCount,
              })
              .from(wrongNotes)
              .where(
                and(
                  eq(wrongNotes.courseId, tree.courseId),
                  eq(wrongNotes.mastered, false),
                  inArray(wrongNotes.questionId, questionIdChunk),
                ),
              ),
          ),
        ).then((chunks) => chunks.flat()),
        Promise.all(
          chunkValues(mappedQuestionIds).map((questionIdChunk) =>
            getDb()
              .select({
                questionId: reviewSchedules.targetId,
              })
              .from(reviewSchedules)
              .where(
                and(
                  eq(reviewSchedules.courseId, tree.courseId),
                  eq(reviewSchedules.targetType, "QUESTION"),
                  inArray(reviewSchedules.status, ["DUE", "SCHEDULED"]),
                  sql`${reviewSchedules.nextReviewAt} <= ${nowIso}`,
                  inArray(reviewSchedules.targetId, questionIdChunk),
                ),
              ),
          ),
        ).then((chunks) => chunks.flat()),
      ])
    : [[], [], []];

  const attemptsByQuestionId = new Map<
    string,
    Array<{ isCorrect: boolean }>
  >();
  for (const attempt of attemptRows) {
    const rows = attemptsByQuestionId.get(attempt.questionId) ?? [];
    rows.push({ isCorrect: attempt.isCorrect });
    attemptsByQuestionId.set(attempt.questionId, rows);
  }
  const wrongCountByQuestionId = new Map<string, number>();
  for (const wrong of wrongRows) {
    wrongCountByQuestionId.set(
      wrong.questionId,
      (wrongCountByQuestionId.get(wrong.questionId) ?? 0) + wrong.wrongCount,
    );
  }
  const dueReviewCountByQuestionId = new Map<string, number>();
  for (const review of reviewRows) {
    dueReviewCountByQuestionId.set(
      review.questionId,
      (dueReviewCountByQuestionId.get(review.questionId) ?? 0) + 1,
    );
  }

  return nodes.map((node) => {
    const nodeQuestionIds = new Set<string>();
    for (const link of parseLinkedContent(node.metadata)) {
      if (link.type === "SUBJECT") {
        for (const questionId of questionIdsBySubject.get(link.id) ?? []) {
          nodeQuestionIds.add(questionId);
        }
      }
      if (link.type === "TOPIC") {
        for (const questionId of questionIdsByTopic.get(link.id) ?? []) {
          nodeQuestionIds.add(questionId);
        }
      }
    }
    const nodeAttempts = [...nodeQuestionIds].flatMap(
      (questionId) => attemptsByQuestionId.get(questionId) ?? [],
    );
    const correctAttempts = nodeAttempts.filter(
      (attempt) => attempt.isCorrect,
    ).length;
    return {
      nodeId: node.id,
      questionCount: nodeQuestionIds.size,
      attemptCount: nodeAttempts.length,
      correctAttempts,
      accuracy: safeRate(correctAttempts, nodeAttempts.length),
      wrongQuestionCount: [...nodeQuestionIds].filter(
        (questionId) => (wrongCountByQuestionId.get(questionId) ?? 0) > 0,
      ).length,
      wrongAttemptCount: [...nodeQuestionIds].reduce(
        (sum, questionId) => sum + (wrongCountByQuestionId.get(questionId) ?? 0),
        0,
      ),
      dueReviewCount: [...nodeQuestionIds].reduce(
        (sum, questionId) =>
          sum + (dueReviewCountByQuestionId.get(questionId) ?? 0),
        0,
      ),
    };
  });
}

export async function getCurriculumTreeCoverage(treeId: string) {
  const tree = await getCurriculumTreeById(treeId);
  if (!tree) return null;

  const nodes = await listCurriculumNodes(treeId);
  const linkedNodeCount = nodes.filter(
    (node) => parseLinkedContent(node.metadata).length > 0,
  ).length;

  const [courseLessonRows, publishedQuestionRows] = await Promise.all([
    getDb()
      .select({
        id: courseLessons.id,
        curriculumNodeId: courseLessons.curriculumNodeId,
      })
      .from(courseLessons)
      .innerJoin(contents, eq(courseLessons.contentId, contents.id))
      .where(
        and(
          eq(courseLessons.courseId, tree.courseId),
          eq(courseLessons.status, "PUBLISHED"),
          isNull(courseLessons.deletedAt),
          eq(contents.status, "PUBLISHED"),
          isNull(contents.deletedAt),
        ),
      ),
    getDb()
      .select({
        questionId: questionCourses.questionId,
      })
      .from(questionCourses)
      .innerJoin(questions, eq(questionCourses.questionId, questions.id))
      .where(
        and(
          eq(questionCourses.courseId, tree.courseId),
          eq(questions.status, "PUBLISHED"),
        ),
      ),
  ]);

  const courseLessonNodeIds = new Set(
    courseLessonRows
      .map((lesson) => lesson.curriculumNodeId)
      .filter((id): id is string => Boolean(id)),
  );

  return {
    treeId,
    courseId: tree.courseId,
    status: tree.status,
    nodeCount: nodes.length,
    linkedNodeCount,
    linkedNodePercent: safeRate(linkedNodeCount, nodes.length),
    publishedCourseLessonCount: courseLessonRows.length,
    courseLessonNodeCount: courseLessonNodeIds.size,
    courseLessonNodePercent: safeRate(courseLessonNodeIds.size, nodes.length),
    unlinkedCourseLessonCount: courseLessonRows.filter(
      (lesson) => !lesson.curriculumNodeId,
    ).length,
    publishedQuestionCount: new Set(
      publishedQuestionRows.map((row) => row.questionId),
    ).size,
  };
}

export async function listUnlinkedCourseLessonsForCurriculumTree(
  treeId: string,
  limit = 8,
) {
  const tree = await getCurriculumTreeById(treeId);
  if (!tree) return [];

  return getDb()
    .select({
      id: courseLessons.id,
      courseId: courseLessons.courseId,
      contentId: courseLessons.contentId,
      contentTitle: contents.title,
      displayTitle: courseLessons.displayTitle,
      sortOrder: courseLessons.sortOrder,
      status: courseLessons.status,
      updatedAt: courseLessons.updatedAt,
    })
    .from(courseLessons)
    .innerJoin(contents, eq(courseLessons.contentId, contents.id))
    .where(
      and(
        eq(courseLessons.courseId, tree.courseId),
        eq(courseLessons.status, "PUBLISHED"),
        isNull(courseLessons.curriculumNodeId),
        isNull(courseLessons.deletedAt),
        eq(contents.status, "PUBLISHED"),
        isNull(contents.deletedAt),
      ),
    )
    .orderBy(asc(courseLessons.sortOrder), asc(courseLessons.displayTitle))
    .limit(limit);
}

export async function getCurriculumNodeTree(treeId: string) {
  const nodes = await listCurriculumNodes(treeId);
  return buildCurriculumTree(nodes);
}

async function listAllNodesForTree(treeId: string): Promise<CurriculumNodeRecord[]> {
  return getDb()
    .select({
      id: curriculumNodes.id,
      curriculumTreeId: curriculumNodes.curriculumTreeId,
      parentId: curriculumNodes.parentId,
      sortOrder: curriculumNodes.sortOrder,
      depth: curriculumNodes.depth,
      path: curriculumNodes.path,
      status: curriculumNodes.status,
    })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.curriculumTreeId, treeId));
}

async function getParentNode(parentId: string | null) {
  if (!parentId) return null;
  const [parent] = await getDb()
    .select({
      id: curriculumNodes.id,
      curriculumTreeId: curriculumNodes.curriculumTreeId,
      parentId: curriculumNodes.parentId,
      sortOrder: curriculumNodes.sortOrder,
      depth: curriculumNodes.depth,
      path: curriculumNodes.path,
      status: curriculumNodes.status,
    })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.id, parentId))
    .limit(1);
  return parent ?? null;
}

export async function saveCurriculumNode(
  input: CurriculumNodeInput,
  actorUserId: string,
) {
  const tree = await getCurriculumTreeById(input.curriculumTreeId);
  if (!tree) {
    throw new AppError(
      "커리큘럼 트리를 찾을 수 없습니다.",
      404,
      "CURRICULUM_TREE_NOT_FOUND",
    );
  }
  if (tree.status === "ARCHIVED") {
    throw new AppError(
      "보관된 커리큘럼 트리는 수정할 수 없습니다.",
      409,
      "CURRICULUM_TREE_ARCHIVED",
    );
  }

  const existing = input.id
    ? (
        await getDb()
          .select()
          .from(curriculumNodes)
          .where(eq(curriculumNodes.id, input.id))
          .limit(1)
      )[0]
    : null;
  if (input.id && !existing) {
    throw new AppError(
      "커리큘럼 노드를 찾을 수 없습니다.",
      404,
      "CURRICULUM_NODE_NOT_FOUND",
    );
  }
  if (existing && existing.curriculumTreeId !== input.curriculumTreeId) {
    throw new AppError(
      "기존 커리큘럼 노드의 트리는 변경할 수 없습니다.",
      409,
      "CURRICULUM_NODE_TREE_IMMUTABLE",
    );
  }

  const parentId = normalizeOptionalText(input.parentId);
  const [nodes, parent] = await Promise.all([
    listAllNodesForTree(input.curriculumTreeId),
    getParentNode(parentId),
  ]);
  assertValidParentSelection({
    nodeId: input.id,
    treeId: input.curriculumTreeId,
    parent,
    parentId,
    nodes,
  });
  assertNoDuplicateSortOrder({
    nodes,
    treeId: input.curriculumTreeId,
    nodeId: input.id,
    parentId,
    sortOrder: input.sortOrder,
  });

  const id = input.id ?? crypto.randomUUID();
  const depth = computeNodeDepth(parent);
  if (depth > 20) {
    throw new AppError(
      "커리큘럼 노드 깊이는 20단계를 초과할 수 없습니다.",
      400,
      "CURRICULUM_DEPTH_LIMIT",
    );
  }
  const path = computeNodePath(parent, id);
  const descendantUpdates =
    existing && (existing.parentId !== parentId || existing.path !== path)
      ? recalculateSubtreePaths({
          nodes,
          rootId: id,
          rootDepth: depth,
          rootPath: path,
        })
      : [];

  const values = {
    curriculumTreeId: input.curriculumTreeId,
    parentId,
    nodeType: input.nodeType,
    title: input.title,
    description: input.description,
    officialCode: normalizeOptionalText(input.officialCode),
    officialTitle: normalizeOptionalText(input.officialTitle),
    sortOrder: input.sortOrder,
    depth,
    path,
    isRequired: input.isRequired,
    isPractical: input.isPractical,
    difficulty: normalizeOptionalText(input.difficulty),
    importance: input.importance ?? null,
    metadata: normalizeMetadata(input.metadata),
    status: input.status,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  await assertLinkedContentBelongsToCourse({
    courseId: tree.courseId,
    metadata: values.metadata,
  });

  await getDb().batch(
    batchItems([
      existing
        ? getDb()
            .update(curriculumNodes)
            .set(values)
            .where(eq(curriculumNodes.id, id))
        : getDb().insert(curriculumNodes).values({ id, ...values }),
      ...descendantUpdates.map((update) =>
        getDb()
          .update(curriculumNodes)
          .set({
            depth: update.depth,
            path: update.path,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(curriculumNodes.id, update.id)),
      ),
      createAuditInsert({
        actorUserId,
        action: existing
          ? "CURRICULUM_NODE_UPDATED"
          : "CURRICULUM_NODE_CREATED",
        resourceType: "CURRICULUM_NODE",
        resourceId: id,
        courseId: tree.courseId,
      }),
    ]),
  );
  return { id, depth, path };
}

export async function archiveCurriculumNode(
  input: CurriculumNodeArchiveInput,
  actorUserId: string,
) {
  const [node] = await getDb()
    .select({
      id: curriculumNodes.id,
      curriculumTreeId: curriculumNodes.curriculumTreeId,
      status: curriculumNodes.status,
      courseId: curriculumTrees.courseId,
    })
    .from(curriculumNodes)
    .innerJoin(
      curriculumTrees,
      eq(curriculumNodes.curriculumTreeId, curriculumTrees.id),
    )
    .where(eq(curriculumNodes.id, input.id))
    .limit(1);
  if (!node) {
    throw new AppError(
      "커리큘럼 노드를 찾을 수 없습니다.",
      404,
      "CURRICULUM_NODE_NOT_FOUND",
    );
  }
  const [child] = await getDb()
    .select({ id: curriculumNodes.id })
    .from(curriculumNodes)
    .where(
      and(
        eq(curriculumNodes.parentId, input.id),
        ne(curriculumNodes.status, "ARCHIVED"),
      ),
    )
    .limit(1);
  if (child) {
    throw new AppError(
      "하위 노드가 있는 커리큘럼 노드는 보관할 수 없습니다.",
      409,
      "CURRICULUM_NODE_HAS_CHILDREN",
    );
  }

  await getDb().batch(
    batchItems([
      getDb()
        .update(curriculumNodes)
        .set({
          status: "ARCHIVED",
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(curriculumNodes.id, input.id)),
      createAuditInsert({
        actorUserId,
        action: "CURRICULUM_NODE_ARCHIVED",
        resourceType: "CURRICULUM_NODE",
        resourceId: input.id,
        courseId: node.courseId,
      }),
    ]),
  );
  return { id: input.id };
}
