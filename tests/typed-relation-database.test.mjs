import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const migrationPaths = [
  "drizzle/0045_occupational_role_foundation.sql",
  "drizzle/0046_occupational_role_identity_hardening.sql",
  "drizzle/0047_occupational_role_alias_hardening.sql",
  "drizzle/0050_skill_foundation.sql",
  "drizzle/0051_typed_role_skill_concept_relations.sql",
];

async function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON; CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL); CREATE TABLE ontology_concepts (id TEXT PRIMARY KEY NOT NULL);");
  for (const path of migrationPaths) {
    const sql = (await readFile(path, "utf8")).replaceAll("--> statement-breakpoint", "");
    database.exec(sql);
  }
  database.prepare("INSERT INTO occupational_roles (id, role_key, label) VALUES (?, ?, ?)").run("role-1", "role:security:appsec-engineer", "Application Security Engineer");
  database.prepare("INSERT INTO skills (id, skill_key, label, source_type, provenance_json) VALUES (?, ?, ?, ?, ?)").run("skill-1", "skill:security:secure-code-review", "Secure Code Review", "TEST", '{"fixture":true}');
  database.prepare("INSERT INTO ontology_concepts (id) VALUES (?)").run("concept-1");
  return database;
}

test("D1 stores typed directed relations with canonical endpoint FKs", async () => {
  const db = await createDatabase();
  db.prepare("INSERT INTO role_skill_relations (id, role_id, skill_id, provenance_json) VALUES (?, ?, ?, ?)").run("rs-1", "role-1", "skill-1", '{"review":"wave-b"}');
  db.prepare("INSERT INTO skill_concept_relations (id, skill_id, concept_id, provenance_json) VALUES (?, ?, ?, ?)").run("sc-1", "skill-1", "concept-1", '{"review":"wave-b"}');
  assert.deepEqual({ ...db.prepare("SELECT relation_type, relation_version, status FROM role_skill_relations").get() }, { relation_type: "ROLE_REQUIRES_SKILL", relation_version: 1, status: "DRAFT" });
  assert.deepEqual({ ...db.prepare("SELECT relation_type, relation_version, status FROM skill_concept_relations").get() }, { relation_type: "SKILL_REQUIRES_CONCEPT", relation_version: 1, status: "DRAFT" });
  assert.equal(db.prepare("SELECT count(*) AS count FROM skills JOIN role_skill_relations ON role_skill_relations.skill_id = skills.id WHERE role_skill_relations.role_id = ?").get("role-1").count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM skill_concept_relations JOIN ontology_concepts ON ontology_concepts.id = skill_concept_relations.concept_id WHERE skill_concept_relations.skill_id = ?").get("skill-1").count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM role_skill_relations WHERE skill_id = ?").get("skill-1").count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM skill_concept_relations WHERE concept_id = ?").get("concept-1").count, 1);
  db.close();
});

test("D1 rejects arbitrary relation types, duplicate edges, missing endpoints, and unreviewed ACTIVE edges", async () => {
  const db = await createDatabase();
  const insertRoleSkill = (id, type = "ROLE_REQUIRES_SKILL", roleId = "role-1", skillId = "skill-1", status = "DRAFT") => db.prepare(
    "INSERT INTO role_skill_relations (id, role_id, skill_id, relation_type, status, provenance_json) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, roleId, skillId, type, status, '{"fixture":true}');
  insertRoleSkill("rs-1");
  assert.throws(() => insertRoleSkill("rs-bad-type", "RELATED_TO"), /CHECK constraint failed/i);
  assert.throws(() => insertRoleSkill("rs-duplicate"), /UNIQUE constraint failed/i);
  assert.throws(() => insertRoleSkill("rs-missing-role", "ROLE_REQUIRES_SKILL", "missing", "skill-1"), /FOREIGN KEY constraint failed/i);
  assert.throws(() => insertRoleSkill("rs-active", "ROLE_REQUIRES_SKILL", "role-1", "skill-1", "ACTIVE"), /CHECK constraint failed/i);
  assert.throws(() => db.prepare("DELETE FROM skills WHERE id = ?").run("skill-1"), /FOREIGN KEY constraint failed/i);
  assert.throws(() => db.prepare("DELETE FROM occupational_roles WHERE id = ?").run("role-1"), /FOREIGN KEY constraint failed/i);
  db.prepare("INSERT INTO skill_concept_relations (id, skill_id, concept_id, provenance_json) VALUES (?, ?, ?, ?)").run("sc-1", "skill-1", "concept-1", '{"fixture":true}');
  assert.throws(() => db.prepare("INSERT INTO skill_concept_relations (id, skill_id, concept_id, provenance_json) VALUES (?, ?, ?, ?)").run("sc-missing", "skill-1", "missing", '{"fixture":true}'), /FOREIGN KEY constraint failed/i);
  assert.throws(() => db.prepare("INSERT INTO skill_concept_relations (id, skill_id, concept_id, provenance_json) VALUES (?, ?, ?, ?)").run("sc-duplicate", "skill-1", "concept-1", '{"fixture":true}'), /UNIQUE constraint failed/i);
  db.close();
});
