import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { EvidenceProjectionRepository } from "../db/evidence-projection-repository.ts";
import { buildEvidenceCandidates } from "../lib/services/evidence-projection.ts";

const A = "a".repeat(64);
const B = "b".repeat(64);
let miniflare;
let database;
let provider;
let repository;

before(async () => {
  miniflare = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-05-15", d1Databases: { DB: "evidence-pr-b" } });
  database = await miniflare.getD1Database("DB");
  await exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users (id text PRIMARY KEY);
    CREATE TABLE ontology_concepts (id text PRIMARY KEY);
    CREATE TABLE question_attempts (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id));
    INSERT INTO users VALUES ('user-1'), ('user-2');
    INSERT INTO ontology_concepts VALUES ('concept-a'), ('concept-b');
    INSERT INTO question_attempts VALUES ('attempt-1', 'user-1');`);
  await applyMigration(await readFile("drizzle/0027_evidence_projection_foundation.sql", "utf8"));
  provider = new D1DatabaseProvider(database);
  repository = new EvidenceProjectionRepository(provider);
});

after(async () => miniflare?.dispose());

test("D1 projection NEW_SUCCESS, EXACT_REPLAY, and durable Mastery handoff", async () => {
  const [candidate] = await buildEvidenceCandidates(source());
  assert.equal(await repository.project(candidate), "NEW_SUCCESS");
  assert.equal(await repository.project(candidate), "EXACT_REPLAY");
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections"), 1);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_recompute_requests WHERE request_type = 'MASTERY_RECOMPUTE_REQUIRED'"), 1);
});

test("D1 semantic conflict fails closed without overwrite", async () => {
  const [conflict] = await buildEvidenceCandidates(source({ resultSummary: { correct: false, score: 0 } }));
  assert.equal(await repository.project(conflict), "CONFLICT");
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections"), 1);
});

test("D1 wrong-user source reference fails closed", async () => {
  const [candidate] = await buildEvidenceCandidates(source({ userId: "user-2", sourceRevisionIdentity: "wrong-owner" }));
  await assert.rejects(repository.project(candidate), hasCode("EVIDENCE_SOURCE_NOT_FOUND_OR_FORBIDDEN"));
});

test("D1 correction supersedes prior active Evidence and replay is stable", async () => {
  const [corrected] = await buildEvidenceCandidates(source({ sourceRevisionIdentity: "revision-2", resultSummary: { correct: false, score: 0 } }));
  assert.equal(await repository.project(corrected), "NEW_SUCCESS");
  assert.equal(await repository.project(corrected), "EXACT_REPLAY");
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE lifecycle = 'SUPERSEDED'"), 1);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE lifecycle = 'ACTIVE'"), 1);
});

test("D1 source invalidation retires active Evidence and is idempotent", async () => {
  assert.equal(await repository.invalidateSource({ sourceType: "QUESTION_ATTEMPT", sourceEventId: "attempt-1", sourceRevisionIdentity: "revision-3", reasonCode: "INVALIDATED_TEST" }), "NEW_SUCCESS");
  assert.equal(await repository.invalidateSource({ sourceType: "QUESTION_ATTEMPT", sourceEventId: "attempt-1", sourceRevisionIdentity: "revision-3", reasonCode: "INVALIDATED_TEST" }), "EXACT_REPLAY");
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE lifecycle = 'ACTIVE'"), 0);
});

test("D1 transaction failure rolls back Evidence and recompute state", async () => {
  const [candidate] = await buildEvidenceCandidates(source({ sourceEventId: "attempt-rollback", sourceRevisionIdentity: "rollback" }));
  await exec("INSERT INTO question_attempts VALUES ('attempt-rollback', 'user-1')");
  const failing = new EvidenceProjectionRepository({
    ...provider,
    kind: provider.kind,
    query: provider.query.bind(provider), queryOne: provider.queryOne.bind(provider), execute: provider.execute.bind(provider), healthCheck: provider.healthCheck.bind(provider),
    transaction: async (statements) => provider.transaction([...statements, { sql: "INSERT INTO missing_table VALUES (?)", parameters: ["fail"] }]),
  });
  await assert.rejects(failing.project(candidate));
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_event_id = 'attempt-rollback'"), 0);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_recompute_requests WHERE source_event_id = 'attempt-rollback'"), 0);
});

test("D1 concurrent identical candidates produce one row and replay-safe outcomes", async () => {
  await exec("INSERT INTO question_attempts VALUES ('attempt-concurrent', 'user-1')");
  const [candidate] = await buildEvidenceCandidates(source({ sourceEventId: "attempt-concurrent", sourceRevisionIdentity: "concurrent" }));
  const outcomes = await Promise.all([repository.project(candidate), repository.project(candidate)]);
  assert.equal(outcomes.includes("NEW_SUCCESS"), true);
  assert.equal(outcomes.every((value) => value === "NEW_SUCCESS" || value === "EXACT_REPLAY"), true);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_event_id = 'attempt-concurrent'"), 1);
});

function source(overrides = {}) {
  return { sourceType: "QUESTION_ATTEMPT", sourceEventId: "attempt-1", sourceRevisionIdentity: "revision-1", userId: "user-1", contentVersionIdentity: "question-version-1", conceptMappingSetHash: A, conceptIds: ["concept-a"], occurredAt: "2026-08-21T00:00:00.000Z", validity: "ELIGIBLE", evidenceType: "PERFORMANCE_RESULT", quality: "DIRECT_PERFORMANCE", resultSummary: { correct: true, score: 100 }, sourceSemanticHash: B, ...overrides };
}

async function applyMigration(sql) {
  for (const statement of sql.split(/--> statement-breakpoint\s*/).map((item) => item.trim()).filter(Boolean)) await exec(statement);
}
async function exec(sql) { return database.prepare(sql).run(); }
async function scalar(sql) { const row = await database.prepare(sql).first(); return Number(row.value); }
function hasCode(code) { return (error) => Boolean(error && typeof error === "object" && "code" in error && error.code === code); }
