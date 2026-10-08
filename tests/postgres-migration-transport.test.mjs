import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { createSecureContext, TLSSocket } from "node:tls";
import test from "node:test";
import postgres from "postgres";
import * as guard from "../scripts/postgres-migration-guard.mjs";
import { migrationTransactionBody } from "../scripts/postgres-migration-transaction.mjs";

// Synthetic approval fixtures are never loaded by the CLI.
const project = "abcdefghijklmnopqrst";
const remoteUrl = `postgres://postgres:test-secret@db.${project}.supabase.co/postgres?sslmode=verify-full`;
const target = {
  id: "synthetic-direct", provider: "supabase", project,
  host: `db.${project}.supabase.co`, port: 5432, database: "postgres",
  user: "postgres", role: "postgres", mode: "direct",
  approvalReference: "https://example.invalid/independent-approval",
  modeEvidence: "https://example.invalid/provider-endpoint-evidence",
  approvedAt: "2026-10-01T00:00:00Z", expiresAt: "2026-10-09T00:00:00Z",
};
const context = (overrides = {}) => ({
  env: { POSTGRES_MIGRATION_TARGET: target.id }, approvedTargets: [target],
  now: new Date("2026-10-08T00:00:00Z"), ...overrides,
});
const rejected = (url, options = context()) => assert.throws(
  () => guard.assertMigrationConnectionUrl(url, options),
  error => error instanceof guard.MigrationGuardError,
);

test("transport regression: PGPORT=6543 cannot select a transaction endpoint", () => {
  rejected(remoteUrl, context({ env: { POSTGRES_MIGRATION_TARGET: target.id, PGPORT: "6543" } }));
});
test("transport regression: PGHOST fallback cannot select an unapproved host", () => {
  rejected("postgres:///postgres", context({ env: { PGHOST: "unapproved.example.test" } }));
});
test("transport regression: missing, hostless and opaque URLs fail closed", () => {
  for (const url of [undefined, "", "postgres:", "postgres:postgres", "postgres:///postgres", "postgres://postgres:test-secret@/postgres"]) rejected(url);
});
test("transport regression: encoded hosts and ports fail closed", () => {
  for (const authority of ["db%2eexample.test", "approved%3A6543", "approved%2Cevil:5432", "approved%253A6543"]) {
    rejected(`postgres://postgres:test-secret@${authority}/postgres`);
  }
});
test("transport regression: multiple host syntax fails closed", () => {
  for (const host of ["approved,evil", "approved:5432,evil:6543"]) rejected(`postgres://postgres:test-secret@${host}/postgres`);
});
test("transport regression: malformed or ambiguous IPv6 fails closed", () => {
  for (const host of ["::1", "[::1", "[::1]:5432:6543", "[0:0:0:0:0:0:0:1]", "[::ffff:127.0.0.1]", "[::1%25lo]"]) {
    rejected(`postgres://postgres:test-secret@${host}/postgres`, context({ disposable: { port: 5432 } }));
  }
});
test("transport regression: URL overrides cannot change driver options", () => {
  for (const query of ["host=evil", "port=6543", "ssl=false", "options=-c%20role=evil", "sslmode=verify-full&sslmode=require", "application_name=unapproved", "target_session_attrs=read-write"]) {
    rejected(`${remoteUrl.split("?")[0]}?${query}`);
  }
});
test("transport regression: endpoint authority requires independent approval", () => {
  rejected(remoteUrl, context({ approvedTargets: [] }));
  for (const change of [{ provider: "unknown" }, { project: "wrong" }, { host: "evil.example.test" }, { database: "other" }, { role: "other" }, { mode: "transaction" }, { approvalReference: "" }, { modeEvidence: "" }, { expiresAt: "2026-10-07T00:00:00Z" }]) {
    rejected(remoteUrl, context({ approvedTargets: [{ ...target, ...change }] }));
  }
});
test("transport regression: localhost aliases cannot exempt production endpoints", () => {
  for (const host of ["localhost", "localhost.", "127.0.0.1", "127.1", "2130706433", "localhost.example.test", "[::1]"]) {
    rejected(`postgres://postgres:test-secret@${host}:5432/postgres`);
  }
});
test("transport regression: remote TLS must authenticate certificates", async () => {
  const plan = guard.assertMigrationConnectionUrl(remoteUrl, context());
  const sql = guard.createMigrationClient(postgres, plan);
  try {
    assert.equal(sql.options.ssl.rejectUnauthorized, true);
    assert.equal(sql.options.ssl.servername, target.host);
    assert.equal(typeof sql.options.ssl.checkServerIdentity, "function");
  } finally { await sql.end(); }
  for (const sslmode of ["require", "allow", "prefer", "disable", "verify-ca"]) {
    rejected(`${remoteUrl.split("?")[0]}?sslmode=${sslmode}`);
  }
});
test("transport regression: certificate hostname mismatch fails closed", async () => {
  const plan = guard.assertMigrationConnectionUrl(remoteUrl, context());
  const sql = guard.createMigrationClient(postgres, plan);
  try {
    assert.equal(sql.options.ssl.checkServerIdentity?.(target.host, { subjectaltname: "DNS:wrong.example.test" })?.code, "ERR_TLS_CERT_ALTNAME_INVALID");
  } finally { await sql.end(); }
});
test("transport regression: backend switching at the SQL BEGIN cannot evade guards", async () => {
  let begun = false;
  let ddl = 0;
  const sql = { reserve: async () => ({
    release: async () => {},
    unsafe: async statement => {
      if (/^BEGIN\s*;?$/i.test(statement.trim())) { begun = true; return []; }
      if (/current_setting/.test(statement)) return [{ lock_timeout: "5s", statement_timeout: "60s", idle_in_transaction_session_timeout: "60s", session_identity: begun ? "902" : "901", database_name: "postgres", current_user: "postgres", session_user: "postgres" }];
      if (/pg_backend_pid/.test(statement)) return [{ session_identity: begun ? "902" : "901", database_name: "postgres", current_user: "postgres", session_user: "postgres" }];
      if (/to_regclass/.test(statement)) return [{ relation: null }];
      if (/^SELECT id, checksum/.test(statement)) return [];
      if (/CREATE TABLE/.test(statement)) { begun = true; ddl++; }
      return [];
    },
  }) };
  const result = await guard.deployMigrationOnReservedConnection({ sql, logger: () => {}, migration: {
    id: "guard_switch", sql: "BEGIN;\nCREATE TABLE guard_switch(id int);\nINSERT INTO app_schema_migrations (id, checksum) VALUES ('guard_switch','switch');\nCOMMIT;",
  } });
  assert.equal(result.code, 1);
  assert.equal(result.errorCode, "MIGRATION_GUARD_SESSION_CHANGED");
  assert.equal(ddl, 0);
});
test("transport regression: runbook has no obsolete approved candidate", () => {
  const text = readFileSync("docs/runbooks/securium-postgres-production-migration-execution.md", "utf8");
  assert.doesNotMatch(text, /ddee4c0/);
  assert.match(text, /pending fresh approval/i);
});

test("postgres.js 3.4.9 receives exactly the approved direct and session endpoints", async () => {
  assert.equal(JSON.parse(readFileSync("node_modules/postgres/package.json", "utf8")).version, "3.4.9");
  const sessionTarget = { ...target, id: "synthetic-session", host: "aws-0-synthetic.pooler.supabase.com", mode: "session", user: `postgres.${project}` };
  for (const approved of [target, sessionTarget]) {
    const url = `postgres://${approved.user}:test-secret@${approved.host}/${approved.database}?sslmode=verify-full`;
    const plan = guard.assertMigrationConnectionUrl(url, context({ env: { POSTGRES_MIGRATION_TARGET: approved.id }, approvedTargets: [approved] }));
    const sql = guard.createMigrationClient(postgres, plan);
    try {
      assert.deepEqual(sql.options.host, [approved.host]);
      assert.deepEqual(sql.options.port, [5432]);
      assert.equal(sql.options.database, approved.database);
      assert.equal(sql.options.user, approved.user);
      assert.equal(plan.mode, approved.mode);
      assert.equal(plan.role, "postgres");
      assert.equal(sql.options.path, false);
      assert.equal(sql.options.socket, undefined);
      assert.equal(sql.options.connection.search_path, "public");
      assert.equal(JSON.stringify(plan).includes("test-secret"), false);
    } finally { await sql.end(); }
  }
});

test("postgres.js inherited PGPORT bypass is reproduced without opening a connection", async () => {
  const savedPort = process.env.PGPORT;
  const plan = guard.assertMigrationConnectionUrl(remoteUrl, context());
  let raw, canonical;
  try {
    process.env.PGPORT = "6543";
    raw = postgres(remoteUrl, { ssl: "require" });
    assert.deepEqual(raw.options.port, [6543]);
    // Explicit arrays bind the driver even if the environment changes after plan validation.
    canonical = guard.createMigrationClient(postgres, plan);
    assert.deepEqual(canonical.options.host, [target.host]);
    assert.deepEqual(canonical.options.port, [5432]);
  } finally {
    if (savedPort === undefined) delete process.env.PGPORT; else process.env.PGPORT = savedPort;
    await raw?.end();
    await canonical?.end();
  }
});

test("a failed rollback destroys the driver before releasing the reserved connection", async () => {
  const events = [];
  const sql = {
    end: async () => events.push("END"),
    reserve: async () => ({
      release: async () => events.push("RELEASE"),
      unsafe: async statement => {
        if (/pg_backend_pid/.test(statement) && !/current_setting/.test(statement)) return [{ session_identity: "901" }];
        if (statement === "ROLLBACK") { events.push("ROLLBACK"); throw new Error("synthetic rollback failure"); }
        if (/SET LOCAL/.test(statement)) throw new Error("synthetic setting failure");
        return [];
      },
    }),
  };
  const result = await guard.deployMigrationOnReservedConnection({ sql, logger: () => {}, migration: {
    id: "guard_rollback", sql: "BEGIN; CREATE TABLE guard_rollback(id int); INSERT INTO app_schema_migrations (id, checksum) VALUES ('guard_rollback','rollback'); COMMIT;",
  } });
  assert.equal(result.code, 1);
  assert.equal(result.errorCode, "MIGRATION_GUARD_ROLLBACK_FAILED");
  assert.equal(result.ddlStarted, false);
  assert.deepEqual(events, ["ROLLBACK", "END", "RELEASE"]);
});

test("owned literal localhost maps to a deterministic IPv4 driver endpoint", async () => {
  for (const host of ["localhost", "127.0.0.1"]) {
    const plan = guard.assertMigrationConnectionUrl(`postgres://postgres:test-secret@${host}:55432/disposable?sslmode=disable`, { env: {}, disposable: { port: 55432 } });
    const sql = guard.createMigrationClient(postgres, plan);
    try {
      assert.deepEqual(sql.options.host, ["127.0.0.1"]);
      assert.deepEqual(sql.options.port, [55432]);
      assert.equal(sql.options.database, "disposable");
      assert.equal(sql.options.user, "postgres");
      assert.equal(sql.options.ssl, false);
    } finally { await sql.end(); }
  }
  rejected(remoteUrl, context({ disposable: { port: 5432 } }));
  rejected("postgres://postgres:test-secret@localhost:55433/disposable", { env: {}, disposable: { port: 55432 } });
});

test("unapproved driver options, ambient TLS weakening, trust changes and expired approvals fail closed", () => {
  assert.throws(() => guard.createMigrationClient(postgres, { host: target.host }), /MIGRATION_GUARD_CONNECTION_PLAN_INVALID/);
  for (const name of ["PGHOST", "PGPORT", "PGUSER", "PGDATABASE", "PGSSLMODE", "PGSSL", "PGOPTIONS", "PGTARGETSESSIONATTRS"]) {
    rejected(remoteUrl, context({ env: { POSTGRES_MIGRATION_TARGET: target.id, [name]: "unapproved" } }));
  }
  rejected(remoteUrl, context({ env: { POSTGRES_MIGRATION_TARGET: target.id, NODE_TLS_REJECT_UNAUTHORIZED: "0" } }));
  rejected(remoteUrl, context({ ca: "unapproved trust" }));
  rejected(remoteUrl, context({ approvedTargets: [{ ...target, caSha256: "a".repeat(64) }] }));
  rejected(remoteUrl, context({ approvedTargets: [target, target] }));
  rejected(remoteUrl, context({ env: { POSTGRES_MIGRATION_TARGET: "incorrect" } }));
  rejected(remoteUrl, context({ env: {} }));
  rejected(remoteUrl, context({ approvedTargets: [{ ...target, role: undefined }] }));
  rejected(remoteUrl, context({ approvedTargets: [{ ...target, approvalReference: "https://user:secret@example.invalid/approval" }] }));
  const plan = guard.assertMigrationConnectionUrl(remoteUrl, context());
  for (const mutate of [
    options => { options.host = ["unapproved.example.test"]; },
    options => { options.port = [6543]; },
    options => { options.database = "unapproved"; },
    options => { options.user = "unapproved"; },
    options => { options.ssl = "require"; },
    options => { options.connection.role = "unapproved"; },
  ]) {
    const inconsistentDriver = options => {
      const parsed = { ...options, connection: { ...options.connection } };
      mutate(parsed);
      return { options: parsed, end: async () => {} };
    };
    assert.throws(() => guard.createMigrationClient(inconsistentDriver, plan), /MIGRATION_GUARD_DRIVER_ENDPOINT_MISMATCH/);
  }
});

test("transaction wrapper preserves dollar bodies and rejects nested or early commits", () => {
  const body = "\n/* COMMIT; /* BEGIN; */ */\nDO $block$ BEGIN PERFORM 'COMMIT;'; END; $block$;\nSELECT E'escaped\\\' COMMIT;';\n";
  assert.equal(migrationTransactionBody(`-- header\nBEGIN;${body}COMMIT;\n-- tail`), body);
  for (const sql of ["BEGIN; CREATE TABLE x(id int); COMMIT; COMMIT;", "BEGIN; BEGIN; SELECT 1; COMMIT;", "BEGIN; SELECT 1; ROLLBACK; COMMIT;", "SELECT 1; COMMIT;", "BEGIN; SELECT 1; COMMIT; SELECT 2;", "BEGIN; SELECT 'unterminated; COMMIT;", "BEGIN; DO $$unterminated; COMMIT;", "'discarded literal' BEGIN; SELECT 1; COMMIT;", "BEGIN(); SELECT 1; COMMIT;"]) {
    assert.throws(() => migrationTransactionBody(sql), /MIGRATION_GUARD_TRANSACTION_WRAPPER_INVALID/);
  }
});

test("real postgres.js TLS rejects unknown chains and hostname mismatches before startup", { timeout: 15_000 }, async t => {
  // Owned loopback protocol fixture: no real provider is contacted and no SQL runs.
  const ca = readFileSync("tests/fixtures/postgres-migration-tls/ca.crt", "utf8");
  const secureContext = createSecureContext({
    key: readFileSync("tests/fixtures/postgres-migration-tls/server.key"),
    cert: readFileSync("tests/fixtures/postgres-migration-tls/server.crt"),
  });
  const cases = [
    { name: "unknown certificate chain", approval: target, ca: null, error: /UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_GET_ISSUER_CERT_LOCALLY/ },
    { name: "trusted chain with incorrect hostname", approval: { ...target, project: "zyxwvutsrqponmlkjihg", host: "db.zyxwvutsrqponmlkjihg.supabase.co", caSha256: createHash("sha256").update(ca).digest("hex") }, ca, error: /ERR_TLS_CERT_ALTNAME_INVALID/ },
    { name: "trusted chain and correct hostname", approval: { ...target, caSha256: createHash("sha256").update(ca).digest("hex") }, ca },
  ];
  for (const fixture of cases) await t.test(fixture.name, async () => {
    let startupMessages = 0;
    const sockets = new Set();
    const server = createServer(socket => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.on("error", () => {});
      socket.once("data", request => {
        assert.equal(request.toString("hex"), "0000000804d2162f");
        socket.write("S");
        const secured = new TLSSocket(socket, { isServer: true, secureContext });
        sockets.add(secured);
        secured.on("close", () => sockets.delete(secured));
        secured.on("error", () => {});
        secured.once("data", () => {
          startupMessages++;
          // Minimal synthetic AuthenticationOk / BackendKeyData / ReadyForQuery.
          secured.write(Buffer.from("5200000008000000004b0000000c0000007b000003db5a0000000549", "hex"));
          secured.on("data", query => {
            if (query[0] !== 81) return; // Simple SELECT used only for fixture readiness.
            const tag = Buffer.from("SELECT 0\0");
            const complete = Buffer.alloc(5 + tag.length);
            complete[0] = 67;
            complete.writeInt32BE(4 + tag.length, 1);
            tag.copy(complete, 5);
            secured.write(Buffer.concat([complete, Buffer.from("5a0000000549", "hex")]));
          });
        });
      });
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const approved = fixture.approval;
    const plan = guard.assertMigrationConnectionUrl(`postgres://postgres:test-secret@${approved.host}/postgres?sslmode=verify-full`, context({ approvedTargets: [approved], ca: fixture.ca }));
    const planned = guard.createMigrationClient(postgres, plan);
    // Route only the test's socket to our owned fixture. Production factory offers
    // no socket/host override. Retain its exact TLS settings in the real driver.
    const client = postgres({ host: ["127.0.0.1"], port: [server.address().port], user: "postgres", password: "synthetic", database: "postgres", ssl: planned.options.ssl, max: 1, prepare: false, fetch_types: false, connect_timeout: 2, onnotice: false });
    try {
      if (fixture.error) {
        await assert.rejects(client.reserve(), error => fixture.error.test(error.code));
        assert.equal(startupMessages, 0);
      } else {
        await client.unsafe("SELECT 1");
        const reserved = await client.reserve();
        await reserved.release();
        assert.equal(startupMessages, 1);
      }
    } finally {
      await client.end({ timeout: 0 });
      await planned.end({ timeout: 0 });
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    }
  });
});
