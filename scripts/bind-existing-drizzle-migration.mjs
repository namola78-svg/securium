import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { dirname, isAbsolute, join, relative, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import process from "node:process";
import {
  BinderStateMachine,
  commitMetadataTransaction as canonicalCommitMetadataTransaction,
  recoverMetadataTransaction as canonicalRecoverMetadataTransaction,
  stableJson,
  validateExecutableEquivalence,
  verifyBindingReceipt,
} from "./practical-drizzle-binding-validation.mjs";
const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const DRIZZLE_KIT_VERSION = "0.31.10";
const BINDER_RECEIPT_FILENAME = "securium-practical-0030-binding-receipt.json";

export class BindingError extends Error {
  constructor(code, message, details = {}) { super(`${code}: ${message}`); this.name = "BindingError"; this.code = code; this.details = details; }
}

export function sha256(value) { return createHash("sha256").update(value).digest("hex"); }

export function parseMigrationIdentity(file) {
  const name = basename(file); const match = /^(\d{4})_([a-z0-9][a-z0-9_-]*)\.sql$/i.exec(name);
  if (!match) throw new BindingError("INVALID_MIGRATION_FILENAME", `unsupported migration filename: ${name}`);
  return { prefix: match[1], idx: Number(match[1]), tag: name.slice(0, -4), filename: name };
}

export function splitSqlStatements(sql) {
  return sql.split(/-->\s*statement-breakpoint\s*/i).flatMap((part) => part.split(/;\s*(?=(?:ALTER|CREATE|DROP|PRAGMA|INSERT|UPDATE|DELETE)\b)/i)).map((statement) => statement.replace(/\/\*[^]*?\*\//g, "").replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
}

export function normalizeSqlStatement(statement) { return statement.replace(/\s+/g, " ").replace(/[`\"]/g, "`").replace(/\s*([(),])\s*/g, "$1").replace(/\s*;\s*$/, "").trim().toUpperCase(); }

export function sqlOperation(statement) {
  const normalized = normalizeSqlStatement(statement);
  const table = normalized.match(/(?:ALTER TABLE|CREATE TABLE|DROP TABLE) [`"]?([A-Z0-9_]+)[`"]?/i)?.[1];
  const index = normalized.match(/(?:CREATE (?:UNIQUE )?INDEX|DROP INDEX) [`"]?([A-Z0-9_]+)[`"]?/i)?.[1];
  const trigger = normalized.match(/(?:CREATE TRIGGER|DROP TRIGGER) [`"]?([A-Z0-9_]+)[`"]?/i)?.[1];
  return { normalized, kind: normalized.split(" ", 1)[0], object: table ?? index ?? trigger ?? null };
}

// Diagnostic only. This function is deliberately incapable of authorizing a binding.
export function classifySqlOperations(existingSql, generatedSql, targetSnapshot = {}) {
  const existing = splitSqlStatements(existingSql).map(sqlOperation); const generated = splitSqlStatements(generatedSql).map(sqlOperation);
  const forbidden = generated.filter(({ normalized }) => /EVIDENCE_PROJECTIONS|SOURCE_LINEAGE|ONTOLOGY|CURRICULUM|COURSE_LESSON/.test(normalized));
  const practical = /(?:PRACTICAL|CANONICAL_PRACTICALS|PRAGMA FOREIGN_KEYS)/;
  const unrelated = generated.filter(({ normalized }) => !practical.test(normalized));
  if (forbidden.length || unrelated.length) throw new BindingError("SQL_EQUIVALENCE_FAILED", "static diagnostic rejected unrelated generated operations", { forbidden: forbidden.map((item) => item.normalized), unrelated: unrelated.map((item) => item.normalized) });
  return { existingStatementCount: existing.length, generatedStatementCount: generated.length, normalizedExactMatch: existing.map((x) => x.normalized).join("\n") === generated.map((x) => x.normalized).join("\n"), forbiddenOperationCount: forbidden.length, targetSnapshotTableCount: Object.keys(targetSnapshot.tables ?? {}).length, authority: "DIAGNOSTIC_ONLY" };
}

function repositoryPath(repoRoot, candidate) {
  const base = resolve(repoRoot); const path = resolve(base, candidate); const rel = relative(base, path);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new BindingError("PATH_OUTSIDE_REPOSITORY", path); return path;
}

async function readJson(path, code = "INVALID_METADATA_JSON") { try { return JSON.parse(await readFile(path, "utf8")); } catch (error) { throw new BindingError(code, `${path}: ${error.message}`); } }
async function ensureFile(path, label) { try { if (!(await stat(path)).isFile()) throw new Error("not a file"); } catch { throw new BindingError("MISSING_REQUIRED_FILE", `${label}: ${path}`); } }
async function fileExists(path) { try { return (await stat(path)).isFile(); } catch { return false; } }
async function copyMeta(source, destination) { await mkdir(dirname(destination), { recursive: true }); await cp(source, destination, { recursive: true, force: true }); }

async function runGenerate(output, schema, repoRoot) {
  const wrapper = join(repoRoot, "scripts", "run-drizzle-kit.mjs"); const configPath = join(dirname(output), "drizzle.config.ts");
  const configRoot = (value) => relative(repoRoot, resolve(value)).replaceAll("\\", "/");
  await writeFile(configPath, `export default { out: "${configRoot(output)}", schema: "${configRoot(schema)}", dialect: "sqlite" };\n`, "utf8");
  try { return await execFileAsync(process.execPath, [wrapper, "generate", "--config", configPath], { cwd: repoRoot, maxBuffer: 20 * 1024 * 1024 }); }
  catch (error) { throw new BindingError("DRIZZLE_GENERATION_FAILED", `${error.stderr || error.stdout || error.message}`); }
}

export async function runAuthorityComparison({ repoRoot, migrationIndex = 30, authorizedSql, generatedSql }) {
  try {
    return await validateExecutableEquivalence({ repoRoot, migrationIndex, existingSql: authorizedSql, generatedSql });
  } catch (error) {
    throw new BindingError(error.code ?? "EXECUTION_EQUIVALENCE_FAILED", error.message, error.details ?? {});
  }
}

export async function bindExistingMigration({ existingSql, expectedSha256, apply = false, rootDir = root, failureStage }) {
  const machine = new BinderStateMachine();
  const repoRoot = resolve(rootDir); const sqlPath = repositoryPath(repoRoot, existingSql); const identity = parseMigrationIdentity(sqlPath); if (identity.prefix !== "0030") throw new BindingError("UNEXPECTED_MIGRATION_INDEX", `expected 0030, got ${identity.prefix}`);
  await ensureFile(sqlPath, "existing SQL"); const sql = await readFile(sqlPath, "utf8"); const actualSha = sha256(sql); if (actualSha !== expectedSha256) throw new BindingError("MIGRATION_HASH_MISMATCH", `${actualSha} != ${expectedSha256}`); if (DRIZZLE_KIT_VERSION !== "0.31.10") throw new BindingError("UNSUPPORTED_DRIZZLE_VERSION", DRIZZLE_KIT_VERSION);
  const metaDir = join(repoRoot, "drizzle", "meta"); const binderDir = join(repoRoot, "reports", "content-audit"); const identityForRecovery = { prefix: identity.prefix, idx: identity.idx, tag: identity.tag }; await mkdir(binderDir, { recursive: true }); await canonicalRecoverMetadataTransaction({ metaDir, binderDir, receiptFilename: BINDER_RECEIPT_FILENAME, identity: identityForRecovery }); const journalPath = join(metaDir, "_journal.json"); const journal = await readJson(journalPath); const entries = Array.isArray(journal.entries) ? journal.entries : []; const latest = entries.at(-1); if (!latest) throw new BindingError("MISSING_PRIOR_JOURNAL", journalPath);
  const schemaSha = sha256(await readFile(join(repoRoot, "db", "schema.ts")));
  const existingEntry = entries.find((entry) => entry.tag === identity.tag); if (existingEntry) { const snapshotPath = join(metaDir, `${identity.prefix}_snapshot.json`); await ensureFile(snapshotPath, "bound snapshot"); const snapshot = await readJson(snapshotPath); const priorSnapshot = await readJson(join(metaDir, `${String(identity.idx - 1).padStart(4, "0")}_snapshot.json`)); if (existingEntry.idx !== identity.idx || snapshot.prevId !== priorSnapshot.id) throw new BindingError("EXACT_REPLAY_METADATA_MISMATCH", identity.tag); if (!(await verifyBindingReceipt({ metaDir, binderDir, receiptFilename: BINDER_RECEIPT_FILENAME, identity: identityForRecovery, existingSqlSha256: actualSha, schemaSha256: schemaSha }))) throw new BindingError("EXACT_REPLAY_RECEIPT_MISSING", identity.tag); machine.transition("EXACT_REPLAY"); return { status: "EXACT_REPLAY", identity, existingSha256: actualSha, snapshot: { id: snapshot.id, prevId: snapshot.prevId }, journal: { idx: existingEntry.idx, tag: existingEntry.tag }, applied: false, binderStateHistory: machine.history }; }
  if (await fileExists(join(metaDir, `${identity.prefix}_snapshot.json`))) throw new BindingError("ORPHAN_SNAPSHOT", `${identity.prefix}_snapshot.json exists without matching journal entry`);
  if (latest.idx + 1 !== identity.idx) throw new BindingError("JOURNAL_INDEX_COLLISION", `${identity.idx} is not next after ${latest.idx}`);
  const priorSnapshot = await readJson(join(metaDir, `${String(latest.idx).padStart(4, "0")}_snapshot.json`)); const temporary = await mkdtemp(join(process.env.TEMP ?? process.cwd(), "securium-drizzle-bind-")); const output = join(temporary, "drizzle");
  try {
    await copyMeta(metaDir, join(output, "meta")); await runGenerate(output, join(repoRoot, "db", "schema.ts"), repoRoot); machine.transition("GENERATED"); const generatedJournal = await readJson(join(output, "meta", "_journal.json")); const generatedEntry = generatedJournal.entries.at(-1); if (generatedEntry?.idx !== identity.idx) throw new BindingError("GENERATED_IDENTITY_MISMATCH", JSON.stringify(generatedEntry));
    const targetSnapshot = await readJson(join(output, "meta", `${String(identity.idx).padStart(4, "0")}_snapshot.json`)); if (targetSnapshot.prevId !== priorSnapshot.id) throw new BindingError("SNAPSHOT_PARENT_MISMATCH", `${targetSnapshot.prevId} != ${priorSnapshot.id}`); const generatedSqlPath = join(output, `${generatedEntry.tag}.sql`); await ensureFile(generatedSqlPath, "generated SQL"); const generatedSql = await readFile(generatedSqlPath, "utf8");
    const diagnostic = classifySqlOperations(sql, generatedSql, targetSnapshot); let authority; try { authority = await runAuthorityComparison({ repoRoot, migrationIndex: identity.idx, authorizedSql: sql, generatedSql }); } catch (error) { machine.fail(); throw error; } machine.transition("EXECUTION_VALIDATED"); machine.transition("SCHEMA_EQUIVALENT"); machine.transition("DATA_EQUIVALENT"); const boundJournal = { ...journal, entries: [...entries, { ...generatedEntry, tag: identity.tag }] };
    const receipt = { version: "PRACTICAL_BINDING_RECEIPT_V1", identity: identity.tag, existingSqlSha256: actualSha, generatedSqlSha256: sha256(generatedSql), schemaSha256: schemaSha, snapshotSha256: sha256(stableJson(targetSnapshot)), journalSha256: sha256(stableJson(boundJournal)), authorityState: "VERIFIED_EXISTING_MIGRATION_AUTHORITY", authorityPath: "existing-migration", exactReplayState: "REPLAYABLE", validation: { executionValidated: true, schemaEquivalent: true, dataEquivalent: true, schemaMismatchCount: 0 } }; machine.transition("METADATA_PREPARED");
    const result = { status: "VALIDATED", drizzleKitVersion: DRIZZLE_KIT_VERSION, identity, existingSha256: actualSha, generatedSha256: sha256(generatedSql), diagnostic, authority: { schemaEquivalence: authority.schemaEquivalence, dataPreservationEquivalence: authority.dataPreservationEquivalence }, snapshot: { id: targetSnapshot.id, prevId: targetSnapshot.prevId }, journal: { idx: identity.idx, tag: identity.tag }, applied: false, binderStateHistory: machine.history };
    if (apply) { result.commit = await canonicalCommitMetadataTransaction({ metaDir, binderDir, receiptFilename: BINDER_RECEIPT_FILENAME, identity: identityForRecovery, snapshot: targetSnapshot, journal: boundJournal, receipt, injectFailureAt: failureStage }); machine.transition("COMMITTED"); result.applied = true; result.binderStateHistory = machine.history; } return result;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

function arg(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const existingSql = arg("--existing-sql"); const expectedSha256 = arg("--sha256"); const apply = process.argv.includes("--apply");
  if (!existingSql || !expectedSha256) { console.error("Usage: node scripts/bind-existing-drizzle-migration.mjs --existing-sql <path> --sha256 <hex> [--apply]"); process.exitCode = 2; }
  else { bindExistingMigration({ existingSql, expectedSha256, apply }).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; }); }
}
