import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [schema, repository, pg, d1, snapshot, journal, manifest, baseline] = await Promise.all([
  read("db/schema.ts"),
  read("db/concept-persistence-repositories.ts"),
  read("db/postgres/migrations/0020_concept_persistence_cp_a.sql"),
  read("drizzle/0032_concept_persistence_cp_a.sql"),
  read("drizzle/meta/0032_snapshot.json"),
  read("drizzle/meta/_journal.json"),
  read("db/postgres/schema-manifest.json"),
  read("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.sha256"),
]);
const snapshotJson = JSON.parse(snapshot);
const manifestJson = JSON.parse(manifest);
const cpTables = ["concepts", "concept_versions", "concept_labels"];

test("fresh-main CP-A scope is exactly concept persistence", () => {
  assert.deepEqual(Object.keys(snapshotJson.tables).filter((name) => cpTables.includes(name)).sort(), [...cpTables].sort());
  assert.deepEqual(manifestJson.cpAExtension.tables, cpTables);
  for (const forbidden of ["skills", "skill_versions", "roles", "role_labels", "tools", "evidence", "mcp"]) {
    assert.doesNotMatch(pg, new RegExp(`CREATE TABLE[^;]*${forbidden}`, "is"));
    assert.doesNotMatch(d1, new RegExp(`CREATE TABLE[^;]*${forbidden}`, "is"));
  }
});

test("PostgreSQL and D1 CP-A contracts preserve the same identity invariants", () => {
  for (const token of [
    "stable_key",
    "concept_versions_identity_unique",
    "concept_versions_hash_unique",
    "semantic_hash",
    "concept_labels_identity_unique",
    "concept_labels_pref_language_unique",
    "concept_versions_status_check",
    "concept_labels_nonempty_check",
  ]) {
    assert.match(pg, new RegExp(token));
    assert.match(d1, new RegExp(token));
  }
  assert.match(schema, /export const concepts = sqliteTable\(/);
  assert.match(schema, /export const conceptVersions = sqliteTable\(/);
  assert.match(schema, /export const conceptLabels = sqliteTable\(/);
});

test("repository is server-only, validates input, and does not mutate versions", () => {
  assert.match(repository, /getDb\(\)\.insert\(concepts\)/);
  assert.match(repository, /insert\(conceptVersions\)/);
  assert.match(repository, /insert\(conceptLabels\)/);
  assert.match(repository, /CP_INVALID_HASH/);
  assert.match(repository, /CP_UNKNOWN_PARENT/);
  assert.doesNotMatch(repository, /update\(conceptVersions\)/);
});

test("migration metadata has only the reserved CP-A D1 slot", () => {
  const entries = JSON.parse(journal).entries;
  assert.equal(entries.filter((entry) => entry.tag === "0032_concept_persistence_cp_a").length, 1);
  assert.equal(entries.some((entry) => entry.tag.startsWith("0033_")), false);
  assert.equal(baseline.trim().split(/\s+/)[0], "2742f0b0b2c11b596d9c7336deb35489f14737e451f4956278f19611ff73f32a");
});

test("CP-A does not introduce governance receipts or CS1A changes", async () => {
  const receipt = await read("lib/policy/cs1a-receipt.ts");
  const contract = await read("lib/policy/cs1a-contract.ts");
  assert.equal((receipt.match(/persist|INSERT|CREATE TABLE/gi) ?? []).length, 0);
  assert.match(contract, /CS1A/);
});
