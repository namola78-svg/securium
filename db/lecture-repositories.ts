import {
  and,
  asc,
  eq,
  isNull,
  like,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from ".";
import {
  courses,
  lectureBookmarks,
  lectureNotes,
  lectureProgress,
  lectures,
  lessons,
  questionCourses,
  questionSubjects,
  questionTopics,
  questions,
  subjects,
  topics,
  userCourseEnrollments,
} from "./schema";
import { AppError } from "@/lib/errors";
import {
  assertLectureCompletionPosition,
  createSafeVideoEmbed,
  getVideoProviderConfig,
  validateLecturePosition,
} from "@/lib/services/video-provider-service";
import { getLatestPublishedRevision } from "./content-revision-repositories";

type LectureFilters = {
  subjectId?: string;
  topicId?: string;
  query?: string;
};

function truncateUtf8(value: string, maxBytes: number) {
  const encoder = new TextEncoder();
  let result = "";

  for (const character of value) {
    const candidate = result + character;
    if (encoder.encode(candidate).byteLength > maxBytes) break;
    result = candidate;
  }

  return result;
}

async function getEnrollmentStatus(
  userId: string | null,
  courseId: string,
) {
  if (!userId) return null;
  const [enrollment] = await getDb()
    .select({ status: userCourseEnrollments.status })
    .from(userCourseEnrollments)
    .where(
      and(
        eq(userCourseEnrollments.userId, userId),
        eq(userCourseEnrollments.courseId, courseId),
      ),
    )
    .limit(1);
  return enrollment?.status ?? null;
}

export async function listPublishedLectures(
  courseId: string,
  userId: string | null,
  filters: LectureFilters = {},
) {
  const viewerId = userId ?? "__anonymous__";
  // D1 limits LIKE patterns by byte length. Keep room for surrounding
  // wildcards and do not split a multi-byte UTF-8 character.
  const search = filters.query
    ? truncateUtf8(filters.query.trim(), 48)
    : "";
  const pattern = `%${search.replaceAll("%", "").replaceAll("_", "")}%`;
  const [rows, enrollmentStatus] = await Promise.all([
    getDb()
      .select({
        id: lectures.id,
        courseId: lectures.courseId,
        subjectId: lectures.subjectId,
        subjectName: subjects.name,
        topicId: lectures.topicId,
        topicName: topics.name,
        title: lectures.title,
        instructorName: lectures.instructorName,
        description: lectures.description,
        videoProvider: lectures.videoProvider,
        videoUrl: lectures.videoUrl,
        thumbnailUrl: lectures.thumbnailUrl,
        durationSeconds: lectures.durationSeconds,
        free: lectures.free,
        displayOrder: lectures.displayOrder,
        isSample: lectures.isSample,
        currentPositionSeconds:
          sql<number>`coalesce(${lectureProgress.currentPositionSeconds}, 0)`,
        completed: sql<boolean>`coalesce(${lectureProgress.completed}, 0)`,
        completedAt: lectureProgress.completedAt,
        lastPlayedAt: lectureProgress.lastPlayedAt,
        bookmarked: sql<boolean>`case when ${lectureBookmarks.id} is null then 0 else 1 end`,
      })
      .from(lectures)
      .innerJoin(courses, eq(lectures.courseId, courses.id))
      .innerJoin(subjects, eq(lectures.subjectId, subjects.id))
      .innerJoin(topics, eq(lectures.topicId, topics.id))
      .leftJoin(
        lectureProgress,
        and(
          eq(lectureProgress.lectureId, lectures.id),
          eq(lectureProgress.userId, viewerId),
        ),
      )
      .leftJoin(
        lectureBookmarks,
        and(
          eq(lectureBookmarks.lectureId, lectures.id),
          eq(lectureBookmarks.userId, viewerId),
        ),
      )
      .where(
        and(
          eq(lectures.courseId, courseId),
          eq(lectures.published, true),
          eq(courses.active, true),
          eq(courses.published, true),
          isNull(courses.deletedAt),
          eq(subjects.active, true),
          isNull(subjects.deletedAt),
          eq(topics.active, true),
          isNull(topics.deletedAt),
          filters.subjectId
            ? eq(lectures.subjectId, filters.subjectId)
            : undefined,
          filters.topicId
            ? eq(lectures.topicId, filters.topicId)
            : undefined,
          search
            ? or(
                like(lectures.title, pattern),
                like(lectures.description, pattern),
                like(lectures.instructorName, pattern),
              )
            : undefined,
        ),
      )
      .orderBy(
        asc(subjects.displayOrder),
        asc(topics.displayOrder),
        asc(lectures.displayOrder),
      )
      .limit(100),
    getEnrollmentStatus(userId, courseId),
  ]);
  const enrolled =
    Boolean(enrollmentStatus) && enrollmentStatus !== "CANCELLED";
  return rows.flatMap((row) => {
    try {
      const provider = getVideoProviderConfig(row.videoProvider);
      createSafeVideoEmbed(row.videoProvider, row.videoUrl);
      return [
        {
          ...row,
          providerLabel: provider.label,
          accessAllowed: row.free || enrolled,
        },
      ];
    } catch {
      return [];
    }
  });
}

export async function getPublishedLecture(
  courseId: string,
  lectureId: string,
  userId: string | null,
) {
  const viewerId = userId ?? "__anonymous__";
  const [lectureRows, enrollmentStatus] = await Promise.all([
    getDb()
      .select({
        id: lectures.id,
        courseId: lectures.courseId,
        courseSlug: courses.slug,
        courseName: courses.name,
        subjectId: lectures.subjectId,
        subjectName: subjects.name,
        topicId: lectures.topicId,
        topicName: topics.name,
        title: lectures.title,
        instructorName: lectures.instructorName,
        description: lectures.description,
        videoProvider: lectures.videoProvider,
        videoUrl: lectures.videoUrl,
        thumbnailUrl: lectures.thumbnailUrl,
        durationSeconds: lectures.durationSeconds,
        free: lectures.free,
        displayOrder: lectures.displayOrder,
        isSample: lectures.isSample,
        currentPositionSeconds:
          sql<number>`coalesce(${lectureProgress.currentPositionSeconds}, 0)`,
        completed: sql<boolean>`coalesce(${lectureProgress.completed}, 0)`,
        completedAt: lectureProgress.completedAt,
        lastPlayedAt: lectureProgress.lastPlayedAt,
        bookmarked: sql<boolean>`case when ${lectureBookmarks.id} is null then 0 else 1 end`,
        note: lectureNotes.content,
      })
      .from(lectures)
      .innerJoin(courses, eq(lectures.courseId, courses.id))
      .innerJoin(subjects, eq(lectures.subjectId, subjects.id))
      .innerJoin(topics, eq(lectures.topicId, topics.id))
      .leftJoin(
        lectureProgress,
        and(
          eq(lectureProgress.lectureId, lectures.id),
          eq(lectureProgress.userId, viewerId),
        ),
      )
      .leftJoin(
        lectureBookmarks,
        and(
          eq(lectureBookmarks.lectureId, lectures.id),
          eq(lectureBookmarks.userId, viewerId),
        ),
      )
      .leftJoin(
        lectureNotes,
        and(
          eq(lectureNotes.lectureId, lectures.id),
          eq(lectureNotes.userId, viewerId),
        ),
      )
      .where(
        and(
          eq(lectures.id, lectureId),
          eq(lectures.courseId, courseId),
          eq(lectures.published, true),
          eq(courses.active, true),
          eq(courses.published, true),
          isNull(courses.deletedAt),
          eq(subjects.active, true),
          isNull(subjects.deletedAt),
          eq(topics.active, true),
          isNull(topics.deletedAt),
        ),
      )
      .limit(1),
    getEnrollmentStatus(userId, courseId),
  ]);
  const lecture = lectureRows[0];
  if (!lecture) return null;
  const enrolled =
    Boolean(enrollmentStatus) && enrollmentStatus !== "CANCELLED";
  const accessAllowed = lecture.free || enrolled;
  let embed = null;
  try {
    embed = accessAllowed
      ? createSafeVideoEmbed(
          lecture.videoProvider,
          lecture.videoUrl,
          lecture.currentPositionSeconds,
        )
      : null;
  } catch {
    return null;
  }

  const [relatedQuestions, relatedTheory, candidates] = await Promise.all([
    getDb()
      .selectDistinct({
        id: questions.id,
        title: questions.title,
        type: questions.type,
        difficulty: questions.difficulty,
      })
      .from(questions)
      .innerJoin(
        questionCourses,
        eq(questionCourses.questionId, questions.id),
      )
      .leftJoin(
        questionSubjects,
        eq(questionSubjects.questionId, questions.id),
      )
      .leftJoin(
        questionTopics,
        eq(questionTopics.questionId, questions.id),
      )
      .where(
        and(
          eq(questionCourses.courseId, lecture.courseId),
          eq(questions.status, "PUBLISHED"),
          or(
            eq(questionSubjects.subjectId, lecture.subjectId),
            eq(questionTopics.topicId, lecture.topicId),
          ),
        ),
      )
      .limit(5),
    getDb()
      .select({
        id: lessons.id,
        title: lessons.title,
        summary: lessons.summary,
      })
      .from(lessons)
      .where(
        and(
          eq(lessons.courseId, lecture.courseId),
          eq(lessons.subjectId, lecture.subjectId),
          eq(lessons.topicId, lecture.topicId),
          eq(lessons.active, true),
          eq(lessons.published, true),
          isNull(lessons.deletedAt),
        ),
      )
      .orderBy(asc(lessons.displayOrder))
      .limit(5),
    getDb()
      .select({
        id: lectures.id,
        title: lectures.title,
        free: lectures.free,
        displayOrder: lectures.displayOrder,
      })
      .from(lectures)
      .where(
        and(
          eq(lectures.courseId, lecture.courseId),
          eq(lectures.published, true),
          sql`(${lectures.displayOrder} > ${lecture.displayOrder} OR (${lectures.displayOrder} = ${lecture.displayOrder} AND ${lectures.id} > ${lecture.id}))`,
        ),
      )
      .orderBy(asc(lectures.displayOrder), asc(lectures.id))
      .limit(10),
  ]);
  const nextLecture =
    candidates.find((candidate) => candidate.free || enrolled) ?? null;
  return {
    ...lecture,
    videoUrl: undefined,
    accessAllowed,
    embed,
    relatedQuestions,
    relatedTheory,
    nextLecture,
  };
}

async function requireAccessibleLecture(userId: string, lectureId: string) {
  const [lecture] = await getDb()
    .select({
      id: lectures.id,
      courseId: lectures.courseId,
      durationSeconds: lectures.durationSeconds,
      free: lectures.free,
      enrollmentStatus: userCourseEnrollments.status,
    })
    .from(lectures)
    .innerJoin(courses, eq(lectures.courseId, courses.id))
    .innerJoin(subjects, eq(lectures.subjectId, subjects.id))
    .innerJoin(topics, eq(lectures.topicId, topics.id))
    .leftJoin(
      userCourseEnrollments,
      and(
        eq(userCourseEnrollments.userId, userId),
        eq(userCourseEnrollments.courseId, lectures.courseId),
      ),
    )
    .where(
      and(
        eq(lectures.id, lectureId),
        eq(lectures.published, true),
        eq(courses.active, true),
        eq(courses.published, true),
        isNull(courses.deletedAt),
        eq(subjects.active, true),
        isNull(subjects.deletedAt),
        eq(topics.active, true),
        isNull(topics.deletedAt),
      ),
    )
    .limit(1);
  if (
    !lecture ||
    (!lecture.free &&
      (!lecture.enrollmentStatus ||
        lecture.enrollmentStatus === "CANCELLED"))
  ) {
    throw new AppError(
      "시청 가능한 강의를 찾을 수 없습니다.",
      404,
      "LECTURE_NOT_ACCESSIBLE",
    );
  }
  return lecture;
}

export async function updateLectureProgress(input: {
  userId: string;
  lectureId: string;
  currentPositionSeconds: number;
  complete: boolean;
}) {
  const lecture = await requireAccessibleLecture(
    input.userId,
    input.lectureId,
  );
  const position = validateLecturePosition(
    input.currentPositionSeconds,
    lecture.durationSeconds,
  );
  if (input.complete) {
    assertLectureCompletionPosition(position, lecture.durationSeconds);
  }
  const [current] = await getDb()
    .select()
    .from(lectureProgress)
    .where(
      and(
        eq(lectureProgress.userId, input.userId),
        eq(lectureProgress.lectureId, input.lectureId),
      ),
    )
    .limit(1);
  const now = new Date().toISOString();
  const completed = Boolean(current?.completed || input.complete);
  const completedAt = current?.completedAt ?? (completed ? now : null);
  const latestRevision = current?.completed
    ? null
    : await getLatestPublishedRevision("LECTURE", input.lectureId);
  const contentRevisionId = current?.completed
    ? current.contentRevisionId
    : latestRevision?.id ?? null;
  await getDb()
    .insert(lectureProgress)
    .values({
      id: current?.id ?? crypto.randomUUID(),
      userId: input.userId,
      lectureId: input.lectureId,
      contentRevisionId,
      currentPositionSeconds: position,
      completed,
      completedAt,
      lastPlayedAt: now,
    })
    .onConflictDoUpdate({
      target: [lectureProgress.userId, lectureProgress.lectureId],
      set: {
        currentPositionSeconds: position,
        contentRevisionId,
        completed,
        completedAt,
        lastPlayedAt: now,
      },
    });
  return {
    lectureId: input.lectureId,
    currentPositionSeconds: position,
    completed,
    completedAt,
    idempotentReplay: Boolean(current?.completed && input.complete),
  };
}

export async function toggleLectureBookmark(
  userId: string,
  lectureId: string,
) {
  await requireAccessibleLecture(userId, lectureId);
  const [existing] = await getDb()
    .select({ id: lectureBookmarks.id })
    .from(lectureBookmarks)
    .where(
      and(
        eq(lectureBookmarks.userId, userId),
        eq(lectureBookmarks.lectureId, lectureId),
      ),
    )
    .limit(1);
  if (existing) {
    await getDb()
      .delete(lectureBookmarks)
      .where(eq(lectureBookmarks.id, existing.id));
    return { bookmarked: false };
  }
  await getDb().insert(lectureBookmarks).values({
    id: crypto.randomUUID(),
    userId,
    lectureId,
  });
  return { bookmarked: true };
}

export async function saveLectureNote(
  userId: string,
  lectureId: string,
  content: string,
) {
  await requireAccessibleLecture(userId, lectureId);
  const normalized = content.trim();
  if (!normalized) {
    await getDb()
      .delete(lectureNotes)
      .where(
        and(
          eq(lectureNotes.userId, userId),
          eq(lectureNotes.lectureId, lectureId),
        ),
      );
    return { content: "", deleted: true };
  }
  const now = new Date().toISOString();
  await getDb()
    .insert(lectureNotes)
    .values({
      id: crypto.randomUUID(),
      userId,
      lectureId,
      content: normalized,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [lectureNotes.userId, lectureNotes.lectureId],
      set: { content: normalized, updatedAt: now },
    });
  return { content: normalized, deleted: false };
}

export async function getLectureUserData(
  userId: string,
  lectureId: string,
) {
  await requireAccessibleLecture(userId, lectureId);
  const [progress, bookmark, note] = await Promise.all([
    getDb()
      .select()
      .from(lectureProgress)
      .where(
        and(
          eq(lectureProgress.userId, userId),
          eq(lectureProgress.lectureId, lectureId),
        ),
      )
      .limit(1),
    getDb()
      .select({ id: lectureBookmarks.id })
      .from(lectureBookmarks)
      .where(
        and(
          eq(lectureBookmarks.userId, userId),
          eq(lectureBookmarks.lectureId, lectureId),
        ),
      )
      .limit(1),
    getDb()
      .select({ content: lectureNotes.content })
      .from(lectureNotes)
      .where(
        and(
          eq(lectureNotes.userId, userId),
          eq(lectureNotes.lectureId, lectureId),
        ),
      )
      .limit(1),
  ]);
  return {
    progress: progress[0] ?? null,
    bookmarked: Boolean(bookmark[0]),
    note: note[0]?.content ?? "",
  };
}
