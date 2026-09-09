import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import { resolveSkillFromDatabaseUsing } from "../db/skill-repository-query.ts";

const migration = (await readFile("drizzle/0041_typed_relations_wave_b_current_main.sql", "utf8"))
  .split(/--> statement-breakpoint\s*/)
  .map((statement) => statement.trim())
  .filter(Boolean);

let miniflare;
let database;
let db;

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "skill-authority-repository" },
  });
  database = await miniflare.getD1Database("DB");
  await execute("PRAGMA foreign_keys = ON");
  await execute("CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL)");
  await execute("CREATE TABLE ontology_concepts (id TEXT PRIMARY KEY NOT NULL)");
  for (const statement of migration) await execute(statement);
  await execute("INSERT INTO skills (id, skill_key, label, source_type, provenance_json) VALUES ('skill-a', 'skill:security:secure-code-review', 'Secure Code Review', 'TEST', '{\"fixture\":true}'), ('skill-b', 'skill:security:vulnerability-assessment', 'Vulnerability Assessment', 'TEST', '{\"fixture\":true}')");
  await execute("INSERT INTO skill_aliases (id, skill_id, alias, normalized_alias) VALUES ('alias-a', 'skill-a', 'secure code review', 'secure code review'), ('alias-b', 'skill-b', 'vulnerability assessment', 'vulnerability assessment')");
  db = drizzle(database, { schema });
});

after(async () => miniflare?.dispose());

test("repository alias lookup uses an explicit join and returns its canonical Skill", async () => {
  const result = await resolveSkillFromDatabaseUsing(db, { alias: " Secure   Code Review " });
  assert.equal(result.status, "RESOLVED");
  if (result.status === "RESOLVED") assert.equal(result.skill.id, "skill-a");
});

test("repository identity conflicts fail closed", async () => {
  const cases = [
    { id: "skill-a", skillKey: "skill:security:vulnerability-assessment" },
    { skillKey: "skill:security:secure-code-review", alias: "vulnerability assessment" },
    { id: "skill-a", alias: "vulnerability assessment" },
    { id: "skill-a", skillKey: "skill:security:secure-code-review", alias: "vulnerability assessment" },
    { id: "skill-a", skillKey: "skill:security:missing" },
  ];
  for (const reference of cases) {
    const result = await resolveSkillFromDatabaseUsing(db, reference);
    assert.notEqual(result.status, "RESOLVED", JSON.stringify(reference));
  }
});

test("repository ambiguous aliases fail closed", async () => {
  await execute("DROP INDEX skill_aliases_normalized_unique");
  await execute("INSERT INTO skill_aliases (id, skill_id, alias, normalized_alias) VALUES ('alias-conflict', 'skill-b', 'secure code review', 'secure code review')");
  const result = await resolveSkillFromDatabaseUsing(db, { alias: "secure code review" });
  assert.equal(result.status, "AMBIGUOUS");
  if (result.status === "AMBIGUOUS") assert.deepEqual(result.candidateIds, ["skill-a", "skill-b"]);
});

async function execute(sql) {
  return database.prepare(sql).run();
}
