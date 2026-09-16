import { AppError } from "../lib/errors.ts";
import type {
  DatabaseValue,
} from "./provider/database-provider.ts";
import { RepositoryContext } from "./repository-adapter/repository-context.ts";
import { quoteIdentifier } from "./repository-adapter/sql-dialect.ts";

export const PUBLIC_COURSE_AVAILABILITY_BATCH_SIZE = 100;

export type PublicCourseAvailability = {
  courseId: string;
  hasPublishedQuestion: boolean;
  hasPublishedLessonContent: boolean;
};

type PublicCourseAvailabilityRow = {
  courseId: unknown;
  hasPublishedQuestion: unknown;
  hasPublishedLessonContent: unknown;
};

export function createPublicCourseAvailabilityRepository(
  context: RepositoryContext,
) {
  return {
    listByCourseIds(courseIds: readonly string[]) {
      return listPublicCourseAvailability(context, courseIds);
    },
  };
}

export async function listPublicCourseAvailability(
  context: RepositoryContext,
  courseIds: readonly string[],
): Promise<PublicCourseAvailability[]> {
  const uniqueCourseIds = normalizeCourseIds(courseIds);
  if (uniqueCourseIds.length === 0) return [];

  const rows: PublicCourseAvailability[] = [];
  for (
    let offset = 0;
    offset < uniqueCourseIds.length;
    offset += PUBLIC_COURSE_AVAILABILITY_BATCH_SIZE
  ) {
    const chunk = uniqueCourseIds.slice(
      offset,
      offset + PUBLIC_COURSE_AVAILABILITY_BATCH_SIZE,
    );
    const result = await context.query<PublicCourseAvailabilityRow>(
      buildAvailabilityStatement(context, chunk),
    );
    rows.push(...result.rows.map(mapAvailabilityRow));
  }

  const byCourseId = new Map(
    rows.map((row) => [row.courseId, row] as const),
  );
  return uniqueCourseIds
    .map((courseId) => byCourseId.get(courseId))
    .filter((row): row is PublicCourseAvailability => Boolean(row));
}

function buildAvailabilityStatement(
  context: RepositoryContext,
  courseIds: readonly string[],
) {
  const activeIndex = courseIds.length + 1;
  const publishedIndex = courseIds.length + 2;
  const groupActiveIndex = courseIds.length + 3;
  const placeholders = context.dialect.placeholders(courseIds.length);
  const activePlaceholder = context.dialect.placeholder(activeIndex);
  const publishedPlaceholder = context.dialect.placeholder(publishedIndex);
  const groupActivePlaceholder = context.dialect.placeholder(groupActiveIndex);

  const statement = `
SELECT ${quoteIdentifier("courses")}.${quoteIdentifier("id")} AS ${quoteIdentifier("courseId")},
  CASE WHEN EXISTS (
    SELECT 1
    FROM ${quoteIdentifier("question_courses")}
    INNER JOIN ${quoteIdentifier("questions")}
      ON ${quoteIdentifier("question_courses")}.${quoteIdentifier("question_id")} = ${quoteIdentifier("questions")}.${quoteIdentifier("id")}
    WHERE ${quoteIdentifier("question_courses")}.${quoteIdentifier("course_id")} = ${quoteIdentifier("courses")}.${quoteIdentifier("id")}
      AND ${quoteIdentifier("questions")}.${quoteIdentifier("status")} = 'PUBLISHED'
  ) THEN 1 ELSE 0 END AS ${quoteIdentifier("hasPublishedQuestion")},
  CASE WHEN EXISTS (
    SELECT 1
    FROM ${quoteIdentifier("course_lessons")}
    INNER JOIN ${quoteIdentifier("contents")}
      ON ${quoteIdentifier("course_lessons")}.${quoteIdentifier("content_id")} = ${quoteIdentifier("contents")}.${quoteIdentifier("id")}
    WHERE ${quoteIdentifier("course_lessons")}.${quoteIdentifier("course_id")} = ${quoteIdentifier("courses")}.${quoteIdentifier("id")}
      AND ${quoteIdentifier("course_lessons")}.${quoteIdentifier("status")} = 'PUBLISHED'
      AND ${quoteIdentifier("course_lessons")}.${quoteIdentifier("deleted_at")} IS NULL
      AND ${quoteIdentifier("contents")}.${quoteIdentifier("status")} = 'PUBLISHED'
      AND ${quoteIdentifier("contents")}.${quoteIdentifier("deleted_at")} IS NULL
  ) THEN 1 ELSE 0 END AS ${quoteIdentifier("hasPublishedLessonContent")}
FROM ${quoteIdentifier("courses")}
INNER JOIN ${quoteIdentifier("course_groups")}
  ON ${quoteIdentifier("courses")}.${quoteIdentifier("course_group_id")} = ${quoteIdentifier("course_groups")}.${quoteIdentifier("id")}
WHERE ${quoteIdentifier("courses")}.${quoteIdentifier("id")} IN (${placeholders})
  AND ${quoteIdentifier("courses")}.${quoteIdentifier("active")} = ${activePlaceholder}
  AND ${quoteIdentifier("courses")}.${quoteIdentifier("published")} = ${publishedPlaceholder}
  AND ${quoteIdentifier("courses")}.${quoteIdentifier("deleted_at")} IS NULL
  AND ${quoteIdentifier("course_groups")}.${quoteIdentifier("active")} = ${groupActivePlaceholder}
  AND ${quoteIdentifier("course_groups")}.${quoteIdentifier("deleted_at")} IS NULL`;

  const parameters: DatabaseValue[] = [...courseIds, 1, 1, 1];
  return { sql: statement, parameters };
}

function normalizeCourseIds(courseIds: readonly string[]) {
  const uniqueCourseIds: string[] = [];
  const seen = new Set<string>();
  for (const courseId of courseIds) {
    if (typeof courseId !== "string" || courseId.length === 0) {
      throw new AppError(
        "Public course availability requires non-empty course IDs.",
        400,
        "PUBLIC_COURSE_AVAILABILITY_INPUT_INVALID",
      );
    }
    if (seen.has(courseId)) continue;
    seen.add(courseId);
    uniqueCourseIds.push(courseId);
  }
  return uniqueCourseIds;
}

function mapAvailabilityRow(
  row: PublicCourseAvailabilityRow,
): PublicCourseAvailability {
  if (typeof row.courseId !== "string" || row.courseId.length === 0) {
    throw new AppError(
      "The public course availability query returned an invalid course ID.",
      500,
      "PUBLIC_COURSE_AVAILABILITY_RESULT_INVALID",
    );
  }
  return {
    courseId: row.courseId,
    hasPublishedQuestion: readBooleanFlag(
      row.hasPublishedQuestion,
      "hasPublishedQuestion",
    ),
    hasPublishedLessonContent: readBooleanFlag(
      row.hasPublishedLessonContent,
      "hasPublishedLessonContent",
    ),
  };
}

function readBooleanFlag(value: unknown, field: string) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && (value === 0 || value === 1)) {
    return value === 1;
  }
  if (typeof value === "string" && (value === "0" || value === "1")) {
    return value === "1";
  }
  throw new AppError(
    `The public course availability query returned an invalid ${field} flag.`,
    500,
    "PUBLIC_COURSE_AVAILABILITY_RESULT_INVALID",
  );
}
