import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  assertSwFoundationBindingMatches,
  buildSwFoundationQuestionBindingSeeds,
  deriveSwFoundationQuestionBindingSeed,
  getSwFoundationQuestionBindingSeed,
} from "../lib/services/securium-sw-security-weakness-foundation-binding.ts";
import {
  buildSwSecurityWeaknessRuntimeProjection,
  SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY,
} from "../lib/services/securium-sw-security-weakness-runtime-adapter.ts";

const runtimeCourse = {
  id: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.courseId,
  code: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.code,
  slug: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.slug,
  name: "SW 보안약점 진단원",
  bindingKey: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.bindingKey,
  active: true,
  published: true,
  isSample: false,
  deletedAt: null,
} as const;

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : undefined;
}

function assertCode(action: () => unknown, expected: string) {
  assert.throws(action, (error: unknown) => errorCode(error) === expected);
}

test("all 21 canonical Foundation questions resolve to unique deterministic bindings", () => {
  const first = buildSwFoundationQuestionBindingSeeds(runtimeCourse);
  const second = buildSwFoundationQuestionBindingSeeds(runtimeCourse);
  const projection = buildSwSecurityWeaknessRuntimeProjection(runtimeCourse);

  assert.equal(first.length, 21);
  assert.equal(new Set(first.map((seed) => seed.id)).size, 21);
  assert.equal(new Set(first.map((seed) => seed.foundationQuestionId)).size, 21);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((seed) => seed.foundationQuestionId).sort(),
    projection.questions.map((question) => question.id).sort(),
  );
  assert.equal(first.every((seed) => /^[0-9a-f]{64}$/.test(seed.semanticHash)), true);
});

test("binding identity is provider-neutral and stores no Foundation content", () => {
  const seeds = buildSwFoundationQuestionBindingSeeds(runtimeCourse);
  for (const seed of seeds) {
    assert.equal(Object.isFrozen(seed), true);
    assert.deepEqual(Object.keys(seed).sort(), [
      "courseId",
      "foundationBindingKey",
      "foundationQuestionId",
      "foundationVersion",
      "id",
      "lifecycleState",
      "semanticHash",
    ]);
    for (const forbidden of [
      "content",
      "prompt",
      "choices",
      "answer",
      "explanation",
      "triad",
      "weakness",
      "role",
      "grading",
      "evidence",
      "mastery",
    ]) {
      assert.equal(forbidden in seed, false, `${forbidden} must not be persisted`);
    }
  }
});

test("unknown Foundation identity and forged binding identity fail closed", () => {
  const seeds = buildSwFoundationQuestionBindingSeeds(runtimeCourse);
  const first = seeds[0];
  assertCode(
    () => getSwFoundationQuestionBindingSeed(runtimeCourse, "sw-fa-q-forged"),
    "SW_FOUNDATION_QUESTION_NOT_FOUND",
  );
  assertCode(
    () =>
      assertSwFoundationBindingMatches(first, {
        ...first,
        id: "sw-fb-v1-forged",
      }),
    "SW_FOUNDATION_BINDING_MISMATCH",
  );
  assertCode(
    () =>
      assertSwFoundationBindingMatches(first, {
        ...first,
        lifecycleState: "RETIRED",
        retiredAt: "2026-09-10T00:00:00.000Z",
      }),
    "SW_FOUNDATION_BINDING_MISMATCH",
  );
});

test("same immutable identity with changed semantic hash fails closed", () => {
  const projection = buildSwSecurityWeaknessRuntimeProjection(runtimeCourse);
  const originalQuestion = projection.questions[0];
  const changedQuestion = {
    ...structuredClone(originalQuestion),
    stem: originalQuestion.stem + " changed after publication",
  };
  const original = deriveSwFoundationQuestionBindingSeed(
    runtimeCourse,
    originalQuestion,
  );
  const changed = deriveSwFoundationQuestionBindingSeed(
    runtimeCourse,
    changedQuestion,
  );

  assert.equal(changed.id, original.id);
  assert.notEqual(changed.semanticHash, original.semanticHash);
  assertCode(
    () => assertSwFoundationBindingMatches(original, changed),
    "SW_FOUNDATION_BINDING_MISMATCH",
  );
});

test("sample substitution is rejected before Foundation binding projection", () => {
  assertCode(
    () =>
      buildSwFoundationQuestionBindingSeeds({
        ...runtimeCourse,
        isSample: true,
      }),
    "SAMPLE_STATE_CONFLICT",
  );
});

test("PostgreSQL and D1 migrations expose equivalent identity-only binding contracts", () => {
  const postgres = readFileSync(
    "db/postgres/migrations/0050_sw_foundation_identity_version_binding.sql",
    "utf8",
  );
  const d1 = readFileSync(
    "drizzle/0043_sw_foundation_identity_version_binding.sql",
    "utf8",
  );
  for (const migration of [postgres, d1]) {
    for (const required of [
      "foundation_question_bindings",
      "foundation_binding_key",
      "foundation_version",
      "foundation_question_id",
      "semantic_hash",
      "lifecycle_state",
      "foundation_question_binding_id",
      "question_attempts_identity_path_check",
    ]) {
      assert.match(migration, new RegExp(required));
    }
    for (const forbidden of [
      "question_text",
      "question_content",
      "choices",
      "correct_answer",
      "explanation",
      "triad_id",
      "weakness_id",
      "is_correct",
    ]) {
      const bindingTable = migration.slice(
        migration.indexOf("foundation_question_bindings"),
        migration.indexOf("question_attempts"),
      );
      assert.equal(
        bindingTable.toLowerCase().includes(forbidden),
        false,
        `${forbidden} must not be in the identity registry`,
      );
    }
  }
  assert.match(postgres, /ALTER COLUMN "question_id" DROP NOT NULL/);
  assert.match(d1, /`question_id` text,/);
  assert.match(d1, /SELECT[^;]*NULL[^;]*FROM `question_attempts`[\s\S]*/);
});

test("D1 migration preserves generic attempts and enforces one Foundation identity path", () => {
  const migration = readFileSync(
    "drizzle/0043_sw_foundation_identity_version_binding.sql",
    "utf8",
  );
  const database = new DatabaseSync(":memory:");
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id text PRIMARY KEY);
    CREATE TABLE questions (id text PRIMARY KEY);
    CREATE TABLE question_versions (id text PRIMARY KEY);
    CREATE TABLE courses (id text PRIMARY KEY);
    INSERT INTO users VALUES ('u1');
    INSERT INTO questions VALUES ('q1');
    INSERT INTO question_versions VALUES ('v1');
    INSERT INTO courses VALUES ('c1'), ('c2');
    CREATE TABLE question_attempts (
      id text PRIMARY KEY NOT NULL,
      idempotency_key text NOT NULL,
      user_id text NOT NULL,
      question_id text NOT NULL,
      question_version_id text,
      concept_mapping_set_hash text,
      course_id text NOT NULL,
      mode text DEFAULT 'LEARNING' NOT NULL,
      exam_session_id text,
      selected_answer text NOT NULL,
      is_correct integer NOT NULL,
      score integer DEFAULT 0 NOT NULL,
      response_time integer DEFAULT 0 NOT NULL,
      attempted_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      attempt_sequence integer
    );
    INSERT INTO question_attempts
      (id, idempotency_key, user_id, question_id, course_id, selected_answer, is_correct)
      VALUES ('legacy', 'legacy-key', 'u1', 'q1', 'c1', 'A', 1);
  `);
  for (const statement of migration
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .filter(Boolean)) {
    database.exec(statement);
  }

  const bindingId = "binding-1";
  database.prepare(`INSERT INTO foundation_question_bindings
    (id, course_id, foundation_binding_key, foundation_version,
     foundation_question_id, semantic_hash, lifecycle_state)
    VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`).run(
    bindingId,
    "c1",
    "sw-vuln-foundation-current-main-v1",
    "sw-vuln-foundation-current-main-v1",
    "sw-fa-q-001",
    "a".repeat(64),
  );
  database.prepare(`INSERT INTO question_attempts
    (id, idempotency_key, user_id, question_id, foundation_question_binding_id,
     course_id, selected_answer, is_correct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    "foundation",
    "foundation-key",
    "u1",
    null,
    bindingId,
    "c1",
    "VULNERABLE",
    1,
  );
  database.prepare(`INSERT INTO question_attempts
    (id, idempotency_key, user_id, question_id, course_id, selected_answer, is_correct)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    "generic",
    "generic-key",
    "u1",
    "q1",
    "c1",
    "A",
    1,
  );
  const countRow = database
    .prepare("SELECT count(*) AS count FROM question_attempts")
    .get();
  assert.equal(countRow?.count, 3);
  assert.throws(() =>
    database.prepare(`INSERT INTO question_attempts
      (id, idempotency_key, user_id, question_id, foundation_question_binding_id,
       course_id, selected_answer, is_correct)
      VALUES ('both', 'both-key', 'u1', 'q1', ?, 'c1', 'A', 1)`).run(bindingId),
  );
  assert.throws(() =>
    database.prepare(`INSERT INTO question_attempts
      (id, idempotency_key, user_id, course_id, selected_answer, is_correct)
      VALUES ('neither', 'neither-key', 'u1', 'c1', 'A', 1)`).run(),
  );
  assert.throws(() =>
    database.prepare(`INSERT INTO question_attempts
      (id, idempotency_key, user_id, foundation_question_binding_id,
       course_id, selected_answer, is_correct)
      VALUES ('cross-course', 'cross-key', 'u1', ?, 'c2', 'A', 1)`).run(bindingId),
  );
  database.close();
});
