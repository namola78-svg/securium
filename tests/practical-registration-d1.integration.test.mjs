import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { registerGovernedPracticalVersion } from "../lib/practical/practical-registration.ts";

const manifestPath = "reports/content-audit/governed-practical-registration-manifest-2026-09-08.json";
let miniflare;
let database;
let provider;
let manifest;

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "governed-practical-registration" },
  });
  database = await miniflare.getD1Database("DB");
  for (const name of await migrationNames()) {
    const sql = await readFile(`drizzle/${name}`, "utf8");
    const d1Sql = adaptMigrationForD1(sql, name);
    const statements = d1Sql.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
    for (let index = 0; index < statements.length; index += 50) {
      await database.batch(statements.slice(index, index + 50).map((statement) => database.prepare(statement)));
    }
  }
  await database.batch([
    database.prepare(`INSERT INTO ontology_concepts
      (id, concept_key, namespace, label, normalized_label, category, description, source_type, source_id, weight, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("oc-digital-forensics", "ontology:security-certification:디지털-포렌식", "security-certification", "디지털 포렌식", "디지털 포렌식", "system-security", "approved Dataset B fixture", "CANONICAL_MANIFEST", "50e2ade70519bc23efcdd417b2e04883b6016bf969e96b45393014467aef35f1", 20, "ACTIVE"),
    database.prepare(`INSERT INTO ontology_aliases
      (id, concept_id, alias, normalized_alias, language, source)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind("oa-digital-forensics", "oc-digital-forensics", "Digital Forensics", "digital forensics", "en", "canonical-manifest:50e2ade70519bc23efcdd417b2e04883b6016bf969e96b45393014467aef35f1"),
  ]);
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  provider = new D1DatabaseProvider(database);
});

after(async () => {
  await miniflare?.dispose();
});

test("approved Digital Forensics practicals register and replay idempotently in disposable D1", async () => {
  const firstResults = [];
  for (const registration of manifest.registrations) {
    firstResults.push(await registerGovernedPracticalVersion(provider, registration));
  }
  assert.equal(firstResults.length, 8);
  assert.equal(firstResults.filter((result) => result.outcome === "NEW_SUCCESS").length, 8);
  assert.equal(firstResults.every((result) => result.resolvedConcepts.length === 1), true);
  assert.equal(firstResults.every((result) => result.resolvedConcepts[0].id === "oc-digital-forensics"), true);

  const replayResults = [];
  for (const registration of manifest.registrations) {
    replayResults.push(await registerGovernedPracticalVersion(provider, registration));
  }
  assert.equal(replayResults.filter((result) => result.outcome === "EXACT_REPLAY").length, 8);

  assert.equal(await scalar("SELECT count(*) AS value FROM canonical_practicals"), 8);
  assert.equal(await scalar("SELECT count(*) AS value FROM practical_governance_versions"), 8);
  assert.equal(await scalar("SELECT count(*) AS value FROM practical_version_concept_bindings"), 8);
  assert.equal(await scalar("SELECT count(DISTINCT practical_id) AS value FROM practical_governance_versions"), 8);
  assert.equal(await scalar("SELECT count(DISTINCT practical_version_id) AS value FROM practical_version_concept_bindings"), 8);
  assert.equal(await scalar("SELECT count(*) AS value FROM practical_version_concept_bindings WHERE concept_id <> 'oc-digital-forensics'"), 0);
  assert.equal(await scalar("SELECT count(*) AS value FROM ontology_concepts"), 1);
  assert.equal(await scalar("SELECT count(*) AS value FROM ontology_aliases"), 1);
});

async function migrationNames() {
  return (await readdir("drizzle"))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

function adaptMigrationForD1(sql, migrationName) {
  const source = String(sql).trim();
  const prefix = /^PRAGMA\s+foreign_keys\s*=\s*OFF\s*;\s*BEGIN\s+TRANSACTION\s*;\s*/i;
  const suffix = /\s*COMMIT\s*;\s*PRAGMA\s+foreign_keys\s*=\s*ON\s*;\s*$/i;
  const hasOuterPrefix = prefix.test(source);
  const hasOuterSuffix = suffix.test(source);
  const startsWithUnsupportedTransaction = /^\s*(?:BEGIN(?:\s+TRANSACTION)?|START\s+TRANSACTION)\s*;/i.test(source);
  if (!hasOuterPrefix && !hasOuterSuffix && !startsWithUnsupportedTransaction) return source;
  if (!hasOuterPrefix || !hasOuterSuffix) {
    throw new Error(`UNSUPPORTED_D1_TRANSACTION_WRAPPER:${migrationName}`);
  }
  return source.replace(prefix, "PRAGMA foreign_keys=OFF;\n").replace(suffix, "\nPRAGMA foreign_keys=ON;");
}

test("D1 migration adapter removes only the governed outer wrapper", async () => {
  const source = await readFile("drizzle/0040_generic_review_currentness_domain.sql", "utf8");
  const adapted = adaptMigrationForD1(source, "0040_generic_review_currentness_domain.sql");
  assert.doesNotMatch(adapted, /^PRAGMA\s+foreign_keys\s*=\s*OFF\s*;\s*BEGIN\s+TRANSACTION\s*;/i);
  assert.doesNotMatch(adapted, /COMMIT\s*;\s*PRAGMA\s+foreign_keys\s*=\s*ON\s*;\s*$/i);
  assert.match(adapted, /CREATE TRIGGER `content_review_judgments_no_update`[\s\S]*BEGIN SELECT RAISE\(ABORT/);
  assert.equal(adaptMigrationForD1("CREATE TRIGGER x BEFORE INSERT ON t BEGIN SELECT 1; END;", "trigger-fixture"), "CREATE TRIGGER x BEFORE INSERT ON t BEGIN SELECT 1; END;");
  assert.throws(() => adaptMigrationForD1("BEGIN TRANSACTION; SELECT 1;", "unsupported.sql"), /UNSUPPORTED_D1_TRANSACTION_WRAPPER/);
});

async function scalar(sql) {
  const row = await database.prepare(sql).first();
  return Number(row?.value ?? 0);
}
