import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const d1MigrationPath = "drizzle/0042_attempt_sequence_schema_foundation.sql";
const postgresMigrationPath =
  "db/postgres/migrations/0049_attempt_sequence_schema_foundation.sql";

test("schema authority declares nullable per-user/course/question AttemptSequence", async () => {
  const schema = await readFile("db/schema.ts", "utf8");
  assert.match(schema, /attemptSequence: integer\("attempt_sequence"\)/);
  assert.match(schema, /question_attempts_partition_sequence_unique[\s\S]*table\.userId, table\.courseId, table\.questionId, table\.attemptSequence/);
  assert.match(schema, /question_attempts_attempt_sequence_check[\s\S]*table\.attemptSequence} IS NULL OR \$\{table\.attemptSequence} >= 1/);
  assert.doesNotMatch(schema, /attemptSequence[^\n]*default/);
});

test("D1 migration preserves existing attempts as NULL and enforces foundation invariants", async () => {
  const migration = await readFile(d1MigrationPath, "utf8");
  assert.doesNotMatch(migration, /UPDATE\s+[`"]?question_attempts/i);
  assert.doesNotMatch(migration, /attempt_sequence"\s*FROM\s+[`"]question_attempts/i);
  assert.match(migration, /attempt_sequence.*integer/);
  assert.match(migration, /attempt_sequence.*>= 1/);
  assert.match(migration, /question_attempts_partition_sequence_unique/);

  const database = new DatabaseSync(":memory:");
  database.exec(`CREATE TABLE users (id text PRIMARY KEY);
  CREATE TABLE questions (id text PRIMARY KEY);
  CREATE TABLE question_versions (id text PRIMARY KEY);
  CREATE TABLE courses (id text PRIMARY KEY);
  INSERT INTO users VALUES ('u1'), ('u2'), ('u3');
  INSERT INTO questions VALUES ('q1'), ('q2'), ('q3');
  INSERT INTO courses VALUES ('c1'), ('c2'), ('c3');
  CREATE TABLE question_attempts (
    id text PRIMARY KEY NOT NULL, idempotency_key text NOT NULL,
    user_id text NOT NULL, question_id text NOT NULL, question_version_id text,
    concept_mapping_set_hash text, course_id text NOT NULL,
    mode text DEFAULT 'LEARNING' NOT NULL, exam_session_id text,
    selected_answer text NOT NULL, is_correct integer NOT NULL,
    score integer DEFAULT 0 NOT NULL, response_time integer DEFAULT 0 NOT NULL,
    attempted_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
  INSERT INTO question_attempts (id, idempotency_key, user_id, question_id, course_id, selected_answer, is_correct)
  VALUES ('a1', 'k1', 'u1', 'q1', 'c1', 'A', 1), ('a2', 'k2', 'u1', 'q1', 'c1', 'B', 0);`);
  database.exec(migration);
  assert.deepEqual(database.prepare("SELECT id, attempt_sequence FROM question_attempts ORDER BY id").all().map((row) => ({ ...row })), [
    { id: "a1", attempt_sequence: null },
    { id: "a2", attempt_sequence: null },
  ]);

  const insert = database.prepare(`INSERT INTO question_attempts
    (id, idempotency_key, user_id, question_id, course_id, selected_answer, is_correct, attempt_sequence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  insert.run("a3", "k3", "u1", "q1", "c1", "A", 1, 1);
  assert.throws(() => insert.run("a4", "k4", "u1", "q1", "c1", "A", 1, 1));
  assert.throws(() => insert.run("a5", "k5", "u1", "q1", "c1", "A", 1, 0));
  assert.throws(() => insert.run("a6", "k6", "u1", "q1", "c1", "A", 1, -1));
  insert.run("a7", "k7", "u2", "q1", "c1", "A", 1, 1);
  insert.run("a8", "k8", "u1", "q2", "c1", "A", 1, 1);
  insert.run("a9", "k9", "u1", "q1", "c2", "A", 1, 1);
  const maxValue = "9223372036854775807";
  insert.run("a10", "k10", "u3", "q3", "c3", "A", 1, maxValue);
  assert.equal(database.prepare("SELECT CAST(attempt_sequence AS TEXT) AS value FROM question_attempts WHERE id = ?").get("a10").value, maxValue);
});

test("PostgreSQL migration is nullable BIGINT foundation only", async () => {
  const migration = await readFile(postgresMigrationPath, "utf8");
  assert.match(migration, /ADD COLUMN "attempt_sequence" bigint;/i);
  assert.match(migration, /attempt_sequence.*>= 1/i);
  assert.match(migration, /WHERE "attempt_sequence" IS NOT NULL/i);
  assert.doesNotMatch(migration, /DEFAULT\s+\d+/i);
  assert.doesNotMatch(migration, /\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b/i);
  assert.doesNotMatch(migration, /counter|allocator|attempt_sequence.*SELECT/i);
  assert.doesNotMatch(migration, /mode|exam_session_id|question_version_id/i);
});
