// Fault barriers wrap real driver calls; they never replace the socket lifecycle.
import postgres from "postgres";
import * as guard from "../../scripts/postgres-migration-guard.mjs";
import * as connection from "../../scripts/postgres-migration-connection.mjs";
import { migrationQuery } from "../../scripts/postgres-migration-lifecycle.mjs";

const send = message => { if (process.connected) process.send(message); };
const driverFailure = (error, stage) => send({ event: "driver_failure", stage, code: error.code ?? "UNKNOWN" });
const configured = new Promise(resolve => process.once("message", resolve));
send({ event: "ready" });
const config = await configured;
const { port, password, database, stage } = config;
const sql = guard.createMigrationClient(postgres, guard.assertMigrationConnectionUrl(
  `postgres://postgres:${password}@127.0.0.1:${port}/${database}`,
  { env: {}, disposable: { port } },
));
const closed = sql.options.onclose;
sql.options.onclose = id => { closed?.(id); send({ event: "closed" }); };
const pause = async event => {
  const continued = new Promise(resolve => process.once("message", resolve));
  send({ event: "barrier", stage: event, pid });
  await continued;
};
let pid;
let retiredUnsafe;
const reserve = sql.reserve.bind(sql);
sql.reserve = async () => {
  send({ event: "reserving" });
  const reserved = await reserve();
  send({ event: "reserved" });
  const unsafe = reserved.unsafe.bind(reserved);
  retiredUnsafe = unsafe;
  pid = Number((await unsafe("SELECT pg_backend_pid() AS pid"))[0].pid);
  const release = reserved.release.bind(reserved);
  reserved.release = async () => {
    if (stage === "release") await pause(stage);
    return release();
  };
  reserved.unsafe = async (statement, ...args) => {
    send({ event: "command", command: /^(BEGIN|COMMIT|ROLLBACK)$/.test(statement) ? statement : "QUERY" });
    if ((stage === "ddl" && /CREATE TABLE loss_fixture/.test(statement)) ||
        (stage === "rollback_in_flight" && statement === "ROLLBACK") ||
        (stage === "commit_ack" && statement === "COMMIT")) {
      // Hold the response after real COMMIT/ROLLBACK with an actual server sleep.
      // This changes only the fault probe, never a published migration.
      const command = stage === "ddl" ? statement : statement + "; SELECT pg_sleep(30)";
      const pending = Promise.resolve(unsafe(command, ...args));
      send({ event: "barrier", stage, pid });
      return pending.catch(error => { driverFailure(error, statement === "ROLLBACK" ? "ROLLBACK" : "PRIMARY"); throw error; });
    }
    let rows;
    try { rows = await unsafe(statement, ...args); }
    catch (error) {
      driverFailure(error, "PRIMARY");
      if (stage === "rollback" && /CREATE TABLE loss_fixture/.test(statement)) await pause(stage);
      throw error;
    }
    if ((stage === "after_begin" && statement === "BEGIN") ||
        (stage === "after_controls" && /SELECT to_regclass/.test(statement)) ||
        (stage === "before_begin" && /pg_backend_pid/.test(statement)) ||
        (stage === "before_commit" && /^SELECT id, checksum/.test(statement) && rows.length === 1)) await pause(stage);
    return rows;
  };
  return reserved;
};

const failure = ["rollback", "rollback_in_flight", "shutdown", "shutdown_in_flight"].includes(stage)
  ? "DO $$ BEGIN RAISE EXCEPTION 'sensitive fixture failure'; END; $$;" : "";
const migration = {
  id: "loss_fixture",
  sql: `BEGIN;
CREATE TABLE loss_fixture(id int);
INSERT INTO app_schema_migrations (id, checksum) VALUES ('loss_fixture','loss-fixture-v1');
${stage === "ddl" ? "SELECT pg_sleep(30);" : ""}
${failure}
COMMIT;`,
};
let result;
let closeResult;
try {
  // Match the CLI's initial identity query before reserving (fetch_types=false).
  await sql.unsafe("SELECT current_database(), current_user, session_user");
  result = await guard.deployMigrationOnReservedConnection({
    sql, migration, identity: { database, role: "postgres" }, logger: () => {},
  });
  // Prove an invalidated pool cannot reserve or continue to a second migration.
  if (result.connectionInvalidated) {
    const next = await guard.deployMigrationOnReservedConnection({ sql, migration: {
      id: "loss_next", sql: "BEGIN; CREATE TABLE loss_next(id int); INSERT INTO app_schema_migrations (id, checksum) VALUES ('loss_next','next-v1'); COMMIT;",
    }, identity: { database, role: "postgres" }, logger: () => {} });
    send({ event: "reuse", result: next });
    let poolCode;
    let handleCode;
    try { await sql.unsafe("SELECT 1"); }
    catch (error) { poolCode = error.code; }
    try { await retiredUnsafe("SELECT 1"); }
    catch (error) { handleCode = error.code; }
    send({ event: "driver_reuse", poolCode, handleCode });
  }
} finally {
  if (stage === "shutdown") await pause(stage);
  if (stage === "shutdown_in_flight") {
    const pending = migrationQuery(sql, sql, "SELECT pg_sleep(30)").catch(error => {
      driverFailure(error, "SHUTDOWN");
    });
    const monitor = postgres({ host: "127.0.0.1", port, user: "postgres", password, database, ssl: false, max: 1, prepare: false, onnotice: false });
    try {
      for (let attempt = 0; ; attempt++) {
        if ((await monitor.unsafe("SELECT wait_event FROM pg_stat_activity WHERE pid=$1", [pid]))[0]?.wait_event === "PgSleep") break;
        if (attempt === 100) throw new Error("SHUTDOWN_QUERY_NOT_STARTED");
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      const ending = connection.closeMigrationClient(sql, { timeout: 1 });
      send({ event: "barrier", stage, pid });
      closeResult = await ending;
      await pending;
    } finally { await monitor.end({ timeout: 0 }); }
  } else closeResult = connection.closeMigrationClient
      ? await connection.closeMigrationClient(sql)
      : (await sql.end({ timeout: 0 }), { code: 0 });
}
send({ event: "result", result, closeResult });
process.exitCode = result?.code || closeResult?.code || 0;
process.disconnect();
