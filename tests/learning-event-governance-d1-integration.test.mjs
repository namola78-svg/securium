import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { LearningEventGovernanceRepository } from "../db/learning-event-governance-repository.ts";
import { LearningEventGovernanceService } from "../lib/services/learning-event-governance.ts";

let miniflare;
let database;
let provider;
let service;

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "learning-event-governance" },
  });
  database = await miniflare.getD1Database("DB");
  const names = (await readdir("drizzle")).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const name of names) await applyMigration(await readFile(`drizzle/${name}`, "utf8"));
  await database.batch([
    database.prepare("INSERT INTO users (id, email, display_name) VALUES ('user-learner-1', 'one@example.invalid', 'One'), ('user-learner-2', 'two@example.invalid', 'Two'), ('user-admin', 'admin@example.invalid', 'Admin')"),
    database.prepare("INSERT INTO course_groups (id, code, name, description) VALUES ('pr-a-group', 'PRA', 'PR A', 'PR A')"),
    database.prepare("INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description) VALUES ('course-isms-p', 'pr-a-group', 'PRA', 'pr-a', 'PR A', 'PRA', 'PR A')"),
    database.prepare("INSERT INTO subjects (id, course_id, code, name) VALUES ('pr-a-subject', 'course-isms-p', 'S', 'Subject')"),
    database.prepare("INSERT INTO topics (id, subject_id, code, name) VALUES ('pr-a-topic', 'pr-a-subject', 'T', 'Topic')"),
    database.prepare("INSERT INTO questions (id, title, content, type, difficulty, explanation, wrong_answer_explanation, created_by) VALUES ('pr-a-question', 'Question', 'Question', 'SINGLE_CHOICE', 'EASY', '', '', 'user-admin')"),
  ]);
  provider = new D1DatabaseProvider(database);
  service = new LearningEventGovernanceService(new LearningEventGovernanceRepository(provider));
});

after(async () => miniflare?.dispose());

test("D1 revision governance proves NEW_SUCCESS, EXACT_REPLAY, owner guard, and sequence conflict", async () => {
  await provider.execute({
    sql: `INSERT INTO question_attempts
      (id, idempotency_key, user_id, question_id, course_id, selected_answer, is_correct, score, response_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    parameters: ["pr-a-attempt-1", "pr-a-idempotency-1", "user-learner-1", "pr-a-question", "course-isms-p", "fixture", false, 0, 1],
  });
  const input = {
    revisionId: "pr-a-revision-1",
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: "pr-a-attempt-1",
    ownerUserId: "user-learner-1",
    actorUserId: "user-admin",
    action: "INVALIDATE",
    reasonCode: "INVALID_ATTEMPT",
    payload: { kind: "VALIDITY_ONLY" },
    expectedPreviousRevisionId: null,
  };
  assert.equal((await service.appendRevision(input)).outcome, "NEW_SUCCESS");
  assert.equal((await service.appendRevision(input)).outcome, "EXACT_REPLAY");
  assert.equal(Number((await provider.queryOne({ sql: "SELECT count(*) AS count FROM learning_event_revisions WHERE source_event_id = ?", parameters: [input.sourceEventId] })).count), 1);
  await assert.rejects(
    service.appendRevision({ ...input, revisionId: "pr-a-cross-user", ownerUserId: "user-learner-2", reasonCode: "CROSS_USER" }),
    (error) => error?.code === "LEARNING_EVENT_SOURCE_NOT_FOUND_OR_FORBIDDEN",
  );
  await assert.rejects(
    service.appendRevision({ ...input, revisionId: "pr-a-stale", action: "RESTORE_ELIGIBILITY", reasonCode: "STALE_SEQUENCE" }),
    (error) => error?.code === "LEARNING_EVENT_REVISION_SEQUENCE_CONFLICT",
  );
});

async function applyMigration(sql) {
  const statements = sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
  for (let index = 0; index < statements.length; index += 50) {
    await database.batch(statements.slice(index, index + 50).map((statement) => database.prepare(statement)));
  }
}

test("concurrent identical D1 revision leaves one semantic row", async () => {
  const base = {
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: "pr-a-attempt-1",
    ownerUserId: "user-learner-1",
    actorUserId: "user-admin",
    action: "RESTORE_ELIGIBILITY",
    reasonCode: "RESTORE_AFTER_REVIEW",
    payload: { kind: "VALIDITY_ONLY" },
    expectedPreviousRevisionId: "pr-a-revision-1",
  };
  const outcomes = await Promise.all([
    service.appendRevision({ ...base, revisionId: "pr-a-concurrent-a" }),
    service.appendRevision({ ...base, revisionId: "pr-a-concurrent-b" }),
  ]);
  assert.deepEqual(outcomes.map((row) => row.outcome).sort(), ["EXACT_REPLAY", "NEW_SUCCESS"]);
  const count = await provider.queryOne({ sql: "SELECT count(*) AS count FROM learning_event_revisions WHERE source_event_id = ?", parameters: [base.sourceEventId] });
  assert.equal(Number(count.count), 2);
});
