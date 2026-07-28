import { AppError } from "../../lib/errors.ts";
import type {
  DatabaseStatement,
  DatabaseValue,
} from "../provider/database-provider.ts";
import { RepositoryContext } from "./repository-context.ts";
import {
  mapDatabaseRow,
  serializeRepositoryValues,
  type RowMapping,
} from "./row-mapper.ts";
import { quoteIdentifier, type SortDirection } from "./sql-dialect.ts";

export type RepositoryPage<T> = {
  items: T[];
  total: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
};

export type RepositoryListOptions = {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: SortDirection;
  filters?: Record<string, DatabaseValue>;
  search?: string;
  scope?: Record<string, DatabaseValue>;
};

type EntityConfig = {
  entity: string;
  table: string;
  mapping: RowMapping;
  create: readonly string[];
  update: readonly string[];
  filters: readonly string[];
  sorts: readonly string[];
  search: readonly string[];
  requiredScope?: readonly string[];
  defaultSort: string;
  softDeactivate?: { property: string; value: DatabaseValue };
  updatedAtProperty?: string;
};

export class SqlEntityRepository<T extends Record<string, unknown>> {
  protected readonly context: RepositoryContext;
  protected readonly config: EntityConfig;

  constructor(context: RepositoryContext, config: EntityConfig) {
    this.context = context;
    this.config = config;
  }

  async create(
    values: Record<string, unknown>,
    scope: Record<string, DatabaseValue> = {},
  ) {
    this.assertRequiredScope(scope);
    for (const property of this.config.requiredScope ?? []) {
      if (values[property] !== scope[property]) {
        throw new AppError(
          `${this.config.entity} create scope does not match the record owner.`,
          403,
          "REPOSITORY_SCOPE_MISMATCH",
        );
      }
    }
    const id = crypto.randomUUID();
    const input = { id, ...values };
    const serialized = serializeRepositoryValues(
      input,
      this.config.mapping,
      ["id", ...this.config.create],
    );
    const columns = Object.keys(serialized);
    const parameters = Object.values(serialized);
    const statement: DatabaseStatement = {
      sql: `INSERT INTO ${quoteIdentifier(this.config.table)} (${columns
        .map(quoteIdentifier)
        .join(", ")}) VALUES (${this.context.dialect.placeholders(
        columns.length,
      )}) ${this.context.dialect.returning(
        Object.values(this.config.mapping.fields),
      )}`,
      parameters,
    };
    const result = await this.context.queryOne<Record<string, unknown>>(
      statement,
    );
    return result ? this.map(result) : ({ ...input } as unknown as T);
  }

  async findById(
    id: string,
    scope: Record<string, DatabaseValue> = {},
  ): Promise<T | null> {
    this.assertRequiredScope(scope);
    const where = this.buildWhere({ id, ...scope }, 1);
    const row = await this.context.queryOne<Record<string, unknown>>({
      sql: `SELECT * FROM ${quoteIdentifier(this.config.table)} WHERE ${where.sql} LIMIT 1`,
      parameters: where.parameters,
    });
    return row ? this.map(row) : null;
  }

  async list(options: RepositoryListOptions = {}): Promise<RepositoryPage<T>> {
    const page = positiveInteger(options.page, 1);
    const pageSize = boundedPageSize(options.pageSize);
    const scope = options.scope ?? {};
    this.assertRequiredScope(scope);
    const filters = options.filters ?? {};
    this.assertAllowedKeys(filters, this.config.filters, "filter");
    const sortBy = options.sortBy ?? this.config.defaultSort;
    if (!this.config.sorts.includes(sortBy)) {
      throw repositoryInputError("The requested sort field is not allowed.");
    }
    const direction = options.sortDirection === "desc" ? "DESC" : "ASC";
    const where = this.buildWhere({ ...scope, ...filters }, 1);
    if (options.search && this.config.search.length === 0) {
      throw repositoryInputError("Search is not supported for this repository.");
    }
    const searchValue = options.search?.trim();
    const searchSql = searchValue
      ? this.context.dialect.caseInsensitivePredicate(
          this.config.search.map((property) => this.column(property)),
          where.parameters.length + 1,
        )
      : "";
    const conditions = [where.sql, searchSql].filter(Boolean).join(" AND ");
    const parameters = [
      ...where.parameters,
      ...(searchValue ? [`%${searchValue}%`] : []),
    ];
    const limitIndex = parameters.length + 1;
    const offsetIndex = parameters.length + 2;
    const from = quoteIdentifier(this.config.table);
    const pagination = await this.context.paginate<Record<string, unknown>>({
      data: {
        sql: `SELECT * FROM ${from}${
          conditions ? ` WHERE ${conditions}` : ""
        } ORDER BY ${quoteIdentifier(this.column(sortBy))} ${direction} ${this.context.dialect.pagination(
          limitIndex,
          offsetIndex,
        )}`,
        parameters: [...parameters, pageSize, (page - 1) * pageSize],
      },
      count: {
        sql: `SELECT COUNT(*) AS total FROM ${from}${
          conditions ? ` WHERE ${conditions}` : ""
        }`,
        parameters,
      },
      page,
      pageSize,
    });
    return {
      items: pagination.result.rows.map((row) => this.map(row)),
      total: pagination.total,
      hasMore: pagination.hasMore,
      page,
      pageSize,
    };
  }

  async update(
    id: string,
    values: Record<string, unknown>,
    scope: Record<string, DatabaseValue> = {},
  ) {
    this.assertRequiredScope(scope);
    const normalizedValues = { ...values };
    if (this.config.updatedAtProperty) {
      normalizedValues[this.config.updatedAtProperty] =
        new Date().toISOString();
    }
    const allowed = [
      ...this.config.update,
      ...(this.config.updatedAtProperty
        ? [this.config.updatedAtProperty]
        : []),
    ];
    const serialized = serializeRepositoryValues(
      normalizedValues,
      this.config.mapping,
      allowed,
    );
    const entries = Object.entries(serialized);
    if (entries.length === 0) {
      throw repositoryInputError("At least one update field is required.");
    }
    const assignments = entries.map(
      ([column], index) =>
        `${quoteIdentifier(column)} = ${this.context.dialect.placeholder(
          index + 1,
        )}`,
    );
    const where = this.buildWhere(
      { id, ...scope },
      entries.length + 1,
    );
    const result = await this.context.execute({
      sql: `UPDATE ${quoteIdentifier(this.config.table)} SET ${assignments.join(
        ", ",
      )} WHERE ${where.sql}`,
      parameters: [...entries.map(([, value]) => value), ...where.parameters],
    });
    if (result.affectedRows === 0) throw notFound(this.config.entity);
    return this.findById(id, scope);
  }

  async deactivate(
    id: string,
    scope: Record<string, DatabaseValue> = {},
  ) {
    if (!this.config.softDeactivate) {
      throw repositoryInputError(
        `${this.config.entity} records cannot be deactivated.`,
      );
    }
    return this.update(
      id,
      {
        [this.config.softDeactivate.property]:
          this.config.softDeactivate.value,
      },
      scope,
    );
  }

  protected map(row: Record<string, unknown>) {
    return mapDatabaseRow<T>(row, this.config.mapping);
  }

  protected column(property: string) {
    const column = this.config.mapping.fields[property];
    if (!column) {
      throw repositoryInputError(`Unknown repository field: ${property}`);
    }
    return column;
  }

  private buildWhere(
    values: Record<string, DatabaseValue>,
    startIndex: number,
  ) {
    this.assertAllowedKeys(
      values,
      ["id", ...this.config.filters, ...(this.config.requiredScope ?? [])],
      "scope",
    );
    const serialized = serializeRepositoryValues(
      values,
      this.config.mapping,
      Object.keys(values),
    );
    const entries = Object.entries(serialized);
    const parameters: DatabaseValue[] = [];
    return {
      sql: entries
        .map(
          ([column, value]) => {
            if (value === null) return `${quoteIdentifier(column)} IS NULL`;
            const placeholder = this.context.dialect.placeholder(
              startIndex + parameters.length,
            );
            parameters.push(value);
            return `${quoteIdentifier(column)} = ${placeholder}`;
          },
        )
        .join(" AND "),
      parameters,
    };
  }

  private assertRequiredScope(scope: Record<string, DatabaseValue>) {
    for (const property of this.config.requiredScope ?? []) {
      if (!(property in scope) || scope[property] === null) {
        throw new AppError(
          `${this.config.entity} access requires an ownership scope.`,
          403,
          "REPOSITORY_SCOPE_REQUIRED",
        );
      }
    }
  }

  private assertAllowedKeys(
    values: Record<string, unknown>,
    allowed: readonly string[],
    kind: string,
  ) {
    for (const key of Object.keys(values)) {
      if (!allowed.includes(key)) {
        throw repositoryInputError(
          `The requested ${kind} field is not allowed.`,
        );
      }
    }
  }
}

export function createCoreRepositories(context: RepositoryContext) {
  return {
    users: new SqlEntityRepository(context, USER),
    roles: new SqlEntityRepository(context, ROLE),
    courses: new SqlEntityRepository(context, COURSE),
    enrollments: new SqlEntityRepository(context, ENROLLMENT),
    lessons: new SqlEntityRepository(context, LESSON),
    lessonProgress: new SqlEntityRepository(context, LESSON_PROGRESS),
    questions: new QuestionRepository(context),
    questionAttempts: new SqlEntityRepository(context, QUESTION_ATTEMPT),
    wrongNotes: new SqlEntityRepository(context, WRONG_NOTE),
    mockExamAttempts: new MockExamAttemptRepository(context),
  };
}

export class QuestionRepository extends SqlEntityRepository<
  Record<string, unknown>
> {
  constructor(context: RepositoryContext) {
    super(context, QUESTION);
  }

  async findByIdForCourse(id: string, courseId: string) {
    const row = await this.context.queryOne<Record<string, unknown>>({
      sql: `SELECT q.* FROM "questions" q INNER JOIN "question_courses" qc ON qc."question_id" = q."id" WHERE q."id" = ${this.context.dialect.placeholder(
        1,
      )} AND qc."course_id" = ${this.context.dialect.placeholder(2)} LIMIT 1`,
      parameters: [id, courseId],
    });
    return row ? this.map(row) : null;
  }

  async listForCourse(
    courseId: string,
    options: Omit<RepositoryListOptions, "scope"> = {},
  ) {
    const page = positiveInteger(options.page, 1);
    const pageSize = boundedPageSize(options.pageSize);
    const search = options.search?.trim();
    const parameters: DatabaseValue[] = [courseId];
    const predicates = [
      `qc."course_id" = ${this.context.dialect.placeholder(1)}`,
    ];
    if (search) {
      parameters.push(`%${search}%`);
      predicates.push(
        this.context.dialect.caseInsensitivePredicate(
          ["title", "content"],
          2,
        ),
      );
    }
    const limitIndex = parameters.length + 1;
    const offsetIndex = parameters.length + 2;
    const where = predicates.join(" AND ");
    const result = await this.context.paginate<Record<string, unknown>>({
      data: {
        sql: `SELECT q.* FROM "questions" q INNER JOIN "question_courses" qc ON qc."question_id" = q."id" WHERE ${where} ORDER BY q."created_at" DESC ${this.context.dialect.pagination(
          limitIndex,
          offsetIndex,
        )}`,
        parameters: [...parameters, pageSize, (page - 1) * pageSize],
      },
      count: {
        sql: `SELECT COUNT(*) AS total FROM "questions" q INNER JOIN "question_courses" qc ON qc."question_id" = q."id" WHERE ${where}`,
        parameters,
      },
      page,
      pageSize,
    });
    return {
      items: result.result.rows.map((row) => this.map(row)),
      total: result.total,
      hasMore: result.hasMore,
      page,
      pageSize,
    };
  }

  async createForCourse(
    values: Record<string, unknown>,
    courseId: string,
    weight = 100,
  ) {
    const id = crypto.randomUUID();
    const serialized = serializeRepositoryValues(
      { id, ...values },
      QUESTION.mapping,
      ["id", ...QUESTION.create],
    );
    const columns = Object.keys(serialized);
    const questionStatement: DatabaseStatement = {
      sql: `INSERT INTO "questions" (${columns
        .map(quoteIdentifier)
        .join(", ")}) VALUES (${this.context.dialect.placeholders(
        columns.length,
      )})`,
      parameters: Object.values(serialized),
    };
    const linkStatement: DatabaseStatement = {
      sql: `INSERT INTO "question_courses" ("question_id", "course_id", "weight") VALUES (${this.context.dialect.placeholders(
        3,
      )})`,
      parameters: [id, courseId, weight],
    };
    await this.context.transaction((transaction) => {
      transaction.execute(questionStatement);
      transaction.execute(linkStatement);
    });
    return id;
  }
}

export class MockExamAttemptRepository extends SqlEntityRepository<
  Record<string, unknown>
> {
  constructor(context: RepositoryContext) {
    super(context, MOCK_EXAM_ATTEMPT);
  }

  async listForCourse(
    userId: string,
    courseId: string,
    page = 1,
    pageSize = 20,
  ) {
    const safePage = positiveInteger(page, 1);
    const safeSize = boundedPageSize(pageSize);
    const limitIndex = 3;
    const offsetIndex = 4;
    const result = await this.context.paginate<Record<string, unknown>>({
      data: {
        sql: `SELECT a.* FROM "mock_exam_attempts" a INNER JOIN "mock_exams" e ON e."id" = a."mock_exam_id" WHERE a."user_id" = ${this.context.dialect.placeholder(
          1,
        )} AND e."course_id" = ${this.context.dialect.placeholder(
          2,
        )} ORDER BY a."started_at" DESC ${this.context.dialect.pagination(
          limitIndex,
          offsetIndex,
        )}`,
        parameters: [
          userId,
          courseId,
          safeSize,
          (safePage - 1) * safeSize,
        ],
      },
      count: {
        sql: `SELECT COUNT(*) AS total FROM "mock_exam_attempts" a INNER JOIN "mock_exams" e ON e."id" = a."mock_exam_id" WHERE a."user_id" = ${this.context.dialect.placeholder(
          1,
        )} AND e."course_id" = ${this.context.dialect.placeholder(2)}`,
        parameters: [userId, courseId],
      },
      page: safePage,
      pageSize: safeSize,
    });
    return {
      items: result.result.rows.map((row) => this.map(row)),
      total: result.total,
      hasMore: result.hasMore,
      page: safePage,
      pageSize: safeSize,
    };
  }
}

const USER: EntityConfig = {
  entity: "User",
  table: "users",
  mapping: mapping(
    {
      id: "id",
      email: "email",
      displayName: "display_name",
      status: "status",
      lastSignedInAt: "last_signed_in_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    [],
    ["lastSignedInAt", "createdAt", "updatedAt"],
  ),
  create: ["email", "displayName", "status", "lastSignedInAt"],
  update: ["displayName", "status", "lastSignedInAt"],
  filters: ["email", "status"],
  sorts: ["email", "createdAt", "updatedAt"],
  search: ["email", "displayName"],
  defaultSort: "createdAt",
  softDeactivate: { property: "status", value: "SUSPENDED" },
  updatedAtProperty: "updatedAt",
};

const ROLE: EntityConfig = {
  entity: "Role",
  table: "roles",
  mapping: mapping({
    id: "id",
    code: "code",
    name: "name",
    description: "description",
    createdAt: "created_at",
    updatedAt: "updated_at",
  }, [], ["createdAt", "updatedAt"]),
  create: ["code", "name", "description"],
  update: ["name", "description"],
  filters: ["code"],
  sorts: ["code", "name", "createdAt"],
  search: ["code", "name"],
  defaultSort: "code",
  updatedAtProperty: "updatedAt",
};

const COURSE: EntityConfig = {
  entity: "Course",
  table: "courses",
  mapping: mapping(
    {
      id: "id",
      courseGroupId: "course_group_id",
      code: "code",
      slug: "slug",
      name: "name",
      shortName: "short_name",
      description: "description",
      thumbnailUrl: "thumbnail_url",
      totalLevels: "total_levels",
      passingScore: "passing_score",
      difficulty: "difficulty",
      active: "active",
      published: "published",
      displayOrder: "display_order",
      isSample: "is_sample",
      deletedAt: "deleted_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    ["active", "published", "isSample"],
    ["deletedAt", "createdAt", "updatedAt"],
  ),
  create: [
    "courseGroupId",
    "code",
    "slug",
    "name",
    "shortName",
    "description",
    "thumbnailUrl",
    "totalLevels",
    "passingScore",
    "difficulty",
    "active",
    "published",
    "displayOrder",
    "isSample",
  ],
  update: [
    "name",
    "shortName",
    "description",
    "thumbnailUrl",
    "totalLevels",
    "passingScore",
    "difficulty",
    "active",
    "published",
    "displayOrder",
  ],
  filters: ["courseGroupId", "active", "published", "difficulty"],
  sorts: ["displayOrder", "name", "createdAt"],
  search: ["code", "slug", "name", "shortName"],
  defaultSort: "displayOrder",
  softDeactivate: { property: "active", value: false },
  updatedAtProperty: "updatedAt",
};

const ENROLLMENT: EntityConfig = {
  entity: "Enrollment",
  table: "user_course_enrollments",
  mapping: mapping({
    id: "id",
    userId: "user_id",
    courseId: "course_id",
    status: "status",
    enrolledAt: "enrolled_at",
    completedAt: "completed_at",
    currentLevel: "current_level",
    progressPercent: "progress_percent",
    totalXp: "total_xp",
    createdAt: "created_at",
    updatedAt: "updated_at",
  }, [], ["enrolledAt", "completedAt", "createdAt", "updatedAt"]),
  create: ["userId", "courseId", "status"],
  update: ["status", "completedAt", "currentLevel", "progressPercent", "totalXp"],
  filters: ["userId", "courseId", "status"],
  requiredScope: ["userId"],
  sorts: ["enrolledAt", "updatedAt"],
  search: [],
  defaultSort: "updatedAt",
  updatedAtProperty: "updatedAt",
};

const LESSON: EntityConfig = {
  entity: "Lesson",
  table: "lessons",
  mapping: mapping(
    {
      id: "id",
      learningUnitId: "learning_unit_id",
      courseId: "course_id",
      subjectId: "subject_id",
      topicId: "topic_id",
      code: "code",
      title: "title",
      summary: "summary",
      content: "content",
      contentFormat: "content_format",
      estimatedMinutes: "estimated_minutes",
      displayOrder: "display_order",
      active: "active",
      published: "published",
      isSample: "is_sample",
      version: "version",
      deletedAt: "deleted_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    ["active", "published", "isSample"],
    ["deletedAt", "createdAt", "updatedAt"],
  ),
  create: [
    "learningUnitId",
    "courseId",
    "subjectId",
    "topicId",
    "code",
    "title",
    "summary",
    "content",
    "contentFormat",
    "estimatedMinutes",
    "displayOrder",
    "active",
    "published",
    "isSample",
    "version",
  ],
  update: [
    "title",
    "summary",
    "content",
    "contentFormat",
    "estimatedMinutes",
    "displayOrder",
    "active",
    "published",
    "version",
  ],
  filters: ["courseId", "subjectId", "topicId", "active", "published"],
  requiredScope: ["courseId"],
  sorts: ["displayOrder", "title", "createdAt"],
  search: ["code", "title", "summary", "content"],
  defaultSort: "displayOrder",
  softDeactivate: { property: "active", value: false },
  updatedAtProperty: "updatedAt",
};

const LESSON_PROGRESS: EntityConfig = {
  entity: "LessonProgress",
  table: "user_lesson_progress",
  mapping: mapping({
    id: "id",
    userId: "user_id",
    courseId: "course_id",
    lessonId: "lesson_id",
    status: "status",
    progressPercent: "progress_percent",
    startedAt: "started_at",
    completedAt: "completed_at",
    lastViewedAt: "last_viewed_at",
    lastPosition: "last_position",
    studySeconds: "study_seconds",
    lastStudiedAt: "last_studied_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  }, [], [
    "startedAt",
    "completedAt",
    "lastViewedAt",
    "lastStudiedAt",
    "createdAt",
    "updatedAt",
  ]),
  create: [
    "userId",
    "courseId",
    "lessonId",
    "status",
    "progressPercent",
    "startedAt",
    "lastViewedAt",
    "lastPosition",
    "studySeconds",
  ],
  update: [
    "status",
    "progressPercent",
    "completedAt",
    "lastViewedAt",
    "lastPosition",
    "studySeconds",
    "lastStudiedAt",
  ],
  filters: ["userId", "courseId", "lessonId", "status"],
  requiredScope: ["userId", "courseId"],
  sorts: ["lastStudiedAt", "updatedAt"],
  search: [],
  defaultSort: "lastStudiedAt",
  updatedAtProperty: "updatedAt",
};

const QUESTION: EntityConfig = {
  entity: "Question",
  table: "questions",
  mapping: mapping(
    {
      id: "id",
      title: "title",
      content: "content",
      type: "type",
      difficulty: "difficulty",
      explanation: "explanation",
      wrongAnswerExplanation: "wrong_answer_explanation",
      status: "status",
      source: "source",
      sourceDate: "source_date",
      version: "version",
      answerConfig: "answer_config_json",
      isSample: "is_sample",
      createdBy: "created_by",
      reviewedBy: "reviewed_by",
      publishedAt: "published_at",
      archivedAt: "archived_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    ["isSample"],
    [
      "sourceDate",
      "publishedAt",
      "archivedAt",
      "createdAt",
      "updatedAt",
    ],
    ["answerConfig"],
  ),
  create: [
    "title",
    "content",
    "type",
    "difficulty",
    "explanation",
    "wrongAnswerExplanation",
    "status",
    "source",
    "sourceDate",
    "version",
    "answerConfig",
    "isSample",
    "createdBy",
    "reviewedBy",
    "publishedAt",
  ],
  update: [
    "title",
    "content",
    "difficulty",
    "explanation",
    "wrongAnswerExplanation",
    "status",
    "source",
    "sourceDate",
    "version",
    "answerConfig",
    "reviewedBy",
    "publishedAt",
    "archivedAt",
  ],
  filters: ["type", "difficulty", "status", "createdBy", "reviewedBy"],
  sorts: ["createdAt", "updatedAt", "difficulty"],
  search: ["title", "content"],
  defaultSort: "createdAt",
  softDeactivate: { property: "status", value: "ARCHIVED" },
  updatedAtProperty: "updatedAt",
};

const QUESTION_ATTEMPT: EntityConfig = {
  entity: "QuestionAttempt",
  table: "question_attempts",
  mapping: mapping(
    {
      id: "id",
      idempotencyKey: "idempotency_key",
      userId: "user_id",
      questionId: "question_id",
      courseId: "course_id",
      mode: "mode",
      examSessionId: "exam_session_id",
      selectedAnswer: "selected_answer",
      isCorrect: "is_correct",
      score: "score",
      responseTime: "response_time",
      attemptedAt: "attempted_at",
    },
    ["isCorrect"],
    ["attemptedAt"],
  ),
  create: [
    "idempotencyKey",
    "userId",
    "questionId",
    "courseId",
    "mode",
    "examSessionId",
    "selectedAnswer",
    "isCorrect",
    "score",
    "responseTime",
    "attemptedAt",
  ],
  update: [],
  filters: ["userId", "questionId", "courseId", "mode"],
  requiredScope: ["userId", "courseId"],
  sorts: ["attemptedAt"],
  search: [],
  defaultSort: "attemptedAt",
};

const WRONG_NOTE: EntityConfig = {
  entity: "WrongNote",
  table: "wrong_notes",
  mapping: mapping(
    {
      id: "id",
      userId: "user_id",
      questionId: "question_id",
      courseId: "course_id",
      lastAttemptId: "last_attempt_id",
      wrongCount: "wrong_count",
      mastered: "mastered",
      userMemo: "user_memo",
      lastReviewedAt: "last_reviewed_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    ["mastered"],
    ["lastReviewedAt", "createdAt", "updatedAt"],
  ),
  create: [
    "userId",
    "questionId",
    "courseId",
    "lastAttemptId",
    "wrongCount",
    "mastered",
    "userMemo",
  ],
  update: [
    "lastAttemptId",
    "wrongCount",
    "mastered",
    "userMemo",
    "lastReviewedAt",
  ],
  filters: ["userId", "questionId", "courseId", "mastered"],
  requiredScope: ["userId", "courseId"],
  sorts: ["updatedAt", "wrongCount"],
  search: [],
  defaultSort: "updatedAt",
  updatedAtProperty: "updatedAt",
};

const MOCK_EXAM_ATTEMPT: EntityConfig = {
  entity: "MockExamAttempt",
  table: "mock_exam_attempts",
  mapping: mapping({
    id: "id",
    mockExamId: "mock_exam_id",
    userId: "user_id",
    startedAt: "started_at",
    expiresAt: "expires_at",
    submittedAt: "submitted_at",
    status: "status",
    score: "score",
    correctCount: "correct_count",
    wrongCount: "wrong_count",
    unansweredCount: "unanswered_count",
    createdAt: "created_at",
    updatedAt: "updated_at",
  }, [], [
    "startedAt",
    "expiresAt",
    "submittedAt",
    "createdAt",
    "updatedAt",
  ]),
  create: ["mockExamId", "userId", "expiresAt", "status"],
  update: [
    "submittedAt",
    "status",
    "score",
    "correctCount",
    "wrongCount",
    "unansweredCount",
  ],
  filters: ["userId", "mockExamId", "status"],
  requiredScope: ["userId"],
  sorts: ["startedAt", "updatedAt"],
  search: [],
  defaultSort: "startedAt",
  updatedAtProperty: "updatedAt",
};

function mapping(
  fields: RowMapping["fields"],
  booleans: readonly string[] = [],
  dates: readonly string[] = [],
  json: readonly string[] = [],
): RowMapping {
  return { fields, booleans, dates, json };
}

function boundedPageSize(value: number | undefined) {
  const parsed = positiveInteger(value, 20);
  return Math.min(parsed, 100);
}

function positiveInteger(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function repositoryInputError(message: string) {
  return new AppError(message, 400, "REPOSITORY_INPUT_INVALID");
}

function notFound(entity: string) {
  return new AppError(`${entity} was not found.`, 404, "REPOSITORY_NOT_FOUND");
}
