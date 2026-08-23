import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { promisify } from "node:util";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { EvidenceProjectionRepository } from "../db/evidence-projection-repository.ts";
import { buildEvidenceCandidates } from "../lib/services/evidence-projection.ts";

const execFile = promisify(execFileCallback);
let container;
let client;

after(async () => {
  await client?.end({ timeout: 5 }).catch(() => {});
  if (container) await execFile("docker", ["rm", "--force", container]).catch(() => {});
});

test("disposable PostgreSQL 17.6 proves Evidence replay, correction, invalidation, and rollback", async () => {
  container = `securium-evidence-pr-b-${randomUUID()}`;
  const password = "evidence-pr-b-disposable-password";
  await execFile("docker", ["run", "--detach", "--rm", "--name", container, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
  const { stdout } = await execFile("docker", ["port", container, "5432/tcp"]);
  const port = stdout.trim().match(/:(\d+)$/)?.[1];
  assert.ok(port);
  const postgres = (await import("postgres")).default;
  client = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
  await waitForConnection();
  await client.unsafe(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE TABLE app_schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE users (id text PRIMARY KEY);
    CREATE TABLE ontology_concepts (id text PRIMARY KEY);
    CREATE TABLE question_attempts (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id));
    INSERT INTO users VALUES ('user-1'), ('user-2');
    INSERT INTO ontology_concepts VALUES ('concept-a');
    INSERT INTO question_attempts VALUES ('attempt-1', 'user-1'), ('attempt-rollback', 'user-1');`);
  await client.unsafe(await readFile("db/postgres/migrations/0015_evidence_projection_foundation.sql", "utf8"));
  const repository = new EvidenceProjectionRepository(makeProvider());
  const [candidate] = await buildEvidenceCandidates(source());
  assert.equal(await repository.project(candidate), "NEW_SUCCESS");
  assert.equal(await repository.project(candidate), "EXACT_REPLAY");
  const [corrected] = await buildEvidenceCandidates(source({ sourceRevisionIdentity: "revision-2", resultSummary: { correct: false, score: 0 } }));
  assert.equal(await repository.project(corrected), "NEW_SUCCESS");
  assert.equal(await repository.invalidateSource({ sourceType: "QUESTION_ATTEMPT", sourceEventId: "attempt-1", sourceRevisionIdentity: "revision-3", reasonCode: "INVALIDATED" }), "NEW_SUCCESS");
  const [rollback] = await buildEvidenceCandidates(source({ sourceEventId: "attempt-rollback", sourceRevisionIdentity: "rollback" }));
  await assert.rejects(new EvidenceProjectionRepository(makeProvider(true)).project(rollback));
  const rows = await client.unsafe("SELECT count(*) AS count FROM evidence_projections WHERE source_event_id = 'attempt-rollback'");
  assert.equal(Number(rows[0].count), 0);
  const policies = await client.unsafe("SELECT c.relrowsecurity, c.relforcerowsecurity FROM pg_class c WHERE c.relname IN ('evidence_projections', 'evidence_recompute_requests')");
  assert.equal(policies.length, 2);
  assert.equal(policies.every((row) => row.relrowsecurity && row.relforcerowsecurity), true);
});

function makeProvider(fail = false) {
  return new PostgresDatabaseProvider({
    query: async (query, parameters) => { const rows = await client.unsafe(query, parameters); return { rows, rowCount: rows.count ?? rows.length }; },
    transaction: async (callback) => client.begin(async (tx) => callback({ query: async (query, parameters) => { if (fail) throw new Error("injected rollback"); const rows = await tx.unsafe(query, parameters); return { rows, rowCount: rows.count ?? rows.length }; } })),
  });
}
function source(overrides = {}) { return { sourceType: "QUESTION_ATTEMPT", sourceEventId: "attempt-1", sourceRevisionIdentity: "revision-1", userId: "user-1", contentVersionIdentity: "question-version-1", conceptMappingSetHash: "a".repeat(64), conceptIds: ["concept-a"], occurredAt: "2026-08-21T00:00:00.000Z", validity: "ELIGIBLE", evidenceType: "PERFORMANCE_RESULT", quality: "DIRECT_PERFORMANCE", resultSummary: { correct: true, score: 100 }, sourceSemanticHash: "b".repeat(64), ...overrides }; }
async function waitForConnection() { for (let i = 0; i < 40; i += 1) { try { await client`SELECT 1`; return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); } } throw new Error("PostgreSQL unavailable"); }
