import { getDatabaseProvider } from "@/db";
import {
  createPublicCourseAvailabilityRepository,
  type PublicCourseAvailability,
} from "@/db/public-course-availability-repository";
import { RepositoryContext } from "@/db/repository-adapter/repository-context";

export type { PublicCourseAvailability } from "@/db/public-course-availability-repository";
export { isPublicCourseAvailable } from "./course-availability-display";

export async function listPublicCourseAvailability(courseIds: readonly string[]) {
  if (courseIds.length === 0) return new Map<string, PublicCourseAvailability>();
  const provider = await getDatabaseProvider();
  const repository = createPublicCourseAvailabilityRepository(
    new RepositoryContext(provider),
  );
  const rows = await repository.listByCourseIds(courseIds);
  return new Map(rows.map((row) => [row.courseId, row] as const));
}

export async function getPublicCourseAvailability(courseId: string) {
  const availability = await listPublicCourseAvailability([courseId]);
  return availability.get(courseId) ?? null;
}
