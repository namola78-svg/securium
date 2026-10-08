import { migrationTransactionBody } from "./postgres-migration-transaction.mjs";
import { MigrationGuardError } from "./postgres-migration-error.mjs";
export { MigrationGuardError } from "./postgres-migration-error.mjs";
export { assertMigrationConnectionUrl, createMigrationClient } from "./postgres-migration-connection.mjs";

export const MIGRATION_SESSION_CONTROLS = Object.freeze({
  lockTimeoutMs: 5_000,
  statementTimeoutMs: 60_000,
  idleInTransactionSessionTimeoutMs: 60_000,
});

const CONTROL_STATEMENTS = Object.freeze([
  "SET LOCAL lock_timeout = '5s'",
  "SET LOCAL statement_timeout = '60s'",
  "SET LOCAL idle_in_transaction_session_timeout = '60s'",
]);

const READBACK_STATEMENT = `
SELECT
  current_setting('lock_timeout') AS lock_timeout,
  current_setting('statement_timeout') AS statement_timeout,
  current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout,
  pg_backend_pid()::text AS session_identity,
  current_database() AS database_name,
  current_user AS current_user,
  session_user AS session_user
`;

const IDENTITY_STATEMENT =
  "SELECT pg_backend_pid()::text AS session_identity, current_database() AS database_name, current_user AS current_user, session_user AS session_user";

export function parsePostgresDurationMilliseconds(value) {
  if (typeof value !== "string") {
    throw new MigrationGuardError("MIGRATION_GUARD_TIMEOUT_PARSE_FAILED");
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new MigrationGuardError("MIGRATION_GUARD_TIMEOUT_PARSE_FAILED");
  }

  const clock = normalized.match(
    /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/,
  );
  if (clock) {
    const milliseconds =
      (Number(clock[1]) * 3_600 + Number(clock[2]) * 60 + Number(clock[3])) *
      1_000;
    return exactNonNegativeMilliseconds(milliseconds);
  }

  const duration = normalized.match(
    /^(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|second|seconds|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)?$/,
  );
  if (!duration) {
    throw new MigrationGuardError("MIGRATION_GUARD_TIMEOUT_PARSE_FAILED");
  }
  const multipliers = {
    ms: 1,
    s: 1_000,
    sec: 1_000,
    secs: 1_000,
    second: 1_000,
    seconds: 1_000,
    min: 60_000,
    mins: 60_000,
    minute: 60_000,
    minutes: 60_000,
    h: 3_600_000,
    hr: 3_600_000,
    hrs: 3_600_000,
    hour: 3_600_000,
    hours: 3_600_000,
    d: 86_400_000,
    day: 86_400_000,
    days: 86_400_000,
  };
  const unit = duration[2];
  const multiplier = unit ? multipliers[unit] : 1;
  return exactNonNegativeMilliseconds(Number(duration[1]) * multiplier);
}

export function assertMigrationSessionControls(observed) {
  const controls = [
    [
      "lock_timeout",
      observed?.lockTimeout,
      MIGRATION_SESSION_CONTROLS.lockTimeoutMs,
      "MIGRATION_GUARD_LOCK_TIMEOUT_MISMATCH",
    ],
    [
      "statement_timeout",
      observed?.statementTimeout,
      MIGRATION_SESSION_CONTROLS.statementTimeoutMs,
      "MIGRATION_GUARD_STATEMENT_TIMEOUT_MISMATCH",
    ],
    [
      "idle_in_transaction_session_timeout",
      observed?.idleInTransactionSessionTimeout,
      MIGRATION_SESSION_CONTROLS.idleInTransactionSessionTimeoutMs,
      "MIGRATION_GUARD_IDLE_TIMEOUT_MISMATCH",
    ],
  ];
  const normalized = {};
  for (const [name, value, expected, mismatchCode] of controls) {
    const milliseconds = parsePostgresDurationMilliseconds(value);
    normalized[name] = milliseconds;
    if (milliseconds !== expected) {
      throw new MigrationGuardError(mismatchCode);
    }
  }
  return normalized;
}

export function expectedMigrationChecksum(migration) {
  const migrationId = typeof migration?.id === "string" ? migration.id : "";
  const sql = typeof migration?.sql === "string" ? migration.sql : "";
  const registration = sql.match(
    /INSERT\s+INTO\s+(?:public\.)?app_schema_migrations\s*\(id,\s*checksum\)\s*VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']*)'/i,
  );
  if (!registration || registration[1] !== migrationId || !registration[2]) {
    throw new MigrationGuardError("MIGRATION_GUARD_CHECKSUM_REGISTRATION_INVALID");
  }
  return registration[2];
}

export async function executeGuardedMigration({
  session, migration, expectedIdentity, logger = defaultLogger,
}) {
  const expectedChecksum = expectedMigrationChecksum(migration);
  return executeGuardedTransaction({
    session, transactionSql: migration.sql, expectedIdentity, logger,
    run: async ({ body, guardedIdentity }) => {
      const rows = await session.readMigrationLedger(migration.id);
      assertLedgerRows(rows, migration.id, expectedChecksum);
      if (rows.length === 1) {
        logger("MIGRATION_GUARD_PASS migration=" + migration.id + " session=" + guardedIdentity + " action=ALREADY_APPLIED_VALID");
        return { applied: false, ddlStatementsExecuted: 0 };
      }
      if (normalizeSessionIdentity(await session.readSessionIdentity()) !== guardedIdentity) {
        throw new MigrationGuardError("MIGRATION_GUARD_SESSION_CHANGED");
      }
      logger("MIGRATION_GUARD_PASS migration=" + migration.id + " session=" + guardedIdentity + " action=EXECUTE");
      await session.executeMigration(body);
      const receipts = await session.readMigrationLedger(migration.id);
      assertLedgerRows(receipts, migration.id, expectedChecksum);
      if (receipts.length !== 1) throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_RECEIPT_MISSING");
      return { applied: true, ddlStatementsExecuted: 1 };
    },
  });
}

function assertLedgerRows(rows, id, checksum) {
  if (!Array.isArray(rows)) throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_LEDGER_INVALID");
  if (rows.length > 1) throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_LEDGER_DUPLICATE");
  if (rows.length === 1 && (rows[0]?.id !== id || rows[0]?.checksum !== checksum)) {
    throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH");
  }
}

async function executeGuardedTransaction({
  session, transactionSql, expectedIdentity, logger, run,
}) {
  const body = migrationTransactionBody(transactionSql);
  // Outside evidence detects a switch at BEGIN; endpoint approval establishes mode.
  const outsideIdentity = normalizeSessionIdentity(await session.readSessionIdentity());
  let beginAttempted = false;
  try {
    beginAttempted = true;
    await session.beginTransaction();
    try {
      for (const statement of CONTROL_STATEMENTS) await session.executeControl(statement);
    } catch { throw new MigrationGuardError("MIGRATION_GUARD_TIMEOUT_SET_FAILED"); }
    let observed;
    try { observed = await session.readControls(); }
    catch { throw new MigrationGuardError("MIGRATION_GUARD_TIMEOUT_READBACK_FAILED"); }
    const guardedIdentity = normalizeSessionIdentity(observed.sessionIdentity);
    if (guardedIdentity !== outsideIdentity) throw new MigrationGuardError("MIGRATION_GUARD_SESSION_CHANGED");
    if (expectedIdentity && (
      observed.databaseName !== expectedIdentity.database ||
      observed.currentUser !== expectedIdentity.role ||
      observed.sessionUser !== expectedIdentity.role
    )) throw new MigrationGuardError("MIGRATION_GUARD_DATABASE_ROLE_MISMATCH");
    const normalized = assertMigrationSessionControls(observed);
    for (const [name, milliseconds] of Object.entries(normalized)) {
      logger("MIGRATION_GUARD_SETTING name=" + name + " expected_ms=" + milliseconds + " observed_ms=" + milliseconds + " result=PASS boundary=TRANSACTION");
    }
    const result = await run({ body, guardedIdentity });
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (beginAttempted) {
      try { await session.rollbackTransaction(); }
      catch { throw new MigrationGuardError("MIGRATION_GUARD_ROLLBACK_FAILED"); }
    }
    throw error;
  }
}

async function onReservedConnection({ sql, operation }) {
  let reserved;
  const state = { ddlStarted: false, rollbackAttempted: false, rollbackSucceeded: false };
  try {
    reserved = await sql.reserve();
    const session = {
      beginTransaction: () => reserved.unsafe("BEGIN"),
      commitTransaction: () => reserved.unsafe("COMMIT"),
      rollbackTransaction: async () => {
        state.rollbackAttempted = true;
        await reserved.unsafe("ROLLBACK");
        state.rollbackSucceeded = true;
      },
      executeControl: statement => reserved.unsafe(statement),
      readControls: async () => {
        const [row] = await reserved.unsafe(READBACK_STATEMENT);
        if (!row) throw new MigrationGuardError("MIGRATION_GUARD_TIMEOUT_READBACK_FAILED");
        return {
          lockTimeout: row.lock_timeout, statementTimeout: row.statement_timeout,
          idleInTransactionSessionTimeout: row.idle_in_transaction_session_timeout,
          sessionIdentity: row.session_identity, databaseName: row.database_name,
          currentUser: row.current_user, sessionUser: row.session_user,
        };
      },
      readMigrationLedger: async migrationId => {
        // Catching undefined_table inside a transaction would leave it aborted.
        const [row] = await reserved.unsafe("SELECT to_regclass('public.app_schema_migrations') AS relation");
        if (!row) throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_LEDGER_INVALID");
        if (row.relation === null) return [];
        return reserved.unsafe("SELECT id, checksum FROM public.app_schema_migrations WHERE id = $1", [migrationId]);
      },
      readSessionIdentity: async () => {
        const [row] = await reserved.unsafe(IDENTITY_STATEMENT);
        return row?.session_identity;
      },
      executeMigration: async migrationSql => {
        state.ddlStarted = true;
        await reserved.unsafe(migrationSql);
      },
    };
    const result = await operation({ session, reserved });
    return { code: 0, stdout: "", ...state, ...result };
  } catch (error) {
    if (state.rollbackAttempted && !state.rollbackSucceeded) await sql.end?.({ timeout: 0 });
    return { code: 1, stdout: "", ...state, errorCode: safeGuardErrorCode(error) };
  } finally {
    if (reserved) await reserved.release();
  }
}

export function deployMigrationOnReservedConnection({ sql, migration, identity, logger = defaultLogger }) {
  return onReservedConnection({
    sql,
    operation: ({ session }) => executeGuardedMigration({
      session, migration, expectedIdentity: identity, logger,
    }),
  });
}

export function deployBaselineOnReservedConnection({ sql, baseline, identity, logger = defaultLogger }) {
  return onReservedConnection({
    sql,
    operation: ({ session, reserved }) => executeGuardedTransaction({
      session, transactionSql: baseline.artifact, expectedIdentity: identity, logger,
      run: async ({ body }) => {
        const manifest = baseline.manifest;
        for (const [name, value] of [
          ["securium.baseline_artifact_sha256", manifest.artifactDigest],
          ["securium.baseline_schema_sha256", manifest.schemaDigest],
          ["securium.baseline_security_sha256", manifest.securityDigest],
        ]) await reserved.unsafe("SELECT set_config($1, $2, true)", [name, value]);
        await session.executeMigration(body);
        const receipts = await reserved.unsafe(
          "SELECT baseline_id, artifact_sha256, schema_sha256, security_sha256 FROM public.app_schema_baseline_receipts WHERE baseline_id = $1",
          [manifest.baselineId],
        );
        if (receipts.length !== 1 || receipts[0].baseline_id !== manifest.baselineId ||
          receipts[0].artifact_sha256 !== manifest.artifactDigest ||
          receipts[0].schema_sha256 !== manifest.schemaDigest ||
          receipts[0].security_sha256 !== manifest.securityDigest
        ) throw new MigrationGuardError("POSTGRES_BASELINE_RECEIPT_VERIFICATION_FAILED");
        return { applied: true };
      },
    }),
  });
}
function exactNonNegativeMilliseconds(value) {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new MigrationGuardError("MIGRATION_GUARD_TIMEOUT_PARSE_FAILED");
  }
  return value;
}

function normalizeSessionIdentity(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!/^\d+$/.test(normalized)) {
    throw new MigrationGuardError("MIGRATION_GUARD_SESSION_CHANGED");
  }
  return normalized;
}

function safeGuardErrorCode(error) {
  if (error instanceof MigrationGuardError) return error.code;
  return safeDatabaseErrorCode(error);
}

function safeDatabaseErrorCode(error) {
  if (!error || typeof error !== "object") return "UNKNOWN";
  const code = "code" in error ? error.code : undefined;
  if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code)) return code;
  return "UNKNOWN";
}

function defaultLogger(message) {
  console.log(message);
}
