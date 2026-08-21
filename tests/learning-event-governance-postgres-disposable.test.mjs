import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, test } from "node:test";
import { promisify } from "node:util";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { LearningEventGovernanceRepository } from "../db/learning-event-governance-repository.ts";
import { LearningEventGovernanceService } from "../lib/services/learning-event-governance.ts";

const execFile = promisify(execFileCallback);
let container;
let client;

after(async () => {
  await client?.end({ timeout: 5 }).catch(() => {});
  if (container) await execFile("docker", ["rm", "--force", container]).catch(() => {});
});

test("disposable PostgreSQL 17.6 proves governed revision replay and rollback", async () => {
  container = `securium-learning-event-governance-${randomUUID()}`;
  const password = "learning-event-governance-test-password";
  await execFile("docker", ["run", "--detach", "--rm", "--name", container, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
  const { stdout } = await execFile("docker", ["port", container, "5432/tcp"]);
  const port = stdout.trim().match(/:(\d+)$/)?.[1];
  assert.ok(port);
  const postgres = (await import("postgres")).default;
  client = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
  await waitForConnection();
  await client.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;");
  const migrations = (await readdir("db/postgres/migrations")).filter((name) => /^\d{4}_.+\.sql$/.test(name) && !["0002_server_only_rls_lockdown.sql", "0009_security_certification_taxonomy_cleanup.sql"].includes(name)).sort();
  for (const name of migrations) await client.unsafe(await readFile(`db/postgres/migrations/${name}`, "utf8"));
  await client.unsafe("INSERT INTO users (id, email, display_name) VALUES ('pr-a-owner', 'owner@example.invalid', 'Owner'), ('pr-a-actor', 'actor@example.invalid', 'Actor')");
  await client.unsafe("INSERT INTO course_groups (id, code, name, description) VALUES ('pr-a-group', 'PRA', 'PR A', 'PR A')");
  await client.unsafe("INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description) VALUES ('pr-a-course', 'pr-a-group', 'PRA', 'pr-a', 'PR A', 'PRA', 'PR A')");
  await client.unsafe("INSERT INTO subjects (id, course_id, code, name) VALUES ('pr-a-subject', 'pr-a-course', 'S', 'Subject')");
  await client.unsafe("INSERT INTO topics (id, subject_id, code, name) VALUES ('pr-a-topic', 'pr-a-subject', 'T', 'Topic')");
  await client.unsafe("INSERT INTO questions (id, title, content, type, difficulty, explanation, wrong_answer_explanation, created_by) VALUES ('pr-a-question', 'Question', 'Question', 'SINGLE_CHOICE', 'EASY', '', '', 'pr-a-actor')");
  await client.unsafe("INSERT INTO question_attempts (id, idempotency_key, user_id, question_id, course_id, selected_answer, is_correct) VALUES ('pr-a-attempt', 'pr-a-key', 'pr-a-owner', 'pr-a-question', 'pr-a-course', 'fixture', 0)");
  const provider = makeProvider();
  const service = new LearningEventGovernanceService(new LearningEventGovernanceRepository(provider));
  const input = { revisionId: "pr-a-pg-revision", sourceType: "QUESTION_ATTEMPT", sourceEventId: "pr-a-attempt", ownerUserId: "pr-a-owner", actorUserId: "pr-a-actor", action: "INVALIDATE", reasonCode: "INVALID_ATTEMPT", payload: { kind: "VALIDITY_ONLY" }, expectedPreviousRevisionId: null };
  assert.equal((await service.appendRevision(input)).outcome, "NEW_SUCCESS");
  assert.equal((await service.appendRevision(input)).outcome, "EXACT_REPLAY");
  await assert.rejects(new LearningEventGovernanceService(new LearningEventGovernanceRepository(makeProvider(true))).appendRevision({ ...input, revisionId: "pr-a-pg-rollback", action: "RESTORE_ELIGIBILITY", expectedPreviousRevisionId: "pr-a-pg-revision" }));
  const rows = await client.unsafe("SELECT count(*) AS count FROM learning_event_revisions WHERE source_event_id = 'pr-a-attempt'");
  assert.equal(Number(rows[0].count), 1);
});

function makeProvider(failTransaction = false) {
  return new PostgresDatabaseProvider({
    query: async (query, parameters) => { const rows = await client.unsafe(query, parameters); return { rows, rowCount: rows.count ?? rows.length }; },
    transaction: async (callback) => client.begin(async (tx) => callback({ query: async (query, parameters) => { if (failTransaction) throw new Error("failure injection before commit"); const rows = await tx.unsafe(query, parameters); return { rows, rowCount: rows.count ?? rows.length }; } })),
  });
}

async function waitForConnection() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { await client`SELECT 1`; return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}
