/** Exact identity tuple fixed by the canonical CPPG registration contract. */
import { AppError } from "../errors.ts";

export const CPPG_CANONICAL_VISIBILITY_IDENTITY = Object.freeze({
  courseId: "course-cppg",
  courseSlug: "cppg",
  courseCode: "CPPG",
  packageKey: "course-cppg:foundation:v1",
});

type CourseIdentity = Readonly<{
  id?: unknown;
  courseId?: unknown;
  slug?: unknown;
  code?: unknown;
  active?: unknown;
  published?: unknown;
  isSample?: unknown;
}>;

export function classifyCppgVisibilityIdentity(course: CourseIdentity): "UNRELATED" | "IDENTITY_CONFLICT" | "CANONICAL_CPPG_IDENTITY" {
  const id = course.id ?? course.courseId;
  const matchesCppg = id === CPPG_CANONICAL_VISIBILITY_IDENTITY.courseId ||
    course.slug === CPPG_CANONICAL_VISIBILITY_IDENTITY.courseSlug ||
    course.code === CPPG_CANONICAL_VISIBILITY_IDENTITY.courseCode;
  if (!matchesCppg) return "UNRELATED";
  return id === CPPG_CANONICAL_VISIBILITY_IDENTITY.courseId &&
    course.slug === CPPG_CANONICAL_VISIBILITY_IDENTITY.courseSlug &&
    course.code === CPPG_CANONICAL_VISIBILITY_IDENTITY.courseCode
    ? "CANONICAL_CPPG_IDENTITY"
    : "IDENTITY_CONFLICT";
}

/**
 * Generic active/published flags remain authoritative for unrelated courses.
 * CPPG is visible only when the canonical identity tuple and its PostgreSQL
 * publication proof are both present. Any partial identity match fails shut.
 */
export async function hasCanonicalLearnerVisibility(course: CourseIdentity): Promise<boolean> {
  const identity = classifyCppgVisibilityIdentity(course);
  if (identity === "UNRELATED") return true;
  if (identity !== "CANONICAL_CPPG_IDENTITY") return false;

  try {
    const [{ getRuntimeAuthorityPersistenceOwner }, publication] = await Promise.all([
      import("../../db/index.ts"),
      import("./cppg-runtime-publication.ts"),
    ]);
    return await publication.resolveCppgCanonicalPublicationVisibility(
      await getRuntimeAuthorityPersistenceOwner(),
    ) === "CANONICALLY_PUBLISHED";
  } catch {
    // D1, missing PostgreSQL configuration, missing receipt, or invalid
    // authority state cannot establish canonical learner visibility.
    return false;
  }
}

export type CppgCanonicalLearnerRowIds = Readonly<{
  subjectIds: readonly string[]; topicIds: readonly string[]; learningUnitIds: readonly string[];
  contentIds: readonly string[]; lessonIds: readonly string[]; courseLessonIds: readonly string[];
  contentRevisionIds: readonly string[]; lectureIds: readonly string[]; audioContentIds: readonly string[];
  questionIds: readonly string[]; mockExamIds: readonly string[];
  specializedFeatureIds: readonly string[]; specializedLinkIds: readonly string[];
  specializedContentIds: readonly string[]; specializedContentRevisionIds: readonly string[];
  practicalLinkIds: readonly string[]; practicalContentIds: readonly string[];
  practicalContentRevisionIds: readonly string[];
}>;

export function isCanonicalCppgContentRevision(input: {
  revisionId: string;
  contentId: string;
  contentType: string;
  revisionStatus: string;
  isLatest: boolean;
}, projection: Pick<CppgCanonicalLearnerRowIds, "contentRevisionIds" | "contentIds"> | null): boolean {
  return Boolean(
    projection &&
    input.contentType === "LESSON" &&
    input.revisionStatus === "published" &&
    input.isLatest &&
    projection.contentRevisionIds.includes(input.revisionId) &&
    projection.contentIds.includes(input.contentId)
  );
}

export async function getCanonicalCppgLearnerRowIds(courseId: string): Promise<CppgCanonicalLearnerRowIds | null> {
  if (courseId !== CPPG_CANONICAL_VISIBILITY_IDENTITY.courseId) return null;
  try {
    const [{ getRuntimeAuthorityPersistenceOwner }, publication] = await Promise.all([
      import("../../db/index.ts"),
      import("./cppg-runtime-publication.ts"),
    ]);
    return await publication.resolveCppgCanonicalPublicationRowIds(await getRuntimeAuthorityPersistenceOwner());
  } catch {
    return null;
  }
}

export function filterCppgRowsToCanonicalProjection<T extends { id: string }>(
  courseId: string,
  rows: readonly T[],
  canonicalIds: readonly string[] | null,
): T[] {
  if (courseId !== CPPG_CANONICAL_VISIBILITY_IDENTITY.courseId) return [...rows];
  if (!canonicalIds) return [];
  const allowed = new Set(canonicalIds);
  return rows.filter(({ id }) => allowed.has(id));
}

/** Assessment identities are projected explicitly; historical learner rows never confer membership. */
export function filterCppgAssessmentRows<T extends { courseId: string; questionId: string }>(
  rows: readonly T[],
  canonicalQuestionIds: readonly string[] | null,
): T[] {
  if (canonicalQuestionIds === null) return rows.filter(({ courseId }) => courseId !== CPPG_CANONICAL_VISIBILITY_IDENTITY.courseId);
  const allowed = new Set(canonicalQuestionIds);
  return rows.filter(({ courseId, questionId }) =>
    courseId !== CPPG_CANONICAL_VISIBILITY_IDENTITY.courseId || allowed.has(questionId)
  );
}

export function isCanonicalCppgQuestion(questionId: string, canonicalQuestionIds: readonly string[] | null): boolean {
  return canonicalQuestionIds?.includes(questionId) ?? false;
}

/** Review history is visible only when its target belongs to the matching current projection domain. */
export function isCanonicalCppgReviewTarget(
  targetType: string,
  targetId: string,
  projection: Pick<CppgCanonicalLearnerRowIds, "questionIds" | "topicIds" | "contentIds"> | null,
): boolean {
  if (!projection) return false;
  const canonicalIds = targetType === "QUESTION" || targetType === "MOCK_EXAM_QUESTION"
    ? projection.questionIds
    : targetType === "TOPIC"
      ? projection.topicIds
      : targetType === "CONTENT"
        ? projection.contentIds
        : null;
  return canonicalIds?.includes(targetId) ?? false;
}

/** A CPPG mock exam is learner-visible only when both the exam and every question are projected. */
export function isCanonicalCppgMockExam(
  mockExamId: string,
  questionIds: readonly string[],
  projection: Pick<CppgCanonicalLearnerRowIds, "mockExamIds" | "questionIds"> | null,
): boolean {
  return Boolean(
    projection &&
    questionIds.length > 0 &&
    projection.mockExamIds.includes(mockExamId) &&
    questionIds.every((questionId) => projection.questionIds.includes(questionId))
  );
}

export function isCanonicalCppgCourseLesson(
  courseId: string,
  courseLessonId: string,
  contentId: string,
  projection: Pick<CppgCanonicalLearnerRowIds, "courseLessonIds" | "contentIds"> | null,
): boolean {
  if (courseId !== CPPG_CANONICAL_VISIBILITY_IDENTITY.courseId) return true;
  return Boolean(
    projection &&
    projection.courseLessonIds.includes(courseLessonId) &&
    projection.contentIds.includes(contentId)
  );
}

export function shouldBypassCppgCurriculumCache(courseId: string): boolean {
  return courseId === CPPG_CANONICAL_VISIBILITY_IDENTITY.courseId;
}

/** The current canonical CPPG publication snapshot does not contain these domains. */
export async function hasCanonicalCppgLearnerDomainRows(
  courseId: string,
  domain: "SPECIALIZED" | "PRACTICAL" | "LECTURE" | "AUDIO",
): Promise<boolean> {
  if (courseId !== CPPG_CANONICAL_VISIBILITY_IDENTITY.courseId) return true;
  const rows = await getCanonicalCppgLearnerRowIds(courseId);
  if (!rows) return false;
  return domain === "SPECIALIZED"
    ? rows.specializedFeatureIds.length > 0 && rows.specializedLinkIds.length > 0 && rows.specializedContentIds.length > 0
    : domain === "PRACTICAL"
      ? rows.practicalLinkIds.length > 0 && rows.practicalContentIds.length > 0
      : domain === "LECTURE"
        ? rows.lectureIds.length > 0
        : rows.audioContentIds.length > 0;
}

export async function hasCanonicalCppgLearnerDomainRow(
  courseId: string,
  domain: "SPECIALIZED" | "PRACTICAL" | "LECTURE" | "AUDIO",
  rowId: string,
): Promise<boolean> {
  if (courseId !== CPPG_CANONICAL_VISIBILITY_IDENTITY.courseId) return true;
  const rows = await getCanonicalCppgLearnerRowIds(courseId);
  if (!rows) return false;
  const identities = domain === "SPECIALIZED"
    ? [...rows.specializedFeatureIds, ...rows.specializedLinkIds, ...rows.specializedContentIds, ...rows.specializedContentRevisionIds]
    : domain === "PRACTICAL"
      ? [...rows.practicalLinkIds, ...rows.practicalContentIds, ...rows.practicalContentRevisionIds]
      : domain === "LECTURE"
        ? rows.lectureIds
        : rows.audioContentIds;
  return identities.includes(rowId);
}

/** Exact row authorization for repositories that already hold the course identity. */
export async function hasCanonicalLearnerRow(
  course: CourseIdentity,
  domain: "LECTURE" | "AUDIO" | "CONTENT_REVISION",
  rowId: string,
): Promise<boolean> {
  const identity = classifyCppgVisibilityIdentity(course);
  if (identity === "UNRELATED") return true;
  if (identity !== "CANONICAL_CPPG_IDENTITY" || !(await hasCanonicalLearnerVisibility(course))) return false;
  const rows = await getCanonicalCppgLearnerRowIds(CPPG_CANONICAL_VISIBILITY_IDENTITY.courseId);
  if (!rows) return false;
  if (domain === "LECTURE") return rows.lectureIds.includes(rowId);
  if (domain === "AUDIO") return rows.audioContentIds.includes(rowId);
  return rows.contentRevisionIds.includes(rowId);
}

export async function requireCanonicalCppgLearnerDomainRows(
  courseId: string,
  domain: "SPECIALIZED" | "PRACTICAL" | "LECTURE" | "AUDIO",
): Promise<void> {
  if (!await hasCanonicalCppgLearnerDomainRows(courseId, domain)) {
    throw new AppError(
      `CPPG ${domain.toLowerCase()} learner content is not in the current canonical publication projection.`,
      403,
      "CPPG_LEARNER_DOMAIN_UNAVAILABLE",
    );
  }
}

export async function filterCanonicalCppgVisibility<T extends CourseIdentity>(
  courses: readonly T[],
  hasPublication: (course: T) => Promise<boolean> = hasCanonicalLearnerVisibility,
): Promise<T[]> {
  const visible = await Promise.all(courses.map(async (course) => ({
    course,
    allowed: await hasPublication(course),
  })));
  return visible.filter((entry) => entry.allowed).map((entry) => entry.course);
}
