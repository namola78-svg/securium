import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createCoreRepositories,
  type RepositoryPage,
  type SqlEntityRepository,
} from "../db/repository-adapter/core-repositories.ts";
import { RepositoryContext } from "../db/repository-adapter/repository-context.ts";
import { RepositorySqlDialect } from "../db/repository-adapter/sql-dialect.ts";
import {
  DatabaseProviderError,
} from "../db/provider/database-error.ts";
import type {
  DatabaseExecutionResult,
  DatabaseProvider,
  DatabaseQueryResult,
  DatabaseStatement,
} from "../db/provider/database-provider.ts";
import { AppError } from "../lib/errors.ts";

test("public question listing keeps PostgreSQL DISTINCT ordering safe", () => {
  const source = readFileSync("db/question-repositories.ts", "utf8");
  const listPublicQuestionsSource =
    source.match(
      /export async function listPublicQuestions[\s\S]*?export async function getQuestionForGrading/,
    )?.[0] ?? "";

  assert.match(listPublicQuestionsSource, /createdAt:\s*questions\.createdAt/);
  assert.doesNotMatch(listPublicQuestionsSource, /orderBy\(\s*filters\.random/);
  assert.doesNotMatch(listPublicQuestionsSource, /sql`random\(\)`/);
});

test("practice question filter subjects remain isolated by course", () => {
  const source = readFileSync("db/question-repositories.ts", "utf8");
  const subjectFilterSource =
    source.match(
      /export async function listQuestionFilterSubjectsForCourse[\s\S]*?export async function listQuestionFilterTopicsForSubject/,
    )?.[0] ?? "";
  const topicFilterSource =
    source.match(
      /export async function listQuestionFilterTopicsForSubject[\s\S]*?export async function getQuestionForGrading/,
    )?.[0] ?? "";

  assert.match(subjectFilterSource, /eq\(questionCourses\.courseId,\s*courseId\)/);
  assert.match(subjectFilterSource, /eq\(subjects\.courseId,\s*courseId\)/);
  assert.match(subjectFilterSource, /eq\(subjects\.active,\s*true\)/);
  assert.match(topicFilterSource, /innerJoin\(subjects,\s*eq\(topics\.subjectId,\s*subjects\.id\)\)/);
  assert.match(topicFilterSource, /eq\(subjects\.courseId,\s*courseId\)/);
  assert.match(topicFilterSource, /isNull\(subjects\.deletedAt\)/);
});

test("question AI explanation retrieval avoids broad empty scans", () => {
  const source = readFileSync("db/ai-repositories.ts", "utf8");
  const generationSource =
    source.match(
      /export async function generateQuestionAIExplanation[\s\S]*?export async function getAIExplanationRecord/,
    )?.[0] ?? "";

  assert.match(generationSource, /buildQuestionRetrievalQuery\(question\)/);
  assert.doesNotMatch(generationSource, /query:\s*""/);
  assert.match(generationSource, /catch\s*\{/);
  assert.match(generationSource, /return \[\]/);
});

test("question AI similar-question lookup keeps PostgreSQL DISTINCT ordering safe", () => {
  const source = readFileSync("db/ai-repositories.ts", "utf8");
  const similarSource =
    source.match(
      /async function listSimilarQuestions[\s\S]*?function deduplicateContexts/,
    )?.[0] ?? "";

  assert.match(similarSource, /selectDistinct\(\{[\s\S]*id:\s*questions\.id,[\s\S]*title:\s*questions\.title,[\s\S]*publishedAt:\s*questions\.publishedAt/);
  assert.match(similarSource, /orderBy\(desc\(questions\.publishedAt\)\)/);
});

const now = "2026-07-27 10:00:00";
const rowsByRepository = {
  users: {
    id: "user-1",
    email: "user@example.invalid",
    display_name: "User",
    status: "ACTIVE",
    created_at: now,
    updated_at: now,
  },
  roles: {
    id: "role-1",
    code: "USER",
    name: "User",
    description: "",
    created_at: now,
    updated_at: now,
  },
  courses: {
    id: "course-1",
    course_group_id: "group-1",
    code: "COURSE",
    slug: "course",
    name: "Course",
    short_name: "Course",
    description: "",
    total_levels: 1,
    passing_score: 60,
    difficulty: "BEGINNER",
    active: 1,
    published: 1,
    display_order: 1,
    is_sample: 1,
    created_at: now,
    updated_at: now,
  },
  enrollments: {
    id: "enrollment-1",
    user_id: "user-1",
    course_id: "course-1",
    status: "ACTIVE",
    enrolled_at: now,
    current_level: 1,
    progress_percent: 10,
    total_xp: 0,
    created_at: now,
    updated_at: now,
  },
  lessons: {
    id: "lesson-1",
    course_id: "course-1",
    subject_id: "subject-1",
    topic_id: "topic-1",
    code: "L1",
    title: "Lesson",
    summary: "",
    content: "Body",
    content_format: "PLAIN_TEXT",
    estimated_minutes: 10,
    display_order: 1,
    active: 1,
    published: 1,
    is_sample: 1,
    version: 1,
    created_at: now,
    updated_at: now,
  },
  lessonProgress: {
    id: "lesson-progress-1",
    user_id: "user-1",
    course_id: "course-1",
    lesson_id: "lesson-1",
    status: "IN_PROGRESS",
    progress_percent: 30,
    last_viewed_at: now,
    last_position: 10,
    study_seconds: 20,
    last_studied_at: now,
    created_at: now,
    updated_at: now,
  },
  questions: {
    id: "question-1",
    title: "Question",
    content: "Content",
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    explanation: "",
    wrong_answer_explanation: "",
    status: "PUBLISHED",
    version: 1,
    answer_config_json: "{\"accepted\":[\"A\"]}",
    is_sample: 1,
    created_by: "admin-1",
    published_at: now,
    created_at: now,
    updated_at: now,
  },
  questionAttempts: {
    id: "attempt-1",
    idempotency_key: "idem-1",
    user_id: "user-1",
    question_id: "question-1",
    course_id: "course-1",
    mode: "LEARNING",
    selected_answer: "choice-1",
    is_correct: 1,
    score: 100,
    response_time: 5,
    attempted_at: now,
  },
  wrongNotes: {
    id: "wrong-1",
    user_id: "user-1",
    question_id: "question-1",
    course_id: "course-1",
    last_attempt_id: "attempt-1",
    wrong_count: 2,
    mastered: 0,
    user_memo: "",
    created_at: now,
    updated_at: now,
  },
  mockExamAttempts: {
    id: "mock-attempt-1",
    mock_exam_id: "exam-1",
    user_id: "user-1",
    started_at: now,
    expires_at: "2026-07-27 11:00:00",
    status: "IN_PROGRESS",
    score: 0,
    correct_count: 0,
    wrong_count: 0,
    unanswered_count: 10,
    created_at: now,
    updated_at: now,
  },
} satisfies Record<string, Record<string, unknown>>;

const scopes = {
  users: {},
  roles: {},
  courses: {},
  enrollments: { userId: "user-1" },
  lessons: { courseId: "course-1" },
  lessonProgress: { userId: "user-1", courseId: "course-1" },
  questions: {},
  questionAttempts: { userId: "user-1", courseId: "course-1" },
  wrongNotes: { userId: "user-1", courseId: "course-1" },
  mockExamAttempts: { userId: "user-1" },
} satisfies Record<string, Record<string, string>>;

for (const kind of ["d1", "supabase"] as const) {
  test(`${kind} 핵심 Repository 10종은 동일한 조회·페이지 계약을 따른다`, async () => {
    for (const key of Object.keys(rowsByRepository) as Array<
      keyof typeof rowsByRepository
    >) {
      const provider = new RecordingProvider(kind, rowsByRepository[key]);
      const repositories = createCoreRepositories(
        new RepositoryContext(provider, "request-1"),
      );
      const repository = repositories[key] as SqlEntityRepository<
        Record<string, unknown>
      >;
      const found = await repository.findById(
        String(rowsByRepository[key].id),
        scopes[key],
      );
      assert.equal(found?.id, rowsByRepository[key].id);
      const page = (await repository.list({
        page: 1,
        pageSize: 1,
        scope: scopes[key],
      })) as RepositoryPage<Record<string, unknown>>;
      assert.equal(page.items.length, 1);
      assert.equal(page.total, 1);
      assert.equal(page.page, 1);
      assert.equal(page.pageSize, 1);
      assert.equal(page.hasMore, false);
      assert.equal(provider.statements.length, 3);
      for (const statement of provider.statements) {
        if (kind === "d1") assert.doesNotMatch(statement.sql, /\$1/);
        else if (statement.parameters?.length) {
          assert.match(statement.sql, /\$1/);
          assert.doesNotMatch(statement.sql, /\?/);
        }
      }
    }
  });
}

test("공통 Row Mapper는 boolean, datetime, JSON을 중앙 변환한다", async () => {
  const provider = new RecordingProvider("d1", rowsByRepository.questions);
  const repositories = createCoreRepositories(new RepositoryContext(provider));
  const question = await repositories.questions.findById("question-1");
  assert.equal(question?.isSample, true);
  assert.deepEqual(question?.answerConfig, { accepted: ["A"] });
  assert.equal(question?.publishedAt, "2026-07-27T10:00:00.000Z");

  provider.row = rowsByRepository.courses;
  const course = await repositories.courses.findById("course-1");
  assert.equal(course?.active, true);
  assert.equal(course?.published, true);
});

test("사용자·과정 소유 범위가 없으면 학습 Repository 접근을 차단한다", async () => {
  const provider = new RecordingProvider("d1", rowsByRepository.enrollments);
  const repositories = createCoreRepositories(new RepositoryContext(provider));
  await assert.rejects(
    repositories.enrollments.findById("enrollment-1"),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "REPOSITORY_SCOPE_REQUIRED",
  );
  await assert.rejects(
    repositories.questionAttempts.list({
      scope: { userId: "user-1" },
    }),
    AppError,
  );
});

test("과정별 문제와 모의고사 시도 조회는 연결 테이블로 과정 범위를 강제한다", async () => {
  const provider = new RecordingProvider("supabase", rowsByRepository.questions);
  const repositories = createCoreRepositories(new RepositoryContext(provider));
  const question = await repositories.questions.findByIdForCourse(
    "question-1",
    "course-1",
  );
  assert.equal(question?.id, "question-1");
  await repositories.questions.listForCourse("course-1", {
    search: "privacy",
  });
  assert.match(provider.statements[0].sql, /question_courses/);
  assert.match(provider.statements[1].sql, /ILIKE \$2/);

  provider.row = rowsByRepository.mockExamAttempts;
  await repositories.mockExamAttempts.listForCourse(
    "user-1",
    "course-1",
  );
  assert.match(
    provider.statements.at(-2)?.sql ?? "",
    /mock_exams[\s\S]*course_id/,
  );
});

test("정렬과 필터는 allowlist 밖의 입력을 SQL로 전달하지 않는다", async () => {
  const provider = new RecordingProvider("d1", rowsByRepository.courses);
  const repositories = createCoreRepositories(new RepositoryContext(provider));
  await assert.rejects(
    repositories.courses.list({ sortBy: "name; DROP TABLE users" }),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "REPOSITORY_INPUT_INVALID",
  );
  assert.equal(provider.statements.length, 0);
});

test("boolean과 null filter는 호환 타입과 IS NULL로 변환한다", async () => {
  for (const kind of ["d1", "supabase"] as const) {
    const provider = new RecordingProvider(kind, rowsByRepository.courses);
    const repositories = createCoreRepositories(new RepositoryContext(provider));
    await repositories.courses.list({
      filters: { active: true },
    });
    assert.equal(provider.statements[0].parameters?.[0], 1);

    provider.statements.length = 0;
    await repositories.lessons.list({
      scope: { courseId: "course-1" },
      filters: { topicId: null },
    });
    assert.match(provider.statements[0].sql, /"topic_id" IS NULL/);
    assert.deepEqual(
      provider.statements[0].parameters?.slice(0, 1),
      ["course-1"],
    );
  }
});

test("Dialect helper는 D1과 PostgreSQL upsert 문법을 분리한다", () => {
  const d1 = new RepositorySqlDialect("d1").insertIgnore(
    "user_roles",
    ["id", "user_id", "role_id"],
    ["id-1", "user-1", "role-1"],
    ["user_id", "role_id"],
  );
  const postgres = new RepositorySqlDialect("supabase").insertIgnore(
    "user_roles",
    ["id", "user_id", "role_id"],
    ["id-1", "user-1", "role-1"],
    ["user_id", "role_id"],
  );
  assert.match(d1.sql, /^INSERT OR IGNORE/);
  assert.match(d1.sql, /\?, \?, \?/);
  assert.match(postgres.sql, /ON CONFLICT \("user_id", "role_id"\) DO NOTHING/);
  assert.match(postgres.sql, /\$1, \$2, \$3/);
});

test("create·update·deactivate는 parameter binding과 공통 결과를 사용한다", async () => {
  const provider = new RecordingProvider("supabase", rowsByRepository.courses);
  const repositories = createCoreRepositories(new RepositoryContext(provider));
  await repositories.courses.create({
    courseGroupId: "group-1",
    code: "NEW",
    slug: "new",
    name: "New",
    shortName: "New",
    description: "",
    totalLevels: 1,
    passingScore: 60,
    difficulty: "BEGINNER",
    active: true,
    published: false,
    displayOrder: 1,
    isSample: true,
  });
  await repositories.courses.update("course-1", { name: "Updated" });
  await repositories.courses.deactivate("course-1");
  assert.match(provider.statements[0].sql, /INSERT INTO "courses"/);
  assert.match(provider.statements[0].sql, /\$1/);
  assert.ok(provider.statements[0].parameters?.includes("New"));
  assert.match(provider.statements[1].sql, /UPDATE "courses"/);
  assert.ok(provider.statements[3].parameters?.includes(0));
});

test("문제와 과정 연결 생성은 하나의 transaction으로 commit된다", async () => {
  const provider = new RecordingProvider("supabase", rowsByRepository.questions);
  const repositories = createCoreRepositories(new RepositoryContext(provider));
  await repositories.questions.createForCourse(
    {
      title: "Question",
      content: "Content",
      type: "SINGLE_CHOICE",
      difficulty: "MEDIUM",
      explanation: "",
      wrongAnswerExplanation: "",
      status: "DRAFT",
      version: 1,
      answerConfig: {},
      isSample: true,
      createdBy: "admin-1",
    },
    "course-1",
  );
  assert.equal(provider.transactionCount, 1);
  assert.equal(provider.transactionStatements.length, 2);
  assert.match(provider.transactionStatements[1].sql, /question_courses/);
});

test("transaction 실패 시 일부 저장을 남기지 않고 rollback한다", async () => {
  const provider = new RecordingProvider("supabase", {});
  provider.failTransaction = true;
  const context = new RepositoryContext(provider);
  await assert.rejects(
    context.transaction((transaction) => {
      transaction.execute({ sql: "INSERT INTO one VALUES ($1)", parameters: [1] });
      transaction.execute({ sql: "INSERT INTO two VALUES ($1)", parameters: [2] });
    }),
    (error: unknown) =>
      error instanceof DatabaseProviderError &&
      error.category === "transaction_error",
  );
  assert.equal(provider.committedStatements.length, 0);
  assert.equal(provider.rollbackCount, 1);
});

test("DB unique와 foreign key 오류는 Driver 원문 없이 유지된다", async () => {
  const provider = new RecordingProvider("supabase", rowsByRepository.users);
  provider.queryOneError = new DatabaseProviderError("unique_violation");
  const repositories = createCoreRepositories(new RepositoryContext(provider));
  await assert.rejects(
    repositories.users.create({
      email: "duplicate@example.invalid",
      displayName: "Duplicate",
      status: "ACTIVE",
    }),
    (error: unknown) =>
      error instanceof DatabaseProviderError &&
      error.category === "unique_violation",
  );
  provider.queryOneError = new DatabaseProviderError("foreign_key_violation");
  await assert.rejects(
    repositories.courses.create({
      courseGroupId: "missing",
      code: "C",
      slug: "c",
      name: "C",
      shortName: "C",
      active: true,
      published: false,
      isSample: true,
    }),
    (error: unknown) =>
      error instanceof DatabaseProviderError &&
      error.category === "foreign_key_violation",
  );
});

class RecordingProvider implements DatabaseProvider {
  readonly kind: "d1" | "supabase";
  row: Record<string, unknown>;
  readonly statements: DatabaseStatement[] = [];
  readonly transactionStatements: DatabaseStatement[] = [];
  readonly committedStatements: DatabaseStatement[] = [];
  transactionCount = 0;
  rollbackCount = 0;
  failTransaction = false;
  queryOneError: Error | undefined;

  constructor(kind: "d1" | "supabase", row: Record<string, unknown>) {
    this.kind = kind;
    this.row = row;
  }

  async query<Row extends Record<string, unknown>>(
    statement: DatabaseStatement,
  ): Promise<DatabaseQueryResult<Row>> {
    this.statements.push(statement);
    return {
      rows: [this.row as Row],
      rowCount: 1,
      metadata: { provider: this.kind },
    };
  }

  async queryOne<Row extends Record<string, unknown>>(
    statement: DatabaseStatement,
  ): Promise<Row | null> {
    this.statements.push(statement);
    if (this.queryOneError) throw this.queryOneError;
    if (/COUNT\(\*\)/i.test(statement.sql)) {
      return { total: 1 } as unknown as Row;
    }
    return this.row as Row;
  }

  async execute(
    statement: DatabaseStatement,
  ): Promise<DatabaseExecutionResult> {
    this.statements.push(statement);
    return {
      affectedRows: 1,
      returnedRows: [],
      metadata: { provider: this.kind },
    };
  }

  async transaction(statements: readonly DatabaseStatement[]) {
    this.transactionCount += 1;
    this.transactionStatements.push(...statements);
    if (this.failTransaction) {
      this.rollbackCount += 1;
      throw new DatabaseProviderError("transaction_error");
    }
    this.committedStatements.push(...statements);
    return statements.map(() => ({
      affectedRows: 1,
      returnedRows: [],
      metadata: { provider: this.kind },
    }));
  }

  async healthCheck() {
    return true;
  }
}
