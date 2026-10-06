import { getDatabaseProvider } from "@/db";
import {
  createPublicCourseAvailabilityRepository,
  type PublicCourseAvailability,
} from "@/db/public-course-availability-repository";
import { RepositoryContext } from "@/db/repository-adapter/repository-context";
import { hasCanonicalLearnerVisibility } from "./cppg-learner-visibility.ts";

export type { PublicCourseAvailability } from "@/db/public-course-availability-repository";
export {
  getPublicCourseAvailabilityState,
  type PublicCourseAvailabilityState,
} from "./course-availability-display";

export async function listPublicCourseAvailability(courseIds: readonly string[]) {
  if (courseIds.length === 0) return new Map<string, PublicCourseAvailability>();
  const provider = await getDatabaseProvider();
  const repository = createPublicCourseAvailabilityRepository(
    new RepositoryContext(provider),
  );
  const rows = await repository.listByCourseIds(courseIds);
  const visibleRows = await Promise.all(rows.map(async (row) => ({
    row,
    visible: await hasCanonicalLearnerVisibility(row.courseId === "course-cppg"
      ? { courseId: row.courseId, slug: "cppg", code: "CPPG" }
      : { courseId: row.courseId }),
  })));
  return new Map(visibleRows.filter(({ visible }) => visible).map(({ row }) => [row.courseId, row] as const));
}

export async function getPublicCourseAvailability(courseId: string) {
  const availability = await listPublicCourseAvailability([courseId]);
  return availability.get(courseId) ?? null;
}
