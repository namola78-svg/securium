export type PublicCourseAvailabilityInput = {
  active: boolean;
  published: boolean;
  publishedLessonCount?: number | null;
  publishedQuestionCount?: number | null;
};

export type PublicLearningAvailability = "UNAVAILABLE" | "THEORY" | "PRACTICE";

/**
 * Theory is available only when the public course gate and at least one
 * canonical, published lesson are both available. Enrollment is checked at
 * the learn route and is intentionally not inferred by this catalog rule.
 */
export function hasPublicTheoryContent(
  course: PublicCourseAvailabilityInput,
) {
  return Boolean(
    course.active &&
      course.published &&
      Number(course.publishedLessonCount ?? 0) > 0,
  );
}

/**
 * A course can be entered when it exposes either canonical theory or a
 * published question set. Practice-only courses must not be hidden merely
 * because their theory delivery is not registered yet.
 */
export function getPublicLearningAvailability(
  course: PublicCourseAvailabilityInput,
): PublicLearningAvailability {
  if (!course.active || !course.published) return "UNAVAILABLE";
  if (hasPublicTheoryContent(course)) return "THEORY";
  return Number(course.publishedQuestionCount ?? 0) > 0
    ? "PRACTICE"
    : "UNAVAILABLE";
}

export function hasPublicLearningContent(
  course: PublicCourseAvailabilityInput,
) {
  return getPublicLearningAvailability(course) !== "UNAVAILABLE";
}
