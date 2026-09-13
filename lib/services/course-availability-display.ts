import type { PublicCourseAvailability } from "../../db/public-course-availability-repository.ts";

export function isPublicCourseAvailable(
  availability: PublicCourseAvailability | null | undefined,
) {
  return Boolean(
    availability?.hasPublishedQuestion ||
      availability?.hasPublishedLessonContent,
  );
}
