import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PostgreSQL and D1 migrations carry the same governance objects", async () => {
  const postgres = await readFile("db/postgres/migrations/0013_question_governance_foundation.sql", "utf8");
  const d1 = await readFile("drizzle/0025_lush_nomad.sql", "utf8");
  for (const token of ["question_versions", "semantic_hash", "question_concepts", "question_concepts_current_unique", "question_concepts_version_status_idx", "question_concepts_concept_status_idx"]) {
    assert.match(postgres, new RegExp(token));
    assert.match(d1, new RegExp(token));
  }
  assert.doesNotMatch(postgres, /DROP COLUMN|TRUNCATE|DELETE FROM/i);
  assert.doesNotMatch(d1, /DROP COLUMN|TRUNCATE|DELETE FROM/i);
  assert.doesNotMatch(postgres, /DROP TABLE/i);
  assert.doesNotMatch(d1, /DROP TABLE/i);
});
