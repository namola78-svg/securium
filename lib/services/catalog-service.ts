import { AppError } from "../errors.ts";

export const ADMIN_ROLES = new Set([
  "COURSE_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
]);

export function assertCatalogManager(roles: readonly string[]) {
  if (!roles.some((role) => ADMIN_ROLES.has(role))) {
    throw new AppError(
      "과정 관리 권한이 필요합니다.",
      403,
      "ADMIN_FORBIDDEN",
    );
  }
}

export function isPublicCourse(course: {
  active: boolean;
  published: boolean;
  deletedAt: string | null;
}) {
  return course.active && course.published && course.deletedAt === null;
}
