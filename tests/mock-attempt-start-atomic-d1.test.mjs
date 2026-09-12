import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { commitMockExamStart } from "../db/mock-exam-start-atomic.ts";
import { computeMockQuestionVersionSemanticHash } from "../lib/services/mock-exam-revision.ts";
import {
  computeConceptMappingSetHash,
  computeMockCompositionSemanticHash,
} from "../lib/services/learning-event-contracts.ts";

const userId = "d1-user";
const courseId = "d1-course";
const examId = "d1-exam";
const questionId = "d1-question";
const questionVersionId = "d1-question-version-01";
const mappingId = "d1-mapping";
const conceptId = "d1-concept";
let miniflare;
let database;

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "mock-start-atomic-d1" },
  });
  database = await miniflare.getD1Database("DB");
  await runSql(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE courses (id TEXT PRIMARY KEY);
    CREATE TABLE user_course_enrollments (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL, status TEXT NOT NULL
    );
    CREATE TABLE mock_exams (
      id TEXT PRIMARY KEY, course_id TEXT NOT NULL, question_count INTEGER NOT NULL,
      passing_score INTEGER NOT NULL, max_attempts INTEGER NOT NULL,
      randomize_questions INTEGER NOT NULL, randomize_choices INTEGER NOT NULL,
      published INTEGER NOT NULL, status TEXT NOT NULL, start_at TEXT, end_at TEXT
    );
    CREATE TABLE questions (id TEXT PRIMARY KEY, status TEXT NOT NULL, version INTEGER NOT NULL);
    CREATE TABLE mock_exam_questions (
      mock_exam_id TEXT NOT NULL, question_id TEXT NOT NULL, score INTEGER NOT NULL, display_order INTEGER NOT NULL
    );
    CREATE TABLE question_versions (
      id TEXT PRIMARY KEY, question_id TEXT NOT NULL, version INTEGER NOT NULL,
      semantic_hash TEXT NOT NULL, human_review_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL
    );
    CREATE TABLE ontology_concepts (id TEXT PRIMARY KEY, concept_key TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE question_concepts (
      id TEXT PRIMARY KEY, question_version_id TEXT NOT NULL, concept_id TEXT NOT NULL,
      relation_type TEXT NOT NULL, qualification_json TEXT, provenance_json TEXT,
      mapping_status TEXT NOT NULL, mapping_version INTEGER NOT NULL
    );
    CREATE TABLE mock_exam_attempts (
      id TEXT PRIMARY KEY, mock_exam_id TEXT NOT NULL, user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL, unanswered_count INTEGER NOT NULL,
      composition_semantic_hash TEXT, composition_snapshot_json TEXT,
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS', score INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE mock_exam_answers (
      id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL, question_id TEXT NOT NULL,
      question_version_id TEXT, concept_mapping_set_hash TEXT
    );
    INSERT INTO users VALUES ('${userId}');
    INSERT INTO courses VALUES ('${courseId}');
    INSERT INTO user_course_enrollments VALUES ('d1-enrollment', '${userId}', '${courseId}', 'ACTIVE');
    INSERT INTO mock_exams VALUES ('${examId}', '${courseId}', 1, 60, 2, 0, 0, 1, 'OPEN', NULL, NULL);
    INSERT INTO questions VALUES ('${questionId}', 'PUBLISHED', 1);
    INSERT INTO mock_exam_questions VALUES ('${examId}', '${questionId}', 10, 1);
    INSERT INTO ontology_concepts VALUES ('${conceptId}', 'mock.d1.concept', 'ACTIVE');
  `);
  await seedQuestionVersion();
});

after(async () => {
  await miniflare?.dispose();
});

test("D1 rejects a prepared start after the committed mapping change atomically", async () => {
  const prepared = await buildPreparedStart("d1-attempt-after-race");
  await database.prepare(
    "INSERT INTO question_concepts VALUES (?, ?, ?, 'MAPS_TO', ?, ?, 'APPROVED', ?)",
  ).bind(mappingId, questionVersionId, conceptId, "{}", "{}", 2).run();

  await assert.rejects(
    commitMockExamStart(prepared, new D1DatabaseProvider(database)),
    (error) => error?.code === "EXAM_INCOMPLETE",
  );
  assert.deepEqual(await counts(prepared.id), { attempts: 0, answers: 0 });
  assert.equal(await scalar("SELECT mapping_version FROM question_concepts WHERE id = ?", [mappingId]), 2);

  await database.prepare("UPDATE question_concepts SET mapping_version = 1 WHERE id = ?").bind(mappingId).run();
  await commitMockExamStart(prepared, new D1DatabaseProvider(database));
  assert.deepEqual(await counts(prepared.id), { attempts: 1, answers: 1 });
});

async function seedQuestionVersion() {
  const snapshot = JSON.stringify({
    id: questionId,
    version: 1,
    title: "D1 atomic question",
    content: "D1 atomic content",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation: "D1 explanation",
    wrongAnswerExplanation: "D1 wrong explanation",
    answerConfigJson: "{}",
    choices: [
      { id: "d1-choice-1", content: "correct", displayOrder: 1, isCorrect: true, explanation: "" },
      { id: "d1-choice-2", content: "wrong", displayOrder: 2, isCorrect: false, explanation: "" },
    ],
    source: null,
    sourceDate: null,
    courseIds: [courseId],
    conceptMappings: [{ conceptId, qualificationJson: "{}", provenanceJson: "{}", mappingStatus: "APPROVED" }],
    governance: {
      blueprintId: "d1-blueprint",
      qualificationJson: "{}",
      provenanceJson: "{}",
      governanceJson: "{}",
      humanReviewHash: "b".repeat(64),
      humanReviewedBy: "d1-reviewer",
      humanReviewedAt: "2026-09-12T00:00:00.000Z",
    },
  });
  const semanticHash = await computeMockQuestionVersionSemanticHash(snapshot, questionId);
  await database.prepare(
    "INSERT INTO question_versions VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(questionVersionId, questionId, 1, semanticHash, "b".repeat(64), snapshot).run();
}

async function runSql(sql) {
  for (const statement of sql.split(/;\s*/).map((value) => value.trim()).filter(Boolean)) {
    await database.prepare(statement).run();
  }
}

async function buildPreparedStart(id) {
  const mapping = {
    conceptIdentity: "mock.d1.concept",
    mappingVersion: 1,
    qualificationJson: "{}",
    provenanceJson: "{}",
  };
  const mappingHash = await computeConceptMappingSetHash([{
    conceptIdentity: mapping.conceptIdentity,
    mappingVersion: mapping.mappingVersion,
    qualification: {},
    provenance: {},
    status: "APPROVED",
  }]);
  const row = {
    questionId,
    displayOrder: 1,
    possibleScore: 10,
    questionStatus: "PUBLISHED",
    questionVersionId,
    questionVersionQuestionId: questionId,
    questionVersionVersion: 1,
    questionVersionSemanticHash: await textScalar("SELECT semantic_hash FROM question_versions WHERE id = ?", [questionVersionId]),
    questionVersionHumanReviewHash: "b".repeat(64),
    questionVersionSnapshotJson: await textScalar("SELECT snapshot_json FROM question_versions WHERE id = ?", [questionVersionId]),
  };
  const item = {
    displayOrder: row.displayOrder,
    questionIdentity: questionId,
    questionVersionSemanticHash: row.questionVersionSemanticHash,
    possibleScore: row.possibleScore,
    conceptMappingSetHash: mappingHash,
  };
  return {
    id,
    userId,
    mockExamId: examId,
    expiresAt: "2026-09-12T01:00:00.000Z",
    compositionSemanticHash: await computeMockCompositionSemanticHash({
      items: [item],
      passingScore: 60,
      questionCount: 1,
      randomizeQuestions: false,
      randomizeChoices: false,
    }),
    compositionSnapshotJson: JSON.stringify({
      snapshotVersion: 1,
      items: [{ ...item, questionVersionId }],
      passingScore: 60,
      questionCount: 1,
      randomizeQuestions: false,
      randomizeChoices: false,
    }),
    exam: {
      id: examId,
      courseId,
      questionCount: 1,
      passingScore: 60,
      maxAttempts: 2,
      randomizeQuestions: false,
      randomizeChoices: false,
      published: true,
      status: "OPEN",
      startAt: null,
      endAt: null,
    },
    questionRows: [row],
    versionBindings: new Map([[questionId, {
      questionVersionId,
      questionVersionSemanticHash: row.questionVersionSemanticHash,
      conceptMappingSetHash: mappingHash,
      mappings: [mapping],
    }]]),
  };
}

async function counts(attemptId) {
  return {
    attempts: await scalar("SELECT count(*) FROM mock_exam_attempts WHERE id = ?", [attemptId]),
    answers: await scalar("SELECT count(*) FROM mock_exam_answers WHERE attempt_id = ?", [attemptId]),
  };
}

async function scalar(sql, parameters) {
  const row = await database.prepare(sql).bind(...parameters).first();
  return Number(Object.values(row ?? {})[0] ?? 0);
}

async function textScalar(sql, parameters) {
  const row = await database.prepare(sql).bind(...parameters).first();
  return Object.values(row ?? {})[0] ?? null;
}
