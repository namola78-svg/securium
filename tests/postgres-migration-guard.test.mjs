import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { promisify } from "node:util";
import {
  assertMigrationConnectionUrl,
  executeGuardedMigration,
  MigrationGuardError,
  parsePostgresDurationMilliseconds,
  deployMigrationOnReservedConnection,
} from "../scripts/postgres-migration-guard.mjs";

const execFile = promisify(execFileCallback);
const fixtureMigration = {
  id: "guard_fixture_0001",
  sql: `BEGIN;
CREATE TABLE migration_guard_fixture (id integer PRIMARY KEY);
INSERT INTO app_schema_migrations (id, checksum)
VALUES ('guard_fixture_0001', 'guard-fixture');
COMMIT;`,
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
  assert.equal(state.executionEvents.at(-1), "DDL");
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
  assert.deepEqual(
    assertMigrationConnectionUrl("postgres://u:p@host:5432/db"),
    { mode: "DIRECT_OR_SESSION_5432", port: "5432" },
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
});

test("disposable PostgreSQL 17.6 executes fixture only after guard pass", async () => {
  const container = `securium-migration-guard-${randomUUID()}`;
  const password = "guard-test-password-2026";
  let sql;
  let containerStarted = false;
  try {
    await execFile("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      container,
      "--env",
      `POSTGRES_PASSWORD=${password}`,
      "--publish",
      "127.0.0.1::5432",
      "postgres:17.6",
    ]);
    containerStarted = true;
    await waitForPostgres(container);
    const { stdout: portOutput } = await execFile("docker", [
      "port",
      container,
      "5432/tcp",
    ]);
    const port = portOutput.trim().match(/:(\d+)$/)?.[1];
    assert.ok(port, "Docker must publish a disposable PostgreSQL port.");

    const postgres = (await import("postgres")).default;
    sql = postgres(
      `postgres://postgres:${password}@127.0.0.1:${port}/postgres`,
      {
        max: 1,
        prepare: false,
        ssl: false,
        onnotice: false,
      },
    );
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
  } finally {
    if (sql) await sql.end({ timeout: 5 });
    if (containerStarted) {
      await execFile("docker", ["rm", "--force", container]);
    }
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
  };
  const controls = {
    lockTimeout: "5s",
    statementTimeout: "60s",
    idleInTransactionSessionTimeout: "60s",
    sessionIdentity: "901",
    ...options.controls,
  };
  state.session = {
    executeControl: async () => {
      state.executionEvents.push("SET");
    },
    readControls: async () => {
      if (options.readbackFailure) throw new Error("synthetic readback failure");
      state.executionEvents.push("READBACK");
      return controls;
    },
    isMigrationApplied: async () => false,
    readSessionIdentity: async () =>
      options.executionSessionIdentity ?? controls.sessionIdentity,
    executeMigration: async () => {
      state.executionEvents.push("DDL");
      state.ddlStatementsExecuted += 1;
      state.migrationRows += 1;
      state.targetTablesCreated += 1;
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
  assert.equal(
    `${result.stdout ?? ""}\n${result.stderr ?? ""}`.includes(expectedCode),
    true,
  );
}
