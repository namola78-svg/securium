import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from ".";
import {
  courseGroups,
  questionCourses,
  courses,
  learningUnits,
  lessons,
  roles,
  subjects,
  topics,
  userCourseEnrollments,
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
import { ensureLevelProgress } from "./phase3-repositories";

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

export async function listPublishedCourses(): Promise<CourseListItem[]> {
  return getDb()
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

  return course ?? null;
}

export async function listCurriculum(courseId: string) {
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

  return subjectRows.map((subject) => ({
    ...subject,
    topics: topicRows.filter((topic) => topic.subjectId === subject.id),
  }));
}

export async function listCurriculumWithSubjectTheoryProgress(
  userId: string,
  courseId: string,
) {
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
        ),
      )
      .groupBy(lessons.subjectId),
  ]);

  const progressBySubjectId = new Map(
    progressRows.map((row) => {
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

  return subjectRows.map((subject) => ({
    ...subject,
    theoryProgress: progressBySubjectId.get(subject.id) ?? {
      totalLessons: 0,
      completedLessons: 0,
      progressPercent: 0,
    },
    topics: topicRows.filter((topic) => topic.subjectId === subject.id),
  }));
}

export async function listCurriculumForLearnOverview(courseId: string) {
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

  return subjectRows.map((subject) => ({
    ...subject,
    theoryProgress: {
      totalLessons: 0,
      completedLessons: 0,
      progressPercent: 0,
    },
    topics: topicRows.filter((topic) => topic.subjectId === subject.id),
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
          active: courses.active,
          published: courses.published,
          deletedAt: courses.deletedAt,
        })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);
      return course ?? null;
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
      courseName: courses.name,
      shortName: courses.shortName,
      totalLevels: courses.totalLevels,
      groupName: courseGroups.name,
    })
    .from(userCourseEnrollments)
    .innerJoin(courses, eq(userCourseEnrollments.courseId, courses.id))
    .innerJoin(courseGroups, eq(courses.courseGroupId, courseGroups.id))
    .where(eq(userCourseEnrollments.userId, userId))
    .orderBy(desc(userCourseEnrollments.updatedAt));

  const stats = await getDb()
    .select({
      courseId: userProgress.courseId,
      correctAnswers: sql<number>`coalesce(sum(${userProgress.correctAnswers}), 0)`,
      totalAnswers: sql<number>`coalesce(sum(${userProgress.totalAnswers}), 0)`,
      lastStudiedAt: sql<string | null>`max(${userProgress.lastStudiedAt})`,
    })
    .from(userProgress)
    .where(eq(userProgress.userId, userId))
    .groupBy(userProgress.courseId);

  return enrollmentRows.map((row) => {
    const courseStats = stats.find((stat) => stat.courseId === row.courseId);
    const totalAnswers = Number(courseStats?.totalAnswers ?? 0);
    const correctAnswers = Number(courseStats?.correctAnswers ?? 0);
    return {
      ...row,
      accuracy:
        totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : null,
      lastStudiedAt: courseStats?.lastStudiedAt ?? null,
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
