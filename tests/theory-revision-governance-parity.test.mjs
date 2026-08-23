import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PostgreSQL and D1 Theory governance migrations preserve semantic parity and legacy fail-closed scope", async () => {
  const [postgres, d1] = await Promise.all([
    readFile("db/postgres/migrations/0016_theory_revision_governance.sql", "utf8"),
    readFile("drizzle/0028_theory_revision_governance.sql", "utf8"),
  ]);
  for (const sql of [postgres, d1]) {
    assert.match(sql, /semantic_hash/);
    assert.match(sql, /human_review_hash/);
    assert.match(sql, /content_revision_concepts/);
    assert.match(sql, /content_revision_concepts_review_check/);
    assert.doesNotMatch(sql, /INSERT\s+INTO\s+content_revisions/i);
    assert.doesNotMatch(sql, /UPDATE\s+content_revisions/i);
  }
  const postgresNames = [...postgres.matchAll(/(?:CONSTRAINT|INDEX)\s+[`"]?([a-z0-9_]+)[`"]?/gi)].map((match) => match[1]).filter((name) => name.includes("content_revision"));
  const d1Names = [...d1.matchAll(/(?:CONSTRAINT|INDEX)\s+[`"]?([a-z0-9_]+)[`"]?/gi)].map((match) => match[1]).filter((name) => name.includes("content_revision"));
  for (const name of ["content_revision_concepts_relation_check", "content_revision_concepts_status_check", "content_revision_concepts_version_check", "content_revision_concepts_review_check", "content_revision_concepts_identity_check", "content_revision_concepts_current_unique", "content_revision_concepts_version_status_idx", "content_revision_concepts_concept_status_idx"]) {
    assert.ok(postgresNames.includes(name), `PostgreSQL missing ${name}`);
    assert.ok(d1Names.includes(name), `D1 missing ${name}`);
  }
});
