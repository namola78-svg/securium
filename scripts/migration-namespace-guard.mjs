import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const postgresDir = resolve(root, "db/postgres/migrations");
const drizzleDir = resolve(root, "drizzle");
const metaDir = resolve(drizzleDir, "meta");

export async function inspectMigrationNamespace({ postgresPath = postgresDir, drizzlePath = drizzleDir, metaPath = metaDir } = {}) {
  const postgresFiles = (await readdir(postgresPath)).filter((name) => name.endsWith(".sql")).sort();
  const postgresIds = new Map();
  for (const name of postgresFiles) {
    const match = /^(\d{4})_(.+)\.sql$/.exec(name);
    if (!match) throw new Error(`UNKNOWN_POSTGRES_MIGRATION:${name}`);
    const id = match[1];
    if (postgresIds.has(id)) throw new Error(`DUPLICATE_POSTGRES_MIGRATION_ID:${id}`);
    postgresIds.set(id, name);
    const sql = await readFile(resolve(postgresPath, name), "utf8");
    if (!new RegExp(`INSERT\\s+INTO\\s+(?:public\\.)?app_schema_migrations\\s*\\(id,\\s*checksum\\)[\\s\\S]*?VALUES\\s*\\(\\s*'${id}(?:_|')`, "i").test(sql)) {
      throw new Error(`POSTGRES_MIGRATION_REGISTRATION_MISMATCH:${name}`);
    }
  }

  const drizzleFiles = (await readdir(drizzlePath)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  const tags = new Map();
  const d1Ids = new Map();
  for (const name of drizzleFiles) {
    const tag = name.replace(/\.sql$/, "");
    const id = name.slice(0, 4);
    if (tags.has(tag)) throw new Error(`DUPLICATE_D1_MIGRATION_TAG:${tag}`);
    if (d1Ids.has(id)) throw new Error(`DUPLICATE_D1_MIGRATION_ID:${id}`);
    tags.set(tag, name);
    d1Ids.set(id, name);
  }
  const journal = JSON.parse(await readFile(resolve(metaPath, "_journal.json"), "utf8"));
  if (!Array.isArray(journal.entries)) throw new Error("D1_JOURNAL_ENTRIES_INVALID");
  const idxs = new Set();
  const journalTags = new Set();
  let previousIdx = -1;
  for (const entry of journal.entries) {
    if (idxs.has(entry.idx)) throw new Error(`DUPLICATE_D1_JOURNAL_IDX:${entry.idx}`);
    if (journalTags.has(entry.tag)) throw new Error(`DUPLICATE_D1_JOURNAL_TAG:${entry.tag}`);
    if (!Number.isInteger(entry.idx) || entry.idx <= previousIdx) throw new Error(`D1_JOURNAL_ORDER_INVALID:${entry.idx}`);
    if (!tags.has(entry.tag)) throw new Error(`D1_JOURNAL_ORPHAN:${entry.tag}`);
    idxs.add(entry.idx); journalTags.add(entry.tag); previousIdx = entry.idx;
  }
  for (const tag of tags.keys()) if (!journalTags.has(tag)) throw new Error(`D1_MIGRATION_ORPHAN:${tag}`);
  const snapshotFiles = (await readdir(metaPath)).filter((name) => /^\d{4}_snapshot\.json$/.test(name));
  for (const name of snapshotFiles) {
    const idx = Number(name.slice(0, 4));
    if (!idxs.has(idx)) throw new Error(`D1_SNAPSHOT_ORPHAN:${name}`);
  }
  return { postgres: postgresFiles, d1: drizzleFiles, journalEntries: journal.entries.length };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.url.replace("file://", ""))) {
  try {
    const result = await inspectMigrationNamespace();
    console.log(`MIGRATION_NAMESPACE_GUARD_PASS postgres=${result.postgres.length} d1=${result.d1.length} journal=${result.journalEntries}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
