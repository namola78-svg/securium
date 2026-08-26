import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = `${await readFile(new URL("../db/schema.ts", import.meta.url), "utf8")}\n${await readFile(new URL("../db/concept-persistence-repositories.ts", import.meta.url), "utf8")}\n${await readFile(new URL("../drizzle/0032_concept_persistence_cp_a.sql", import.meta.url), "utf8")}\n${await readFile(new URL("../db/postgres/migrations/0020_concept_persistence_cp_a.sql", import.meta.url), "utf8")}`;

for (const [name, pattern] of [
  ["stable identity", /concepts_stable_key_unique/],
  ["version identity", /concept_versions_identity_unique/],
  ["semantic hash identity", /concept_versions_hash_unique/],
  ["label identity", /concept_labels_identity_unique/],
  ["invalid status", /CP_INVALID_STATUS/],
  ["unknown parent", /CP_UNKNOWN_PARENT/],
  ["invalid hash", /CP_INVALID_HASH/],
  ["restricted lineage", /ON DELETE RESTRICT|onDelete: "restrict"/i],
]) {
  test(`CP-A fail-closed: ${name}`, () => assert.match(source, pattern));
}

test("CP-A does not implement role, skill, relation, or cycle persistence", () => {
  for (const forbidden of ["skill_versions", "role_labels", "concept_relations", "mapping_versions"]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
});
