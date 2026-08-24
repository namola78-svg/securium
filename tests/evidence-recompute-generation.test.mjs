import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { EvidenceProjectionRepository } from "../db/evidence-projection-repository.ts";

let mf;
let db;
let repository;

before(async () => {
  mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-05-15", d1Databases: { DB: "generation" } });
  db = await mf.getD1Database("DB");
  await exec("PRAGMA foreign_keys=ON; CREATE TABLE users (id text PRIMARY KEY); CREATE TABLE ontology_concepts (id text PRIMARY KEY, concept_key text NOT NULL, status text NOT NULL);");
  await apply("drizzle/0027_evidence_projection_foundation.sql");
  await exec("ALTER TABLE evidence_projections ADD COLUMN source_lineage_identity text");
  await exec("CREATE UNIQUE INDEX evidence_projections_active_lineage_unique ON evidence_projections (user_id, source_type, source_lineage_identity, evidence_type, concept_id, projection_version) WHERE lifecycle = 'ACTIVE'");
  await apply("drizzle/0031_evidence_e2_a_recompute_operations.sql");
  repository = new EvidenceProjectionRepository(new D1DatabaseProvider(db));
});

after(() => mf?.dispose());

test("only a succeeded generation may become active", async () => {
  assert.equal(await repository.createGeneration({ id: "g1", mappingSnapshotHash: "a".repeat(64) }), "NEW_SUCCESS");
  assert.equal(await repository.cutoverGeneration("g1"), "CONFLICT");
  assert.equal((await repository.startGeneration("g1")).affectedRows, 1);
  assert.equal((await repository.completeGeneration("g1")).affectedRows, 1);
  assert.equal(await repository.cutoverGeneration("g1"), "NEW_SUCCESS");
  const row = await scalar("SELECT status || ':' || active value FROM evidence_rebuild_generations WHERE id = 'g1'");
  assert.equal(row, "SUCCEEDED:1");
});

test("generation cutover is idempotent and race-safe", async () => {
  await repository.createGeneration({ id: "g2", mappingSnapshotHash: "b".repeat(64) });
  await repository.startGeneration("g2");
  await repository.completeGeneration("g2");
  const results = await Promise.all([repository.cutoverGeneration("g2"), repository.cutoverGeneration("g2")]);
  assert.equal(results.every((value) => value === "NEW_SUCCESS" || value === "EXACT_REPLAY" || value === "CONFLICT"), true);
  assert.equal(Number(await scalar("SELECT count(*) value FROM evidence_rebuild_generations WHERE active = 1")), 1);
});

test("cancelled and superseded generations cannot cut over", async () => {
  await repository.createGeneration({ id: "g3", mappingSnapshotHash: "c".repeat(64) });
  assert.equal((await repository.cancelGeneration("g3")).affectedRows, 1);
  assert.equal(await repository.cutoverGeneration("g3"), "CONFLICT");
  await repository.createGeneration({ id: "g4", mappingSnapshotHash: "d".repeat(64) });
  assert.equal((await repository.supersedeGeneration("g4", "g5")).affectedRows, 1);
  assert.equal(await repository.cutoverGeneration("g4"), "CONFLICT");
});

async function exec(sql) { return db.prepare(sql).run(); }
async function scalar(sql) { const result = await db.prepare(sql).first(); return String(result?.value ?? ""); }
async function apply(file) { const text = await readFile(file, "utf8"); for (const statement of text.split(/--> statement-breakpoint/).map((item) => item.trim()).filter(Boolean)) await exec(statement); }

