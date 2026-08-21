import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pgPath = "db/postgres/migrations/0014_learning_event_version_revision_governance.sql";
const d1Path = "drizzle/0026_remarkable_scarecrow.sql";

test("PostgreSQL and D1 migrations expose the same PR A governance surface", async () => {
  const [pg, d1] = await Promise.all([readFile(pgPath, "utf8"), readFile(d1Path, "utf8")]);
  for (const token of [
    "learning_event_revisions",
    "question_version_id",
    "concept_mapping_set_hash",
    "composition_semantic_hash",
    "content_version",
    "content_revision_id",
    "learning_event_revisions_sequence_unique",
    "learning_event_revisions_semantic_unique",
  ]) {
    assert.match(pg, new RegExp(token));
    assert.match(d1, new RegExp(token));
  }
  assert.doesNotMatch(pg + d1, /evidence_projections|evidence_recompute_requests|mastery/i);
  assert.doesNotMatch(pg + d1, /DROP COLUMN|DELETE FROM|UPDATE\s+["`]?question_attempts/i);
});

test("legacy migration copies bind no guessed semantic version", async () => {
  const d1 = await readFile(d1Path, "utf8");
  assert.match(d1, /SELECT "id", "idempotency_key", "user_id", "question_id", NULL, NULL,/);
  assert.match(d1, /"unanswered_count", NULL, "created_at"/);
});
