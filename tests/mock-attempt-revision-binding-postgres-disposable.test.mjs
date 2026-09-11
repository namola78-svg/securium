import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { register } from "node:module";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import postgres from "postgres";
import { computeMockQuestionVersionSemanticHash } from "../lib/services/mock-exam-revision.ts";

const execFile = promisify(execFileCallback);
const userId = "a0000000-0000-4000-8000-000000000001";
const otherUserId = "a0000000-0000-4000-8000-000000000002";
const authorId = "a0000000-0000-4000-8000-000000000003";
const groupId = "mock-pg-group";
const courseId = "mock-pg-course";
const examId = "mock-pg-exam";
const questionId = "mock-pg-question";
const choiceOneId = "mock-pg-question-choice-01";
const choiceTwoId = "mock-pg-question-choice-02";
const conceptId = "mock-pg-concept";
const questionVersionOneId = "mock-pg-question-version-01";
const questionVersionTwoId = "mock-pg-question-version-02";
const mappingOneId = "mock-pg-question-mapping-01";
const mappingTwoId = "mock-pg-question-mapping-02";
let container;
let client;
let phase3;
let disconnectRuntimePostgresExecutor;
let getRuntimePostgresExecutor;
let DatabaseEvidenceSourceResolver;
let PostgresDatabaseProvider;

after(async () => {
  await disconnectRuntimePostgresExecutor?.().catch(() => {});
  await client?.end({ timeout: 5 }).catch(() => {});
  if (container) {
    await execFile("docker", ["rm", "--force", container]).catch(() => {});
  }
});

before(async () => {
  container = `securium-mock-attempt-pg-${randomUUID()}`;
  const password = "mock-attempt-postgres-test-password";
  await execFile("docker", [
    "run", "--detach", "--rm", "--name", container,
    "--env", `POSTGRES_PASSWORD=${password}`,
    "--publish", "127.0.0.1::5432", "postgres:17.6",
  ]);
  const { stdout } = await execFile("docker", ["port", container, "5432/tcp"]);
  const port = stdout.trim().match(/:(\d+)$/)?.[1];
  assert.ok(port);
  const connectionString = `postgres://postgres:${password}@127.0.0.1:${port}/postgres`;
  client = postgres(connectionString, {
    max: 1,
    prepare: false,
    ssl: false,
    onnotice: false,
  });
  await waitForConnection();
  await client.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;");
  const migrations = (await readdir("db/postgres/migrations"))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .filter((name) => !["0002_server_only_rls_lockdown.sql", "0009_security_certification_taxonomy_cleanup.sql"].includes(name))
    .sort();
  for (const name of migrations) {
    await client.unsafe(await readFile(`db/postgres/migrations/${name}`, "utf8"));
  }
  await seedFixture();

  process.env.APP_ENV = "development";
  process.env.DB_PROVIDER = "supabase";
  process.env.DATABASE_URL = connectionString;
  process.env.POSTGRES_SSL_MODE = "disable";
  process.env.POSTGRES_MAX_CONNECTIONS = "4";
  process.env.POSTGRES_QUERY_TIMEOUT_MS = "5000";
  register("./support/node-runtime-loader.mjs", import.meta.url);
  phase3 = await import("../db/phase3-repositories.ts");
  ({ disconnectRuntimePostgresExecutor, getRuntimePostgresExecutor } = await import("../db/postgres/postgres-js-executor.ts"));
  ({ DatabaseEvidenceSourceResolver } = await import("../db/evidence-source-adapters.ts"));
  ({ PostgresDatabaseProvider } = await import("../db/provider/postgres-database-provider.ts"));
});

test("the actual PostgreSQL provider preserves mock attempt revisions", async () => {
  const countRows = async () => {
    const [row] = await client.unsafe(
      "SELECT count(*)::int AS attempts, (SELECT count(*)::int FROM mock_exam_answers WHERE attempt_id IN (SELECT id FROM mock_exam_attempts WHERE mock_exam_id = $1)) AS answers FROM mock_exam_attempts WHERE mock_exam_id = $1",
      [examId],
    );
    return [Number(row.attempts), Number(row.answers)];
  };
  const beforeInvalidStarts = await countRows();
  const [storedVersionOne] = await client.unsafe(
    "SELECT snapshot_json FROM question_versions WHERE id = $1",
    [questionVersionOneId],
  );

  await client.unsafe("DELETE FROM question_concepts WHERE id = $1", [mappingOneId]);
  await assert.rejects(
    phase3.startMockExam(userId, examId),
    (error) => error?.code === "QUESTION_VERSION_NOT_ELIGIBLE",
  );
  assert.deepEqual(await countRows(), beforeInvalidStarts);
  await insertMapping(mappingOneId, questionVersionOneId, 1);

  await client.unsafe("UPDATE question_versions SET snapshot_json = '{}' WHERE id = $1", [questionVersionOneId]);
  await assert.rejects(
    phase3.startMockExam(userId, examId),
    (error) => error?.code === "MOCK_QUESTION_VERSION_UNAVAILABLE",
  );
  assert.deepEqual(await countRows(), beforeInvalidStarts);
  await client.unsafe("UPDATE question_versions SET snapshot_json = $1 WHERE id = $2", [storedVersionOne.snapshot_json, questionVersionOneId]);

  await client.unsafe("DELETE FROM question_concepts WHERE id = $1", [mappingOneId]);
  await client.unsafe("DELETE FROM question_versions WHERE id = $1", [questionVersionOneId]);
  await assert.rejects(
    phase3.startMockExam(userId, examId),
    (error) => error?.code === "EXAM_INCOMPLETE",
  );
  assert.deepEqual(await countRows(), beforeInvalidStarts);
  await insertVersion(questionVersionOneId, 1, "Mock PostgreSQL question v1", "Mock PostgreSQL content v1", "Mock PostgreSQL explanation v1", "Mock PostgreSQL wrong explanation v1", "Mock PostgreSQL old correct", "Mock PostgreSQL old wrong");
  await insertMapping(mappingOneId, questionVersionOneId, 1);

  const first = await phase3.startMockExam(userId, examId);
  const firstAttempt = await phase3.getMockExamAttempt(userId, first.id);
  assert.equal(firstAttempt.questions[0].title, "Mock PostgreSQL question v1");
  assert.equal(firstAttempt.questions[0].choices[0].isCorrect, undefined);
  assert.equal(firstAttempt.questions[0].explanation, undefined);

  const bound = await client.unsafe(
    "SELECT a.question_version_id, a.concept_mapping_set_hash, e.composition_semantic_hash FROM mock_exam_answers a JOIN mock_exam_attempts e ON e.id = a.attempt_id WHERE a.attempt_id = $1",
    [first.id],
  );
  assert.equal(bound[0].question_version_id, questionVersionOneId);
  assert.match(bound[0].concept_mapping_set_hash, /^[0-9a-f]{64}$/);
  assert.match(bound[0].composition_semantic_hash, /^[0-9a-f]{64}$/);

  await client.unsafe(
    "UPDATE question_versions SET snapshot_json = '{}' WHERE id = $1",
    [questionVersionOneId],
  );
  await assert.rejects(
    phase3.getMockExamAttempt(userId, first.id),
    (error) => error?.code === "MOCK_QUESTION_VERSION_UNAVAILABLE",
  );
  await client.unsafe(
    "UPDATE question_versions SET snapshot_json = $1 WHERE id = $2",
    [storedVersionOne.snapshot_json, questionVersionOneId],
  );

  await client.unsafe(
    "UPDATE mock_exam_answers SET concept_mapping_set_hash = $1 WHERE attempt_id = $2",
    ["f".repeat(64), first.id],
  );
  await assert.rejects(
    phase3.getMockExamAttempt(userId, first.id),
    (error) => error?.code === "MOCK_COMPOSITION_MISMATCH",
  );
  await client.unsafe(
    "UPDATE mock_exam_answers SET concept_mapping_set_hash = $1 WHERE attempt_id = $2",
    [bound[0].concept_mapping_set_hash, first.id],
  );

  await assert.rejects(
    phase3.getMockExamAttempt(otherUserId, first.id),
    (error) => error?.code === "EXAM_ATTEMPT_NOT_FOUND",
  );
  await assert.rejects(
    phase3.saveMockExamAnswer({
      userId: otherUserId,
      attemptId: first.id,
      questionId,
      answer: choiceOneId,
    }),
    (error) => error?.code === "EXAM_ATTEMPT_NOT_FOUND",
  );

  await mutateCurrentQuestionToVersionTwo();
  const unchanged = await phase3.getMockExamAttempt(userId, first.id);
  assert.equal(unchanged.questions[0].title, "Mock PostgreSQL question v1");
  assert.equal(unchanged.questions[0].choices[0].content, "Mock PostgreSQL old correct");
  assert.equal(unchanged.questions[0].choices[0].isCorrect, undefined);

  await phase3.saveMockExamAnswer({
    userId,
    attemptId: first.id,
    questionId,
    answer: choiceOneId,
    questionVersionId: "forged-version-id",
    conceptMappingSetHash: "f".repeat(64),
    score: 100,
  });
  const submitResults = await Promise.allSettled([
    phase3.submitMockExam(userId, first.id),
    phase3.submitMockExam(userId, first.id),
  ]);
  assert.deepEqual(
    submitResults.map((result) => result.status === "fulfilled" ? 200 : result.reason?.code === "EXAM_ALREADY_SUBMITTED" ? 409 : result.reason).sort(),
    [200, 409],
  );
  const result = await phase3.getMockExamAttempt(userId, first.id);
  assert.equal(result.score, 100);
  assert.equal(result.questions[0].title, "Mock PostgreSQL question v1");
  assert.equal(result.questions[0].choices[0].content, "Mock PostgreSQL old correct");
  assert.deepEqual(
    (await client.unsafe("SELECT status, score FROM mock_exam_attempts WHERE id = $1", [first.id])).map((row) => [row.status, Number(row.score)]),
    [["SUBMITTED", 100]],
  );

  const [firstAnswer] = await client.unsafe(
    "SELECT id FROM mock_exam_answers WHERE attempt_id = $1",
    [first.id],
  );
  const resolver = new DatabaseEvidenceSourceResolver(
    new PostgresDatabaseProvider(
      await getRuntimePostgresExecutor(process.env),
    ),
  );
  const evidence = await resolver.resolveEvent({
    sourceType: "MOCK_ITEM_RESULT",
    sourceEventId: firstAnswer.id,
    sourceRevisionIdentity: "1".repeat(64),
  });
  assert.equal(evidence?.contentVersionIdentity, questionVersionOneId);
  assert.equal(evidence?.conceptMappingSetHash, bound[0].concept_mapping_set_hash);
  await client.unsafe(
    "UPDATE question_concepts SET mapping_version = 2 WHERE id = $1",
    [mappingOneId],
  );
  try {
    await assert.rejects(
      resolver.resolveEvent({
        sourceType: "MOCK_ITEM_RESULT",
        sourceEventId: firstAnswer.id,
        sourceRevisionIdentity: "1".repeat(64),
      }),
      (error) => error?.code === "EVIDENCE_MAPPING_SET_MISMATCH",
    );
  } finally {
    await client.unsafe(
      "UPDATE question_concepts SET mapping_version = 1 WHERE id = $1",
      [mappingOneId],
    );
  }

  const attemptEvidence = await resolver.resolveEvent({
    sourceType: "MOCK_ATTEMPT",
    sourceEventId: first.id,
    sourceRevisionIdentity: "1".repeat(64),
  });
  assert.equal(attemptEvidence?.validity, "ELIGIBLE");
  const [storedAttempt] = await client.unsafe(
    "SELECT composition_snapshot_json FROM mock_exam_attempts WHERE id = $1",
    [first.id],
  );
  const mutatedComposition = JSON.parse(storedAttempt.composition_snapshot_json);
  mutatedComposition.items[0].possibleScore = 20;
  await client.unsafe(
    "UPDATE mock_exam_attempts SET composition_snapshot_json = $1 WHERE id = $2",
    [JSON.stringify(mutatedComposition), first.id],
  );
  await assert.rejects(
    resolver.resolveEvent({
      sourceType: "MOCK_ATTEMPT",
      sourceEventId: first.id,
      sourceRevisionIdentity: "1".repeat(64),
    }),
    (error) => error?.code === "MOCK_COMPOSITION_MISMATCH",
  );
  await client.unsafe(
    "UPDATE mock_exam_attempts SET composition_snapshot_json = $1 WHERE id = $2",
    [storedAttempt.composition_snapshot_json, first.id],
  );

  const replay = await assert.rejects(
    phase3.submitMockExam(userId, first.id),
    (error) => error?.code === "EXAM_ALREADY_SUBMITTED",
  );
  assert.equal(replay, undefined);

  const second = await phase3.startMockExam(userId, examId);
  const secondAttempt = await phase3.getMockExamAttempt(userId, second.id);
  assert.equal(secondAttempt.questions[0].title, "Mock PostgreSQL question v2");
  assert.equal(secondAttempt.questions[0].choices[1].content, "Mock PostgreSQL new correct");
  const secondBound = await client.unsafe(
    "SELECT question_version_id FROM mock_exam_answers WHERE attempt_id = $1",
    [second.id],
  );
  assert.equal(secondBound[0].question_version_id, questionVersionTwoId);
  await phase3.saveMockExamAnswer({ userId, attemptId: second.id, questionId, answer: choiceTwoId });
  await client.unsafe(`
    CREATE OR REPLACE FUNCTION mock_attempt_test_abort_submit() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'mock submit failure fixture'; END; $$;
    CREATE TRIGGER mock_attempt_test_abort_submit
      BEFORE UPDATE ON mock_exam_attempts
      FOR EACH ROW EXECUTE FUNCTION mock_attempt_test_abort_submit();
  `);
  try {
    await assert.rejects(phase3.submitMockExam(userId, second.id));
    assert.deepEqual(
      (await client.unsafe("SELECT status, score FROM mock_exam_attempts WHERE id = $1", [second.id])).map((row) => [row.status, row.score]),
      [["IN_PROGRESS", 0]],
    );
    assert.deepEqual(
      (await client.unsafe("SELECT is_correct, score FROM mock_exam_answers WHERE attempt_id = $1", [second.id])).map((row) => [row.is_correct, row.score]),
      [[null, null]],
    );
    assert.equal(
      Number((await client.unsafe("SELECT count(*) FROM learning_activities WHERE target_id = $1", [second.id]))[0].count),
      0,
    );
  } finally {
    await client.unsafe("DROP TRIGGER mock_attempt_test_abort_submit ON mock_exam_attempts; DROP FUNCTION mock_attempt_test_abort_submit();");
  }
  assert.equal((await phase3.submitMockExam(userId, second.id)).score, 100);
});

async function seedFixture() {
  await client.unsafe(
    "INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)",
    [authorId, "mock-pg-author@example.invalid", "Mock PG Author", userId, "mock-pg-user@example.invalid", "Mock PG User", otherUserId, "mock-pg-other@example.invalid", "Other Mock PG User"],
  );
  await client.unsafe(
    "INSERT INTO course_groups (id, code, name, description) VALUES ($1, $2, $3, $4)",
    [groupId, "MOCK-PG", "Mock PG Group", "Disposable PostgreSQL mock exam fixture"],
  );
  await client.unsafe(
    "INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description, published, active) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 1)",
    [courseId, groupId, "MOCK-PG", "mock-pg-course", "Mock PostgreSQL Course", "Mock PG", "Disposable PostgreSQL mock exam fixture"],
  );
  await client.unsafe(
    "INSERT INTO user_course_enrollments (id, user_id, course_id, status) VALUES ($1, $2, $3, 'ACTIVE')",
    ["mock-pg-enrollment", userId, courseId],
  );
  await client.unsafe(
    "INSERT INTO mock_exams (id, course_id, title, description, exam_type, question_count, time_limit_minutes, passing_score, max_attempts, randomize_questions, randomize_choices, status, published) VALUES ($1, $2, $3, $4, 'QUICK', 1, 30, 60, 2, 0, 0, 'OPEN', 1)",
    [examId, courseId, "Mock PostgreSQL Exam", "Disposable PostgreSQL mock exam fixture"],
  );
  await client.unsafe(
    "INSERT INTO questions (id, title, content, type, difficulty, explanation, wrong_answer_explanation, status, version, answer_config_json, is_sample, created_by, reviewed_by, published_at) VALUES ($1, $2, $3, 'SINGLE_CHOICE', 'EASY', $4, $5, 'PUBLISHED', 1, '{}', 0, $6, $6, CURRENT_TIMESTAMP::text)",
    [questionId, "Mock PostgreSQL question v1", "Mock PostgreSQL content v1", "Mock PostgreSQL explanation v1", "Mock PostgreSQL wrong explanation v1", authorId],
  );
  await client.unsafe(
    "INSERT INTO question_choices (id, question_id, content, display_order, is_correct, explanation) VALUES ($1, $3, $4, 1, 1, ''), ($2, $3, $5, 2, 0, '')",
    [choiceOneId, choiceTwoId, questionId, "Mock PostgreSQL old correct", "Mock PostgreSQL old wrong"],
  );
  await client.unsafe(
    "INSERT INTO ontology_concepts (id, concept_key, label, normalized_label, status) VALUES ($1, $2, $3, $4, 'ACTIVE')",
    [conceptId, "mock.pg.revision", "Mock PG revision", "mock pg revision"],
  );
  await insertVersion(questionVersionOneId, 1, "Mock PostgreSQL question v1", "Mock PostgreSQL content v1", "Mock PostgreSQL explanation v1", "Mock PostgreSQL wrong explanation v1", "Mock PostgreSQL old correct", "Mock PostgreSQL old wrong");
  await client.unsafe(
    "INSERT INTO question_concepts (id, question_version_id, concept_id, created_by, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at) VALUES ($1, $2, $3, $4, 'MAPS_TO', '{}', '{}', 'APPROVED', 1, $4, CURRENT_TIMESTAMP::text)",
    [mappingOneId, questionVersionOneId, conceptId, authorId],
  );
  await client.unsafe(
    "INSERT INTO mock_exam_questions (mock_exam_id, question_id, score, display_order) VALUES ($1, $2, 10, 1)",
    [examId, questionId],
  );
}

async function mutateCurrentQuestionToVersionTwo() {
  await client.unsafe(
    "UPDATE questions SET version = 2, title = $1, content = $2, explanation = $3, wrong_answer_explanation = $4, updated_at = CURRENT_TIMESTAMP::text WHERE id = $5",
    ["Mock PostgreSQL question v2", "Mock PostgreSQL content v2", "Mock PostgreSQL explanation v2", "Mock PostgreSQL wrong explanation v2", questionId],
  );
  await client.unsafe(
    "UPDATE question_choices SET content = CASE WHEN id = $1 THEN $2 ELSE $3 END, is_correct = CASE WHEN id = $1 THEN 0 ELSE 1 END WHERE question_id = $4",
    [choiceOneId, "Mock PostgreSQL new wrong", "Mock PostgreSQL new correct", questionId],
  );
  await insertVersion(questionVersionTwoId, 2, "Mock PostgreSQL question v2", "Mock PostgreSQL content v2", "Mock PostgreSQL explanation v2", "Mock PostgreSQL wrong explanation v2", "Mock PostgreSQL new wrong", "Mock PostgreSQL new correct");
  await client.unsafe(
    "INSERT INTO question_concepts (id, question_version_id, concept_id, created_by, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at) VALUES ($1, $2, $3, $4, 'MAPS_TO', '{}', '{}', 'APPROVED', 2, $4, CURRENT_TIMESTAMP::text)",
    [mappingTwoId, questionVersionTwoId, conceptId, authorId],
  );
}

async function insertVersion(id, version, title, content, explanation, wrongExplanation, correctChoice, wrongChoice) {
  const snapshot = JSON.stringify({
    id: questionId,
    version,
    title,
    content,
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation,
    wrongAnswerExplanation: wrongExplanation,
    answerConfigJson: "{}",
    choices: [
      { id: choiceOneId, content: correctChoice, displayOrder: 1, isCorrect: version === 1, explanation: "" },
      { id: choiceTwoId, content: wrongChoice, displayOrder: 2, isCorrect: version !== 1, explanation: "" },
    ],
    source: null,
    sourceDate: null,
    courseIds: [courseId],
    conceptMappings: [{
      conceptId,
      qualificationJson: "{}",
      provenanceJson: "{}",
      mappingStatus: "APPROVED",
      reviewedBy: authorId,
      reviewedAt: "2026-09-11T00:00:00.000Z",
    }],
    governance: {
      blueprintId: "mock-pg-blueprint",
      qualificationJson: "{}",
      provenanceJson: "{}",
      governanceJson: "{}",
      humanReviewHash: String(version + 1).repeat(64),
      humanReviewedBy: authorId,
      humanReviewedAt: "2026-09-11T00:00:00.000Z",
    },
  });
  const semanticHash = await computeMockQuestionVersionSemanticHash(snapshot, questionId);
  await client.unsafe(
    "INSERT INTO question_versions (id, question_id, version, snapshot_json, review_comment, semantic_hash, human_review_hash, human_reviewed_by, human_reviewed_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP::text, $8)",
    [id, questionId, version, snapshot, `Mock PG revision ${version}`, semanticHash, String(version + 1).repeat(64), authorId],
  );
}

async function insertMapping(id, versionId, mappingVersion) {
  await client.unsafe(
    "INSERT INTO question_concepts (id, question_version_id, concept_id, created_by, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at) VALUES ($1, $2, $3, $4, 'MAPS_TO', '{}', '{}', 'APPROVED', $5, $4, CURRENT_TIMESTAMP::text)",
    [id, versionId, conceptId, authorId, mappingVersion],
  );
}

async function waitForConnection() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await client`SELECT 1`;
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}
