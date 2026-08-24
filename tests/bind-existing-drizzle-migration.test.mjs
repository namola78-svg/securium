import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  BindingError,
  bindExistingMigration,
  classifySqlOperations,
  normalizeSqlStatement,
  parseMigrationIdentity,
  sha256,
} from "../scripts/bind-existing-drizzle-migration.mjs";
import {
  BinderStateMachine,
  ValidationFailure,
  commitMetadataTransaction,
  recoverMetadataTransaction,
  sha256 as validationSha256,
  stableJson,
  validateDatabaseTransitions,
  verifyBindingReceipt,
} from "../scripts/practical-drizzle-binding-validation.mjs";

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

const baseSql = `CREATE TABLE source (id TEXT PRIMARY KEY, value TEXT);`;
const seedSql = `INSERT INTO source (id, value) VALUES ('row-1', 'kept');`;
const addNullable = `ALTER TABLE source ADD COLUMN added TEXT;`;

function transitionFailure(generatedSql, authoritativeSql = addNullable, dataQueries = ["SELECT id, value FROM source ORDER BY id"]) {
  try {
    validateDatabaseTransitions({ baseSql, seedSql, authoritativeSql, generatedSql, dataQueries });
    assert.fail("validation unexpectedly succeeded");
  } catch (error) {
    assert.ok(error instanceof ValidationFailure);
    return error;
  }
}

test("GENERATED_SQL_EXECUTION_FAILURE_REJECTED", () => {
  const error = transitionFailure(`CREATE TABLE __new_source (id TEXT PRIMARY KEY, value TEXT, added TEXT); INSERT INTO __new_source SELECT id, value, added FROM source;`);
  assert.equal(error.code, "REJECTED_GENERATED_MIGRATION_NOT_EXECUTABLE");
});

test("MISSING_SOURCE_COLUMN_REJECTED", () => {
  const error = transitionFailure(`CREATE TABLE __new_source (id TEXT, evaluation_semantic_hash TEXT); INSERT INTO __new_source SELECT id, evaluation_semantic_hash FROM source;`);
  assert.match(error.message, /evaluation_semantic_hash/);
});

test("SCHEMA_EQUIVALENCE_REQUIRED", () => {
  const error = transitionFailure(`ALTER TABLE source ADD COLUMN added INTEGER;`);
  assert.equal(error.code, "REJECTED_SCHEMA_NOT_EQUIVALENT");
});

test("DATA_PRESERVATION_EQUIVALENCE_REQUIRED", () => {
  const error = transitionFailure(`${addNullable} UPDATE source SET value = 'changed';`);
  assert.equal(error.code, "REJECTED_DATA_NOT_EQUIVALENT");
});

test("TRIGGER_MISMATCH_REJECTED", () => {
  const authoritative = `${addNullable} CREATE TRIGGER source_guard BEFORE UPDATE ON source BEGIN SELECT RAISE(ABORT, 'guard'); END;`;
  const error = transitionFailure(addNullable, authoritative);
  assert.equal(error.code, "REJECTED_SCHEMA_NOT_EQUIVALENT");
  assert.ok(error.details.mismatches.includes("triggers"));
});

test("CHECK_CONSTRAINT_MISMATCH_REJECTED", () => {
  const authoritative = `CREATE TABLE replacement (id TEXT PRIMARY KEY, value TEXT CHECK(length(value) > 0)); INSERT INTO replacement SELECT id, value FROM source; DROP TABLE source; ALTER TABLE replacement RENAME TO source;`;
  const generated = `CREATE TABLE replacement (id TEXT PRIMARY KEY, value TEXT); INSERT INTO replacement SELECT id, value FROM source; DROP TABLE source; ALTER TABLE replacement RENAME TO source;`;
  const error = transitionFailure(generated, authoritative);
  assert.equal(error.code, "REJECTED_SCHEMA_NOT_EQUIVALENT");
  assert.ok(error.details.mismatches.some((item) => item.includes("checks")));
});

test("INDEX_MISMATCH_REJECTED", () => {
  const error = transitionFailure(addNullable, `${addNullable} CREATE UNIQUE INDEX source_value_unique ON source(value);`);
  assert.equal(error.code, "REJECTED_SCHEMA_NOT_EQUIVALENT");
  assert.ok(error.details.mismatches.some((item) => item.includes("indexes")));
});

test("FOREIGN_KEY_STATE_RECOVERED by disposable destruction after failure", () => {
  const error = transitionFailure(`PRAGMA foreign_keys=OFF; CREATE TABLE __new_source (id TEXT, added TEXT); INSERT INTO __new_source SELECT id, missing FROM source;`);
  assert.equal(error.details.foreignKeys, 0);
  assert.equal(error.details.validationDatabaseReused, false);
  assert.equal(error.details.validationDatabaseDestroyed, true);
});

test("PARTIAL_NEW_TABLE_CLEANUP destroys rather than reuses failed validation DB", () => {
  const error = transitionFailure(`CREATE TABLE __new_source (id TEXT, added TEXT); INSERT INTO __new_source SELECT id, missing FROM source;`);
  assert.deepEqual(error.details.temporaryTables, ["__new_source"]);
  assert.equal(error.details.validationDatabaseDestroyed, true);
});

function bindingFixture(metaDir) {
  const identity = { prefix: "0030", idx: 30, tag: "0030_practical_revision_governance" };
  const snapshot = { id: "snapshot-30", prevId: "snapshot-29", tables: {} };
  const journal = { version: "7", dialect: "sqlite", entries: [{ idx: 29, tag: "0029_evidence_e1_core_remediation" }, { idx: 30, tag: identity.tag }] };
  const snapshotText = stableJson(snapshot);
  const journalText = stableJson(journal);
  const receipt = {
    version: "PRACTICAL_BINDING_RECEIPT_V1",
    identity: identity.tag,
    existingSqlSha256: "authorized-sql",
    generatedSqlSha256: "generated-sql",
    snapshotSha256: validationSha256(snapshotText),
    journalSha256: validationSha256(journalText),
    authorityState: "VERIFIED_EXISTING_MIGRATION_AUTHORITY",
    authorityPath: "existing-migration",
    exactReplayState: "REPLAYABLE",
  };
  return { metaDir, identity, snapshot, journal, receipt };
}

async function metadataDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "securium-binding-metadata-"));
  await writeFile(join(directory, "_journal.json"), stableJson({ version: "7", dialect: "sqlite", entries: [{ idx: 29, tag: "0029_evidence_e1_core_remediation" }] }), "utf8");
  await writeFile(join(directory, "0029_snapshot.json"), stableJson({ id: "snapshot-29", prevId: "snapshot-28", tables: {} }), "utf8");
  return directory;
}

test("INTERRUPTED_SNAPSHOT_WRITE_RECOVERY rolls back unmanifested temp state", async () => {
  const directory = await metadataDirectory();
  const fixture = bindingFixture(directory);
  await assert.rejects(commitMetadataTransaction({ ...fixture, injectFailureAt: "AFTER_SNAPSHOT_TEMP_WRITE" }));
  assert.equal(await recoverMetadataTransaction({ metaDir: directory, identity: fixture.identity }), "ROLL_BACK");
  await rm(directory, { recursive: true, force: true });
});

test("before snapshot write interruption leaves no canonical metadata delta", async () => {
  const directory = await metadataDirectory();
  const fixture = bindingFixture(directory);
  const before = await readFile(join(directory, "_journal.json"), "utf8");
  await assert.rejects(commitMetadataTransaction({ ...fixture, injectFailureAt: "BEFORE_SNAPSHOT_TEMP_WRITE" }));
  assert.equal(await recoverMetadataTransaction({ metaDir: directory, identity: fixture.identity }), "NONE");
  assert.equal(await readFile(join(directory, "_journal.json"), "utf8"), before);
  await rm(directory, { recursive: true, force: true });
});

test("INTERRUPTED_JOURNAL_WRITE_RECOVERY rolls back truncated pending journal", async () => {
  const directory = await metadataDirectory();
  const fixture = bindingFixture(directory);
  await assert.rejects(commitMetadataTransaction({ ...fixture, injectFailureAt: "DURING_JOURNAL_TEMP_WRITE" }));
  assert.equal(await recoverMetadataTransaction({ metaDir: directory, identity: fixture.identity }), "ROLL_BACK");
  await rm(directory, { recursive: true, force: true });
});

test("post-snapshot/pre-journal interruption deterministically rolls forward", async () => {
  const directory = await metadataDirectory();
  const fixture = bindingFixture(directory);
  await assert.rejects(commitMetadataTransaction({ ...fixture, injectFailureAt: "AFTER_SNAPSHOT_PROMOTION_BEFORE_JOURNAL" }));
  assert.equal(await recoverMetadataTransaction({ metaDir: directory, identity: fixture.identity }), "ROLL_FORWARD");
  const recoveredJournal = await readFile(join(directory, "_journal.json"), "utf8");
  assert.doesNotThrow(() => JSON.parse(recoveredJournal));
  await rm(directory, { recursive: true, force: true });
});

test("TRUNCATED_JOURNAL_RECOVERY uses verified recovery copy", async () => {
  const directory = await metadataDirectory();
  const fixture = bindingFixture(directory);
  await assert.rejects(commitMetadataTransaction({ ...fixture, injectFailureAt: "AFTER_JOURNAL_PROMOTION" }));
  await writeFile(join(directory, "_journal.json"), '{"truncated":', "utf8");
  assert.equal(await recoverMetadataTransaction({ metaDir: directory, identity: fixture.identity }), "ROLL_FORWARD");
  assert.equal(JSON.parse(await readFile(join(directory, "_journal.json"), "utf8")).entries.at(-1).tag, fixture.identity.tag);
  await rm(directory, { recursive: true, force: true });
});

test("EXACT_REPLAY_AFTER_RECOVERY requires a verified binding receipt", async () => {
  const directory = await metadataDirectory();
  const fixture = bindingFixture(directory);
  await assert.rejects(commitMetadataTransaction({ ...fixture, injectFailureAt: "CLEANUP" }));
  assert.equal(await recoverMetadataTransaction({ metaDir: directory, identity: fixture.identity }), "ROLL_FORWARD");
  assert.equal(await verifyBindingReceipt({ metaDir: directory, identity: fixture.identity, existingSqlSha256: "authorized-sql" }), true);
  await rm(directory, { recursive: true, force: true });
});

test("BINDER_RECEIPT_PATH_IS_SEPARATE_FROM_DRIZZLE_META", async () => {
  const directory = await metadataDirectory();
  const binderDir = join(directory, "reports", "content-audit");
  const fixture = bindingFixture(directory);
  await commitMetadataTransaction({ ...fixture, binderDir, receiptFilename: "securium-practical-0030-binding-receipt.json" });
  await assert.rejects(readFile(join(directory, "0030_practical_revision_governance.binding.json")));
  assert.doesNotReject(readFile(join(binderDir, "securium-practical-0030-binding-receipt.json")));
  assert.equal(await verifyBindingReceipt({ metaDir: directory, binderDir, receiptFilename: "securium-practical-0030-binding-receipt.json", identity: fixture.identity, existingSqlSha256: "authorized-sql" }), true);
  await rm(directory, { recursive: true, force: true });
});

test("BINDER_RECEIPT_PATH_RECOVERY_PRESERVES_ATOMIC_STATE", async () => {
  const directory = await metadataDirectory();
  const binderDir = join(directory, "reports", "content-audit");
  const fixture = bindingFixture(directory);
  await assert.rejects(commitMetadataTransaction({ ...fixture, binderDir, receiptFilename: "securium-practical-0030-binding-receipt.json", injectFailureAt: "AFTER_JOURNAL_PROMOTION" }));
  assert.equal(await recoverMetadataTransaction({ metaDir: directory, binderDir, receiptFilename: "securium-practical-0030-binding-receipt.json", identity: fixture.identity }), "ROLL_FORWARD");
  assert.doesNotReject(readFile(join(binderDir, "securium-practical-0030-binding-receipt.json")));
  await assert.rejects(readFile(join(directory, ".0030_practical_revision_governance.binding-transaction.json")));
  await rm(directory, { recursive: true, force: true });
});

test("BINDER_RECEIPT_WRONG_SHA_AND_JOURNAL_FAIL_CLOSED", async () => {
  const directory = await metadataDirectory();
  const binderDir = join(directory, "reports", "content-audit");
  const fixture = bindingFixture(directory);
  const receiptFilename = "securium-practical-0030-binding-receipt.json";
  await commitMetadataTransaction({ ...fixture, binderDir, receiptFilename });
  assert.equal(await verifyBindingReceipt({ metaDir: directory, binderDir, receiptFilename, identity: fixture.identity, existingSqlSha256: "wrong-sql" }), false);
  assert.equal(await verifyBindingReceipt({ metaDir: directory, binderDir, receiptFilename, identity: { ...fixture.identity, tag: "wrong-journal-tag" }, existingSqlSha256: "authorized-sql" }), false);
  await rm(directory, { recursive: true, force: true });
});

test("BINDER_RECEIPT_WRONG_AUTHORITY_AND_CORRUPTION_FAIL_CLOSED", async () => {
  const directory = await metadataDirectory();
  const binderDir = join(directory, "reports", "content-audit");
  const fixture = bindingFixture(directory);
  const receiptFilename = "securium-practical-0030-binding-receipt.json";
  await commitMetadataTransaction({ ...fixture, binderDir, receiptFilename });
  const receiptPath = join(binderDir, receiptFilename);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  receipt.authorityState = "DIAGNOSTIC_ONLY";
  await writeFile(receiptPath, stableJson(receipt), "utf8");
  assert.equal(await verifyBindingReceipt({ metaDir: directory, binderDir, receiptFilename, identity: fixture.identity, existingSqlSha256: "authorized-sql" }), false);
  await writeFile(receiptPath, "{corrupt", "utf8");
  await assert.rejects(verifyBindingReceipt({ metaDir: directory, binderDir, receiptFilename, identity: fixture.identity, existingSqlSha256: "authorized-sql" }), (error) => error.code === "INVALID_BINDING_RECEIPT");
  await rm(directory, { recursive: true, force: true });
});

test("binder state machine fails closed on invalid transitions", () => {
  const machine = new BinderStateMachine();
  assert.throws(() => machine.transition("METADATA_PREPARED"), (error) => error.code === "INVALID_BINDER_STATE_TRANSITION");
  assert.deepEqual(machine.history, ["PREFLIGHT"]);
});

async function metadataPreflightRepository({ journalEntry = false, snapshot = true }) {
  const directory = await mkdtemp(join(tmpdir(), "securium-binding-preflight-"));
  await mkdir(join(directory, "drizzle", "meta"), { recursive: true });
  await mkdir(join(directory, "db"), { recursive: true });
  const sql = "CREATE TABLE canonical_practicals (id TEXT PRIMARY KEY);";
  await writeFile(join(directory, "drizzle", "0030_practical_revision_governance.sql"), sql, "utf8");
  await writeFile(join(directory, "db", "schema.ts"), "export {};\n", "utf8");
  await writeFile(join(directory, "drizzle", "meta", "0029_snapshot.json"), stableJson({ id: "snapshot-29", prevId: "snapshot-28", tables: {} }), "utf8");
  if (snapshot) await writeFile(join(directory, "drizzle", "meta", "0030_snapshot.json"), stableJson({ id: "snapshot-30", prevId: "snapshot-29", tables: {} }), "utf8");
  const entries = [{ idx: 29, tag: "0029_evidence_e1_core_remediation" }];
  if (journalEntry) entries.push({ idx: 30, tag: "0030_practical_revision_governance" });
  await writeFile(join(directory, "drizzle", "meta", "_journal.json"), stableJson({ version: "7", dialect: "sqlite", entries }), "utf8");
  return { directory, sql, hash: validationSha256(sql) };
}

test("orphan snapshot is rejected before generation", async () => {
  const fixture = await metadataPreflightRepository({ journalEntry: false, snapshot: true });
  await assert.rejects(bindExistingMigration({ rootDir: fixture.directory, existingSql: "drizzle/0030_practical_revision_governance.sql", expectedSha256: fixture.hash }), (error) => error.code === "ORPHAN_SNAPSHOT");
  await rm(fixture.directory, { recursive: true, force: true });
});

test("pre-existing snapshot and journal without verified receipt fail closed", async () => {
  const fixture = await metadataPreflightRepository({ journalEntry: true, snapshot: true });
  await assert.rejects(bindExistingMigration({ rootDir: fixture.directory, existingSql: "drizzle/0030_practical_revision_governance.sql", expectedSha256: fixture.hash }), (error) => error.code === "EXACT_REPLAY_RECEIPT_MISSING");
  await rm(fixture.directory, { recursive: true, force: true });
});
