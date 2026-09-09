import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [schema, d1, postgres, journal, repository] = await Promise.all([
  read("db/schema.ts"),
  read("drizzle/0051_typed_role_skill_concept_relations.sql"),
  read("db/postgres/migrations/0042_typed_role_skill_concept_relations.sql"),
  read("drizzle/meta/_journal.json"),
  read("db/typed-relation-repositories.ts"),
]);

test("Wave B uses dedicated typed tables and canonical endpoint authorities", () => {
  assert.match(schema, /roleSkillRelations = sqliteTable\(\s*"role_skill_relations"/);
  assert.match(schema, /skillConceptRelations = sqliteTable\(\s*"skill_concept_relations"/);
  for (const sql of [d1, postgres]) {
    assert.match(sql, /ROLE_REQUIRES_SKILL/);
    assert.match(sql, /SKILL_REQUIRES_CONCEPT/);
    assert.match(sql, /role_skill_relations_edge_unique/);
    assert.match(sql, /skill_concept_relations_edge_unique/);
    assert.match(sql, /provenance/);
    assert.match(sql, /relation_version/);
    assert.match(sql, /ACTIVE.*reviewed_by/s);
  }
  assert.match(postgres, /REVOKE ALL PRIVILEGES ON TABLE public\."role_skill_relations", public\."skill_concept_relations"/);
  assert.match(postgres, /0042_typed_role_skill_concept_relations/);
  assert.match(journal, /0051_typed_role_skill_concept_relations/);
  assert.match(repository, /createRoleRequiresSkillDraft/);
  assert.match(repository, /createSkillRequiresConceptDraft/);
  for (const readModel of ["skillsForRole", "conceptsForSkill", "rolesForSkill", "skillsForConcept"]) assert.match(repository, new RegExp(`export async function ${readModel}`));
});

test("Wave B does not add learner state, seeds, inverse rows, or generic relation fallback", () => {
  assert.doesNotMatch(schema, /user_skill_state|learner_twin|skill_seed/i);
  assert.doesNotMatch(repository, /ontologyEdges|fromType|toType/);
  assert.match(d1, /ON DELETE restrict/);
  assert.match(d1, /ON DELETE restrict/);
});

test("Wave B Drizzle and provider FK deletion policies remain restrictive and identical", () => {
  const tableBlock = (exportName) => schema.match(new RegExp(`export const ${exportName} = sqliteTable\\([\\s\\S]*?\\n\\);`))?.[0] ?? "";
  const matrix = [
    { table: "roleSkillRelations", column: "roleId", drizzle: "occupationalRoles.id", pg: '"role_id" text NOT NULL REFERENCES public."occupational_roles"("id") ON UPDATE NO ACTION ON DELETE RESTRICT', d1: "FOREIGN KEY (`role_id`) REFERENCES `occupational_roles`(`id`) ON UPDATE no action ON DELETE restrict" },
    { table: "roleSkillRelations", column: "skillId", drizzle: "skills.id", pg: '"skill_id" text NOT NULL REFERENCES public."skills"("id") ON UPDATE NO ACTION ON DELETE RESTRICT', d1: "FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE restrict" },
    { table: "roleSkillRelations", column: "reviewedBy", drizzle: "users.id", pg: '"reviewed_by" text REFERENCES public."users"("id") ON UPDATE NO ACTION ON DELETE RESTRICT', d1: "FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict" },
    { table: "skillConceptRelations", column: "skillId", drizzle: "skills.id", pg: '"skill_id" text NOT NULL REFERENCES public."skills"("id") ON UPDATE NO ACTION ON DELETE RESTRICT', d1: "FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE restrict" },
    { table: "skillConceptRelations", column: "conceptId", drizzle: "ontologyConcepts.id", pg: '"concept_id" text NOT NULL REFERENCES public."ontology_concepts"("id") ON UPDATE NO ACTION ON DELETE RESTRICT', d1: "FOREIGN KEY (`concept_id`) REFERENCES `ontology_concepts`(`id`) ON UPDATE no action ON DELETE restrict" },
    { table: "skillConceptRelations", column: "reviewedBy", drizzle: "users.id", pg: '"reviewed_by" text REFERENCES public."users"("id") ON UPDATE NO ACTION ON DELETE RESTRICT', d1: "FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict" },
  ];
  for (const row of matrix) {
    const block = tableBlock(row.table);
    assert.ok(block.includes(`${row.column}:`), `Drizzle column missing: ${row.table}.${row.column}`);
    assert.ok(block.includes(`references(() => ${row.drizzle}, { onDelete: "restrict" })`), `Drizzle policy mismatch: ${row.table}.${row.column}`);
    assert.ok(postgres.includes(row.pg), `PostgreSQL policy mismatch: ${row.table}.${row.column}`);
    assert.ok(d1.includes(row.d1), `D1 policy mismatch: ${row.table}.${row.column}`);
  }
});
