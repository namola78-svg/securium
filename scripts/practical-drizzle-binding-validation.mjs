import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, open, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const BINDER_STATES = Object.freeze([
  "PREFLIGHT",
  "GENERATED",
  "EXECUTION_VALIDATED",
  "SCHEMA_EQUIVALENT",
  "DATA_EQUIVALENT",
  "METADATA_PREPARED",
  "COMMITTED",
  "EXACT_REPLAY",
  "FAILED",
]);

const VERIFIED_AUTHORITY_STATE = "VERIFIED_EXISTING_MIGRATION_AUTHORITY";
const VERIFIED_AUTHORITY_PATH = "existing-migration";
const REPLAYABLE_RECEIPT_STATE = "REPLAYABLE";

const TRANSITIONS = Object.freeze({
  PREFLIGHT: new Set(["GENERATED", "EXACT_REPLAY", "FAILED"]),
  GENERATED: new Set(["EXECUTION_VALIDATED", "FAILED"]),
  EXECUTION_VALIDATED: new Set(["SCHEMA_EQUIVALENT", "FAILED"]),
  SCHEMA_EQUIVALENT: new Set(["DATA_EQUIVALENT", "FAILED"]),
  DATA_EQUIVALENT: new Set(["METADATA_PREPARED", "FAILED"]),
  METADATA_PREPARED: new Set(["COMMITTED", "FAILED"]),
  COMMITTED: new Set(["EXACT_REPLAY", "FAILED"]),
  EXACT_REPLAY: new Set(),
  FAILED: new Set(),
});

export class ValidationFailure extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = "ValidationFailure";
    this.code = code;
    this.details = details;
  }
}

export class BinderStateMachine {
  constructor() {
    this.state = "PREFLIGHT";
    this.history = [this.state];
  }

  transition(next) {
    if (!TRANSITIONS[this.state]?.has(next)) {
      throw new ValidationFailure("INVALID_BINDER_STATE_TRANSITION", `${this.state} -> ${next}`);
    }
    this.state = next;
    this.history.push(next);
    return this.state;
  }

  fail() {
    if (this.state !== "FAILED") this.transition("FAILED");
    return this.state;
  }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function cleanMigrationSql(sql) {
  return sql.replaceAll("--> statement-breakpoint", "");
}

function executeMigration(database, sql) {
  const statements = sql.split(/-->\s*statement-breakpoint/i).map((statement) => statement.trim()).filter(Boolean);
  for (let index = 0; index < statements.length; index += 1) {
    try { database.exec(statements[index]); }
    catch (error) {
      error.migrationStatementIndex = index + 1;
      error.migrationStatement = statements[index];
      throw error;
    }
  }
  return statements.length;
}

function normalizeSql(sql) {
  return (sql ?? "")
    .replace(/["`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),])\s*/g, "$1")
    .trim()
    .toUpperCase();
}

function extractChecks(sql) {
  const checks = [];
  const upper = (sql ?? "").toUpperCase();
  let cursor = 0;
  while ((cursor = upper.indexOf("CHECK", cursor)) >= 0) {
    const openIndex = upper.indexOf("(", cursor + 5);
    if (openIndex < 0) break;
    let depth = 0;
    let quote = null;
    let end = -1;
    for (let index = openIndex; index < sql.length; index += 1) {
      const char = sql[index];
      if (quote) {
        if (char === quote && sql[index - 1] !== "\\") quote = null;
        continue;
      }
      if (char === "'" || char === '"' || char === "`") {
        quote = char;
        continue;
      }
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
    if (end < 0) break;
    checks.push(normalizeSql(sql.slice(openIndex + 1, end)));
    cursor = end + 1;
  }
  return checks.sort();
}

function rows(database, sql) {
  return database.prepare(sql).all().map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? Number(value) : value]),
  ));
}

function tableContract(database, name) {
  const quoted = name.replaceAll("'", "''");
  const definition = database.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?").get(name)?.sql ?? "";
  const indexes = rows(database, `PRAGMA index_list('${quoted}')`).map((index) => ({
    ...index,
    columns: rows(database, `PRAGMA index_xinfo('${String(index.name).replaceAll("'", "''")}')`),
    sql: normalizeSql(database.prepare("SELECT sql FROM sqlite_schema WHERE type = 'index' AND name = ?").get(index.name)?.sql ?? ""),
  }));
  return {
    columns: rows(database, `PRAGMA table_xinfo('${quoted}')`),
    foreignKeys: rows(database, `PRAGMA foreign_key_list('${quoted}')`),
    indexes,
    checks: extractChecks(definition),
    definition: normalizeSql(definition),
  };
}

export function captureDatabaseContract(database) {
  const tableNames = rows(database, "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((row) => row.name);
  return {
    tables: Object.fromEntries(tableNames.map((name) => [name, tableContract(database, name)])),
    triggers: rows(database, "SELECT name, tbl_name, sql FROM sqlite_schema WHERE type = 'trigger' ORDER BY name")
      .map((trigger) => ({ ...trigger, sql: normalizeSql(trigger.sql) })),
  };
}

function compareComponent(left, right, name, mismatches) {
  if (JSON.stringify(left) !== JSON.stringify(right)) mismatches.push(name);
}

export function compareDatabaseContracts(left, right) {
  const mismatches = [];
  const leftNames = Object.keys(left.tables);
  const rightNames = Object.keys(right.tables);
  compareComponent(leftNames, rightNames, "tables", mismatches);
  for (const name of [...new Set([...leftNames, ...rightNames])].sort()) {
    const a = left.tables[name];
    const b = right.tables[name];
    if (!a || !b) continue;
    compareComponent(a.columns, b.columns, `${name}.columns`, mismatches);
    compareComponent(a.foreignKeys, b.foreignKeys, `${name}.foreignKeys`, mismatches);
    compareComponent(a.indexes, b.indexes, `${name}.indexes`, mismatches);
    compareComponent(a.checks, b.checks, `${name}.checks`, mismatches);
    compareComponent(a.definition, b.definition, `${name}.definition`, mismatches);
  }
  compareComponent(left.triggers, right.triggers, "triggers", mismatches);
  return { equivalent: mismatches.length === 0, mismatchCount: mismatches.length, mismatches };
}

async function priorMigrationPaths(repoRoot, previousIndex) {
  const directory = join(repoRoot, "drizzle");
  return (await readdir(directory))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name) && Number(name.slice(0, 4)) <= previousIndex)
    .sort()
    .map((name) => join(directory, name));
}

async function applyBase(database, paths) {
  database.exec("PRAGMA foreign_keys = ON");
  for (const path of paths) database.exec(cleanMigrationSql(await readFile(path, "utf8")));
}

export function practical0030SeedSql() {
  const a = "a".repeat(64);
  const b = "b".repeat(64);
  const c = "c".repeat(64);
  return `
    INSERT INTO users (id, email, display_name, created_at, updated_at)
      VALUES ('binder-user', 'binder@example.test', 'Binder User', '2026-01-01', '2026-01-01');
    INSERT INTO course_groups (id, code, name, created_at, updated_at)
      VALUES ('binder-group', 'BINDER', 'Binder Group', '2026-01-01', '2026-01-01');
    INSERT INTO courses (id, course_group_id, code, slug, name, short_name, created_at, updated_at)
      VALUES ('binder-course', 'binder-group', 'BINDER', 'binder-course', 'Binder Course', 'BINDER', '2026-01-01', '2026-01-01');
    INSERT INTO curriculum_trees (id, course_id, title, version, status, created_at, updated_at)
      VALUES ('binder-tree', 'binder-course', 'Binder Tree', 'v1', 'ACTIVE', '2026-01-01', '2026-01-01');
    INSERT INTO curriculum_nodes (id, curriculum_tree_id, node_type, title, is_practical, created_at, updated_at)
      VALUES ('binder-node', 'binder-tree', 'PRACTICAL', 'Binder Node', 1, '2026-01-01', '2026-01-01');
    INSERT INTO practical_rubric_versions (id, rubric_id, version, snapshot_json, snapshot_digest, created_at)
      VALUES ('binder-rubric-v1', 'binder-rubric', 1, '{}', '${a}', '2026-01-01'),
             ('binder-rubric-v2', 'binder-rubric', 2, '{"version":2}', '${b}', '2026-01-02');
    INSERT INTO practical_definition_versions (id, practical_id, version, rubric_version_id, snapshot_json, snapshot_digest, created_at)
      VALUES ('binder-definition-v1', 'binder-practical', 1, 'binder-rubric-v1', '{}', '${b}', '2026-01-01'),
             ('binder-definition-v2', 'binder-practical', 2, 'binder-rubric-v2', '{"version":2}', '${c}', '2026-01-02');
    INSERT INTO practical_attempts (
      id, user_id, practical_id, practical_definition_version_id, rubric_version_id,
      course_id, curriculum_tree_id, curriculum_tree_version_reference, curriculum_node_id,
      objective_placement_id, practical_placement_id, state, responses_json,
      artifact_manifest_json, creation_idempotency_key, draft_revision, created_at, updated_at
    ) VALUES (
      'binder-attempt', 'binder-user', 'binder-practical', 'binder-definition-v1', 'binder-rubric-v1',
      'binder-course', 'binder-tree', 'v1', 'binder-node', 'binder-objective', 'binder-placement',
      'SUBMITTED', '[]', '[]', 'binder-create', 1, '2026-01-03', '2026-01-03'
    );
  `;
}

function seedPractical0030(database) {
  database.exec(practical0030SeedSql());
  return 10;
}

function preservedColumnMap(database, tables) {
  return Object.fromEntries(tables.map((table) => [
    table,
    rows(database, `PRAGMA table_xinfo('${table.replaceAll("'", "''")}')`).map((column) => column.name),
  ]));
}

function preservedData(database, columnMap = null) {
  const tables = [
    "users",
    "course_groups",
    "courses",
    "curriculum_trees",
    "curriculum_nodes",
    "practical_rubric_versions",
    "practical_definition_versions",
    "practical_attempts",
  ];
  const columns = columnMap ?? preservedColumnMap(database, tables);
  return Object.fromEntries(tables.map((table) => {
    const projection = columns[table].map((column) => `"${String(column).replaceAll('"', '""')}"`).join(", ");
    return [table, rows(database, `SELECT ${projection} FROM ${table} ORDER BY id`)];
  }));
}

function failureDatabaseState(database) {
  let foreignKeys = null;
  let temporaryTables = [];
  try {
    foreignKeys = database.prepare("PRAGMA foreign_keys").get()?.foreign_keys ?? null;
    temporaryTables = rows(database, "SELECT name FROM sqlite_schema WHERE type = 'table' AND name LIKE '__new_%' ORDER BY name").map((row) => row.name);
  } catch {
    // The disposable database is still destroyed in finally.
  }
  return { foreignKeys, temporaryTables, partialStateObserved: temporaryTables.length > 0 || foreignKeys === 0 };
}

export function validateDatabaseTransitions({ baseSql, seedSql = "", authoritativeSql, generatedSql, dataQueries = [] }) {
  const databaseA = new DatabaseSync(":memory:");
  const databaseB = new DatabaseSync(":memory:");
  try {
    for (const database of [databaseA, databaseB]) {
      database.exec("PRAGMA foreign_keys = ON");
      database.exec(cleanMigrationSql(baseSql));
      if (seedSql) database.exec(seedSql);
    }
    const baseA = captureDatabaseContract(databaseA);
    const baseB = captureDatabaseContract(databaseB);
    if (stableJson(baseA) !== stableJson(baseB)) {
      throw new ValidationFailure("AUTHORITATIVE_BASE_MISMATCH", "disposable bases differ");
    }
    const beforeA = dataQueries.map((sql) => rows(databaseA, sql));
    const beforeB = dataQueries.map((sql) => rows(databaseB, sql));
    try { databaseA.exec(cleanMigrationSql(authoritativeSql)); }
    catch (error) {
      throw new ValidationFailure("REJECTED_AUTHORITATIVE_MIGRATION_NOT_EXECUTABLE", error.message, failureDatabaseState(databaseA));
    }
    try { databaseB.exec(cleanMigrationSql(generatedSql)); }
    catch (error) {
      throw new ValidationFailure("REJECTED_GENERATED_MIGRATION_NOT_EXECUTABLE", error.message, {
        ...failureDatabaseState(databaseB),
        validationDatabaseReused: false,
        validationDatabaseDestroyed: true,
      });
    }
    const schemaComparison = compareDatabaseContracts(captureDatabaseContract(databaseA), captureDatabaseContract(databaseB));
    if (!schemaComparison.equivalent) {
      throw new ValidationFailure("REJECTED_SCHEMA_NOT_EQUIVALENT", JSON.stringify(schemaComparison), schemaComparison);
    }
    const afterA = dataQueries.map((sql) => rows(databaseA, sql));
    const afterB = dataQueries.map((sql) => rows(databaseB, sql));
    if (stableJson(beforeA) !== stableJson(afterA) || stableJson(beforeB) !== stableJson(afterB)
      || stableJson(afterA) !== stableJson(afterB)) {
      throw new ValidationFailure("REJECTED_DATA_NOT_EQUIVALENT", "pre-existing semantic rows changed");
    }
    return {
      executionValidated: true,
      schemaEquivalent: true,
      dataEquivalent: true,
      schemaMismatchCount: 0,
      foreignKeysAfter: [databaseA, databaseB].map((database) => database.prepare("PRAGMA foreign_keys").get()?.foreign_keys),
      validationDatabaseReused: false,
      validationDatabaseDestroyed: true,
    };
  } finally {
    databaseA.close();
    databaseB.close();
  }
}

export async function validateExecutableEquivalence({ repoRoot, migrationIndex, existingSql, generatedSql }) {
  const previousIndex = migrationIndex - 1;
  const migrations = await priorMigrationPaths(repoRoot, previousIndex);
  if (!migrations.length || Number(basename(migrations.at(-1)).slice(0, 4)) !== previousIndex) {
    throw new ValidationFailure("AUTHORITATIVE_BASE_INCOMPLETE", `expected prior migration ${previousIndex}`);
  }
  const databaseA = new DatabaseSync(":memory:");
  const databaseB = new DatabaseSync(":memory:");
  let destroyed = false;
  try {
    await applyBase(databaseA, migrations);
    await applyBase(databaseB, migrations);
    const baseA = captureDatabaseContract(databaseA);
    const baseB = captureDatabaseContract(databaseB);
    if (sha256(stableJson(baseA)) !== sha256(stableJson(baseB))) {
      throw new ValidationFailure("AUTHORITATIVE_BASE_MISMATCH", "disposable bases differ");
    }
    const seededRowCount = seedPractical0030(databaseA);
    seedPractical0030(databaseB);
    const tables = ["users", "course_groups", "courses", "curriculum_trees", "curriculum_nodes", "practical_rubric_versions", "practical_definition_versions", "practical_attempts"];
    const columnMap = preservedColumnMap(databaseA, tables);
    const beforeA = preservedData(databaseA, columnMap);
    const beforeB = preservedData(databaseB, columnMap);
    try {
      executeMigration(databaseA, existingSql);
    } catch (error) {
      throw new ValidationFailure("REJECTED_AUTHORITATIVE_MIGRATION_NOT_EXECUTABLE", error.message, failureDatabaseState(databaseA));
    }
    try {
      executeMigration(databaseB, generatedSql);
    } catch (error) {
      throw new ValidationFailure("REJECTED_GENERATED_MIGRATION_NOT_EXECUTABLE", error.message, {
        ...failureDatabaseState(databaseB),
        statementIndex: error.migrationStatementIndex ?? null,
        statement: error.migrationStatement ?? null,
        validationDatabaseReused: false,
        validationDatabaseDestroyed: true,
      });
    }
    const foreignKeysA = databaseA.prepare("PRAGMA foreign_keys").get()?.foreign_keys;
    const foreignKeysB = databaseB.prepare("PRAGMA foreign_keys").get()?.foreign_keys;
    if (foreignKeysA !== 1 || foreignKeysB !== 1) {
      throw new ValidationFailure("REJECTED_FOREIGN_KEY_STATE_UNSAFE", `${foreignKeysA}/${foreignKeysB}`);
    }
    const schemaComparison = compareDatabaseContracts(captureDatabaseContract(databaseA), captureDatabaseContract(databaseB));
    if (!schemaComparison.equivalent) {
      throw new ValidationFailure("REJECTED_SCHEMA_NOT_EQUIVALENT", JSON.stringify(schemaComparison), schemaComparison);
    }
    const afterA = preservedData(databaseA, columnMap);
    const afterB = preservedData(databaseB, columnMap);
    const dataEquivalent = stableJson(beforeA) === stableJson(afterA)
      && stableJson(beforeB) === stableJson(afterB)
      && stableJson(afterA) === stableJson(afterB);
    if (!dataEquivalent) {
      throw new ValidationFailure("REJECTED_DATA_NOT_EQUIVALENT", "pre-existing semantic rows changed");
    }
    return {
      executionValidated: true,
      schemaEquivalent: true,
      dataEquivalent: true,
      seededRowCount,
      preservedRowCount: Object.values(afterA).reduce((sum, entries) => sum + entries.length, 0),
      schemaMismatchCount: 0,
      foreignKeysBefore: 1,
      foreignKeysAfter: 1,
      validationDatabaseReused: false,
      validationDatabaseDestroyed: true,
    };
  } finally {
    databaseA.close();
    databaseB.close();
    destroyed = true;
    void destroyed;
  }
}

function metadataPaths(metaDir, identity, { binderDir = metaDir, receiptFilename = null } = {}) {
  const stem = identity.tag;
  const receiptName = receiptFilename ?? `${stem}.binding.json`;
  return {
    snapshot: join(metaDir, `${identity.prefix}_snapshot.json`),
    journal: join(metaDir, "_journal.json"),
    receipt: join(binderDir, receiptName),
    manifest: join(binderDir, `.${stem}.binding-transaction.json`),
    snapshotTemp: join(binderDir, `.${stem}.snapshot.pending`),
    journalTemp: join(binderDir, `.${stem}.journal.pending`),
    receiptTemp: join(binderDir, `.${stem}.receipt.pending`),
    snapshotRecovery: join(binderDir, `.${stem}.snapshot.recovery`),
    journalRecovery: join(binderDir, `.${stem}.journal.recovery`),
    receiptRecovery: join(binderDir, `.${stem}.receipt.recovery`),
  };
}

async function exists(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

async function readJson(path, code = "INVALID_METADATA_JSON") {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { throw new ValidationFailure(code, `${path}: ${error.message}`); }
}

async function writeExclusive(path, content) {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicReplace(source, target) {
  await rename(source, target);
}

async function removePending(paths) {
  await Promise.all([paths.snapshotTemp, paths.journalTemp, paths.receiptTemp,
    paths.snapshotRecovery, paths.journalRecovery, paths.receiptRecovery, paths.manifest]
    .map((path) => rm(path, { force: true })));
}

async function hasAny(paths) {
  for (const path of paths) if (await exists(path)) return true;
  return false;
}

async function promoteValidCandidate({ primary, recovery, target, expectedHash, code }) {
  for (const source of [primary, recovery]) {
    if (await exists(source) && sha256(await readFile(source)) === expectedHash) {
      await atomicReplace(source, target);
      return;
    }
  }
  throw new ValidationFailure(code, target);
}

export async function recoverMetadataTransaction({ metaDir, binderDir = metaDir, receiptFilename = null, identity }) {
  const paths = metadataPaths(metaDir, identity, { binderDir, receiptFilename });
  if (!(await exists(paths.manifest))) {
    const pending = [paths.snapshotTemp, paths.journalTemp, paths.receiptTemp,
      paths.snapshotRecovery, paths.journalRecovery, paths.receiptRecovery];
    if (await hasAny(pending)) {
      await Promise.all(pending.map((path) => rm(path, { force: true })));
      return "ROLL_BACK";
    }
    return "NONE";
  }
  const manifest = await readJson(paths.manifest, "INVALID_BINDING_MANIFEST");
  const snapshotValid = await exists(paths.snapshot)
    && sha256(await readFile(paths.snapshot)) === manifest.snapshotSha256;
  let journalValid = false;
  if (await exists(paths.journal)) {
    try { journalValid = sha256(await readFile(paths.journal)) === manifest.journalSha256; } catch { journalValid = false; }
  }
  if (!snapshotValid) {
    await promoteValidCandidate({ primary: paths.snapshotTemp, recovery: paths.snapshotRecovery,
      target: paths.snapshot, expectedHash: manifest.snapshotSha256, code: "RECOVERY_SNAPSHOT_UNAVAILABLE" });
  }
  if (!journalValid) {
    await promoteValidCandidate({ primary: paths.journalTemp, recovery: paths.journalRecovery,
      target: paths.journal, expectedHash: manifest.journalSha256, code: "RECOVERY_JOURNAL_UNAVAILABLE" });
  }
  const receiptValid = await exists(paths.receipt)
    && sha256(await readFile(paths.receipt)) === manifest.receiptSha256;
  if (!receiptValid) {
    await promoteValidCandidate({ primary: paths.receiptTemp, recovery: paths.receiptRecovery,
      target: paths.receipt, expectedHash: manifest.receiptSha256, code: "RECOVERY_RECEIPT_UNAVAILABLE" });
  }
  await removePending(paths);
  return "ROLL_FORWARD";
}

function inject(stage, expected) {
  if (stage === expected) throw new ValidationFailure("INJECTED_METADATA_INTERRUPTION", stage);
}

export async function commitMetadataTransaction({ metaDir, binderDir = metaDir, receiptFilename = null, identity, snapshot, journal, receipt, injectFailureAt = null }) {
  await mkdir(binderDir, { recursive: true });
  const paths = metadataPaths(metaDir, identity, { binderDir, receiptFilename });
  if (await exists(paths.snapshot) || await exists(paths.receipt)) {
    throw new ValidationFailure("PREEXISTING_METADATA_PROTECTED", identity.tag);
  }
  const currentJournal = await readJson(paths.journal, "INVALID_CANONICAL_JOURNAL");
  const currentEntries = Array.isArray(currentJournal.entries) ? currentJournal.entries : [];
  const targetEntries = Array.isArray(journal.entries) ? journal.entries : [];
  const targetEntry = targetEntries.at(-1);
  if (currentEntries.some((entry) => entry.tag === identity.tag)
    || targetEntry?.idx !== identity.idx || targetEntry?.tag !== identity.tag
    || targetEntries.length !== currentEntries.length + 1
    || stableJson(targetEntries.slice(0, -1)) !== stableJson(currentEntries)) {
    throw new ValidationFailure("JOURNAL_BINDING_PRECONDITION_FAILED", identity.tag);
  }
  const priorPath = join(metaDir, `${String(identity.idx - 1).padStart(4, "0")}_snapshot.json`);
  const priorSnapshot = await readJson(priorPath, "INVALID_PRIOR_SNAPSHOT");
  if (snapshot.prevId !== priorSnapshot.id) throw new ValidationFailure("SNAPSHOT_PARENT_MISMATCH", identity.tag);
  const snapshotText = stableJson(snapshot);
  const journalText = stableJson(journal);
  const receiptText = stableJson(receipt);
  JSON.parse(snapshotText);
  JSON.parse(journalText);
  JSON.parse(receiptText);
  if (receipt.identity !== identity.tag
    || receipt.authorityState !== VERIFIED_AUTHORITY_STATE
    || receipt.authorityPath !== VERIFIED_AUTHORITY_PATH
    || receipt.exactReplayState !== REPLAYABLE_RECEIPT_STATE
    || receipt.snapshotSha256 !== sha256(snapshotText)
    || receipt.journalSha256 !== sha256(journalText)) {
    throw new ValidationFailure("BINDING_RECEIPT_MISMATCH", identity.tag);
  }
  const manifest = {
    version: "PRACTICAL_BINDING_TXN_V1",
    transactionId: randomUUID(),
    identity: identity.tag,
    snapshotSha256: sha256(snapshotText),
    journalSha256: sha256(journalText),
    receiptSha256: sha256(receiptText),
  };
  inject(injectFailureAt, "BEFORE_SNAPSHOT_TEMP_WRITE");
  await writeExclusive(paths.snapshotTemp, snapshotText);
  inject(injectFailureAt, "AFTER_SNAPSHOT_TEMP_WRITE");
  if (injectFailureAt === "DURING_JOURNAL_TEMP_WRITE") {
    await writeExclusive(paths.journalTemp, journalText.slice(0, Math.max(1, Math.floor(journalText.length / 2))));
    throw new ValidationFailure("INJECTED_METADATA_INTERRUPTION", injectFailureAt);
  }
  await writeExclusive(paths.journalTemp, journalText);
  await writeExclusive(paths.receiptTemp, receiptText);
  await copyFile(paths.snapshotTemp, paths.snapshotRecovery);
  await copyFile(paths.journalTemp, paths.journalRecovery);
  await copyFile(paths.receiptTemp, paths.receiptRecovery);
  await writeExclusive(paths.manifest, stableJson(manifest));
  await atomicReplace(paths.snapshotTemp, paths.snapshot);
  inject(injectFailureAt, "AFTER_SNAPSHOT_PROMOTION_BEFORE_JOURNAL");
  await atomicReplace(paths.journalTemp, paths.journal);
  inject(injectFailureAt, "AFTER_JOURNAL_PROMOTION");
  await atomicReplace(paths.receiptTemp, paths.receipt);
  inject(injectFailureAt, "CLEANUP");
  await removePending(paths);
  return { status: "COMMITTED", manifestVersion: manifest.version };
}

export async function verifyBindingReceipt({ metaDir, binderDir = metaDir, receiptFilename = null, identity, existingSqlSha256, schemaSha256 = null }) {
  const paths = metadataPaths(metaDir, identity, { binderDir, receiptFilename });
  if (!(await exists(paths.receipt))) return false;
  const receipt = await readJson(paths.receipt, "INVALID_BINDING_RECEIPT");
  if (receipt.existingSqlSha256 !== existingSqlSha256
    || receipt.identity !== identity.tag
    || receipt.authorityState !== VERIFIED_AUTHORITY_STATE
    || receipt.authorityPath !== VERIFIED_AUTHORITY_PATH
    || receipt.exactReplayState !== REPLAYABLE_RECEIPT_STATE) return false;
  if (schemaSha256 !== null && receipt.schemaSha256 !== schemaSha256) return false;
  if (!(await exists(paths.snapshot)) || !(await exists(paths.journal))) return false;
  return receipt.snapshotSha256 === sha256(await readFile(paths.snapshot))
    && receipt.journalSha256 === sha256(await readFile(paths.journal));
}
