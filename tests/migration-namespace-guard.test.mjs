import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectMigrationNamespace } from "../scripts/migration-namespace-guard.mjs";

test("repository migration namespace is duplicate-free and journal-consistent", async () => {
  const result = await inspectMigrationNamespace();
  assert.equal(result.postgres.length, 35);
  assert.equal(result.d1.length, 45);
  assert.equal(result.journalEntries, 46);
});

test("D1 numeric ID collisions fail closed even with different tags", async () => {
  const root = await mkdtemp(join(tmpdir(), "securium-migration-guard-"));
  const postgresPath = join(root, "postgres");
  const drizzlePath = join(root, "drizzle");
  const metaPath = join(drizzlePath, "meta");
  await mkdir(postgresPath, { recursive: true });
  await mkdir(metaPath, { recursive: true });
  await writeFile(join(postgresPath, "0001_test.sql"), "INSERT INTO app_schema_migrations (id, checksum) VALUES ('0001_test', 'x');");
  await writeFile(join(drizzlePath, "0000_first.sql"), "-- first\n");
  await writeFile(join(drizzlePath, "0000_second.sql"), "-- second\n");
  await writeFile(join(metaPath, "_journal.json"), JSON.stringify({ entries: [] }));

  await assert.rejects(
    inspectMigrationNamespace({ postgresPath, drizzlePath, metaPath }),
    /DUPLICATE_D1_MIGRATION_ID:0000/,
  );
});
