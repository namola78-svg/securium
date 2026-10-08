import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { promisify } from "node:util";
import {
  assertMigrationConnectionUrl,
  executeGuardedMigration,
  MigrationGuardError,
  parsePostgresDurationMilliseconds,
  deployMigrationOnReservedConnection,
  expectedMigrationChecksum,
  createMigrationClient,
} from "../scripts/postgres-migration-guard.mjs";
import { cleanupOwnedPostgresContainer, createOwnedPostgresContainer, getPublishedPostgresPort } from "../scripts/owned-postgres-container.mjs";

const execFile = promisify(execFileCallback);
const fixtureMigration = {
  id: "guard_fixture_0001",
  sql: `BEGIN;
CREATE TABLE migration_guard_fixture (id integer PRIMARY KEY);
INSERT INTO app_schema_migrations (id, checksum)
VALUES ('guard_fixture_0001', 'guard-fixture');
COMMIT;`,
};
const legacyRlsMigration = {
  id: "0041_legacy_concept_rls_hardening",
  sql: readFileSync("db/postgres/migrations/0041_legacy_concept_rls_hardening.sql", "utf8"),
};
const baselineReceiptRlsMigration = {
  id: "0058_app_schema_baseline_receipts_rls_hardening",
  sql: readFileSync("db/postgres/migrations/0058_app_schema_baseline_receipts_rls_hardening.sql", "utf8"),
};

test("case 1: exact session settings pass before DDL", async () => {
  const state = createFakeSession();
  const events = [];
  const result = await executeGuardedMigration({
    session: state.session,
    migration: fixtureMigration,
    logger: (message) => events.push(message),
  });

  assert.equal(result.applied, true);
  assert.equal(state.ddlStatementsExecuted, 1);
  assert.equal(state.migrationRows, 1);
  assert.equal(state.targetTablesCreated, 1);
  assert.equal(events.at(-1)?.includes("action=EXECUTE"), true);
  assert.equal(state.executionEvents[0], "BEGIN");
  assert.equal(state.executionEvents.at(-1), "COMMIT");
});

test("valid applied migration requires the exact registered checksum", async () => {
  const state = createFakeSession({
    migrationLedgerRows: [{ id: fixtureMigration.id, checksum: "guard-fixture" }],
  });
  const result = await executeGuardedMigration({
    session: state.session,
    migration: fixtureMigration,
    logger: (message) => state.events.push(message),
  });

  assert.equal(result.applied, false);
  assert.equal(state.ddlStatementsExecuted, 0);
  assert.equal(state.events.at(-1)?.includes("action=ALREADY_APPLIED_VALID"), true);
});

test("same migration ID with a different checksum fails closed before DDL", async () => {
  const state = createFakeSession({
    migrationLedgerRows: [{ id: fixtureMigration.id, checksum: "wrong-checksum" }],
  });
  await assert.rejects(
    executeGuardedMigration({
      session: state.session,
      migration: fixtureMigration,
      logger: () => {},
    }),
    hasGuardCode("MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH"),
  );
  assertZeroDdl(state);
});

test("0041 legacy Concept RLS migration uses its approved checksum", async () => {
  assert.equal(expectedMigrationChecksum(legacyRlsMigration), "legacy-concept-rls-hardening-v1");
  const state = createFakeSession({
    migrationLedgerRows: [{ id: legacyRlsMigration.id, checksum: "legacy-concept-rls-hardening-v1" }],
  });
  const result = await executeGuardedMigration({
    session: state.session,
    migration: legacyRlsMigration,
    logger: () => {},
  });
  assert.equal(result.applied, false);
  assert.equal(state.ddlStatementsExecuted, 0);
});

test("0058 baseline receipt RLS migration is limited to enabling RLS", async () => {
  assert.equal(expectedMigrationChecksum(baselineReceiptRlsMigration), "app-schema-baseline-receipts-rls-hardening-v1");
  assert.match(baselineReceiptRlsMigration.sql, /ALTER TABLE public\.app_schema_baseline_receipts ENABLE ROW LEVEL SECURITY/i);
  assert.doesNotMatch(baselineReceiptRlsMigration.sql, /CREATE\s+POLICY|FORCE\s+ROW\s+LEVEL\s+SECURITY|\bGRANT\b|\bREVOKE\b|\bUPDATE\s+public\.app_schema_baseline_receipts|\bDELETE\s+FROM\s+public\.app_schema_baseline_receipts/i);
  const state = createFakeSession({
    migrationLedgerRows: [{ id: baselineReceiptRlsMigration.id, checksum: "app-schema-baseline-receipts-rls-hardening-v1" }],
  });
  const result = await executeGuardedMigration({
    session: state.session,
    migration: baselineReceiptRlsMigration,
    logger: () => {},
  });
  assert.equal(result.applied, false);
  assert.equal(state.ddlStatementsExecuted, 0);
});

test("missing, null, and empty migration ledger checksums fail closed", async () => {
  for (const checksum of [null, ""]) {
    const state = createFakeSession({
      migrationLedgerRows: [{ id: fixtureMigration.id, checksum }],
    });
    await assert.rejects(
      executeGuardedMigration({
        session: state.session,
        migration: fixtureMigration,
        logger: () => {},
      }),
      hasGuardCode("MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH"),
    );
    assertZeroDdl(state);
  }
});

test("duplicate migration ledger IDs fail closed", async () => {
  const state = createFakeSession({
    migrationLedgerRows: [
      { id: fixtureMigration.id, checksum: "guard-fixture" },
      { id: fixtureMigration.id, checksum: "guard-fixture" },
    ],
  });
  await assert.rejects(
    executeGuardedMigration({
      session: state.session,
      migration: fixtureMigration,
      logger: () => {},
    }),
    hasGuardCode("MIGRATION_GUARD_MIGRATION_LEDGER_DUPLICATE"),
  );
  assertZeroDdl(state);
});

test("all governed PostgreSQL migrations expose the existing checksum convention", async () => {
  const files = (await readdir("db/postgres/migrations"))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
  assert.equal(files.length, 43);
  assert.ok(files.includes("0060_isms_profile_mapping_foundation.sql"));
  for (const file of files) {
    const migration = {
      id: file.replace(/\.sql$/, ""),
      sql: readFileSync(`db/postgres/migrations/${file}`, "utf8"),
    };
    assert.ok(expectedMigrationChecksum(migration), file);
  }
});

test("case 2: lock_timeout 0 blocks before DDL", async () => {
  await assertBlocked(
    { lockTimeout: "0" },
    "MIGRATION_GUARD_LOCK_TIMEOUT_MISMATCH",
  );
});

test("case 3: statement_timeout 2min blocks before DDL", async () => {
  await assertBlocked(
    { statementTimeout: "2min" },
    "MIGRATION_GUARD_STATEMENT_TIMEOUT_MISMATCH",
  );
});

test("case 4: idle timeout 0 blocks before DDL", async () => {
  await assertBlocked(
    { idleInTransactionSessionTimeout: "0" },
    "MIGRATION_GUARD_IDLE_TIMEOUT_MISMATCH",
  );
});

test("case 5: readback failure blocks before DDL", async () => {
  const state = createFakeSession({ readbackFailure: true });
  await assert.rejects(
    executeGuardedMigration({
      session: state.session,
      migration: fixtureMigration,
      logger: () => {},
    }),
    hasGuardCode("MIGRATION_GUARD_TIMEOUT_READBACK_FAILED"),
  );
  assertZeroDdl(state);
});

test("case 6: unparseable timeout blocks before DDL", async () => {
  await assertBlocked(
    { lockTimeout: "not-a-duration" },
    "MIGRATION_GUARD_TIMEOUT_PARSE_FAILED",
  );
});

test("case 7: session identity switch blocks before DDL", async () => {
  const state = createFakeSession({ executionSessionIdentity: "902" });
  await assert.rejects(
    executeGuardedMigration({
      session: state.session,
      migration: fixtureMigration,
      logger: () => {},
    }),
    hasGuardCode("MIGRATION_GUARD_SESSION_CHANGED"),
  );
  assertZeroDdl(state);
});

test("duration normalization accepts supported equivalents exactly", () => {
  assert.equal(parsePostgresDurationMilliseconds("5s"), 5_000);
  assert.equal(parsePostgresDurationMilliseconds("5000ms"), 5_000);
  assert.equal(parsePostgresDurationMilliseconds("00:00:05"), 5_000);
  assert.equal(parsePostgresDurationMilliseconds("1min"), 60_000);
  assert.equal(parsePostgresDurationMilliseconds("00:01:00"), 60_000);
  assert.throws(
    () => parsePostgresDurationMilliseconds("60001.5ms"),
    hasGuardCode("MIGRATION_GUARD_TIMEOUT_PARSE_FAILED"),
  );
  assert.throws(
    () => assertMigrationConnectionUrl("postgres://u:p@host:6543/db"),
    hasGuardCode("MIGRATION_GUARD_TRANSACTION_POOLING_FORBIDDEN"),
  );
  assert.throws(
    () => assertMigrationConnectionUrl("postgres://u:p@host:5432/db"),
    hasGuardCode("MIGRATION_GUARD_TARGET_APPROVAL_REQUIRED"),
  );
  const disposablePlan = assertMigrationConnectionUrl(
    "postgres://postgres:p@localhost:55432/db",
    { env: {}, disposable: { port: 55432 } },
  );
  assert.equal(disposablePlan.host, "127.0.0.1");
  assert.equal(disposablePlan.port, 55432);
  assert.equal(disposablePlan.mode, "owned-loopback-disposable");
  assert.throws(
    () => assertMigrationConnectionUrl("postgres://u:p@db.example.test:55432/db"),
    hasGuardCode("MIGRATION_GUARD_REMOTE_CUSTOM_PORT_FORBIDDEN"),
  );
});

test("repository deploy runner preserves approval and rejects unsafe transports", async () => {
  const baseEnvironment = {
    ...process.env,
    POSTGRES_MIGRATION_URL:
      "postgres://migration:test-password@127.0.0.1:5432/test",
  };
  delete baseEnvironment.POSTGRES_MIGRATION_APPROVED;
  delete baseEnvironment.POSTGRES_MIGRATION_USE_PSQL;
  await assertNodeFailure(
    ["scripts/postgres-migrations.mjs", "deploy", "--confirm"],
    baseEnvironment,
    "POSTGRES_MIGRATION_APPROVAL_REQUIRED",
  );
  await assertNodeFailure(
    ["scripts/postgres-migrations.mjs", "deploy", "--confirm"],
    { ...baseEnvironment, POSTGRES_MIGRATION_APPROVED: "incorrect-approval" },
    "POSTGRES_MIGRATION_APPROVAL_REQUIRED",
  );
  await assertNodeFailure(
    ["scripts/postgres-migrations.mjs", "deploy"],
    { ...baseEnvironment, POSTGRES_MIGRATION_APPROVED: "APPLY_REVIEWED_MIGRATIONS" },
    "POSTGRES_MIGRATION_APPROVAL_REQUIRED",
  );
  await assertNodeFailure(
    ["scripts/postgres-migrations.mjs", "deploy", "--confirm"],
    {
      ...baseEnvironment,
      POSTGRES_MIGRATION_APPROVED: "APPLY_REVIEWED_MIGRATIONS",
      POSTGRES_MIGRATION_USE_PSQL: "1",
    },
    "MIGRATION_GUARD_SINGLE_SESSION_REQUIRED",
  );
  await assertNodeFailure(
    ["scripts/postgres-migrations.mjs", "deploy", "--confirm"],
    {
      ...baseEnvironment,
      POSTGRES_MIGRATION_URL:
        "postgres://migration:test-password@127.0.0.1:6543/test",
      POSTGRES_MIGRATION_APPROVED: "APPLY_REVIEWED_MIGRATIONS",
    },
    "MIGRATION_GUARD_TRANSACTION_POOLING_FORBIDDEN",
  );
  await assertNodeFailure(
    ["scripts/postgres-migrations.mjs", "deploy", "--confirm"],
    {
      ...baseEnvironment,
      POSTGRES_MIGRATION_URL:
        "postgres://migration:test-password@db.example.test:55432/test",
      POSTGRES_MIGRATION_APPROVED: "APPLY_REVIEWED_MIGRATIONS",
    },
    "MIGRATION_GUARD_REMOTE_CUSTOM_PORT_FORBIDDEN",
  );
});

test("disposable PostgreSQL 17.6 executes fixture only after guard pass", async () => {
  const container = `securium-migration-guard-${randomUUID()}`;
  const password = "guard-test-password-2026";
  let sql;
  let owned;
  try {
    await mkdir("tmp", { recursive: true });
    owned = await createOwnedPostgresContainer({ name: container, ownerToken: randomUUID(), password, receiptPath: resolve(`tmp/${container}-owner.json`) });
    await waitForPostgres(container);
    const port = Number(await getPublishedPostgresPort(owned));
    assert.ok(port, "Docker must publish a disposable PostgreSQL port.");

    const postgres = (await import("postgres")).default;
    const plan = assertMigrationConnectionUrl(`postgres://postgres:${password}@localhost:${port}/postgres`, { env: {}, disposable: { port } });
    sql = createMigrationClient(postgres, plan);
    assert.deepEqual(sql.options.host, ["127.0.0.1"]);
    assert.deepEqual(sql.options.port, [port]);
    await waitForClientConnection(sql);
    await sql.unsafe(`CREATE TABLE app_schema_migrations (
      id text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    const events = [];
    const result = await deployMigrationOnReservedConnection({
      sql,
      migration: fixtureMigration,
      identity: { database: "postgres", role: "postgres" },
      logger: (message) => events.push(message),
    });
    assert.equal(result.code, 0);
    assert.equal(result.applied, true);
    assert.equal(result.ddlStarted, true);
    assert.equal(events.at(-1)?.includes("action=EXECUTE"), true);

    const tables = await sql.unsafe(
      "SELECT count(*)::int AS count FROM pg_class WHERE relname = 'migration_guard_fixture' AND relkind = 'r'",
    );
    const registrations = await sql.unsafe(
      "SELECT count(*)::int AS count FROM app_schema_migrations WHERE id = 'guard_fixture_0001'",
    );
    assert.equal(tables[0].count, 1);
    assert.equal(registrations[0].count, 1);

    const wrongRole = await deployMigrationOnReservedConnection({ sql, migration: fixtureMigration, identity: { database: "postgres", role: "unapproved" }, logger: () => {} });
    assert.equal(wrongRole.errorCode, "MIGRATION_GUARD_DATABASE_ROLE_MISMATCH");
    assert.equal(wrongRole.ddlStarted, false);
    assert.equal(wrongRole.rollbackSucceeded, true);
    const wrongDatabase = await deployMigrationOnReservedConnection({ sql, migration: fixtureMigration, identity: { database: "unapproved", role: "postgres" }, logger: () => {} });
    assert.equal(wrongDatabase.errorCode, "MIGRATION_GUARD_DATABASE_ROLE_MISMATCH");
    assert.equal(wrongDatabase.ddlStarted, false);

    const evidenceMigration = {
      id: "guard_transaction_evidence",
      sql: "BEGIN;\nCREATE TABLE guard_transaction_evidence AS SELECT pg_backend_pid()::text AS pid, current_setting('lock_timeout') AS lock_timeout, current_setting('statement_timeout') AS statement_timeout, current_setting('idle_in_transaction_session_timeout') AS idle_timeout;\nINSERT INTO app_schema_migrations (id, checksum) VALUES ('guard_transaction_evidence','transaction-evidence');\nCOMMIT;",
    };
    const transactionEvents = [];
    const transaction = await deployMigrationOnReservedConnection({ sql, migration: evidenceMigration, identity: { database: "postgres", role: "postgres" }, logger: message => transactionEvents.push(message) });
    assert.equal(transaction.code, 0);
    const [observed] = await sql.unsafe("SELECT * FROM guard_transaction_evidence");
    assert.deepEqual(observed, { pid: transactionEvents.at(-1).match(/session=(\d+)/)[1], lock_timeout: "5s", statement_timeout: "1min", idle_timeout: "1min" });
    const [afterCommit] = await sql.unsafe("SELECT current_setting('lock_timeout') AS value");
    assert.equal(afterCommit.value, "0", "SET LOCAL must expire on commit");

    for (const [id, errorSql, expectedCode] of [
      ["guard_sql_failure", "DO $$ BEGIN RAISE EXCEPTION 'sensitive synthetic error text'; END; $$;", "P0001"],
      ["guard_missing_receipt", "", "MIGRATION_GUARD_MIGRATION_RECEIPT_MISSING"],
      ["guard_changed_receipt", "", "MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH"],
    ]) {
      const cleanup = id === "guard_missing_receipt" ? `DELETE FROM app_schema_migrations WHERE id='${id}';` : id === "guard_changed_receipt" ? `UPDATE app_schema_migrations SET checksum='incorrect' WHERE id='${id}';` : "";
      const migration = { id, sql: `BEGIN;\nCREATE TABLE ${id}(id int);\n${errorSql}\nINSERT INTO app_schema_migrations (id, checksum) VALUES ('${id}','expected');\n${cleanup}\nCOMMIT;` };
      const failure = await deployMigrationOnReservedConnection({ sql, migration, identity: { database: "postgres", role: "postgres" }, logger: () => {} });
      assert.equal(failure.code, 1);
      assert.equal(failure.errorCode, expectedCode);
      assert.equal(failure.ddlStarted, true);
      assert.equal(failure.rollbackAttempted, true);
      assert.equal(failure.rollbackSucceeded, true);
      assert.equal(JSON.stringify(failure).includes("sensitive"), false);
      assert.equal((await sql.unsafe("SELECT to_regclass($1) AS relation", [id]))[0].relation, null);
      assert.equal((await sql.unsafe("SELECT id FROM app_schema_migrations WHERE id=$1", [id])).length, 0);
    }

    await sql.unsafe("UPDATE app_schema_migrations SET checksum='incorrect' WHERE id=$1", [fixtureMigration.id]);
    const checksumFailure = await deployMigrationOnReservedConnection({ sql, migration: fixtureMigration, logger: () => {} });
    assert.equal(checksumFailure.code, 1);
    assert.equal(checksumFailure.errorCode, "MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH");
    assert.equal(checksumFailure.ddlStarted, false);
    assert.equal(checksumFailure.rollbackSucceeded, true);

    const cliEnvironment = { ...process.env };
    for (const name of Object.keys(cliEnvironment)) if (/^PG|^POSTGRES_|^DIRECT_URL$|^DATABASE_URL$/.test(name)) delete cliEnvironment[name];
    await sql.unsafe("CREATE DATABASE guard_cli_empty");
    cliEnvironment.POSTGRES_MIGRATION_URL = `postgres://postgres:${password}@localhost:${port}/guard_cli_empty`;
    cliEnvironment.POSTGRES_MIGRATION_DISPOSABLE_RECEIPT = owned.receiptPath;
    const status = await execFile(process.execPath, ["scripts/postgres-migrations.mjs", "status"], { env: cliEnvironment, windowsHide: true });
    assert.match(status.stdout, /tls=DISPOSABLE_PLAINTEXT authority=owned-disposable/);
    assert.equal((status.stdout + status.stderr).includes(password), false);
    for (const overrides of [{ POSTGRES_MIGRATION_DISPOSABLE_RECEIPT: "" }, { PGPORT: "6543" }, { PGHOST: "unapproved.example.test" }]) {
      await assertNodeFailure(["scripts/postgres-migrations.mjs", "status"], { ...cliEnvironment, ...overrides }, overrides.PGPORT || overrides.PGHOST ? "MIGRATION_GUARD_INHERITED_CONNECTION_OPTIONS_FORBIDDEN" : "MIGRATION_GUARD_DISPOSABLE_OWNERSHIP_REQUIRED");
    }
    const impostorReceipt = resolve(`tmp/${container}-incorrect-owner.json`);
    await writeFile(impostorReceipt, JSON.stringify({ ...owned, ownerToken: "incorrect-owner" }));
    await assertNodeFailure(["scripts/postgres-migrations.mjs", "status"], { ...cliEnvironment, POSTGRES_MIGRATION_DISPOSABLE_RECEIPT: impostorReceipt }, "MIGRATION_GUARD_DISPOSABLE_OWNERSHIP_MISMATCH");
    const differentPort = port === 65535 ? port - 1 : port + 1;
    await assertNodeFailure(["scripts/postgres-migrations.mjs", "status"], { ...cliEnvironment, POSTGRES_MIGRATION_URL: `postgres://postgres:${password}@localhost:${differentPort}/guard_cli_empty` }, "MIGRATION_GUARD_DISPOSABLE_ENDPOINT_MISMATCH");
    await assertNodeFailure(["scripts/postgres-migrations.mjs", "status"], { ...cliEnvironment, POSTGRES_MIGRATION_URL: "postgres://postgres:synthetic@db.abcdefghijklmnopqrst.supabase.co/postgres" }, "MIGRATION_GUARD_DISPOSABLE_ENDPOINT_MISMATCH");
  } finally {
    if (sql) await sql.end({ timeout: 5 });
    if (owned) await cleanupOwnedPostgresContainer(owned);
  }
});

async function assertBlocked(overrides, expectedCode) {
  const state = createFakeSession({ controls: overrides });
  await assert.rejects(
    executeGuardedMigration({
      session: state.session,
      migration: fixtureMigration,
      logger: () => {},
    }),
    hasGuardCode(expectedCode),
  );
  assertZeroDdl(state);
}

function assertZeroDdl(state) {
  assert.equal(state.ddlStatementsExecuted, 0);
  assert.equal(state.migrationRows, 0);
  assert.equal(state.targetTablesCreated, 0);
}

function createFakeSession(options = {}) {
  const state = {
    ddlStatementsExecuted: 0,
    migrationRows: 0,
    targetTablesCreated: 0,
    executionEvents: [],
    events: [],
  };
  const controls = {
    lockTimeout: "5s",
    statementTimeout: "60s",
    idleInTransactionSessionTimeout: "60s",
    sessionIdentity: "901",
    ...options.controls,
  };
  state.session = {
    beginTransaction: async () => { state.executionEvents.push("BEGIN"); },
    commitTransaction: async () => { state.executionEvents.push("COMMIT"); },
    rollbackTransaction: async () => { state.executionEvents.push("ROLLBACK"); },
    executeControl: async () => {
      state.executionEvents.push("SET");
    },
    readControls: async () => {
      if (options.readbackFailure) throw new Error("synthetic readback failure");
      state.executionEvents.push("READBACK");
      return controls;
    },
    readMigrationLedger: async () => options.migrationLedgerRows ?? state.receipts ?? [],
    readSessionIdentity: async () => {
      state.identityReads = (state.identityReads ?? 0) + 1;
      return state.identityReads === 1 ? controls.sessionIdentity : options.executionSessionIdentity ?? controls.sessionIdentity;
    },
    executeMigration: async body => {
      state.executionEvents.push("DDL");
      state.ddlStatementsExecuted += 1;
      state.migrationRows += 1;
      state.targetTablesCreated += 1;
      const match = body.match(/VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'/i);
      state.receipts = [{ id: match[1], checksum: match[2] }];
    },
  };
  return state;
}

function hasGuardCode(code) {
  return (error) =>
    error instanceof MigrationGuardError && error.code === code;
}

async function waitForPostgres(container) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await execFile("docker", [
        "exec",
        container,
        "pg_isready",
        "--username",
        "postgres",
      ]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}

async function waitForClientConnection(sql) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await sql.unsafe("SELECT 1");
      return;
    } catch (error) {
      const code = error && typeof error === "object" ? error.code : undefined;
      if (
        code !== "57P03" &&
        code !== "ECONNREFUSED" &&
        code !== "ECONNRESET"
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Disposable PostgreSQL client connection was not ready.");
}

async function assertNodeFailure(args, environment, expectedCode) {
  let result;
  try {
    await execFile(process.execPath, args, { env: environment });
  } catch (error) {
    result = error;
  }
  assert.ok(result, `Expected ${expectedCode} to fail closed.`);
  assert.equal(result.code, 1);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  for (const name of ["POSTGRES_MIGRATION_URL", "DIRECT_URL", "DATABASE_URL"]) {
    if (!environment[name]) continue;
    let password;
    try { password = decodeURIComponent(new URL(environment[name]).password); } catch { continue; }
    assert.equal(output.includes(environment[name]), false, "Migration failures must never print the URL");
    if (password) assert.equal(output.includes(password), false, "Migration failures must never print credentials");
  }
  assert.equal(
    output.includes(expectedCode),
    true,
  );
}
