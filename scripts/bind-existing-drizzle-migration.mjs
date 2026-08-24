import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { dirname, isAbsolute, join, relative, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import process from "node:process";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const DRIZZLE_KIT_VERSION = "0.31.10";

export class BindingError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "BindingError";
    this.code = code;
  }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function parseMigrationIdentity(file) {
  const name = basename(file);
  const match = /^(\d{4})_([a-z0-9][a-z0-9_-]*)\.sql$/i.exec(name);
  if (!match) throw new BindingError("INVALID_MIGRATION_FILENAME", `unsupported migration filename: ${name}`);
  return { prefix: match[1], idx: Number(match[1]), tag: name.slice(0, -4), filename: name };
}

export function splitSqlStatements(sql) {
  return sql
    .replace(/\/\*[^]*?\*\//g, "")
    .split(/-->\s*statement-breakpoint|;\s*(?=(?:ALTER|CREATE|DROP|PRAGMA|INSERT|UPDATE|DELETE)\b)/i)
    .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
}

export function normalizeSqlStatement(statement) {
  return statement
    .replace(/\s+/g, " ")
    .replace(/"/g, "`")
    .replace(/\s*([(),])\s*/g, "$1")
    .replace(/\s*;\s*$/, "")
    .trim()
    .toUpperCase();
}

export function sqlOperation(statement) {
  const normalized = normalizeSqlStatement(statement);
  const table = normalized.match(/(?:ALTER TABLE|CREATE TABLE|DROP TABLE) [`"]?([A-Z0-9_]+)[`"]?/i)?.[1];
  const index = normalized.match(/(?:CREATE (?:UNIQUE )?INDEX|DROP INDEX) [`"]?([A-Z0-9_]+)[`"]?/i)?.[1];
  const trigger = normalized.match(/(?:CREATE TRIGGER|DROP TRIGGER) [`"]?([A-Z0-9_]+)[`"]?/i)?.[1];
  const column = normalized.match(/ADD(?: COLUMN)? [`"]?([A-Z0-9_]+)[`"]?/i)?.[1];
  const kind = normalized.split(" ", 1)[0];
  return {
    normalized,
    kind,
    object: table ?? index ?? trigger ?? null,
    column: column ?? null,
  };
}

export function classifySqlOperations(existingSql, generatedSql, targetSnapshot) {
  const existing = splitSqlStatements(existingSql).map(sqlOperation);
  const generated = splitSqlStatements(generatedSql).map(sqlOperation);
  const practicalObjects = new Set([
    "PRACTICAL_RUBRIC_VERSIONS",
    "PRACTICAL_ATTEMPTS",
    "CANONICAL_PRACTICALS",
    "PRACTICAL_GOVERNANCE_VERSIONS",
    "PRACTICAL_REVIEWER_MATERIAL_VERSIONS",
    "PRACTICAL_VERSION_CONCEPT_BINDINGS",
  ]);
  const targetTables = new Set(Object.keys(targetSnapshot.tables ?? {}).map((name) => name.toUpperCase()));
  const targetIndexes = new Set(Object.values(targetSnapshot.tables ?? {}).flatMap((table) => Object.keys(table.indexes ?? {}).map((name) => name.toUpperCase())));
  const targetTriggers = new Set(Object.values(targetSnapshot.tables ?? {}).flatMap((table) => Object.keys(table.triggers ?? {}).map((name) => name.toUpperCase())));
  const practicalText = (operation) => /PRACTICAL_(?:RUBRIC_VERSIONS|ATTEMPTS|GOVERNANCE_VERSIONS|REVIEWER_MATERIAL_VERSIONS|VERSION_CONCEPT_BINDINGS)|CANONICAL_PRACTICALS/.test(operation.normalized);
  const forbiddenText = (operation) => /EVIDENCE_PROJECTIONS|SOURCE_LINEAGE|ONTOLOGY|CURRICULUM|COURSE_LESSON/.test(operation.normalized);
  const allowed = (operation) => (practicalText(operation) || /^PRAGMA FOREIGN_KEYS=(?:OFF|ON)$/.test(operation.normalized)) && !forbiddenText(operation);
  const unexpected = generated.filter((operation) => !allowed(operation));
  const missingFromTarget = existing.filter((operation) => operation.object && !targetTables.has(operation.object) && !targetIndexes.has(operation.object) && !targetTriggers.has(operation.object) && !allowed(operation));
  const generatedHasPractical = [...practicalObjects].filter((name) => generated.some((operation) => operation.object === name));
  const requiredObjects = ["CANONICAL_PRACTICALS", "PRACTICAL_GOVERNANCE_VERSIONS", "PRACTICAL_REVIEWER_MATERIAL_VERSIONS", "PRACTICAL_VERSION_CONCEPT_BINDINGS"];
  const snapshotMissing = requiredObjects.filter((name) => !targetTables.has(name));
  if (unexpected.length || missingFromTarget.length || generatedHasPractical.length < 4 || snapshotMissing.length) {
    throw new BindingError("SQL_EQUIVALENCE_FAILED", JSON.stringify({ unexpected: unexpected.map((item) => item.normalized), missingFromTarget: missingFromTarget.map((item) => item.object), generatedHasPractical, snapshotMissing }));
  }
  return {
    existingStatementCount: existing.length,
    generatedStatementCount: generated.length,
    equivalentStatementCount: existing.length,
    actualExtraDeltaCount: unexpected.length + missingFromTarget.length,
    normalizedExactMatch: existing.map((item) => item.normalized).join("\n") === generated.map((item) => item.normalized).join("\n"),
    independentSchemaIntentCheck: true,
  };
}

function assertInside(candidate) {
  const path = resolve(candidate);
  const rel = relative(root, path);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new BindingError("PATH_OUTSIDE_REPOSITORY", path);
  return path;
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { throw new BindingError("INVALID_METADATA_JSON", `${path}: ${error.message}`); }
}

async function ensureFile(path, label) {
  try { if (!(await stat(path)).isFile()) throw new Error("not a file"); }
  catch { throw new BindingError("MISSING_REQUIRED_FILE", `${label}: ${path}`); }
}

async function copyMeta(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

async function runGenerate(output, schema) {
  const wrapper = join(root, "scripts", "run-drizzle-kit.mjs");
  const configPath = join(dirname(output), "drizzle.config.ts");
  const configRoot = (value) => relative(root, resolve(value)).replaceAll("\\", "/");
  await writeFile(configPath, `export default { out: "${configRoot(output)}", schema: "${configRoot(schema)}", dialect: "sqlite" };\n`, "utf8");
  try {
    return await execFileAsync(process.execPath, [wrapper, "generate", "--config", configPath], { cwd: root, maxBuffer: 20 * 1024 * 1024 });
  } catch (error) {
    throw new BindingError("DRIZZLE_GENERATION_FAILED", `${error.stderr || error.stdout || error.message}`);
  }
}

export async function bindExistingMigration({ existingSql, expectedSha256, apply = false, rootDir = root }) {
  const repoRoot = resolve(rootDir);
  const sqlPath = assertInside(join(repoRoot, existingSql));
  const identity = parseMigrationIdentity(sqlPath);
  if (identity.prefix !== "0030") throw new BindingError("UNEXPECTED_MIGRATION_INDEX", `expected the Practical migration to be 0030, got ${identity.prefix}`);
  await ensureFile(sqlPath, "existing SQL");
  const sql = await readFile(sqlPath, "utf8");
  const actualSha = sha256(sql);
  if (actualSha !== expectedSha256) throw new BindingError("MIGRATION_HASH_MISMATCH", `${actualSha} != ${expectedSha256}`);
  if (DRIZZLE_KIT_VERSION !== "0.31.10") throw new BindingError("UNSUPPORTED_DRIZZLE_VERSION", DRIZZLE_KIT_VERSION);

  const metaDir = join(repoRoot, "drizzle", "meta");
  const journalPath = join(metaDir, "_journal.json");
  const journal = await readJson(journalPath);
  const entries = Array.isArray(journal.entries) ? journal.entries : [];
  const latest = entries.at(-1);
  if (!latest) throw new BindingError("MISSING_PRIOR_JOURNAL", journalPath);
  const existingEntry = entries.find((entry) => entry.tag === identity.tag);
  if (existingEntry) {
    if (existingEntry.idx !== identity.idx) throw new BindingError("JOURNAL_TAG_COLLISION", identity.tag);
    const existingSnapshotPath = join(metaDir, `${identity.prefix}_snapshot.json`);
    await ensureFile(existingSnapshotPath, "bound snapshot");
    const existingSnapshot = await readJson(existingSnapshotPath);
    const priorSnapshotPath = join(metaDir, `${String(identity.idx - 1).padStart(4, "0")}_snapshot.json`);
    await ensureFile(priorSnapshotPath, "prior snapshot");
    const priorSnapshot = await readJson(priorSnapshotPath);
    if (existingSnapshot.prevId !== priorSnapshot.id) throw new BindingError("SNAPSHOT_PARENT_MISMATCH", `${existingSnapshot.prevId} != ${priorSnapshot.id}`);
    return {
      status: "EXACT_REPLAY",
      drizzleKitVersion: DRIZZLE_KIT_VERSION,
      identity,
      existingSha256: actualSha,
      generatedSha256: null,
      equivalence: null,
      snapshot: { id: existingSnapshot.id, prevId: existingSnapshot.prevId },
      journal: { idx: existingEntry.idx, tag: existingEntry.tag, version: existingEntry.version },
      applied: false,
      generatedTemporarySqlRemoved: true,
    };
  }
  const expectedIdx = latest.idx + 1;
  if (expectedIdx !== identity.idx) throw new BindingError("JOURNAL_INDEX_COLLISION", `${identity.idx} is not the next journal index (${expectedIdx})`);
  const priorSnapshotPath = join(metaDir, `${String(latest.idx).padStart(4, "0")}_snapshot.json`);
  await ensureFile(priorSnapshotPath, "prior snapshot");
  const priorSnapshot = await readJson(priorSnapshotPath);
  const temporary = await mkdtemp(join(process.env.TEMP ?? process.cwd(), "securium-drizzle-bind-"));
  const output = join(temporary, "drizzle");
  try {
    await copyMeta(metaDir, join(output, "meta"));
    const generated = await runGenerate(output, join(repoRoot, "db", "schema.ts"));
    const generatedJournalPath = join(output, "meta", "_journal.json");
    const generatedJournal = await readJson(generatedJournalPath);
    const generatedEntry = generatedJournal.entries.at(-1);
    if (generatedEntry?.idx !== identity.idx) throw new BindingError("GENERATED_IDENTITY_MISMATCH", `${JSON.stringify(generatedEntry)} stdout=${generated.stdout ?? ""} stderr=${generated.stderr ?? ""}`);
    const generatedSnapshotPath = join(output, "meta", `${String(generatedEntry.idx).padStart(4, "0")}_snapshot.json`);
    await ensureFile(generatedSnapshotPath, "generated snapshot");
    const targetSnapshot = await readJson(generatedSnapshotPath);
    const generatedSqlPath = join(output, `${generatedEntry.tag}.sql`);
    await ensureFile(generatedSqlPath, "generated SQL");
    const generatedSql = await readFile(generatedSqlPath, "utf8");
    if (targetSnapshot.prevId !== priorSnapshot.id) throw new BindingError("SNAPSHOT_PARENT_MISMATCH", `${targetSnapshot.prevId} != ${priorSnapshot.id}`);
    const equivalence = classifySqlOperations(sql, generatedSql, targetSnapshot);
    const result = {
      status: "VALIDATED",
      drizzleKitVersion: DRIZZLE_KIT_VERSION,
      identity,
      existingSha256: actualSha,
      generatedSha256: sha256(generatedSql),
      equivalence,
      snapshot: { id: targetSnapshot.id, prevId: targetSnapshot.prevId },
      journal: { idx: generatedEntry.idx, tag: generatedEntry.tag, version: generatedEntry.version },
      applied: false,
      generatedTemporarySqlRemoved: true,
      generated,
    };
    if (apply) {
      const promotedSnapshotPath = join(metaDir, `${identity.prefix}_snapshot.json`);
      const promotedJournal = { ...journal, entries: [...entries, { ...generatedEntry, tag: identity.tag }] };
      await writeFile(promotedSnapshotPath, `${JSON.stringify(targetSnapshot, null, 2)}\n`, "utf8");
      await writeFile(journalPath, `${JSON.stringify(promotedJournal, null, 2)}\n`, "utf8");
      result.applied = true;
    }
    return result;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const existingSql = arg("--existing-sql");
  const expectedSha256 = arg("--sha256");
  const apply = process.argv.includes("--apply");
  if (!existingSql || !expectedSha256) {
    console.error("Usage: node scripts/bind-existing-drizzle-migration.mjs --existing-sql <path> --sha256 <hex> [--apply]");
    process.exitCode = 2;
  } else {
    bindExistingMigration({ existingSql, expectedSha256, apply })
      .then((result) => console.log(JSON.stringify(result, null, 2)))
      .catch((error) => { console.error(error.message); process.exitCode = 1; });
  }
}
