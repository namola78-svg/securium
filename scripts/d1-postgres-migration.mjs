import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const operation = process.argv[2];
const manifest = JSON.parse(
  await readFile(resolve("db/postgres/schema-manifest.json"), "utf8"),
);
const batchSize = readPositiveInteger(option("--batch-size") ?? "250", 1, 1000);
const outputDirectory = resolve(option("--output") ?? "work/d1-export");
const execute = process.argv.includes("--execute");

if (!["export-d1", "import-postgres", "verify-migration"].includes(operation)) {
  fail("MIGRATION_OPERATION_INVALID");
}

if (!execute) {
  const expectedAction = {
    "export-d1": "read D1 in bounded batches",
    "import-postgres": "insert exported rows with ON CONFLICT DO NOTHING",
    "verify-migration": "compare row counts and foreign-key integrity",
  }[operation];
  console.log(
    `MIGRATION_DRY_RUN operation=${operation} tables=${manifest.tableCount} batchSize=${batchSize} action=${expectedAction}`,
  );
  process.exit(0);
}

if (operation === "export-d1") {
  await exportD1();
} else if (operation === "import-postgres") {
  await importPostgres();
} else {
  await verifyMigration();
}

async function exportD1() {
  const local = process.argv.includes("--local");
  const remote = process.argv.includes("--remote");
  if (local === remote) fail("D1_EXPORT_TARGET_REQUIRED");
  if (
    remote &&
    (!process.argv.includes("--confirm-production-read") ||
      process.env.D1_EXPORT_APPROVED !== "READ_ONLY_EXPORT")
  ) {
    fail("D1_REMOTE_EXPORT_APPROVAL_REQUIRED");
  }
  await mkdir(outputDirectory, { recursive: true });
  const counts = {};
  for (const table of manifest.tableOrder) {
    const definition = manifest.tables[table];
    const orderColumn = definition.primaryKey ?? definition.columns[0];
    const rows = [];
    for (let offset = 0; ; offset += batchSize) {
      const page = await d1Query(
        `SELECT * FROM ${identifier(table)} ORDER BY ${identifier(
          orderColumn,
        )} LIMIT ${batchSize} OFFSET ${offset}`,
        local,
      );
      rows.push(...page);
      if (page.length < batchSize) break;
    }
    counts[table] = rows.length;
    await writeFile(
      join(outputDirectory, `${table}.ndjson`),
      rows.map((row) => JSON.stringify(row)).join("\n") +
        (rows.length ? "\n" : ""),
      { encoding: "utf8", flag: "wx" },
    );
  }
  await writeFile(
    join(outputDirectory, "export-manifest.json"),
    `${JSON.stringify(
      {
        formatVersion: 1,
        source: local ? "d1-local" : "d1-remote",
        createdAt: new Date().toISOString(),
        schemaSource: manifest.sourceSnapshot,
        counts,
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  console.log(`D1_EXPORT_COMPLETED tables=${manifest.tableCount}`);
}

async function importPostgres() {
  requireApproval(
    "--confirm-import",
    "POSTGRES_IMPORT_APPROVED",
    "IMPORT_REVIEWED_EXPORT",
  );
  const exportManifest = await readExportManifest();
  const checkpointPath = join(outputDirectory, "import-checkpoint.json");
  let completed = new Set();
  try {
    const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
    completed = new Set(checkpoint.completedTables ?? []);
  } catch {
    // A missing checkpoint means a new import.
  }
  const psql = await psqlCommand();
  const connectionEnvironment = libpqEnvironment();
  for (const table of manifest.tableOrder) {
    if (completed.has(table)) continue;
    const rows = await readNdjson(join(outputDirectory, `${table}.ndjson`));
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      const sql = buildInsertSql(table, manifest.tables[table].columns, batch);
      const temporaryDirectory = await mkdtemp(
        join(tmpdir(), "shield-pg-import-"),
      );
      const sqlPath = join(temporaryDirectory, "batch.sql");
      try {
        await writeFile(sqlPath, sql, { encoding: "utf8", flag: "wx" });
        const result = await run(psql, [
          "-v",
          "ON_ERROR_STOP=1",
          "-f",
          sqlPath,
        ], connectionEnvironment);
        if (result.code !== 0) fail("POSTGRES_IMPORT_BATCH_FAILED");
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    }
    completed.add(table);
    await writeFile(
      checkpointPath,
      `${JSON.stringify(
        { completedTables: [...completed], updatedAt: new Date().toISOString() },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
  if (Object.keys(exportManifest.counts).length !== manifest.tableCount) {
    fail("EXPORT_MANIFEST_TABLE_COUNT_INVALID");
  }
  console.log(`POSTGRES_IMPORT_COMPLETED tables=${completed.size}`);
}

async function verifyMigration() {
  requireApproval(
    "--confirm-verify",
    "POSTGRES_VERIFY_APPROVED",
    "VERIFY_MIGRATION",
  );
  const exportManifest = await readExportManifest();
  const psql = await psqlCommand();
  const environment = libpqEnvironment();
  let countMismatches = 0;
  let orphanCount = 0;
  for (const table of manifest.tableOrder) {
    const result = await run(
      psql,
      ["-At", "-c", `SELECT COUNT(*) FROM ${identifier(table)}`],
      environment,
    );
    if (result.code !== 0) fail("POSTGRES_VERIFY_QUERY_FAILED");
    const actual = Number(result.stdout.trim());
    if (actual !== Number(exportManifest.counts[table])) countMismatches += 1;
    for (const foreignKey of manifest.tables[table].foreignKeys) {
      const predicate = foreignKey.columnsFrom
        .map(
          (column, index) =>
            `source.${identifier(column)} = target.${identifier(
              foreignKey.columnsTo[index],
            )}`,
        )
        .join(" AND ");
      const nonNull = foreignKey.columnsFrom
        .map((column) => `source.${identifier(column)} IS NOT NULL`)
        .join(" AND ");
      const orphanQuery = `SELECT COUNT(*) FROM ${identifier(
        table,
      )} source LEFT JOIN ${identifier(
        foreignKey.tableTo,
      )} target ON ${predicate} WHERE ${nonNull} AND target.${identifier(
        foreignKey.columnsTo[0],
      )} IS NULL`;
      const orphanResult = await run(
        psql,
        ["-At", "-c", orphanQuery],
        environment,
      );
      if (orphanResult.code !== 0) fail("POSTGRES_VERIFY_QUERY_FAILED");
      orphanCount += Number(orphanResult.stdout.trim());
    }
  }
  console.log(
    `MIGRATION_VERIFIED countMismatches=${countMismatches} orphanRows=${orphanCount}`,
  );
  if (countMismatches || orphanCount) process.exitCode = 1;
}

async function d1Query(sql, local) {
  const args = [
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    local ? "--local" : "--remote",
    "--config",
    option("--config") ?? "wrangler.local.jsonc",
    "--command",
    sql,
    "--json",
  ];
  const result = await run(process.execPath, args, process.env);
  if (result.code !== 0) fail("D1_EXPORT_QUERY_FAILED");
  try {
    const payload = JSON.parse(result.stdout);
    return payload?.[0]?.results ?? [];
  } catch {
    fail("D1_EXPORT_RESULT_INVALID");
  }
}

async function readExportManifest() {
  const value = JSON.parse(
    await readFile(join(outputDirectory, "export-manifest.json"), "utf8"),
  );
  if (value.formatVersion !== 1 || !value.counts) {
    fail("EXPORT_MANIFEST_INVALID");
  }
  return value;
}

async function readNdjson(path) {
  const value = await readFile(path, "utf8");
  return value
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function buildInsertSql(table, columns, rows) {
  if (rows.length === 0) return "BEGIN;\nCOMMIT;\n";
  const values = rows
    .map(
      (row) =>
        `(${columns.map((column) => sqlValue(row[column])).join(", ")})`,
    )
    .join(",\n");
  return `BEGIN;\nINSERT INTO ${identifier(table)} (${columns
    .map(identifier)
    .join(", ")}) VALUES\n${values}\nON CONFLICT DO NOTHING;\nCOMMIT;\n`;
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("EXPORT_NUMBER_INVALID");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value !== "string") return sqlValue(JSON.stringify(value));
  return `'${value.replaceAll("'", "''")}'`;
}

function identifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) fail("MIGRATION_IDENTIFIER_INVALID");
  return `"${value}"`;
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readPositiveInteger(value, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    fail("MIGRATION_BATCH_SIZE_INVALID");
  }
  return parsed;
}

function requireApproval(flag, variable, expected) {
  if (!process.argv.includes(flag) || process.env[variable] !== expected) {
    fail("MIGRATION_APPROVAL_REQUIRED");
  }
}

async function psqlCommand() {
  const candidates =
    process.platform === "win32"
      ? ["psql.exe", "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe"]
      : ["psql"];
  for (const executable of candidates) {
    const result = await run(executable, ["--version"], process.env);
    if (result.code === 0) return executable;
  }
  fail("PSQL_NOT_AVAILABLE");
}

function libpqEnvironment() {
  const directUrl = process.env.DIRECT_URL?.trim();
  if (!directUrl) fail("DIRECT_URL_REQUIRED");
  let url;
  try {
    url = new URL(directUrl);
  } catch {
    fail("DIRECT_URL_INVALID");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    fail("DIRECT_URL_INVALID");
  }
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.get("sslmode") ?? "require",
  };
}

function run(executable, args, environment) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, {
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", () => {});
    child.on("error", () => resolvePromise({ code: 1, stdout: "" }));
    child.on("close", (code) =>
      resolvePromise({ code: code ?? 1, stdout }),
    );
  });
}

function fail(code) {
  console.error(code);
  process.exit(1);
}
