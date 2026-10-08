import { MigrationGuardError } from "./postgres-migration-error.mjs";

const clients = new WeakMap();

export function migrationClientLifecycle(sql) {
  let state = clients.get(sql);
  if (!state) {
    state = { invalidated: false, connectionLost: false, ending: false, closePromise: null };
    clients.set(sql, state);
  }
  return state;
}

export function assertMigrationClientUsable(sql) {
  const state = migrationClientLifecycle(sql);
  if (state.invalidated || state.ending) throw new MigrationGuardError("CONNECTION_CLOSED");
}

export function observeMigrationConnectionClose(sql) {
  const state = migrationClientLifecycle(sql);
  // An orderly end is expected. Every other close retires this migration client;
  // postgres.js must not reconnect a stale reserved handle or reuse its pool.
  if (!state.ending) {
    state.connectionLost = true;
    state.invalidated = true;
  }
}

export function invalidateMigrationClient(sql, { connectionLost = false } = {}) {
  const state = migrationClientLifecycle(sql);
  state.invalidated = true;
  state.connectionLost ||= connectionLost;
}

export function isDisconnectedMigrationError(error) {
  const code = error?.code;
  return typeof code === "string" && (
    /^(08[A-Z0-9]{3}|57P0[1-5]|CONNECTION_[A-Z_]+)$/.test(code) ||
    ["ECONNRESET", "ECONNREFUSED", "ECONNABORTED", "EPIPE", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH"].includes(code)
  );
}

export async function migrationQuery(sql, connection, statement, parameters = []) {
  assertMigrationClientUsable(sql);
  try {
    // Invoke and await inside the same boundary: drivers may throw synchronously
    // or reject their thenable. Never dispatch after a close notification.
    return await connection.unsafe(statement, parameters);
  } catch (error) {
    if (isDisconnectedMigrationError(error)) invalidateMigrationClient(sql, { connectionLost: true });
    else if (!/^[A-Z0-9]{5}$/.test(error?.code ?? "")) invalidateMigrationClient(sql);
    throw error;
  }
}

export function safeMigrationErrorCode(error) {
  const code = error?.code;
  if (typeof code === "string" && /^[A-Z0-9_]{1,96}$/.test(code)) return code;
  return "UNKNOWN";
}

export async function closeMigrationClient(sql, { timeout = 5 } = {}) {
  const state = migrationClientLifecycle(sql);
  if (state.closePromise) return state.closePromise;
  state.ending = true;
  // This promise always resolves with a redacted result. Cleanup callers retain
  // their original error and can separately report an unverified transaction.
  state.closePromise = (async () => {
    try {
      await sql.end({ timeout: state.invalidated ? 0 : timeout });
      return { code: state.connectionLost ? 1 : 0, shutdownSucceeded: true,
        ...(state.connectionLost ? { errorCode: "CONNECTION_CLOSED" } : {}) };
    } catch (error) {
      state.invalidated = true;
      return { code: 1, shutdownSucceeded: false, errorCode: safeMigrationErrorCode(error) };
    }
  })();
  return state.closePromise;
}
