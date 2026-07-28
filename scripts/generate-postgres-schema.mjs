import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const snapshotPath = resolve("drizzle/meta/0013_snapshot.json");
const outputPath = resolve(
  "db/postgres/migrations/0001_d1_compatibility_schema.sql",
);
const manifestPath = resolve("db/postgres/schema-manifest.json");

const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const tables = snapshot.tables;
const tableOrder = topologicalTableOrder(tables);
const lines = [
  "-- GENERATED from drizzle/meta/0013_snapshot.json.",
  "-- Review before applying. Production execution requires explicit approval.",
  "BEGIN;",
  "",
  "CREATE TABLE IF NOT EXISTS app_schema_migrations (",
  '  "id" text PRIMARY KEY,',
  '  "checksum" text NOT NULL,',
  '  "applied_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP',
  ");",
  "",
];

for (const tableName of tableOrder) {
  const table = tables[tableName];
  const definitions = [];
  for (const column of Object.values(table.columns)) {
    definitions.push(`  ${columnSql(column)}`);
  }
  for (const foreignKey of Object.values(table.foreignKeys)) {
    definitions.push(
      `  CONSTRAINT ${identifier(foreignKey.name)} FOREIGN KEY (${foreignKey.columnsFrom
        .map(identifier)
        .join(", ")}) REFERENCES ${identifier(foreignKey.tableTo)} (${foreignKey.columnsTo
        .map(identifier)
        .join(", ")}) ON UPDATE ${action(foreignKey.onUpdate)} ON DELETE ${action(
        foreignKey.onDelete,
      )}`,
    );
  }
  for (const checkConstraint of Object.values(table.checkConstraints)) {
    definitions.push(
      `  CONSTRAINT ${identifier(checkConstraint.name)} CHECK (${checkConstraint.value})`,
    );
  }
  lines.push(
    `CREATE TABLE ${identifier(tableName)} (\n${definitions.join(",\n")}\n);`,
    "",
  );
  // PostgreSQL requires a referenced UNIQUE index to exist before a later
  // table can create a foreign key against those columns. Emit each table's
  // indexes immediately after the table instead of deferring every index until
  // all tables have been created.
  for (const index of Object.values(table.indexes)) {
    const where = index.where ? ` WHERE ${index.where}` : "";
    lines.push(
      `CREATE ${index.isUnique ? "UNIQUE " : ""}INDEX ${identifier(
        index.name,
      )} ON ${identifier(tableName)} (${index.columns
        .map(identifier)
        .join(", ")})${where};`,
    );
  }
}

lines.push(
  "",
  "INSERT INTO app_schema_migrations (id, checksum)",
  "VALUES ('0001_d1_compatibility_schema', 'snapshot-0013')",
  "ON CONFLICT (id) DO NOTHING;",
  "",
  "COMMIT;",
  "",
);

const manifest = {
  sourceSnapshot: "drizzle/meta/0013_snapshot.json",
  tableCount: tableOrder.length,
  tableOrder,
  tables: Object.fromEntries(
    tableOrder.map((name) => [
      name,
      {
        columns: Object.keys(tables[name].columns),
        primaryKey:
          Object.values(tables[name].columns).find(
            (column) => column.primaryKey,
          )?.name ?? null,
        foreignKeys: Object.values(tables[name].foreignKeys).map(
          (foreignKey) => ({
            name: foreignKey.name,
            tableTo: foreignKey.tableTo,
            columnsFrom: foreignKey.columnsFrom,
            columnsTo: foreignKey.columnsTo,
          }),
        ),
      },
    ]),
  ),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${lines.join("\n")}`, "utf8");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`POSTGRES_SCHEMA_GENERATED tables=${tableOrder.length}`);

function columnSql(column) {
  const parts = [identifier(column.name), postgresType(column.type)];
  if (column.primaryKey) parts.push("PRIMARY KEY");
  if (column.notNull) parts.push("NOT NULL");
  if (column.default !== undefined) {
    parts.push("DEFAULT", postgresDefault(column.default, column.type));
  }
  return parts.join(" ");
}

function postgresType(type) {
  if (type === "text") return "text";
  if (type === "integer") return "integer";
  throw new Error(`Unsupported SQLite type: ${type}`);
}

function postgresDefault(value, type) {
  if (type === "integer" && value === true) return "1";
  if (type === "integer" && value === false) return "0";
  if (type === "text" && value === "CURRENT_TIMESTAMP") {
    return "(CURRENT_TIMESTAMP::text)";
  }
  return String(value);
}

function topologicalTableOrder(tableMap) {
  const names = Object.keys(tableMap);
  const dependencies = new Map(
    names.map((name) => [
      name,
      new Set(
        Object.values(tableMap[name].foreignKeys)
          .map((foreignKey) => foreignKey.tableTo)
          .filter((target) => target !== name),
      ),
    ]),
  );
  const order = [];
  while (order.length < names.length) {
    const ready = names
      .filter(
        (name) =>
          !order.includes(name) &&
          [...dependencies.get(name)].every((dependency) =>
            order.includes(dependency),
          ),
      )
      .sort();
    if (ready.length === 0) {
      throw new Error("Cross-table foreign key cycle requires manual review.");
    }
    order.push(...ready);
  }
  return order;
}

function identifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Unsafe identifier: ${value}`);
  }
  return `"${value}"`;
}

function action(value) {
  const normalized = String(value ?? "no action").toUpperCase();
  if (!["NO ACTION", "RESTRICT", "CASCADE", "SET NULL"].includes(normalized)) {
    throw new Error(`Unsupported foreign key action: ${value}`);
  }
  return normalized;
}
