export const MIGRATION_SESSION_CONTROLS = Object.freeze({
  lockTimeoutMs: 5_000,
  statementTimeoutMs: 60_000,
  idleInTransactionSessionTimeoutMs: 60_000,
});

const CONTROL_STATEMENTS = Object.freeze([
  "SET SESSION lock_timeout = '5s'",
  "SET SESSION statement_timeout = '60s'",
  "SET SESSION idle_in_transaction_session_timeout = '60s'",
]);

const READBACK_STATEMENT = `
SELECT
  current_setting('lock_timeout') AS lock_timeout,
  current_setting('statement_timeout') AS statement_timeout,
  current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout,
  pg_backend_pid()::text AS session_identity
`;

const IDENTITY_STATEMENT =
  "SELECT pg_backend_pid()::text AS session_identity";

export class MigrationGuardError extends Error {
  constructor(code) {
    super(code);
    this.name = "MigrationGuardError";
    this.code = code;
  }
}

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

export async function executeGuardedMigration({
  session,
  migration,
  logger = defaultLogger,
}) {
  try {
    for (const statement of CONTROL_STATEMENTS) {
      await session.executeControl(statement);
    }
  } catch {
    throw new MigrationGuardError("MIGRATION_GUARD_TIMEOUT_SET_FAILED");
  }

  let observed;
  try {
    observed = await session.readControls();
  } catch {
    throw new MigrationGuardError("MIGRATION_GUARD_TIMEOUT_READBACK_FAILED");
  }
  const normalized = assertMigrationSessionControls(observed);
  for (const [name, expected] of [
    ["lock_timeout", MIGRATION_SESSION_CONTROLS.lockTimeoutMs],
    ["statement_timeout", MIGRATION_SESSION_CONTROLS.statementTimeoutMs],
    [
      "idle_in_transaction_session_timeout",
      MIGRATION_SESSION_CONTROLS.idleInTransactionSessionTimeoutMs,
    ],
  ]) {
    logger(
      `MIGRATION_GUARD_SETTING name=${name} expected_ms=${expected} observed_ms=${normalized[name]} result=PASS`,
    );
  }

  const guardedIdentity = normalizeSessionIdentity(observed.sessionIdentity);
  const alreadyApplied = await session.isMigrationApplied(migration.id);
  if (alreadyApplied) {
    logger(
      `MIGRATION_GUARD_PASS migration=${migration.id} session=${guardedIdentity} action=ALREADY_APPLIED`,
    );
    return { applied: false, ddlStatementsExecuted: 0 };
  }

  let executionIdentity;
  try {
    executionIdentity = normalizeSessionIdentity(
      await session.readSessionIdentity(),
    );
  } catch (error) {
    if (error instanceof MigrationGuardError) throw error;
    throw new MigrationGuardError("MIGRATION_GUARD_SESSION_CHANGED");
  }
  if (executionIdentity !== guardedIdentity) {
    throw new MigrationGuardError("MIGRATION_GUARD_SESSION_CHANGED");
  }

  logger(
    `MIGRATION_GUARD_PASS migration=${migration.id} session=${guardedIdentity} action=EXECUTE`,
  );
  await session.executeMigration(migration.sql);
  return { applied: true, ddlStatementsExecuted: 1 };
}

export async function deployMigrationOnReservedConnection({
  sql,
  migration,
  logger,
}) {
  const reserved = await sql.reserve();
  let ddlStarted = false;
  try {
    const session = {
      executeControl: async (statement) => {
        await reserved.unsafe(statement);
      },
      readControls: async () => {
        const rows = await reserved.unsafe(READBACK_STATEMENT);
        const row = rows[0];
        if (!row) {
          throw new MigrationGuardError(
            "MIGRATION_GUARD_TIMEOUT_READBACK_FAILED",
          );
        }
        return {
          lockTimeout: row.lock_timeout,
          statementTimeout: row.statement_timeout,
          idleInTransactionSessionTimeout:
            row.idle_in_transaction_session_timeout,
          sessionIdentity: row.session_identity,
        };
      },
      isMigrationApplied: async (migrationId) => {
        try {
          const rows = await reserved.unsafe(
            "SELECT id FROM app_schema_migrations WHERE id = $1",
            [migrationId],
          );
          return rows.length === 1;
        } catch (error) {
          if (safeDatabaseErrorCode(error) === "42P01") return false;
          throw error;
        }
      },
      readSessionIdentity: async () => {
        const rows = await reserved.unsafe(IDENTITY_STATEMENT);
        return rows[0]?.session_identity;
      },
      executeMigration: async (migrationSql) => {
        ddlStarted = true;
        await reserved.unsafe(migrationSql);
      },
    };
    const result = await executeGuardedMigration({
      session,
      migration,
      logger,
    });
    return { code: 0, stdout: "", ddlStarted, ...result };
  } catch (error) {
    return {
      code: 1,
      stdout: "",
      ddlStarted,
      errorCode: safeGuardErrorCode(error),
    };
  } finally {
    await reserved.release();
  }
}

export function assertMigrationConnectionUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new MigrationGuardError("DIRECT_URL_INVALID");
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new MigrationGuardError("DIRECT_URL_INVALID");
  }
  const port = url.port || "5432";
  if (port === "6543") {
    throw new MigrationGuardError(
      "MIGRATION_GUARD_TRANSACTION_POOLING_FORBIDDEN",
    );
  }
  return {
    mode: port === "5432" ? "DIRECT_OR_SESSION_5432" : "DIRECT_CUSTOM_PORT",
    port,
  };
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
