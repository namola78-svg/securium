import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import postgres from "postgres";
import { deployMigrationOnReservedConnection } from "../scripts/postgres-migration-guard.mjs";
import { cleanupOwnedPostgresContainer, createOwnedPostgresContainer, getPublishedPostgresPort, inspectOwnedPostgresContainer } from "../scripts/owned-postgres-container.mjs";

const stages = ["before_begin", "after_begin", "after_controls", "ddl", "before_commit", "commit_ack", "rollback", "rollback_in_flight", "release", "shutdown", "shutdown_in_flight"];
const evidence = { authority: "OWNED_DISPOSABLE_SYNTHETIC_FIXTURES", node: process.version, driver: "postgres.js 3.4.9", stages: {} };

test("real backend termination fails closed at every migration and cleanup barrier", { timeout: 180_000 }, async t => {
  const password = randomBytes(32).toString("hex");
  let owned;
  let admin;
  let port;
  const connect = database => postgres({ host: "127.0.0.1", port, user: "postgres", password, database, ssl: false, max: 1, prepare: false, connect_timeout: 2, onnotice: false });
  try {
    await mkdir("tmp", { recursive: true });
    owned = await createOwnedPostgresContainer({ name: `securium-backend-loss-${randomUUID()}`, ownerToken: randomUUID(), password, image: "postgres:17.6", receiptPath: resolve(`tmp/backend-loss-${process.version}-owner.json`) });
    port = Number(await getPublishedPostgresPort(owned));
    admin = connect("postgres");
    await eventually(async () => { await admin.unsafe("SELECT 1"); });
    evidence.server = (await admin.unsafe("SHOW server_version"))[0].server_version;
    assert.equal((await admin.unsafe("SHOW server_version_num"))[0].server_version_num, "170006");
    for (const stage of stages) await t.test(stage, async () => {
      const database = `loss_${stage}`;
      await admin.unsafe(`CREATE DATABASE ${database}`);
      const setup = connect(database);
      try { await setup.unsafe("CREATE TABLE app_schema_migrations(id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())"); }
      finally { await setup.end({ timeout: 0 }); }
      const messages = [];
      let stderr = "";
      let stdout = "";
      let barrierError;
      let barrierTask;
      const child = fork("tests/support/postgres-backend-loss-worker.mjs", [], { silent: true, windowsHide: true, execArgv: ["--unhandled-rejections=strict"] });
      child.stdout.on("data", chunk => { stdout += chunk; });
      child.stderr.on("data", chunk => { stderr += chunk; });
      child.on("message", message => {
        messages.push(message);
        if (message.event === "ready") { child.send({ port, password, database, stage }); return; }
        if (message.event !== "barrier") return;
        barrierTask = (async () => {
          assert.equal(message.stage, stage);
          const activity = async () => (await admin.unsafe("SELECT datname, application_name, wait_event, state FROM pg_stat_activity WHERE pid=$1", [message.pid]))[0];
          const inFlight = ["ddl", "commit_ack", "rollback_in_flight", "shutdown_in_flight"].includes(stage);
          if (inFlight) await eventually(async () => { assert.equal((await activity())?.wait_event, "PgSleep"); });
          const row = await activity();
          assert.equal(row.datname, database);
          assert.equal(row.application_name, "securium-postgres-migrations");
          assert.equal((await admin.unsafe("SELECT pg_terminate_backend($1,5000) AS terminated", [message.pid]))[0].terminated, true);
          if (!inFlight) {
            await eventually(async () => { assert.ok(messages.some(m => m.event === "closed")); });
            if (child.connected) child.send({ event: "continue" });
          }
        })().catch(error => { barrierError = error; child.kill(); });
      });
      const timer = setTimeout(() => child.kill(), 20_000);
      const exit = new Promise((resolveExit, reject) => { child.once("error", reject); child.once("exit", (code, signal) => resolveExit({ code, signal })); });
      let outcome;
      try { outcome = await exit; await barrierTask; }
      finally { clearTimeout(timer); if (child.connected) child.kill(); }
      const fresh = connect(database);
      let state;
      try {
        const [tables] = await fresh.unsafe("SELECT to_regclass('public.loss_fixture') AS fixture, to_regclass('public.loss_next') AS next");
        const rows = Array.from(await fresh.unsafe("SELECT id, checksum FROM app_schema_migrations ORDER BY id"));
        state = { ...tables, rows };
        const committed = ["release", "commit_ack"].includes(stage);
        assert.equal(tables.fixture, committed ? "loss_fixture" : null);
        assert.equal(tables.next, null);
        assert.deepEqual(rows, committed ? [{ id: "loss_fixture", checksum: "loss-fixture-v1" }] : []);
        // Retry is authorized only after the fresh connection checked both states.
        const migration = { id: "loss_fixture", sql: "BEGIN; CREATE TABLE loss_fixture(id int); INSERT INTO app_schema_migrations (id, checksum) VALUES ('loss_fixture','loss-fixture-v1'); COMMIT;" };
        const retried = await deployMigrationOnReservedConnection({ sql: fresh, migration, identity: { database, role: "postgres" }, logger: () => {} });
        assert.equal(retried.code, 0);
        assert.equal(retried.applied, !committed);
        assert.equal((await fresh.unsafe("SELECT count(*)::int AS count FROM app_schema_migrations"))[0].count, 1);
      } finally { await fresh.end({ timeout: 0 }); }
      const resultMessage = messages.find(m => m.event === "result");
      const driverFailures = messages.filter(m => m.event === "driver_failure");
      const rollbackCommands = messages.filter(m => m.event === "command" && m.command === "ROLLBACK").length;
      const driverReuse = messages.find(m => m.event === "driver_reuse");
      evidence.stages[stage] = { exit: outcome, result: resultMessage, events: messages.map(m => m.event), driverFailures, driverReuse, rollbackCommands, databaseAfterInterruption: state, uncaughtTypeError: /TypeError/.test(stderr), unhandledRejection: /UnhandledPromiseRejection|unhandledRejection/.test(stderr), verifiedRetry: "PASS" };
      assert.ifError(barrierError);
      assert.equal(outcome.signal, null, JSON.stringify({ events: messages, stderr }));
      assert.equal(outcome.code, 1);
      assert.equal(stderr, "", "a controlled worker must emit no uncaught error or rejection stack");
      assert.equal(stdout, "");
      assert.doesNotMatch(stdout + stderr, /TypeError|UnhandledPromiseRejection|unhandledRejection/);
      assert.equal((stdout + stderr).includes(password), false);
      assert.doesNotMatch(stdout + stderr, /postgres:\/\/|sensitive fixture failure/);
      assert.ok(resultMessage, "runner must return a controlled failure before exiting");
      assert.equal(resultMessage.result.code, 1);
      const primaryDriverFailure = messages.find(m => m.event === "driver_failure" && m.stage === "PRIMARY");
      assert.equal(resultMessage.result.errorCode, primaryDriverFailure?.code ?? "CONNECTION_CLOSED");
      assert.equal(resultMessage.result.originalErrorCode, resultMessage.result.errorCode);
      assert.equal(rollbackCommands, ["rollback_in_flight", "shutdown", "shutdown_in_flight"].includes(stage) ? 1 : 0);
      if (stage === "rollback_in_flight") {
        assert.equal(resultMessage.result.rollbackAttempted, true);
        assert.equal(resultMessage.result.rollbackSucceeded, false);
        const rollbackFailure = messages.find(m => m.event === "driver_failure" && m.stage === "ROLLBACK");
        assert.ok(["57P01", "CONNECTION_CLOSED"].includes(rollbackFailure?.code));
        assert.deepEqual(resultMessage.result.cleanupErrors, [{ stage: "ROLLBACK", errorCode: rollbackFailure.code }]);
      }
      if (!["shutdown", "shutdown_in_flight"].includes(stage)) {
        assert.equal(resultMessage.result.connectionInvalidated, true);
        assert.equal(resultMessage.result.transactionOutcome, "VERIFICATION_REQUIRED");
        assert.equal(resultMessage.result.applied, undefined);
        const reuse = messages.find(m => m.event === "reuse")?.result;
        assert.equal(reuse?.code, 1);
        assert.equal(reuse?.ddlStarted, false);
        assert.deepEqual(driverReuse, { event: "driver_reuse", poolCode: "CONNECTION_ENDED", handleCode: "CONNECTION_DESTROYED" });
      }
      if (stage.startsWith("shutdown")) {
        assert.equal(resultMessage.result.rollbackSucceeded, true);
        assert.equal(resultMessage.closeResult.code, 1);
        assert.equal(resultMessage.closeResult.shutdownSucceeded, true);
      }
      if (["after_begin", "after_controls", "ddl", "before_commit"].includes(stage)) assert.equal(resultMessage.result.rollbackSucceeded, false);
    });
  } finally {
    await admin?.end({ timeout: 0 });
    evidence.cleanup = owned ? await cleanupOwnedPostgresContainer(owned) : "NO_CREATED_CONTAINER";
    if (owned) assert.equal(await inspectOwnedPostgresContainer(owned), null);
    await writeFile(`tmp/backend-loss-${process.version}-evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  }
});

async function eventually(operation) {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) { if (attempt === 100) throw error; await new Promise(resolve => setTimeout(resolve, 25)); }
  }
}
