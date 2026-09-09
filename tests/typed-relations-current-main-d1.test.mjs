import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const migration = (await readFile("drizzle/0041_typed_relations_wave_b_current_main.sql", "utf8")).replaceAll("--> statement-breakpoint", "");

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON; CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL); CREATE TABLE ontology_concepts (id TEXT PRIMARY KEY NOT NULL);");
  db.exec(migration);
  db.exec("INSERT INTO occupational_roles (id, role_key, label) VALUES ('role-1', 'role:security:appsec-engineer', 'Application Security Engineer'); INSERT INTO skills (id, skill_key, label, source_type, provenance_json) VALUES ('skill-1', 'skill:security:secure-code-review', 'Secure Code Review', 'TEST', '{\"fixture\":true}'); INSERT INTO ontology_concepts (id) VALUES ('concept-1');");
  return db;
}

test("D1 stores both typed relation families without seed rows", () => {
  const db = database();
  db.prepare("INSERT INTO role_skill_relations (id, role_id, skill_id, provenance_json) VALUES (?, ?, ?, ?)").run("rs-1", "role-1", "skill-1", '{"review":"current-main"}');
  db.prepare("INSERT INTO skill_concept_relations (id, skill_id, concept_id, provenance_json) VALUES (?, ?, ?, ?)").run("sc-1", "skill-1", "concept-1", '{"review":"current-main"}');
  assert.equal(db.prepare("SELECT relation_type FROM role_skill_relations").get().relation_type, "ROLE_REQUIRES_SKILL");
  assert.equal(db.prepare("SELECT relation_type FROM skill_concept_relations").get().relation_type, "SKILL_REQUIRES_CONCEPT");
  db.close();
});

test("D1 rejects unknown endpoints, wrong relation types, and semantic duplicates", () => {
  const db = database();
  const insert = (id, role = "role-1", skill = "skill-1", type = "ROLE_REQUIRES_SKILL") => db.prepare("INSERT INTO role_skill_relations (id, role_id, skill_id, relation_type, provenance_json) VALUES (?, ?, ?, ?, ?)").run(id, role, skill, type, '{"fixture":true}');
  insert("rs-1");
  assert.throws(() => insert("rs-duplicate"), /UNIQUE constraint failed/i);
  assert.throws(() => insert("rs-unknown-role", "missing"), /FOREIGN KEY constraint failed/i);
  assert.throws(() => insert("rs-wrong-type", "role-1", "skill-1", "RELATED_TO"), /CHECK constraint failed/i);
  assert.throws(() => db.prepare("INSERT INTO skill_concept_relations (id, skill_id, concept_id, provenance_json) VALUES (?, ?, ?, ?)").run("sc-unknown", "skill-1", "missing", '{"fixture":true}'), /FOREIGN KEY constraint failed/i);
  db.close();
});

test("D1 restrictive endpoint deletion preserves governed relation history", () => {
  const db = database();
  db.prepare("INSERT INTO role_skill_relations (id, role_id, skill_id, provenance_json) VALUES (?, ?, ?, ?)").run("rs-1", "role-1", "skill-1", '{"fixture":true}');
  assert.throws(() => db.prepare("DELETE FROM occupational_roles WHERE id = ?").run("role-1"), /FOREIGN KEY constraint failed/i);
  assert.throws(() => db.prepare("DELETE FROM skills WHERE id = ?").run("skill-1"), /FOREIGN KEY constraint failed/i);
  assert.equal(db.prepare("SELECT count(*) AS count FROM role_skill_relations").get().count, 1);
  db.prepare("DELETE FROM role_skill_relations WHERE id = ?").run("rs-1");
  assert.equal(db.prepare("SELECT count(*) AS count FROM role_skill_relations").get().count, 0);
  db.close();
});

test("D1 role aliases follow the approved dependent CASCADE lifecycle", () => {
  const db = database();
  db.prepare("INSERT INTO occupational_role_aliases (id, role_id, alias, normalized_alias) VALUES (?, ?, ?, ?)").run("alias-1", "role-1", "application security engineer", "application security engineer");
  db.prepare("DELETE FROM occupational_roles WHERE id = ?").run("role-1");
  assert.equal(db.prepare("SELECT count(*) AS count FROM occupational_role_aliases").get().count, 0);
  db.close();
});
