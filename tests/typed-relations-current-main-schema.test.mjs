import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [schema, postgres, d1, journal] = await Promise.all([
  read("db/schema.ts"),
  read("db/postgres/migrations/0048_typed_relations_wave_b_current_main.sql"),
  read("drizzle/0041_typed_relations_wave_b_current_main.sql"),
  read("drizzle/meta/_journal.json"),
]);

test("current-main reauthor keeps RBAC and occupational Role authorities separate", () => {
  assert.match(schema, /export const roles = sqliteTable\("roles"/);
  assert.match(schema, /export const occupationalRoles = sqliteTable\(\s*"occupational_roles"/);
  assert.match(schema, /export const occupationalRoleAliases = sqliteTable\(\s*"occupational_role_aliases"/);
  assert.doesNotMatch(schema, /user_skill_state|learner_twin/);
});

test("Skill and typed relations use the existing canonical Concept table", () => {
  assert.match(schema, /export const skills = sqliteTable\(\s*"skills"/);
  assert.match(schema, /export const skillAliases = sqliteTable\(\s*"skill_aliases"/);
  assert.match(schema, /export const roleSkillRelations = sqliteTable\(\s*"role_skill_relations"/);
  assert.match(schema, /export const skillConceptRelations = sqliteTable\(\s*"skill_concept_relations"/);
  assert.match(schema, /references\(\(\) => ontologyConcepts\.id, \{ onDelete: "restrict" \}\)/);
  assert.doesNotMatch(postgres, /CREATE TABLE public\."concepts"/);
  assert.doesNotMatch(d1, /CREATE TABLE `concepts`/);
});

test("provider schemas preserve alias CASCADE and all six relation FK RESTRICT policies", () => {
  assert.match(schema, /roleId: text\("role_id"\)[\s\S]*onDelete: "cascade"/);
  assert.equal((postgres.match(/ON DELETE RESTRICT/g) ?? []).length >= 6, true);
  assert.match(postgres, /"role_id" text NOT NULL REFERENCES public\."occupational_roles"\("id"\) ON UPDATE NO ACTION ON DELETE RESTRICT/);
  assert.match(postgres, /"concept_id" text NOT NULL REFERENCES public\."ontology_concepts"\("id"\) ON UPDATE NO ACTION ON DELETE RESTRICT/);
  assert.match(d1, /ON DELETE cascade/);
  assert.equal((d1.match(/ON DELETE restrict/g) ?? []).length >= 6, true);
});

test("current-main Drizzle lineage uses the next current-main tag rather than old 0050/0051 tags", () => {
  assert.match(journal, /0041_typed_relations_wave_b_current_main/);
  assert.doesNotMatch(journal, /0052_typed_relations_wave_b_current_main/);
  assert.doesNotMatch(journal, /0050_|0051_/);
  assert.doesNotMatch(journal, /0050_|0051_/);
  assert.doesNotMatch(journal, /0050_|0051_/);
  assert.doesNotMatch(journal, /0050_skill_foundation|0051_typed_role_skill_concept_relations/);
});
