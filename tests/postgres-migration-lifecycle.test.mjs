import assert from "node:assert/strict";
import test from "node:test";
import { deployMigrationOnReservedConnection, executeGuardedMigration } from "../scripts/postgres-migration-guard.mjs";
import { closeMigrationClient, observeMigrationConnectionClose } from "../scripts/postgres-migration-lifecycle.mjs";

const migration = { id: "lifecycle", sql: "BEGIN; CREATE TABLE lifecycle(id int); INSERT INTO app_schema_migrations (id, checksum) VALUES ('lifecycle','v1'); COMMIT;" };
const failure = code => Object.assign(new Error("postgres://credential:secret@invalid/private"), { code });

for (const asynchronous of [false, true]) {
  const inject = error => asynchronous ? Promise.reject(error) : (() => { throw error; })();
  for (const broken of ["ROLLBACK", "RELEASE", "SHUTDOWN"]) test(`${asynchronous ? "async" : "sync"} ${broken} failure retains the SQL cause and controls cleanup`, async () => {
    const calls = [];
    const original = failure("P0001");
    const secondary = failure("EPIPE");
    const reserved = {
      unsafe(statement) {
        calls.push(statement);
        if (statement.includes("pg_backend_pid") && !statement.includes("current_setting")) return [{ session_identity: "100" }];
        if (statement.includes("current_setting")) return [{ session_identity: "100", lock_timeout: "5s", statement_timeout: "60s", idle_in_transaction_session_timeout: "60s" }];
        if (statement.includes("to_regclass")) return [{ relation: null }];
        if (statement.includes("CREATE TABLE")) return inject(original);
        if (statement === "ROLLBACK" && ["ROLLBACK", "SHUTDOWN"].includes(broken)) return inject(secondary);
        return [];
      },
      release() { calls.push("RELEASE"); if (broken === "RELEASE") return inject(secondary); },
    };
    const sql = { reserve: async () => reserved, end() { calls.push("END"); if (broken === "SHUTDOWN") return inject(failure("ETIMEDOUT")); } };
    const result = await deployMigrationOnReservedConnection({ sql, migration, logger: () => {} });
    assert.equal(result.code, 1);
    assert.equal(result.errorCode, "P0001");
    assert.equal(result.originalErrorCode, "P0001");
    assert.equal(result.connectionInvalidated, true);
    assert.equal(result.applied, undefined);
    assert.doesNotMatch(JSON.stringify(result), /credential|secret|postgres:\/\//);
    assert.equal(calls.includes("END"), true);
    if (broken !== "RELEASE") {
      assert.equal(result.transactionOutcome, "VERIFICATION_REQUIRED");
      assert.equal(result.rollbackSucceeded, false);
      assert.equal(calls.includes("RELEASE"), false);
    }
    if (broken === "SHUTDOWN") assert.deepEqual(result.cleanupErrors, [{ stage: "ROLLBACK", errorCode: "EPIPE" }, { stage: "SHUTDOWN", errorCode: "ETIMEDOUT" }]);
    const before = calls.length;
    const next = await deployMigrationOnReservedConnection({ sql, migration, logger: () => {} });
    assert.equal(next.code, 1);
    assert.equal(next.ddlStarted, false);
    assert.equal(calls.length, before, "retired clients cannot dispatch or reserve again");
    const closed = await closeMigrationClient(sql);
    assert.equal(closed.shutdownSucceeded, broken !== "SHUTDOWN");
  });
}

test("an idle backend close blocks reservation without dispatching driver work", async () => {
  let reserves = 0;
  const sql = { reserve: async () => { reserves++; }, end: async () => {} };
  observeMigrationConnectionClose(sql);
  const result = await deployMigrationOnReservedConnection({ sql, migration, logger: () => {} });
  assert.equal(result.errorCode, "CONNECTION_CLOSED");
  assert.equal(result.transactionOutcome, "VERIFICATION_REQUIRED");
  assert.equal(reserves, 0);
});

test("the direct guard never replaces an original error when rollback also rejects", async () => {
  const original = failure("42501");
  const session = {
    readSessionIdentity: async () => "100", beginTransaction: async () => {},
    executeControl: async () => {},
    readControls: async () => ({ sessionIdentity: "100", lockTimeout: "5s", statementTimeout: "60s", idleInTransactionSessionTimeout: "60s" }),
    readMigrationLedger: async () => { throw original; },
    rollbackTransaction: async () => { throw failure("EPIPE"); },
  };
  await assert.rejects(executeGuardedMigration({ session, migration, logger: () => {} }), error => error === original);
});
