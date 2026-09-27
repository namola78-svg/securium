import type {
  PublicCourseOutlineRepository,
} from "../lib/services/public-course-outline-adapter.ts";
import {
  MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS,
  MAX_PUBLIC_COURSE_OUTLINE_TOPICS,
} from "../lib/services/public-course-outline-adapter.ts";
import { RepositoryContext } from "./repository-adapter/repository-context.ts";
import { quoteIdentifier } from "./repository-adapter/sql-dialect.ts";
import type { DatabaseStatement } from "./provider/database-provider.ts";

const SUBJECT_FETCH_LIMIT = MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS + 1;
const TOPIC_FETCH_LIMIT = MAX_PUBLIC_COURSE_OUTLINE_TOPICS + 1;

type OutlineQueryKind = "course" | "subjects" | "topics";

export type PublicCourseOutlineProviderMetrics = Readonly<{
  queryCount: number;
  queryCountByKind: Readonly<Record<OutlineQueryKind, number>>;
  returnedRowsByKind: Readonly<Record<OutlineQueryKind, number>>;
}>;

export type PublicCourseOutlineProvider = PublicCourseOutlineRepository & {
  getMetrics: () => PublicCourseOutlineProviderMetrics;
};

type DatabaseRow = Record<string, unknown>;

/**
 * Read-only public outline projection with bounded database result sets.
 *
 * The course predicate intentionally includes the active/non-deleted group
 * predicate used by listPublishedCourses. The existing detail repository has
 * a narrower course-only predicate and is left unchanged; this provider does
 * not claim that the public selection policy has been globally activated.
 */
export function createPublicCourseOutlineProvider(
  context: RepositoryContext,
): PublicCourseOutlineProvider {
  const metrics = {
    queryCount: 0,
    queryCountByKind: {
      course: 0,
      subjects: 0,
      topics: 0,
    } satisfies Record<OutlineQueryKind, number>,
    returnedRowsByKind: {
      course: 0,
      subjects: 0,
      topics: 0,
    } satisfies Record<OutlineQueryKind, number>,
  };

  async function query<Row extends DatabaseRow>(
    kind: OutlineQueryKind,
    statement: DatabaseStatement,
  ) {
    metrics.queryCount += 1;
    metrics.queryCountByKind[kind] += 1;
    const result = await context.query<Row>(statement);
    metrics.returnedRowsByKind[kind] += result.rows.length;
    return result.rows;
  }

  return {
    async getPublicCourseBySlug(slug: string) {
      const rows = await query<DatabaseRow>(
        "course",
        buildCourseStatement(context, slug),
      );
      const row = rows[0];
      return row ? mapCourseRow(row) : null;
    },

    async listCurriculum(courseId: string) {
      const [subjectRows, topicRows] = await Promise.all([
        query<DatabaseRow>(
          "subjects",
          buildSubjectsStatement(context, courseId),
        ),
        query<DatabaseRow>("topics", buildTopicsStatement(context, courseId)),
      ]);

      const subjects = subjectRows.map(mapSubjectRow);
      const subjectsById = new Map(
        subjects.map((subject) => [subject.id, subject] as const),
      );

      for (const row of topicRows) {
        const topic = mapTopicRow(row);
        const subject = subjectsById.get(topic.subjectId);
        // A subject omitted by the bounded subject query can only occur after
        // a concurrent change or once the subject limit has already been
        // exceeded. Do not manufacture a public subject for such a topic.
        if (subject) subject.topics.push(topic);
      }

      return subjects;
    },

    getMetrics() {
      return {
        queryCount: metrics.queryCount,
        queryCountByKind: { ...metrics.queryCountByKind },
        returnedRowsByKind: { ...metrics.returnedRowsByKind },
      };
    },
  };
}

function buildCourseStatement(
  context: RepositoryContext,
  slug: string,
): DatabaseStatement {
  const p = context.dialect.placeholder.bind(context.dialect);
  const statement = `
SELECT
  ${column("courses", "id")} AS ${identifier("id")},
  ${column("course_groups", "name")} AS ${identifier("groupName")},
  ${column("courses", "code")} AS ${identifier("code")},
  ${column("courses", "slug")} AS ${identifier("slug")},
  ${column("courses", "name")} AS ${identifier("name")},
  ${column("courses", "short_name")} AS ${identifier("shortName")},
  ${column("courses", "description")} AS ${identifier("description")},
  ${column("courses", "difficulty")} AS ${identifier("difficulty")},
  ${column("courses", "active")} AS ${identifier("active")},
  ${column("courses", "published")} AS ${identifier("published")}
FROM ${identifier("courses")}
INNER JOIN ${identifier("course_groups")}
  ON ${column("courses", "course_group_id")} = ${column("course_groups", "id")}
WHERE ${column("courses", "slug")} = ${p(1)}
  AND ${column("courses", "active")} = ${p(2)}
  AND ${column("courses", "published")} = ${p(3)}
  AND ${column("courses", "deleted_at")} IS NULL
  AND ${column("course_groups", "active")} = ${p(4)}
  AND ${column("course_groups", "deleted_at")} IS NULL
LIMIT 1`;

  return { sql: statement, parameters: [slug, 1, 1, 1] };
}

function buildSubjectsStatement(
  context: RepositoryContext,
  courseId: string,
): DatabaseStatement {
  const p = context.dialect.placeholder.bind(context.dialect);
  const statement = `
SELECT
  ${column("subjects", "id")} AS ${identifier("id")},
  ${column("subjects", "course_id")} AS ${identifier("courseId")},
  ${column("subjects", "code")} AS ${identifier("code")},
  ${column("subjects", "name")} AS ${identifier("name")},
  ${column("subjects", "description")} AS ${identifier("description")},
  ${column("subjects", "display_order")} AS ${identifier("displayOrder")},
  ${column("subjects", "active")} AS ${identifier("active")},
  ${column("subjects", "is_sample")} AS ${identifier("isSample")}
FROM ${identifier("subjects")}
WHERE ${column("subjects", "course_id")} = ${p(1)}
  AND ${column("subjects", "active")} = ${p(2)}
  AND ${column("subjects", "deleted_at")} IS NULL
ORDER BY ${column("subjects", "display_order")} ASC,
  ${column("subjects", "id")} ASC
LIMIT ${p(3)}`;

  return { sql: statement, parameters: [courseId, 1, SUBJECT_FETCH_LIMIT] };
}

function buildTopicsStatement(
  context: RepositoryContext,
  courseId: string,
): DatabaseStatement {
  const p = context.dialect.placeholder.bind(context.dialect);
  const statement = `
SELECT
  ${column("topics", "id")} AS ${identifier("id")},
  ${column("topics", "subject_id")} AS ${identifier("subjectId")},
  ${column("subjects", "course_id")} AS ${identifier("courseId")},
  ${column("topics", "code")} AS ${identifier("code")},
  ${column("topics", "name")} AS ${identifier("name")},
  ${column("topics", "description")} AS ${identifier("description")},
  ${column("topics", "display_order")} AS ${identifier("displayOrder")},
  ${column("topics", "active")} AS ${identifier("active")},
  ${column("topics", "is_sample")} AS ${identifier("isSample")}
FROM ${identifier("topics")}
INNER JOIN ${identifier("subjects")}
  ON ${column("topics", "subject_id")} = ${column("subjects", "id")}
WHERE ${column("subjects", "course_id")} = ${p(1)}
  AND ${column("subjects", "active")} = ${p(2)}
  AND ${column("subjects", "deleted_at")} IS NULL
  AND ${column("topics", "active")} = ${p(3)}
  AND ${column("topics", "deleted_at")} IS NULL
ORDER BY ${column("topics", "display_order")} ASC,
  ${column("topics", "id")} ASC
LIMIT ${p(4)}`;

  return {
    sql: statement,
    parameters: [courseId, 1, 1, TOPIC_FETCH_LIMIT],
  };
}

function mapCourseRow(row: DatabaseRow) {
  return {
    id: row.id,
    groupName: row.groupName,
    code: row.code,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName,
    description: row.description,
    difficulty: row.difficulty,
    active: databaseBoolean(row.active),
    published: databaseBoolean(row.published),
  };
}

function mapSubjectRow(row: DatabaseRow) {
  return {
    id: row.id,
    courseId: row.courseId,
    code: row.code,
    name: row.name,
    description: row.description,
    displayOrder: row.displayOrder,
    active: databaseBoolean(row.active),
    isSample: databaseBoolean(row.isSample),
    topics: [] as ReturnType<typeof mapTopicRow>[],
  };
}

function mapTopicRow(row: DatabaseRow) {
  return {
    id: row.id,
    subjectId: row.subjectId,
    courseId: row.courseId,
    code: row.code,
    name: row.name,
    description: row.description,
    displayOrder: row.displayOrder,
    active: databaseBoolean(row.active),
    isSample: databaseBoolean(row.isSample),
  };
}

function databaseBoolean(value: unknown): unknown {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && (value === 0 || value === 1)) {
    return value === 1;
  }
  if (typeof value === "string" && (value === "0" || value === "1")) {
    return value === "1";
  }
  return value;
}

function column(table: string, name: string) {
  return `${identifier(table)}.${identifier(name)}`;
}

function identifier(value: string) {
  return quoteIdentifier(value);
}
