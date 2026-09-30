import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from ".";
import {
  contents,
  courseGroups,
  courseLessons,
  questionCourses,
  courses,
  learningUnits,
  lessons,
  roles,
  subjects,
  topics,
  userCourseEnrollments,
  userCourseLessonProgress,
  userLessonProgress,
  userProgress,
  userRoles,
  users,
} from "./schema";
import type {
  CourseGroupInput,
  CourseInput,
  SubjectInput,
  TopicInput,
} from "@/lib/validation";
import type {
  EnrollmentRecord,
  EnrollmentRepository,
  EnrollmentStatus,
} from "@/lib/services/enrollment-service";
import { AppError } from "@/lib/errors";
import { assertGenericCppgPublicationAllowed, isCppgPublicationTarget } from "@/lib/services/cppg-generic-publication-guard";
import { filterCanonicalCppgVisibility, filterCppgRowsToCanonicalProjection, getCanonicalCppgLearnerRowIds, hasCanonicalLearnerVisibility } from "@/lib/services/cppg-learner-visibility.ts";
import { ensureLevelProgress } from "./phase3-repositories";
import {
  buildSwSecurityWeaknessRuntimeProjection,
  SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY,
  type SwRuntimeCourseProjection,
} from "../lib/services/securium-sw-security-weakness-runtime-adapter.ts";

export type CourseListItem = {
  id: string;
  groupName: string;
  code: string;
  slug: string;
  name: string;
  shortName: string;
  description: string;
  thumbnailUrl: string | null;
  totalLevels: number;
  passingScore: number;
  difficulty: string;
  active: boolean;
  published: boolean;
  displayOrder: number;
  isSample: boolean;
  updatedAt?: string;
  subjectCount?: number;
  topicCount?: number;
  questionCount?: number;
};

type SwRuntimeCourseProjectionInput = Pick<
  CourseListItem,
  "id" | "code" | "slug" | "name" | "active" | "published" | "isSample"
> & {
  deletedAt?: string | null;
};

/**
 * Binding-aware read seam for the SW Foundation. It deliberately accepts a
 * repository result instead of opening a database connection, so the
 * Foundation projection remains read-only and testable without runtime DB
 * access. Unrelated courses are left to the existing generic repository path.
 */
export function projectSwSecurityWeaknessRuntimeCourse(
  course: SwRuntimeCourseProjectionInput,
): SwRuntimeCourseProjection | null {
  const isKnownIdentity =
    course.id === SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.courseId ||
    course.code === SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.code ||
    course.slug === SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.slug;
  if (!isKnownIdentity) return null;

  return buildSwSecurityWeaknessRuntimeProjection({
    id: course.id,
    code: course.code,
    slug: course.slug,
    name: course.name,
    bindingKey: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.bindingKey,
    active: course.active,
    published: course.published,
    isSample: course.isSample,
    deletedAt: course.deletedAt ?? null,
  });
}

export async function listPublishedCourses(): Promise<CourseListItem[]> {
  const rows = await getDb()
    .select({
      id: courses.id,
      groupName: courseGroups.name,
      code: courses.code,
      slug: courses.slug,
      name: courses.name,
      shortName: courses.shortName,
      description: courses.description,
      thumbnailUrl: courses.thumbnailUrl,
      totalLevels: courses.totalLevels,
      passingScore: courses.passingScore,
      difficulty: courses.difficulty,
      active: courses.active,
      published: courses.published,
      displayOrder: courses.displayOrder,
      isSample: courses.isSample,
      updatedAt: courses.updatedAt,
      subjectCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${subjects}
        WHERE ${subjects.courseId} = ${courses.id}
          AND ${subjects.active} = 1
          AND ${subjects.deletedAt} IS NULL
      )`,
      topicCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${topics}
        INNER JOIN ${subjects} ON ${topics.subjectId} = ${subjects.id}
        WHERE ${subjects.courseId} = ${courses.id}
          AND ${subjects.active} = 1
          AND ${subjects.deletedAt} IS NULL
          AND ${topics.active} = 1
          AND ${topics.deletedAt} IS NULL
      )`,
      questionCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${questionCourses}
        WHERE ${questionCourses.courseId} = ${courses.id}
      )`,
    })
    .from(courses)
    .innerJoin(courseGroups, eq(courses.courseGroupId, courseGroups.id))
    .where(
      and(
        eq(courses.active, true),
        eq(courses.published, true),
        isNull(courses.deletedAt),
        eq(courseGroups.active, true),
        isNull(courseGroups.deletedAt),
      ),
    )
    .orderBy(asc(courseGroups.displayOrder), asc(courses.displayOrder));
  return filterCanonicalCppgVisibility(rows);
}

export async function getPublicCourseBySlug(slug: string) {
  const [course] = await getDb()
    .select({
      id: courses.id,
      groupName: courseGroups.name,
      code: courses.code,
      slug: courses.slug,
      name: courses.name,
      shortName: courses.shortName,
      description: courses.description,
      thumbnailUrl: courses.thumbnailUrl,
      totalLevels: courses.totalLevels,
      passingScore: courses.passingScore,
      difficulty: courses.difficulty,
      active: courses.active,
      published: courses.published,
      displayOrder: courses.displayOrder,
      isSample: courses.isSample,
      updatedAt: courses.updatedAt,
      subjectCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${subjects}
        WHERE ${subjects.courseId} = ${courses.id}
          AND ${subjects.active} = 1
          AND ${subjects.deletedAt} IS NULL
      )`,
      topicCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${topics}
        INNER JOIN ${subjects} ON ${topics.subjectId} = ${subjects.id}
        WHERE ${subjects.courseId} = ${courses.id}
          AND ${subjects.active} = 1
          AND ${subjects.deletedAt} IS NULL
          AND ${topics.active} = 1
          AND ${topics.deletedAt} IS NULL
      )`,
      questionCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${questionCourses}
        WHERE ${questionCourses.courseId} = ${courses.id}
      )`,
    })
    .from(courses)
    .innerJoin(courseGroups, eq(courses.courseGroupId, courseGroups.id))
    .where(
      and(
        eq(courses.slug, slug),
        eq(courses.active, true),
        eq(courses.published, true),
        isNull(courses.deletedAt),
      ),
    )
    .limit(1);

  return course && await hasCanonicalLearnerVisibility(course) ? course : null;
}

export async function getLearnCourseAccessBySlug(
  userId: string,
  slug: string,
) {
  const [row] = await getDb()
    .select({
      id: courses.id,
      groupName: courseGroups.name,
      code: courses.code,
      slug: courses.slug,
      name: courses.name,
      shortName: courses.shortName,
      description: courses.description,
      thumbnailUrl: courses.thumbnailUrl,
      totalLevels: courses.totalLevels,
      passingScore: courses.passingScore,
      difficulty: courses.difficulty,
      active: courses.active,
      published: courses.published,
      displayOrder: courses.displayOrder,
      isSample: courses.isSample,
      updatedAt: courses.updatedAt,
      enrollmentId: userCourseEnrollments.id,
      enrollmentUserId: userCourseEnrollments.userId,
      enrollmentCourseId: userCourseEnrollments.courseId,
      enrollmentStatus: userCourseEnrollments.status,
    })
    .from(courses)
    .innerJoin(courseGroups, eq(courses.courseGroupId, courseGroups.id))
    .leftJoin(
      userCourseEnrollments,
      and(
        eq(userCourseEnrollments.userId, userId),
        eq(userCourseEnrollments.courseId, courses.id),
      ),
    )
    .where(
      and(
        eq(courses.slug, slug),
        eq(courses.active, true),
        eq(courses.published, true),
        isNull(courses.deletedAt),
      ),
    )
    .limit(1);

  if (!row || !await hasCanonicalLearnerVisibility(row)) return { course: null, enrollment: null };
  const {
    enrollmentId,
    enrollmentUserId,
    enrollmentCourseId,
    enrollmentStatus,
    ...course
  } = row;

  return {
    course,
    enrollment: enrollmentId
      ? ({
          id: enrollmentId,
          userId: enrollmentUserId,
          courseId: enrollmentCourseId,
          status: enrollmentStatus,
        } as EnrollmentRecord)
      : null,
  };
}

export async function listCurriculum(courseId: string) {
  const cppgRows = courseId === "course-cppg" ? await getCanonicalCppgLearnerRowIds(courseId) : null;
  if (courseId === "course-cppg" && !cppgRows) return [];
  const [subjectRows, topicRows] = await Promise.all([
    getDb()
      .select()
      .from(subjects)
      .where(
        and(
          eq(subjects.courseId, courseId),
          eq(subjects.active, true),
          isNull(subjects.deletedAt),
        ),
      )
      .orderBy(asc(subjects.displayOrder)),
    getDb()
      .select({
        id: topics.id,
        subjectId: topics.subjectId,
        parentTopicId: topics.parentTopicId,
        code: topics.code,
        name: topics.name,
        description: topics.description,
        displayOrder: topics.displayOrder,
        active: topics.active,
        isSample: topics.isSample,
      })
      .from(topics)
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(
        and(
          eq(subjects.courseId, courseId),
          eq(topics.active, true),
          isNull(topics.deletedAt),
        ),
      )
      .orderBy(asc(topics.displayOrder)),
  ]);

  const visibleSubjects = filterCppgRowsToCanonicalProjection(courseId, subjectRows, cppgRows?.subjectIds ?? null);
  const visibleTopics = filterCppgRowsToCanonicalProjection(courseId, topicRows, cppgRows?.topicIds ?? null);
  return visibleSubjects.map((subject) => ({
    ...subject,
    topics: visibleTopics.filter((topic) => topic.subjectId === subject.id),
  }));
}

export async function listCurriculumWithSubjectTheoryProgress(
  userId: string,
  courseId: string,
) {
  const cppgRows = courseId === "course-cppg" ? await getCanonicalCppgLearnerRowIds(courseId) : null;
  if (courseId === "course-cppg" && !cppgRows) return [];
  const [subjectRows, topicRows, progressRows] = await Promise.all([
    getDb()
      .select()
      .from(subjects)
      .where(
        and(
          eq(subjects.courseId, courseId),
          eq(subjects.active, true),
          isNull(subjects.deletedAt),
        ),
      )
      .orderBy(asc(subjects.displayOrder)),
    getDb()
      .select({
        id: topics.id,
        subjectId: topics.subjectId,
        parentTopicId: topics.parentTopicId,
        code: topics.code,
        name: topics.name,
        description: topics.description,
        displayOrder: topics.displayOrder,
        active: topics.active,
        isSample: topics.isSample,
      })
      .from(topics)
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(
        and(
          eq(subjects.courseId, courseId),
          eq(topics.active, true),
          isNull(topics.deletedAt),
        ),
      )
      .orderBy(asc(topics.displayOrder)),
    getDb()
      .select({
        subjectId: lessons.subjectId,
        totalLessons: sql<number>`count(${lessons.id})`,
        completedLessons: sql<number>`coalesce(sum(case when ${userLessonProgress.status} = 'COMPLETED' then 1 else 0 end), 0)`,
      })
      .from(lessons)
      .innerJoin(learningUnits, eq(lessons.learningUnitId, learningUnits.id))
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
          ...(cppgRows ? [inArray(lessons.id, [...cppgRows.lessonIds])] : []),
        ),
      )
      .groupBy(lessons.subjectId),
  ]);

  const visibleSubjects = filterCppgRowsToCanonicalProjection(courseId, subjectRows, cppgRows?.subjectIds ?? null);
  const visibleTopics = filterCppgRowsToCanonicalProjection(courseId, topicRows, cppgRows?.topicIds ?? null);
  const visibleProgressRows = filterCppgRowsToCanonicalProjection(courseId, progressRows.map((row) => ({ ...row, id: row.subjectId })), cppgRows?.subjectIds ?? null);
  const progressBySubjectId = new Map(
    visibleProgressRows.map((row) => {
      const totalLessons = Number(row.totalLessons);
      const completedLessons = Number(row.completedLessons);
      return [
        row.subjectId,
        {
          totalLessons,
          completedLessons,
          progressPercent: totalLessons
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0,
        },
      ];
    }),
  );

  return visibleSubjects.map((subject) => ({
    ...subject,
    theoryProgress: progressBySubjectId.get(subject.id) ?? {
      totalLessons: 0,
      completedLessons: 0,
      progressPercent: 0,
    },
    topics: visibleTopics.filter((topic) => topic.subjectId === subject.id),
  }));
}

export async function listCurriculumForLearnOverview(courseId: string) {
  const cppgRows = courseId === "course-cppg" ? await getCanonicalCppgLearnerRowIds(courseId) : null;
  if (courseId === "course-cppg" && !cppgRows) return [];
  const [subjectRows, topicRows] = await Promise.all([
    getDb()
      .select()
      .from(subjects)
      .where(
        and(
          eq(subjects.courseId, courseId),
          eq(subjects.active, true),
          isNull(subjects.deletedAt),
        ),
      )
      .orderBy(asc(subjects.displayOrder)),
    getDb()
      .select({
        id: topics.id,
        subjectId: topics.subjectId,
        parentTopicId: topics.parentTopicId,
        code: topics.code,
        name: topics.name,
        description: topics.description,
        displayOrder: topics.displayOrder,
        active: topics.active,
        isSample: topics.isSample,
      })
      .from(topics)
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(
        and(
          eq(subjects.courseId, courseId),
          eq(topics.active, true),
          isNull(topics.deletedAt),
        ),
      )
      .orderBy(asc(topics.displayOrder)),
  ]);

  const visibleSubjects = filterCppgRowsToCanonicalProjection(courseId, subjectRows, cppgRows?.subjectIds ?? null);
  const visibleTopics = filterCppgRowsToCanonicalProjection(courseId, topicRows, cppgRows?.topicIds ?? null);
  return visibleSubjects.map((subject) => ({
    ...subject,
    theoryProgress: {
      totalLessons: 0,
      completedLessons: 0,
      progressPercent: 0,
    },
    topics: visibleTopics.filter((topic) => topic.subjectId === subject.id),
  }));
}

export async function listAllCourseGroups() {
  return getDb()
    .select()
    .from(courseGroups)
    .where(isNull(courseGroups.deletedAt))
    .orderBy(asc(courseGroups.displayOrder));
}

export async function listAllCourses() {
  return getDb()
    .select({
      id: courses.id,
      courseGroupId: courses.courseGroupId,
      groupName: courseGroups.name,
      code: courses.code,
      slug: courses.slug,
      name: courses.name,
      shortName: courses.shortName,
      description: courses.description,
      thumbnailUrl: courses.thumbnailUrl,
      totalLevels: courses.totalLevels,
      passingScore: courses.passingScore,
      difficulty: courses.difficulty,
      active: courses.active,
      published: courses.published,
      displayOrder: courses.displayOrder,
      isSample: courses.isSample,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .innerJoin(courseGroups, eq(courses.courseGroupId, courseGroups.id))
    .where(isNull(courses.deletedAt))
    .orderBy(asc(courseGroups.displayOrder), asc(courses.displayOrder));
}

export async function getCourseById(courseId: string) {
  const [course] = await getDb()
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
    .limit(1);
  return course ?? null;
}

/** Learner-facing ID lookup; administrative reads continue to use getCourseById. */
export async function getLearnerCourseById(courseId: string) {
  const course = await getCourseById(courseId);
  return course && await hasCanonicalLearnerVisibility(course) ? course : null;
}

export async function getSubjectById(subjectId: string) {
  const [subject] = await getDb()
    .select()
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), isNull(subjects.deletedAt)))
    .limit(1);
  return subject ?? null;
}

export async function listSubjectsForCourse(courseId: string) {
  return getDb()
    .select()
    .from(subjects)
    .where(and(eq(subjects.courseId, courseId), isNull(subjects.deletedAt)))
    .orderBy(asc(subjects.displayOrder));
}

export async function listTopicsForSubject(subjectId: string) {
  return getDb()
    .select()
    .from(topics)
    .where(and(eq(topics.subjectId, subjectId), isNull(topics.deletedAt)))
    .orderBy(asc(topics.displayOrder));
}

export async function listAllActiveSubjects() {
  return getDb()
    .select({
      id: subjects.id,
      courseId: subjects.courseId,
      name: subjects.name,
      code: subjects.code,
      displayOrder: subjects.displayOrder,
    })
    .from(subjects)
    .where(and(eq(subjects.active, true), isNull(subjects.deletedAt)))
    .orderBy(asc(subjects.courseId), asc(subjects.displayOrder));
}

export async function listAllActiveTopics() {
  return getDb()
    .select({
      id: topics.id,
      subjectId: topics.subjectId,
      name: topics.name,
      code: topics.code,
      displayOrder: topics.displayOrder,
    })
    .from(topics)
    .where(and(eq(topics.active, true), isNull(topics.deletedAt)))
    .orderBy(asc(topics.subjectId), asc(topics.displayOrder));
}

export async function findUserByEmail(email: string) {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return user ?? null;
}

export async function findUserWithRoleCodesByEmail(email: string) {
  const rows = await getDb()
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
      roleCode: roles.code,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(users.email, email.toLowerCase()));

  const first = rows[0];
  if (!first) return null;

  return {
    id: first.id,
    email: first.email,
    displayName: first.displayName,
    status: first.status,
    roles: rows
      .map((row) => row.roleCode)
      .filter((roleCode): roleCode is string => Boolean(roleCode)),
  };
}

export async function ensureUser(input: {
  email: string;
  displayName: string;
}) {
  const email = input.email.toLowerCase();
  await getDb()
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      email,
      displayName: input.displayName,
      lastSignedInAt: sql`CURRENT_TIMESTAMP`,
    })
    .onConflictDoNothing({ target: users.email });

  const user = await findUserByEmail(email);
  if (!user) throw new Error("Authenticated user could not be loaded");

  const [userRole] = await getDb()
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, "USER"))
    .limit(1);

  if (userRole) {
    await getDb()
      .insert(userRoles)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        roleId: userRole.id,
      })
      .onConflictDoNothing();
  }

  return user;
}

export async function listRoleCodes(userId: string) {
  const rows = await getDb()
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
  return rows.map((row) => row.code);
}

export function createEnrollmentRepository(): EnrollmentRepository {
  return {
    async getCourseForEnrollment(courseId) {
      const [course] = await getDb()
        .select({
          id: courses.id,
          slug: courses.slug,
          code: courses.code,
          active: courses.active,
          published: courses.published,
          deletedAt: courses.deletedAt,
        })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);
      if (!course || !(await hasCanonicalLearnerVisibility(course))) return null;
      return course;
    },

    async findEnrollment(userId, courseId) {
      const [row] = await getDb()
        .select({
          id: userCourseEnrollments.id,
          userId: userCourseEnrollments.userId,
          courseId: userCourseEnrollments.courseId,
          status: userCourseEnrollments.status,
        })
        .from(userCourseEnrollments)
        .where(
          and(
            eq(userCourseEnrollments.userId, userId),
            eq(userCourseEnrollments.courseId, courseId),
          ),
        )
        .limit(1);
      return (row as EnrollmentRecord | undefined) ?? null;
    },

    async createEnrollment(userId, courseId) {
      const [row] = await getDb()
        .insert(userCourseEnrollments)
        .values({
          id: crypto.randomUUID(),
          userId,
          courseId,
          status: "ACTIVE",
        })
        .returning({
          id: userCourseEnrollments.id,
          userId: userCourseEnrollments.userId,
          courseId: userCourseEnrollments.courseId,
          status: userCourseEnrollments.status,
        });
      await ensureLevelProgress(userId, courseId);
      return row as EnrollmentRecord;
    },

    async getEnrollmentById(enrollmentId) {
      const [row] = await getDb()
        .select({
          id: userCourseEnrollments.id,
          userId: userCourseEnrollments.userId,
          courseId: userCourseEnrollments.courseId,
          status: userCourseEnrollments.status,
        })
        .from(userCourseEnrollments)
        .where(eq(userCourseEnrollments.id, enrollmentId))
        .limit(1);
      return (row as EnrollmentRecord | undefined) ?? null;
    },

    async updateEnrollmentStatus(enrollmentId, status: EnrollmentStatus) {
      const [row] = await getDb()
        .update(userCourseEnrollments)
        .set({
          status,
          completedAt: status === "COMPLETED" ? sql`CURRENT_TIMESTAMP` : null,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(userCourseEnrollments.id, enrollmentId))
        .returning({
          id: userCourseEnrollments.id,
          userId: userCourseEnrollments.userId,
          courseId: userCourseEnrollments.courseId,
          status: userCourseEnrollments.status,
        });
      return row as EnrollmentRecord;
    },
  };
}

export async function listUserEnrollments(userId: string) {
  const enrollmentRows = await getDb()
    .select({
      id: userCourseEnrollments.id,
      status: userCourseEnrollments.status,
      enrolledAt: userCourseEnrollments.enrolledAt,
      completedAt: userCourseEnrollments.completedAt,
      currentLevel: userCourseEnrollments.currentLevel,
      progressPercent: userCourseEnrollments.progressPercent,
      totalXp: userCourseEnrollments.totalXp,
      courseId: courses.id,
      courseSlug: courses.slug,
      courseCode: courses.code,
      courseName: courses.name,
      shortName: courses.shortName,
      totalLevels: courses.totalLevels,
      groupName: courseGroups.name,
      correctAnswers: sql<number>`coalesce((select sum(${userProgress.correctAnswers}) from ${userProgress} where ${userProgress.userId} = ${userId} and ${userProgress.courseId} = ${courses.id}), 0)`,
      totalAnswers: sql<number>`coalesce((select sum(${userProgress.totalAnswers}) from ${userProgress} where ${userProgress.userId} = ${userId} and ${userProgress.courseId} = ${courses.id}), 0)`,
      lastStudiedAt: sql<string | null>`(select max(${userProgress.lastStudiedAt}) from ${userProgress} where ${userProgress.userId} = ${userId} and ${userProgress.courseId} = ${courses.id})`,
      theoryTotalLessons: sql<number>`coalesce((select count(${courseLessons.id}) from ${courseLessons} inner join ${contents} on ${courseLessons.contentId} = ${contents.id} where ${courseLessons.courseId} = ${courses.id} and ${courseLessons.status} = 'PUBLISHED' and ${courseLessons.deletedAt} is null and ${contents.status} = 'PUBLISHED' and ${contents.deletedAt} is null), 0)`,
      theoryCompletedLessons: sql<number>`coalesce((select count(${userCourseLessonProgress.id}) from ${userCourseLessonProgress} inner join ${courseLessons} on ${userCourseLessonProgress.courseLessonId} = ${courseLessons.id} inner join ${contents} on ${courseLessons.contentId} = ${contents.id} where ${userCourseLessonProgress.userId} = ${userId} and ${userCourseLessonProgress.courseId} = ${courses.id} and ${userCourseLessonProgress.status} = 'COMPLETED' and ${userCourseLessonProgress.contentId} = ${contents.id} and ${userCourseLessonProgress.contentVersion} = ${contents.version} and ${courseLessons.courseId} = ${courses.id} and ${courseLessons.status} = 'PUBLISHED' and ${courseLessons.deletedAt} is null and ${contents.status} = 'PUBLISHED' and ${contents.deletedAt} is null), 0)`,
    })
    .from(userCourseEnrollments)
    .innerJoin(courses, eq(userCourseEnrollments.courseId, courses.id))
    .innerJoin(courseGroups, eq(courses.courseGroupId, courseGroups.id))
    .where(eq(userCourseEnrollments.userId, userId))
    .orderBy(desc(userCourseEnrollments.updatedAt));

  const visibleEnrollments = await filterCanonicalCppgVisibility(enrollmentRows.map((row) => ({
    ...row,
    id: row.courseId,
    slug: row.courseSlug,
    code: row.courseCode,
  })));
  const visibleCourseIds = new Set(visibleEnrollments.map((row) => row.courseId));
  return enrollmentRows.filter((row) => visibleCourseIds.has(row.courseId)).map((row) => {
    const { courseCode: _courseCode, ...publicRow } = row;
    void _courseCode;
    const totalAnswers = Number(row.totalAnswers ?? 0);
    const correctAnswers = Number(row.correctAnswers ?? 0);
    const theoryTotalLessons = Number(row.theoryTotalLessons ?? 0);
    const theoryCompletedLessons = Number(row.theoryCompletedLessons ?? 0);
    return {
      ...publicRow,
      accuracy:
        totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : null,
      lastStudiedAt: row.lastStudiedAt ?? null,
      theoryTotalLessons,
      theoryCompletedLessons,
      theoryProgressPercent: theoryTotalLessons
        ? Math.round((theoryCompletedLessons / theoryTotalLessons) * 100)
        : 0,
    };
  });
}

export async function getEnrollmentForCourse(userId: string, courseId: string) {
  const repository = createEnrollmentRepository();
  return repository.findEnrollment(userId, courseId);
}

export async function listProgressForCourse(userId: string, courseId: string) {
  return getDb()
    .select()
    .from(userProgress)
    .where(
      and(
        eq(userProgress.userId, userId),
        eq(userProgress.courseId, courseId),
      ),
    )
    .orderBy(desc(userProgress.lastStudiedAt));
}

export async function saveCourseGroup(input: CourseGroupInput) {
  const existing = input.id
    ? (
        await getDb()
          .select({ active: courseGroups.active })
          .from(courseGroups)
          .where(eq(courseGroups.id, input.id))
          .limit(1)
      )[0]
    : null;
  if (input.id && existing) {
    const childCourses = await getDb()
      .select({
        id: courses.id,
        slug: courses.slug,
        code: courses.code,
        active: courses.active,
        published: courses.published,
      })
      .from(courses)
      .where(eq(courses.courseGroupId, input.id));
    for (const course of childCourses) {
      assertGenericCppgPublicationAllowed(
        { courseId: course.id, courseSlug: course.slug, courseCode: course.code },
        { active: course.active && existing.active, published: course.published && existing.active },
        { active: course.active && input.active, published: course.published && input.active },
      );
    }
  }
  const values = {
    code: input.code,
    name: input.name,
    description: input.description,
    displayOrder: input.displayOrder,
    active: input.active,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  if (input.id) {
    const [updated] = await getDb()
      .update(courseGroups)
      .set(values)
      .where(eq(courseGroups.id, input.id))
      .returning({ id: courseGroups.id });
    if (!updated) {
      throw new AppError(
        "과정군을 찾을 수 없습니다.",
        404,
        "COURSE_GROUP_NOT_FOUND",
      );
    }
    return input.id;
  }
  const id = crypto.randomUUID();
  await getDb().insert(courseGroups).values({ id, ...values });
  return id;
}

export async function saveCourse(input: CourseInput) {
  const current = input.id
    ? (
        await getDb()
          .select({
            active: courses.active,
            published: courses.published,
            courseGroupId: courses.courseGroupId,
            slug: courses.slug,
            code: courses.code,
          })
          .from(courses)
          .where(eq(courses.id, input.id))
          .limit(1)
      )[0]
    : null;
  assertGenericCppgPublicationAllowed(
    { courseId: input.id, courseSlug: input.slug, courseCode: input.code },
    current ?? { active: false, published: false },
    input,
    current ? { courseId: input.id, courseSlug: current.slug, courseCode: current.code } : {},
  );
  if (
    current &&
    isCppgPublicationTarget({
      courseId: input.id,
      courseSlug: current.slug,
      courseCode: current.code,
    })
  ) {
    const [priorGroup] = await getDb()
      .select({ active: courseGroups.active })
      .from(courseGroups)
      .where(eq(courseGroups.id, current.courseGroupId))
      .limit(1);
    const [nextGroup] = await getDb()
      .select({ active: courseGroups.active })
      .from(courseGroups)
      .where(eq(courseGroups.id, input.courseGroupId))
      .limit(1);
    assertGenericCppgPublicationAllowed(
      { courseId: input.id, courseSlug: input.slug, courseCode: input.code },
      {
        published: current.active && current.published && (priorGroup?.active ?? false),
      },
      {
        published: input.active && input.published && (nextGroup?.active ?? false),
      },
      { courseId: input.id, courseSlug: current.slug, courseCode: current.code },
    );
  }
  const values = {
    courseGroupId: input.courseGroupId,
    code: input.code,
    slug: input.slug,
    name: input.name,
    shortName: input.shortName,
    description: input.description,
    thumbnailUrl: input.thumbnailUrl || null,
    totalLevels: input.totalLevels,
    passingScore: input.passingScore,
    difficulty: input.difficulty,
    active: input.active,
    published: input.published,
    displayOrder: input.displayOrder,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  if (input.id) {
    const [updated] = await getDb()
      .update(courses)
      .set(values)
      .where(eq(courses.id, input.id))
      .returning({ id: courses.id });
    if (!updated) {
      throw new AppError("과정을 찾을 수 없습니다.", 404, "COURSE_NOT_FOUND");
    }
    return input.id;
  }
  const id = crypto.randomUUID();
  await getDb().insert(courses).values({ id, ...values });
  return id;
}

export async function saveSubject(input: SubjectInput) {
  const [course] = await getDb()
    .select({ slug: courses.slug, code: courses.code })
    .from(courses)
    .where(eq(courses.id, input.courseId))
    .limit(1);
  const current = input.id
    ? (
        await getDb()
          .select({ active: subjects.active })
          .from(subjects)
          .where(eq(subjects.id, input.id))
          .limit(1)
      )[0]
    : null;
  assertGenericCppgPublicationAllowed(
    { courseId: input.courseId, courseSlug: course?.slug, courseCode: course?.code },
    current ?? { active: false },
    input,
  );
  const values = {
    courseId: input.courseId,
    code: input.code,
    name: input.name,
    description: input.description,
    displayOrder: input.displayOrder,
    active: input.active,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  if (input.id) {
    const [existing] = await getDb()
      .select({ courseId: subjects.courseId })
      .from(subjects)
      .where(eq(subjects.id, input.id))
      .limit(1);
    if (!existing) {
      throw new AppError("과목을 찾을 수 없습니다.", 404, "SUBJECT_NOT_FOUND");
    }
    if (existing.courseId !== input.courseId) {
      throw new AppError(
        "학습 기록 보호를 위해 과목의 소속 과정은 변경할 수 없습니다.",
        409,
        "SUBJECT_COURSE_IMMUTABLE",
      );
    }
    await getDb().update(subjects).set(values).where(eq(subjects.id, input.id));
    return input.id;
  }
  const id = crypto.randomUUID();
  await getDb().insert(subjects).values({ id, ...values });
  return id;
}

export async function saveTopic(input: TopicInput) {
  const [subject] = await getDb()
    .select({
      courseId: subjects.courseId,
      courseSlug: courses.slug,
      courseCode: courses.code,
    })
    .from(subjects)
    .innerJoin(courses, eq(subjects.courseId, courses.id))
    .where(eq(subjects.id, input.subjectId))
    .limit(1);
  const current = input.id
    ? (
        await getDb()
          .select({ active: topics.active })
          .from(topics)
          .where(eq(topics.id, input.id))
          .limit(1)
      )[0]
    : null;
  assertGenericCppgPublicationAllowed(
    {
      courseId: subject?.courseId,
      courseSlug: subject?.courseSlug,
      courseCode: subject?.courseCode,
    },
    current ?? { active: false },
    input,
  );
  if (input.parentTopicId) {
    if (input.parentTopicId === input.id) {
      throw new AppError(
        "주제를 자신의 상위 주제로 지정할 수 없습니다.",
        400,
        "TOPIC_SELF_REFERENCE",
      );
    }
    const [parent] = await getDb()
      .select({ subjectId: topics.subjectId })
      .from(topics)
      .where(eq(topics.id, input.parentTopicId))
      .limit(1);
    if (!parent || parent.subjectId !== input.subjectId) {
      throw new AppError(
        "같은 과목의 주제만 상위 주제로 지정할 수 있습니다.",
        400,
        "TOPIC_PARENT_SCOPE_MISMATCH",
      );
    }
  }
  const values = {
    subjectId: input.subjectId,
    parentTopicId: input.parentTopicId || null,
    code: input.code,
    name: input.name,
    description: input.description,
    displayOrder: input.displayOrder,
    active: input.active,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  if (input.id) {
    const [existing] = await getDb()
      .select({ subjectId: topics.subjectId })
      .from(topics)
      .where(eq(topics.id, input.id))
      .limit(1);
    if (!existing) {
      throw new AppError("주제를 찾을 수 없습니다.", 404, "TOPIC_NOT_FOUND");
    }
    if (existing.subjectId !== input.subjectId) {
      throw new AppError(
        "학습 기록 보호를 위해 주제의 소속 과목은 변경할 수 없습니다.",
        409,
        "TOPIC_SUBJECT_IMMUTABLE",
      );
    }
    await getDb().update(topics).set(values).where(eq(topics.id, input.id));
    return input.id;
  }
  const id = crypto.randomUUID();
  await getDb().insert(topics).values({ id, ...values });
  return id;
}
