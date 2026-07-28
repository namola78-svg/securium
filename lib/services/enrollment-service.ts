import { AppError } from "../errors.ts";

export type EnrollmentStatus =
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";

export type EnrollableCourse = {
  id: string;
  active: boolean;
  published: boolean;
  deletedAt: string | null;
};

export type EnrollmentRecord = {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
};

export interface EnrollmentRepository {
  getCourseForEnrollment(courseId: string): Promise<EnrollableCourse | null>;
  findEnrollment(
    userId: string,
    courseId: string,
  ): Promise<EnrollmentRecord | null>;
  createEnrollment(userId: string, courseId: string): Promise<EnrollmentRecord>;
  getEnrollmentById(enrollmentId: string): Promise<EnrollmentRecord | null>;
  updateEnrollmentStatus(
    enrollmentId: string,
    status: EnrollmentStatus,
  ): Promise<EnrollmentRecord>;
}

export async function enrollInCourse(
  repository: EnrollmentRepository,
  userId: string,
  courseId: string,
) {
  const course = await repository.getCourseForEnrollment(courseId);
  if (!course || !course.active || !course.published || course.deletedAt) {
    throw new AppError(
      "현재 수강할 수 없는 과정입니다.",
      409,
      "COURSE_NOT_ENROLLABLE",
    );
  }

  const existing = await repository.findEnrollment(userId, courseId);
  if (existing) {
    throw new AppError(
      "이미 수강 중이거나 수강 이력이 있는 과정입니다.",
      409,
      "DUPLICATE_ENROLLMENT",
    );
  }

  return repository.createEnrollment(userId, courseId);
}

export async function changeEnrollmentStatus(
  repository: EnrollmentRepository,
  actorUserId: string,
  enrollmentId: string,
  status: EnrollmentStatus,
) {
  const enrollment = await repository.getEnrollmentById(enrollmentId);
  if (!enrollment) {
    throw new AppError("수강 기록을 찾을 수 없습니다.", 404, "ENROLLMENT_NOT_FOUND");
  }
  if (enrollment.userId !== actorUserId) {
    throw new AppError(
      "다른 사용자의 수강 기록에 접근할 수 없습니다.",
      403,
      "ENROLLMENT_FORBIDDEN",
    );
  }

  return repository.updateEnrollmentStatus(enrollmentId, status);
}

export function summarizeCourseProgress(
  records: Array<{
    userId: string;
    courseId: string;
    progressPercent: number;
  }>,
  actorUserId: string,
  ownerUserId: string,
  courseId: string,
) {
  if (actorUserId !== ownerUserId) {
    throw new AppError(
      "다른 사용자의 학습기록에 접근할 수 없습니다.",
      403,
      "PROGRESS_FORBIDDEN",
    );
  }
  const scoped = records.filter(
    (record) =>
      record.userId === ownerUserId && record.courseId === courseId,
  );
  if (!scoped.length) return 0;
  return Math.round(
    scoped.reduce((sum, record) => sum + record.progressPercent, 0) /
      scoped.length,
  );
}
