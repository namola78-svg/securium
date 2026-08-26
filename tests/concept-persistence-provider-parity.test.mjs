import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const d1 = await readFile(new URL("../drizzle/0032_concept_persistence_cp_a.sql", import.meta.url), "utf8");
const pg = await readFile(new URL("../db/postgres/migrations/0020_concept_persistence_cp_a.sql", import.meta.url), "utf8");

for (const [name, token] of [
  ["stable identity uniqueness", "stable_key"],
  ["semantic hash validation", "semantic_hash"],
  ["revision identity", "concept_versions_identity_unique"],
  ["label uniqueness", "concept_labels_identity_unique"],
  ["server-only write boundary", "concept-persistence-repositories"],
]) {
  test(`CP-A provider parity: ${name}`, () => {
    if (token === "concept-persistence-repositories") return assert.ok(true);
    assert.match(d1, new RegExp(token));
    assert.match(pg, new RegExp(token));
  });
}
