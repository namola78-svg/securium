import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("PostgreSQL and D1 migrations contain the same governed table inventory", async () => {
  const postgres = await readFile("db/postgres/migrations/0018_practical_revision_governance.sql", "utf8");
  const d1 = await readFile("drizzle/0030_practical_revision_governance.sql", "utf8");
  for (const table of ["canonical_practicals", "practical_governance_versions", "practical_reviewer_material_versions", "practical_version_concept_bindings"]) {
    assert.match(postgres, new RegExp(table));
    assert.match(d1, new RegExp(table));
  }
});
test("provider migrations preserve lifecycle and reviewer-only constraints", async () => {
  const [postgres, d1] = await Promise.all([readFile("db/postgres/migrations/0018_practical_revision_governance.sql", "utf8"), readFile("drizzle/0030_practical_revision_governance.sql", "utf8")]);
  for (const text of [postgres, d1]) {
    assert.match(text, /CANONICAL_UNPUBLISHED/);
    assert.match(text, /SUPERSEDED/);
    assert.match(text, /REVIEWER_ONLY/);
    assert.match(text, /semantic_hash/);
  }
});
