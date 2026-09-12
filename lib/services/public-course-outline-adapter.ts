const MAX_COURSE_SLUG_LENGTH = 128;

export const MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS = 50;
export const MAX_PUBLIC_COURSE_OUTLINE_TOPICS = 200;

export type PublicCourseOutlineInput = Readonly<{
  courseSlug: string;
}>;

export type PublicCourseOutlineCourse = Readonly<{
  id: string;
  slug: string;
  code: string;
  name: string;
  shortName: string | null;
  groupName: string | null;
  description: string | null;
  difficulty: string | null;
}>;

export type PublicCourseOutlineTopic = Readonly<{
  id: string;
  subjectId: string;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isSample: boolean;
}>;

export type PublicCourseOutlineSubject = Readonly<{
  id: string;
  courseId: string;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isSample: boolean;
  topics: readonly PublicCourseOutlineTopic[];
}>;

export type PublicCourseOutlineUnavailableReason =
  | "OUTLINE_LIMIT_EXCEEDED"
  | "PUBLIC_RELATION_MISMATCH"
  | "INVALID_PUBLIC_PROJECTION"
  | "PUBLIC_REPOSITORY_ERROR";

export type PublicCourseOutlineResult =
  | Readonly<{
      status: "OK";
      course: PublicCourseOutlineCourse;
      subjects: readonly PublicCourseOutlineSubject[];
    }>
  | Readonly<{
      status: "INVALID_INPUT" | "NOT_FOUND";
    }>
  | Readonly<{
      status: "UNAVAILABLE";
      reason: PublicCourseOutlineUnavailableReason;
    }>;

export type PublicCourseOutlineRepository = Readonly<{
  getPublicCourseBySlug: (slug: string) => Promise<unknown>;
  listCurriculum: (courseId: string) => Promise<unknown>;
}>;

type RecordValue = Record<string, unknown>;

type NormalizedCourse =
  | Readonly<{ kind: "ok"; value: PublicCourseOutlineCourse }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "invalid" }>;

type NormalizedCollection =
  | Readonly<{
      kind: "ok";
      subjects: readonly PublicCourseOutlineSubject[];
    }>
  | Readonly<{ kind: "limit" }>
  | Readonly<{ kind: "relation" }>
  | Readonly<{ kind: "invalid" }>;

export function createPublicCourseOutlineAdapter(
  repository: PublicCourseOutlineRepository,
) {
  return async function getCourseOutline(
    input: unknown,
  ): Promise<PublicCourseOutlineResult> {
    if (!isValidInput(input)) return { status: "INVALID_INPUT" };

    let courseRow: unknown;
    try {
      courseRow = await repository.getPublicCourseBySlug(input.courseSlug);
    } catch {
      return { status: "UNAVAILABLE", reason: "PUBLIC_REPOSITORY_ERROR" };
    }

    const course = normalizeCourse(courseRow, input.courseSlug);
    if (course.kind === "not-found") return { status: "NOT_FOUND" };
    if (course.kind === "invalid") {
      return { status: "UNAVAILABLE", reason: "INVALID_PUBLIC_PROJECTION" };
    }

    let curriculumRows: unknown;
    try {
      curriculumRows = await repository.listCurriculum(course.value.id);
    } catch {
      return { status: "UNAVAILABLE", reason: "PUBLIC_REPOSITORY_ERROR" };
    }

    const curriculum = normalizeCurriculum(curriculumRows, course.value.id);
    if (curriculum.kind === "limit") {
      return { status: "UNAVAILABLE", reason: "OUTLINE_LIMIT_EXCEEDED" };
    }
    if (curriculum.kind === "relation") {
      return { status: "UNAVAILABLE", reason: "PUBLIC_RELATION_MISMATCH" };
    }
    if (curriculum.kind === "invalid") {
      return { status: "UNAVAILABLE", reason: "INVALID_PUBLIC_PROJECTION" };
    }

    return {
      status: "OK",
      course: course.value,
      subjects: curriculum.subjects,
    };
  };
}

export async function getPublicCourseOutline(
  input: unknown,
): Promise<PublicCourseOutlineResult> {
  const repository = await import("../../db/repositories.ts");
  return createPublicCourseOutlineAdapter({
    getPublicCourseBySlug: repository.getPublicCourseBySlug,
    listCurriculum: repository.listCurriculum,
  })(input);
}

function isValidInput(input: unknown): input is PublicCourseOutlineInput {
  if (!isRecord(input) || typeof input.courseSlug !== "string") return false;
  const slug = input.courseSlug;
  return (
    slug.length > 0 &&
    slug.length <= MAX_COURSE_SLUG_LENGTH &&
    slug === slug.trim() &&
    !/[\\/\u0000-\u001f\u007f?#]/.test(slug)
  );
}

function normalizeCourse(
  value: unknown,
  requestedSlug: string,
): NormalizedCourse {
  if (value == null) return { kind: "not-found" };
  if (!isRecord(value)) return { kind: "invalid" };

  if (value.active === false || value.published === false || typeof value.deletedAt === "string") {
    return { kind: "not-found" };
  }
  if (
    value.active !== true ||
    value.published !== true ||
    (value.deletedAt !== undefined && value.deletedAt !== null)
  ) {
    return { kind: "invalid" };
  }

  const id = nonEmptyString(value.id);
  const slug = nonEmptyString(value.slug);
  const code = nonEmptyString(value.code);
  const name = nonEmptyString(value.name);
  const shortName = nullableString(value.shortName);
  const groupName = nullableString(value.groupName);
  const description = nullableString(value.description);
  const difficulty = nullableString(value.difficulty);
  if (
    !id ||
    !slug ||
    slug !== requestedSlug ||
    !code ||
    !name ||
    shortName === undefined ||
    groupName === undefined ||
    description === undefined ||
    difficulty === undefined
  ) {
    return { kind: "invalid" };
  }

  return {
    kind: "ok",
    value: { id, slug, code, name, shortName, groupName, description, difficulty },
  };
}

function normalizeCurriculum(
  value: unknown,
  courseId: string,
): NormalizedCollection {
  if (!Array.isArray(value)) return { kind: "invalid" };

  const subjects: PublicCourseOutlineSubject[] = [];
  const subjectIds = new Set<string>();
  const topicIds = new Set<string>();
  let topicCount = 0;

  for (const subjectValue of value) {
    if (!isRecord(subjectValue)) return { kind: "invalid" };
    const subjectVisibility = visibility(subjectValue);
    if (subjectVisibility === "hidden") continue;
    if (subjectVisibility === "invalid") return { kind: "invalid" };

    const subjectId = nonEmptyString(subjectValue.id);
    const subjectCourseId = nonEmptyString(subjectValue.courseId);
    const subjectCode = nonEmptyString(subjectValue.code);
    const subjectName = nonEmptyString(subjectValue.name);
    const subjectDescription = nullableString(subjectValue.description);
    const subjectDisplayOrder = displayOrder(subjectValue.displayOrder);
    const subjectIsSample = booleanValue(subjectValue.isSample);
    const topicValues = subjectValue.topics;
    if (
      !subjectId ||
      !subjectCourseId ||
      !subjectCode ||
      !subjectName ||
      subjectDescription === undefined ||
      subjectDisplayOrder === undefined ||
      subjectIsSample === undefined ||
      !Array.isArray(topicValues)
    ) {
      return { kind: "invalid" };
    }
    if (subjectCourseId !== courseId) return { kind: "relation" };
    if (subjectIds.has(subjectId)) return { kind: "relation" };

    const topics: PublicCourseOutlineTopic[] = [];
    for (const topicValue of topicValues) {
      if (!isRecord(topicValue)) return { kind: "invalid" };
      const topicVisibility = visibility(topicValue);
      if (topicVisibility === "hidden") continue;
      if (topicVisibility === "invalid") return { kind: "invalid" };

      const topicId = nonEmptyString(topicValue.id);
      const topicSubjectId = nonEmptyString(topicValue.subjectId);
      const topicCourseId =
        topicValue.courseId === undefined
          ? courseId
          : nonEmptyString(topicValue.courseId);
      const topicCode = nonEmptyString(topicValue.code);
      const topicName = nonEmptyString(topicValue.name);
      const topicDescription = nullableString(topicValue.description);
      const topicDisplayOrder = displayOrder(topicValue.displayOrder);
      const topicIsSample = booleanValue(topicValue.isSample);
      if (
        !topicId ||
        !topicSubjectId ||
        !topicCourseId ||
        !topicCode ||
        !topicName ||
        topicDescription === undefined ||
        topicDisplayOrder === undefined ||
        topicIsSample === undefined
      ) return { kind: "invalid" };
      if (topicSubjectId !== subjectId || topicCourseId !== courseId) {
        return { kind: "relation" };
      }
      if (topicIds.has(topicId)) return { kind: "relation" };

      topicIds.add(topicId);
      topics.push({
        id: topicId,
        subjectId: topicSubjectId,
        code: topicCode,
        name: topicName,
        description: topicDescription,
        displayOrder: topicDisplayOrder,
        isSample: topicIsSample,
      });
    }

    subjectIds.add(subjectId);
    topicCount += topics.length;
    subjects.push({
      id: subjectId,
      courseId: subjectCourseId,
      code: subjectCode,
      name: subjectName,
      description: subjectDescription,
      displayOrder: subjectDisplayOrder,
      isSample: subjectIsSample,
      topics: sortByDisplayOrder(topics),
    });
  }

  if (
    subjects.length > MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS ||
    topicCount > MAX_PUBLIC_COURSE_OUTLINE_TOPICS
  ) {
    return { kind: "limit" };
  }

  return { kind: "ok", subjects: sortByDisplayOrder(subjects) };
}

function visibility(value: RecordValue): "visible" | "hidden" | "invalid" {
  if (typeof value.active !== "boolean") return "invalid";
  if (!value.active) return "hidden";
  if (value.published !== undefined) {
    if (typeof value.published !== "boolean") return "invalid";
    if (!value.published) return "hidden";
  }
  if (value.deletedAt !== undefined && value.deletedAt !== null) {
    return typeof value.deletedAt === "string" ? "hidden" : "invalid";
  }
  return "visible";
}

function sortByDisplayOrder<
  T extends Readonly<{ displayOrder: number; id: string }>,
>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => {
    const orderDifference = left.displayOrder - right.displayOrder;
    if (orderDifference !== 0) return orderDifference;
    if (left.id < right.id) return -1;
    if (left.id > right.id) return 1;
    return 0;
  });
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function displayOrder(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : undefined;
}
