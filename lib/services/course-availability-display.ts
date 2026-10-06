import type { PublicCourseAvailability } from "../../db/public-course-availability-repository.ts";

export type PublicCourseAvailabilityState =
  | "THEORY_CONTENT"
  | "QUESTION_CONTENT"
  | "THEORY_AND_QUESTION_CONTENT"
  | "NO_PUBLISHED_LEARNER_CONTENT";

/** Describes only the published relations observed by the public availability query. */
export function getPublicCourseAvailabilityState(
  availability: PublicCourseAvailability | null | undefined,
): PublicCourseAvailabilityState {
  const hasTheory = availability?.hasPublishedLessonContent === true;
  const hasQuestions = availability?.hasPublishedQuestion === true;
  if (hasTheory && hasQuestions) return "THEORY_AND_QUESTION_CONTENT";
  if (hasTheory) return "THEORY_CONTENT";
  if (hasQuestions) return "QUESTION_CONTENT";
  return "NO_PUBLISHED_LEARNER_CONTENT";
}
