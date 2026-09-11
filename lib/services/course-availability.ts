export type PublicCourseAvailabilityInput = {
  active: boolean;
  published: boolean;
  publishedLessonCount?: number | null;
};

/**
 * A course is learnable only when its public course gate and at least one
 * canonical, published lesson are both available. Enrollment is checked at
 * the learn route and is intentionally not inferred by this catalog rule.
 */
export function hasPublicLearningContent(
  course: PublicCourseAvailabilityInput,
) {
  return Boolean(
    course.active &&
      course.published &&
      Number(course.publishedLessonCount ?? 0) > 0,
  );
}
