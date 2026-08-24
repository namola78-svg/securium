import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { createRecomputeRequest, EvidenceProjectionRepository } from "../db/evidence-projection-repository.ts";

let miniflare;
let db;
let provider;
let repository;

before(async () => {
  miniflare = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-05-15", d1Databases: { DB: "e2a" } });
  db = await miniflare.getD1Database("DB");
  await exec("PRAGMA foreign_keys=ON; CREATE TABLE users (id text PRIMARY KEY); CREATE TABLE ontology_concepts (id text PRIMARY KEY, concept_key text NOT NULL, status text NOT NULL); INSERT INTO users VALUES ('u1'); INSERT INTO ontology_concepts VALUES ('c1', 'concept:c1', 'ACTIVE');");
  await apply("drizzle/0027_evidence_projection_foundation.sql");
  await exec("ALTER TABLE evidence_projections ADD COLUMN source_lineage_identity text");
  await exec("CREATE UNIQUE INDEX evidence_projections_active_lineage_unique ON evidence_projections (user_id, source_type, source_lineage_identity, evidence_type, concept_id, projection_version) WHERE lifecycle = 'ACTIVE'");
  await apply("drizzle/0031_evidence_e2_a_recompute_operations.sql");
  provider = new D1DatabaseProvider(db);
  repository = new EvidenceProjectionRepository(provider);
});

after(() => miniflare?.dispose());

test("E2-A claim, lease, checkpoint, token guard, and completion are atomic", async () => {
  const request = await enqueue("claim");
  const claimed = await repository.claimNext("USER", "worker-a");
  assert.equal(claimed?.id, request.id);
  assert.equal(claimed?.status, "PROCESSING");
  assert.equal(await repository.claimNext("USER", "worker-b"), null);
  assert.equal((await repository.updateCheckpoint(request.id, "wrong", "x")).affectedRows, 0);
  assert.equal((await repository.updateCheckpoint(request.id, claimed.claimToken, "cursor-1")).affectedRows, 1);
  assert.equal((await repository.completeClaim(request.id, "wrong")).affectedRows, 0);
  assert.equal((await repository.completeClaim(request.id, claimed.claimToken)).affectedRows, 1);
  assert.equal((await repository.completeClaim(request.id, claimed.claimToken)).affectedRows, 0);
});

test("E2-A retry ceiling and expired lease reclaim are bounded", async () => {
  const request = await enqueue("retry");
  let claimed = await repository.claimNext("USER", "worker-r");
  assert.ok(claimed);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const outcome = await repository.scheduleRetry(request.id, claimed.claimToken, "TRANSIENT_DB", 0, new Date("2026-08-24T00:00:00.000Z"));
    if (attempt < 5) {
      assert.equal(outcome.outcome, "RETRYABLE");
      await exec(`UPDATE evidence_recompute_requests SET next_attempt_at = '2020-01-01T00:00:00.000Z' WHERE id = '${request.id}'`);
      claimed = await repository.claimNext("USER", `worker-r-${attempt}`);
      assert.ok(claimed);
    } else {
      assert.equal(outcome.outcome, "FAILED");
    }
  }
});

test("E2-A cancellation and supersession are terminal lifecycle states", async () => {
  const cancelled = await enqueue("cancel");
  assert.equal((await repository.cancelRequest(cancelled.id)).affectedRows, 1);
  assert.equal((await repository.claimNext("USER", "worker-cancel"))?.id ?? null, null);
  const superseded = await enqueue("supersede");
  const successor = await enqueue("successor");
  assert.equal((await repository.supersedeRequest(superseded.id, successor.id)).affectedRows, 1);
  assert.equal((await repository.claimNext("USER", "worker-super"))?.id ?? null, successor.id);
});

async function enqueue(suffix) {
  const request = await createRecomputeRequest({ requestType: "EVIDENCE_RECOMPUTE_REQUIRED", scopeType: "USER", userId: "u1", projectionVersion: "EVIDENCE_V1", reasonCode: `E2A_${suffix}` });
  assert.equal(await repository.enqueue(request), "NEW_SUCCESS");
  return request;
}

async function exec(sql) { return db.prepare(sql).run(); }
async function apply(file) { const text = await readFile(file, "utf8"); for (const statement of text.split(/--> statement-breakpoint/).map((item) => item.trim()).filter(Boolean)) await exec(statement); }

