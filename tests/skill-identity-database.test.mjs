import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

async function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON; CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL);");
  const sql = await readFile("drizzle/0050_skill_foundation.sql", "utf8");
  database.exec(sql.replaceAll("--> statement-breakpoint", ""));
  return database;
}
function insertSkill(database, id, key = `skill:security:${id}`, label = id) {
  database.prepare("INSERT INTO skills (id, skill_key, label, source_type, provenance_json) VALUES (?, ?, ?, ?, ?)").run(id, key, label, "TEST", '{"fixture":true}');
}
test("D1 Skill schema enforces identity, lifecycle, provenance, alias uniqueness, and key immutability", async () => {
  const db = await createDatabase();
  insertSkill(db, "skill-1");
  assert.throws(() => insertSkill(db, "bad", "Secure Code Review"), /constraint failed/i);
  db.prepare("INSERT INTO skill_aliases (id, skill_id, alias, normalized_alias) VALUES (?, ?, ?, ?)").run("alias-1", "skill-1", "secure code review", "secure code review");
  assert.throws(() => db.prepare("INSERT INTO skill_aliases (id, skill_id, alias, normalized_alias) VALUES (?, ?, ?, ?)").run("alias-2", "skill-1", "secure code review", "secure code review"), /UNIQUE constraint failed/i);
  assert.throws(() => db.prepare("UPDATE skills SET skill_key = ? WHERE id = ?").run("skill:security:changed", "skill-1"), /immutable/i);
  db.prepare("UPDATE skills SET label = ? WHERE id = ?").run("Secure Code Review (Updated)", "skill-1");
  db.close();
});
test("D1 Skill aliases reject noncanonical, orphan, and cross-skill collisions", async () => {
  const db = await createDatabase();
  insertSkill(db, "skill-1"); insertSkill(db, "skill-2");
  const add = (id, skillId, alias, normalized = alias) => db.prepare("INSERT INTO skill_aliases (id, skill_id, alias, normalized_alias) VALUES (?, ?, ?, ?)").run(id, skillId, alias, normalized);
  add("alias-1", "skill-1", "secure code review", "secure code review");
  assert.throws(() => add("alias-2", "skill-2", "secure code review", "secure code review"), /UNIQUE constraint failed/i);
  assert.throws(() => add("alias-bad", "skill-2", " Secure Code Review", "secure code review"), /constraint failed/i);
  assert.throws(() => add("alias-orphan", "missing", "other skill", "other skill"), /FOREIGN KEY constraint failed/i);
  db.close();
});
