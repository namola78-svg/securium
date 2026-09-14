import { AppError } from "../lib/errors.ts";
import type {
  DatabaseProvider,
  DatabaseStatement,
  DatabaseValue,
} from "./provider/database-provider.ts";

export type MockExamStartMapping = Readonly<{
  conceptIdentity: string;
  mappingVersion: number;
  qualificationJson: string | null;
  provenanceJson: string | null;
}>;

export type MockExamStartQuestion = Readonly<{
  questionId: string;
  displayOrder: number;
  possibleScore: number;
  questionStatus: string;
  questionVersionId: string | null;
  questionVersionQuestionId: string | null;
  questionVersionVersion: number | null;
  questionVersionSemanticHash: string | null;
  questionVersionHumanReviewHash: string | null;
  questionVersionSnapshotJson: string | null;
}>;

export type MockExamStartBinding = Readonly<{
  questionVersionId: string;
  questionVersionSemanticHash: string;
  conceptMappingSetHash: string;
  mappings: readonly MockExamStartMapping[];
}>;

export type PreparedMockExamStart = Readonly<{
  id: string;
  userId: string;
  mockExamId: string;
  expiresAt: string;
  compositionSemanticHash: string;
  compositionSnapshotJson: string;
  exam: Readonly<{
    id: string;
    courseId: string;
    questionCount: number;
    passingScore: number;
    maxAttempts: number;
    randomizeQuestions: boolean;
    randomizeChoices: boolean;
    published: boolean;
    status: string;
    startAt: string | null;
    endAt: string | null;
  }>;
  questionRows: readonly MockExamStartQuestion[];
  versionBindings: ReadonlyMap<string, MockExamStartBinding>;
}>;

/**
 * Commits the immutable mock composition at the database's write boundary.
 * PostgreSQL locks the rows that can change the composition on the same
 * reserved transaction connection; D1 evaluates the conditional insert and
 * all answer inserts in one batch transaction.
 */
export async function commitMockExamStart(
  input: PreparedMockExamStart,
  database: DatabaseProvider,
) {
  const statements: DatabaseStatement[] = [];
  if (database.kind === "supabase") {
    statements.push(...postgresCompositionLocks(input));
  }

  const guardedAttempt = buildGuardedAttemptInsert(input, database.kind);
  statements.push(guardedAttempt);
  const attemptInsertIndex = statements.length - 1;
  for (const row of input.questionRows) {
    const binding = input.versionBindings.get(row.questionId);
    if (!binding) {
      throw new AppError(
        "시험 문제 구성이 완료되지 않았습니다.",
        409,
        "EXAM_INCOMPLETE",
      );
    }
    statements.push({
      sql: `INSERT INTO "mock_exam_answers"
        ("id", "attempt_id", "question_id", "question_version_id", "concept_mapping_set_hash")
        SELECT ?, parent."id", ?, ?, ?
        FROM "mock_exam_attempts" AS parent
        WHERE parent."id" = ? AND parent."user_id" = ? AND parent."mock_exam_id" = ?`,
      parameters: [
        crypto.randomUUID(),
        row.questionId,
        binding.questionVersionId,
        binding.conceptMappingSetHash,
        input.id,
        input.userId,
        input.mockExamId,
      ],
    });
  }

  const results = await database.transaction(statements);
  if (Number(results[attemptInsertIndex]?.affectedRows ?? 0) !== 1) {
    throw new AppError(
      "모의고사 구성이 응시 생성 중 변경되었습니다.",
      409,
      "EXAM_INCOMPLETE",
    );
  }
  return { id: input.id, expiresAt: input.expiresAt };
}

function postgresCompositionLocks(input: PreparedMockExamStart) {
  const questionVersionIds = input.questionRows
    .map((row) => row.questionVersionId)
    .filter((value): value is string => Boolean(value));
  const questionVersionPlaceholders = questionVersionIds.map(() => "?").join(", ");
  return [
    statement(
      `SELECT "id" FROM "mock_exams" WHERE "id" = ? FOR UPDATE`,
      [input.mockExamId],
    ),
    statement(
      `SELECT enrollment."id"
       FROM "user_course_enrollments" AS enrollment
       WHERE enrollment."user_id" = ? AND enrollment."course_id" = ?
       FOR UPDATE`,
      [input.userId, input.exam.courseId],
    ),
    statement(
      `SELECT item."question_id"
       FROM "mock_exam_questions" AS item
       INNER JOIN "questions" AS question ON question."id" = item."question_id"
       WHERE item."mock_exam_id" = ?
       FOR UPDATE OF item, question`,
      [input.mockExamId],
    ),
    statement(
      `SELECT "id" FROM "question_versions"
       WHERE "id" IN (${questionVersionPlaceholders})
       FOR UPDATE`,
      questionVersionIds,
    ),
    statement(
      `SELECT mapping."id"
       FROM "question_concepts" AS mapping
       INNER JOIN "ontology_concepts" AS concept ON concept."id" = mapping."concept_id"
       WHERE mapping."question_version_id" IN (${questionVersionPlaceholders})
       FOR UPDATE OF mapping, concept`,
      questionVersionIds,
    ),
  ];
}

function buildGuardedAttemptInsert(
  input: PreparedMockExamStart,
  providerKind: DatabaseProvider["kind"],
): DatabaseStatement {
  const parameters: DatabaseValue[] = [];
  const parameter = (value: DatabaseValue) => {
    parameters.push(value);
    return "?";
  };
  const nullableEquality = (column: string, value: string | null) =>
    value === null
      ? `${column} IS NULL`
      : `${column} = ${parameter(value)}`;
  const booleanEquality = (column: string, value: boolean) =>
    `${column} = ${parameter(value ? 1 : 0)}`;

  const values = [
    parameter(input.id),
    parameter(input.mockExamId),
    parameter(input.userId),
    parameter(input.expiresAt),
    parameter(input.questionRows.length),
    parameter(input.compositionSemanticHash),
    parameter(input.compositionSnapshotJson),
  ];
  const predicates = [
    `EXISTS (
      SELECT 1 FROM "mock_exams" AS exam
      WHERE exam."id" = ${parameter(input.exam.id)}
        AND exam."course_id" = ${parameter(input.exam.courseId)}
        AND exam."question_count" = ${parameter(input.exam.questionCount)}
        AND exam."passing_score" = ${parameter(input.exam.passingScore)}
        AND exam."max_attempts" = ${parameter(input.exam.maxAttempts)}
        AND ${booleanEquality("exam.\"randomize_questions\"", input.exam.randomizeQuestions)}
        AND ${booleanEquality("exam.\"randomize_choices\"", input.exam.randomizeChoices)}
        AND ${booleanEquality("exam.\"published\"", input.exam.published)}
        AND exam."status" = ${parameter(input.exam.status)}
        AND ${nullableEquality("exam.\"start_at\"", input.exam.startAt)}
        AND ${nullableEquality("exam.\"end_at\"", input.exam.endAt)}
        AND ${openTimePredicate("exam.\"start_at\"", "start", providerKind)}
        AND ${openTimePredicate("exam.\"end_at\"", "end", providerKind)}
    )`,
    `EXISTS (
      SELECT 1 FROM "user_course_enrollments" AS enrollment
      WHERE enrollment."user_id" = ${parameter(input.userId)}
        AND enrollment."course_id" = ${parameter(input.exam.courseId)}
        AND enrollment."status" IN (${parameter("ACTIVE")}, ${parameter("PAUSED")})
    )`,
    `(SELECT count(*) FROM "mock_exam_attempts" AS current_attempt
      WHERE current_attempt."user_id" = ${parameter(input.userId)}
        AND current_attempt."mock_exam_id" = ${parameter(input.mockExamId)})
      < ${parameter(input.exam.maxAttempts)}`,
    `(SELECT count(*) FROM "mock_exam_questions" AS item
      WHERE item."mock_exam_id" = ${parameter(input.mockExamId)})
      = ${parameter(input.questionRows.length)}`,
  ];

  for (const row of input.questionRows) {
    predicates.push(questionPredicate(input, row, parameter));
    const binding = input.versionBindings.get(row.questionId);
    if (!binding) continue;
    predicates.push(mappingPredicate(binding, parameter));
  }

  return {
    sql: `INSERT INTO "mock_exam_attempts"
      ("id", "mock_exam_id", "user_id", "expires_at", "unanswered_count", "composition_semantic_hash", "composition_snapshot_json")
      SELECT ${values.join(", ")}
      WHERE ${predicates.join("\n        AND ")}`,
    parameters,
  };
}

function openTimePredicate(
  column: string,
  boundary: "start" | "end",
  providerKind: DatabaseProvider["kind"],
) {
  const operator = boundary === "start" ? "<=" : ">";
  const now = providerKind === "supabase"
    ? `CAST(CURRENT_TIMESTAMP AS TEXT)`
    : `julianday('now')`;
  const value = providerKind === "supabase"
    ? `${column}::timestamptz ${operator} CURRENT_TIMESTAMP`
    : `julianday(${column}) ${operator} ${now}`;
  return `${column} IS NULL OR ${value}`;
}

function questionPredicate(
  input: PreparedMockExamStart,
  row: MockExamStartQuestion,
  parameter: (value: DatabaseValue) => string,
) {
  return `EXISTS (
    SELECT 1
    FROM "mock_exam_questions" AS item
    INNER JOIN "questions" AS question ON question."id" = item."question_id"
    INNER JOIN "question_versions" AS version
      ON version."question_id" = question."id" AND version."version" = question."version"
    WHERE item."mock_exam_id" = ${parameter(input.mockExamId)}
      AND item."question_id" = ${parameter(row.questionId)}
      AND item."display_order" = ${parameter(row.displayOrder)}
      AND item."score" = ${parameter(row.possibleScore)}
      AND question."status" = ${parameter(row.questionStatus)}
      AND version."id" = ${parameter(row.questionVersionId)}
      AND version."question_id" = ${parameter(row.questionVersionQuestionId)}
      AND version."version" = ${parameter(row.questionVersionVersion)}
      AND version."semantic_hash" = ${parameter(row.questionVersionSemanticHash)}
      AND version."human_review_hash" = ${parameter(row.questionVersionHumanReviewHash)}
      AND version."snapshot_json" = ${parameter(row.questionVersionSnapshotJson)}
  )`;
}

function mappingPredicate(
  binding: MockExamStartBinding,
  parameter: (value: DatabaseValue) => string,
) {
  const mappingPredicates = [
    `(SELECT count(*)
      FROM "question_concepts" AS mapping
      INNER JOIN "ontology_concepts" AS concept ON concept."id" = mapping."concept_id"
      WHERE mapping."question_version_id" = ${parameter(binding.questionVersionId)}
        AND mapping."mapping_status" = ${parameter("APPROVED")}
        AND mapping."relation_type" = ${parameter("MAPS_TO")}
        AND concept."status" = ${parameter("ACTIVE")})
      = ${parameter(binding.mappings.length)}`,
  ];
  for (const mapping of binding.mappings) {
    const qualification = mapping.qualificationJson;
    const provenance = mapping.provenanceJson;
    mappingPredicates.push(`EXISTS (
      SELECT 1
      FROM "question_concepts" AS mapping
      INNER JOIN "ontology_concepts" AS concept ON concept."id" = mapping."concept_id"
      WHERE mapping."question_version_id" = ${parameter(binding.questionVersionId)}
        AND mapping."mapping_status" = ${parameter("APPROVED")}
        AND mapping."relation_type" = ${parameter("MAPS_TO")}
        AND concept."status" = ${parameter("ACTIVE")}
        AND concept."concept_key" = ${parameter(mapping.conceptIdentity)}
        AND mapping."mapping_version" = ${parameter(mapping.mappingVersion)}
        AND ${nullableEqualityForBuilder("mapping.\"qualification_json\"", qualification, parameter)}
        AND ${nullableEqualityForBuilder("mapping.\"provenance_json\"", provenance, parameter)}
    )`);
  }
  return mappingPredicates.join("\n        AND ");
}

function nullableEqualityForBuilder(
  column: string,
  value: string | null,
  parameter: (value: DatabaseValue) => string,
) {
  return value === null ? `${column} IS NULL` : `${column} = ${parameter(value)}`;
}

function statement(sql: string, parameters: readonly DatabaseValue[]): DatabaseStatement {
  return { sql, parameters };
}
