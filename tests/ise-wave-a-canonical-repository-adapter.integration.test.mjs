import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories } from "../lib/services/ise-wave-a-canonical-repository-adapter.ts";

let miniflare;
let database;

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "ise-wave-a-adapter-integration" },
  });
  database = await miniflare.getD1Database("DB");
  const migrations = (await readdir("drizzle"))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name) && Number(name.slice(0, 4)) < 23)
    .sort();
  for (const name of migrations) {
    const sql = await readFile(`drizzle/${name}`, "utf8");
    const statements = sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
    for (let index = 0; index < statements.length; index += 50) {
      await database.batch(statements.slice(index, index + 50).map((statement) => database.prepare(statement)));
    }
  }
  const factMigration = await readFile("drizzle/0023_canonical_fact_foundation.sql", "utf8");
  for (const statement of factMigration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
    await database.batch([database.prepare(statement)]);
  }
  await database.batch([
    database.prepare("PRAGMA foreign_keys = ON"),
    database.prepare("INSERT INTO users (id, email, display_name, status) VALUES ('ise-adapter-user', 'ise-adapter@example.invalid', 'ISE Adapter', 'ACTIVE')"),
    database.prepare("INSERT INTO course_groups (id, code, name, description, display_order, active, is_sample) VALUES ('ise-adapter-group', 'ISE_ADAPTER', 'ISE Adapter', '', 1, 1, 1)"),
    database.prepare("INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description, total_levels, passing_score, difficulty, active, published, display_order, is_sample) VALUES ('course-ise', 'ise-adapter-group', 'ISE', 'information-security-engineer', 'ISE', 'ISE', '', 1, 60, 'INTERMEDIATE', 1, 1, 1, 0)"),
    database.prepare("INSERT INTO source_identities (id, canonical_key, source_type, canonical_label, normalized_identity, publisher, jurisdiction, lifecycle_state, created_by) VALUES ('ise-adapter-source', 'cq-ise-scope', 'OFFICIAL_SCOPE_REFERENCE', 'CQ scope', 'https://www.cq.or.kr/qh_quagm01_020.do', 'CQ', 'KR', 'ACTIVE', 'ise-adapter-user')"),
  ]);
});

after(async () => {
  await miniflare?.dispose();
});

test("concrete D1 repository adapter resolves canonical course and source rows", async () => {
  const state = await buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories(new D1DatabaseProvider(database));
  assert.equal(state.qualification, "course-ise");
  assert.equal(state.readiness, "CANONICAL_REVISION_PROVENANCE_READY_FOR_REVIEW");
  assert.deepEqual(state.revisions.map((revision) => revision.provenance.sourceBindings[0].sourceIdentityId), [
    "ise-adapter-source",
    "ise-adapter-source",
  ]);
});
