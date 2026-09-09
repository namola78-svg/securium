import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [schema, d1, postgres, d1Hardening, postgresHardening, roleService, roleRepository] = await Promise.all([
  read("db/schema.ts"),
  read("drizzle/0045_occupational_role_foundation.sql"),
  read("db/postgres/migrations/0034_occupational_role_foundation.sql"),
  read("drizzle/0047_occupational_role_alias_hardening.sql"),
  read("db/postgres/migrations/0036_occupational_role_alias_hardening.sql"),
  read("lib/services/occupational-role-authority.ts"),
  read("db/occupational-role-repositories.ts"),
]);

test("Occupational Role uses dedicated canonical tables and preserves RBAC separation", () => {
  assert.match(schema, /export const roles = sqliteTable\("roles"/);
  assert.match(schema, /export const occupationalRoles = sqliteTable\(\s*"occupational_roles"/);
  assert.match(schema, /export const occupationalRoleAliases = sqliteTable\(\s*"occupational_role_aliases"/);
  assert.doesNotMatch(roleRepository, /from\("\.\/schema"\)[\s\S]*\broles\b/);
  assert.match(roleService, /AUTHORIZATION_ROLE != OCCUPATIONAL_ROLE/);
});

test("D1 and PostgreSQL Role schemas have equivalent bounded identity and lifecycle contracts", () => {
  for (const sql of [d1, postgres]) {
    assert.match(sql, /occupational_roles/);
    assert.match(sql, /occupational_role_aliases/);
    assert.match(sql, /role_key/);
    assert.match(sql, /occupational_roles_key_unique/);
    assert.match(sql, /occupational_roles_status_check/);
    assert.match(sql, /occupational_roles_active_review_check/);
    assert.match(sql, /review_evidence_json/);
    assert.doesNotMatch(sql, /skill|certification|user_roles/i);
  }
  assert.match(postgres, /REVOKE ALL PRIVILEGES ON TABLE public\."occupational_roles"/);
  assert.match(postgres, /ENABLE ROW LEVEL SECURITY/);
  assert.match(postgres, /0034_occupational_role_foundation/);
});

test("Role alias hardening is global, printable-canonical, and forward-only", () => {
  assert.match(schema, /occupational_role_aliases_normalized_unique/);
  assert.match(schema, /NOT GLOB '\*\[\^ -~\]\*'/);
  assert.match(d1Hardening, /occupational_role_aliases_normalized_unique/);
  assert.match(d1Hardening, /NOT GLOB '\*\[\^ -~\]\*'/);
  assert.match(postgresHardening, /occupational_role_aliases_normalized_unique/);
  assert.match(postgresHardening, /\\\\x20-\\\\x7E/);
  assert.match(postgresHardening, /0036_occupational_role_alias_hardening/);
});

test("Wave B has only bounded typed Role-Skill-Concept relation authorities", () => {
  assert.match(schema, /roleSkillRelations = sqliteTable\(\s*"role_skill_relations"/);
  assert.match(schema, /skillConceptRelations = sqliteTable\(\s*"skill_concept_relations"/);
  assert.match(roleService, /roleToSkill: "ROLE_REQUIRES_SKILL"/);
  assert.match(roleService, /skillToConcept: "SKILL_REQUIRES_CONCEPT"/);
  assert.doesNotMatch(roleService, /user_role_state|skill_versions/);
  assert.doesNotMatch(roleRepository, /ontologyEdges|questionConcepts|contentRevisionConcepts/);
});
