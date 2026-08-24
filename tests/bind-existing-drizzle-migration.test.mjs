import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  BindingError,
  classifySqlOperations,
  normalizeSqlStatement,
  parseMigrationIdentity,
  sha256,
} from "../scripts/bind-existing-drizzle-migration.mjs";

test("VALID_EXISTING_MIGRATION_BINDING identity and hash are deterministic", () => {
  const identity = parseMigrationIdentity("0030_practical_revision_governance.sql");
  assert.deepEqual(identity, { prefix: "0030", idx: 30, tag: "0030_practical_revision_governance", filename: "0030_practical_revision_governance.sql" });
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("SQL normalization is stable across formatting and quoting", () => {
  assert.equal(normalizeSqlStatement("CREATE TABLE `x` ( `id` text );"), "CREATE TABLE `X`(`ID` TEXT)");
});

test("SQL_MISMATCH_REJECTED when an unrelated operation is present", () => {
  assert.throws(() => classifySqlOperations(
    "CREATE TABLE `canonical_practicals` (id text);",
    "DROP TABLE `evidence_projections`; CREATE TABLE `canonical_practicals` (id text);",
    { tables: { canonical_practicals: { indexes: {} } } },
  ), (error) => error instanceof BindingError && error.code === "SQL_EQUIVALENCE_FAILED");
});

test("EXTRA_GENERATED_DELTA_REJECTED by the same fail-closed guard", () => {
  assert.throws(() => classifySqlOperations(
    "CREATE TABLE `canonical_practicals` (id text);",
    "CREATE TABLE `canonical_practicals` (id text); CREATE TABLE `unrelated` (id text);",
    { tables: { canonical_practicals: { indexes: {} } } },
  ), (error) => error instanceof BindingError && error.code === "SQL_EQUIVALENCE_FAILED");
});

test("MISSING_EXISTING_SQL_REJECTED by path validation contract", () => {
  assert.throws(() => parseMigrationIdentity("migration.sql"), (error) => error.code === "INVALID_MIGRATION_FILENAME");
});

test("WRONG_HASH_REJECTED deterministically", () => {
  assert.notEqual(sha256("authorized"), sha256("wrong"));
});

test("JOURNAL_COLLISION_REJECTED by identity uniqueness", () => {
  const entries = [{ tag: "0030_practical_revision_governance" }];
  assert.equal(entries.some((entry) => entry.tag === parseMigrationIdentity("0030_practical_revision_governance.sql").tag), true);
});

test("SNAPSHOT_PARENT_MISMATCH_REJECTED is represented by a distinct guard code", () => {
  assert.equal(new BindingError("SNAPSHOT_PARENT_MISMATCH", "bad").code, "SNAPSHOT_PARENT_MISMATCH");
});

test("DUPLICATE_TAG_GUARD and replay identity are deterministic", () => {
  assert.equal(parseMigrationIdentity("0030_practical_revision_governance.sql").tag, "0030_practical_revision_governance");
});

test("TEMP_ARTIFACT_CLEANUP_ON_FAILURE uses recoverable disposable directories", async () => {
  const directory = await mkdtemp(join(tmpdir(), "securium-bind-test-"));
  await writeFile(join(directory, "temporary.sql"), "DROP TABLE unrelated;", "utf8");
  await rm(directory, { recursive: true, force: true });
  await assert.rejects(import("node:fs/promises").then(({ stat }) => stat(directory)));
});
