import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import {
  createIsmsPBatch1ApprovalDigest,
  createIsmsPBatch1ProductionPreflight,
  executeApprovedIsmsPBatch1ProductionMaterialization,
} from "../lib/data/isms-p-theory-batch1-production-executor.mjs";
import { loadLocalEnvIfPresent } from "./load-local-env.mjs";

const mode = process.argv[2]?.toUpperCase();
if (!new Set(["PLAN", "DIGEST", "APPLY"]).has(mode)) {
  fail("USAGE", "Use plan, digest, or apply. PLAN and APPLY are separate invocations.");
}

if (mode === "DIGEST") {
  const digest = createIsmsPBatch1ApprovalDigest({
    approvalString: requiredArgument("--approval="),
    mainSha: requiredArgument("--main-sha="),
    preflightSha: requiredArgument("--preflight-sha="),
    operationCount: requiredInteger("--expected-create="),
    freshDiffHash: requiredArgument("--fresh-diff-hash="),
  });
  console.log(JSON.stringify({ mode: "APPROVAL_DIGEST", approvalDigest: digest }, null, 2));
  process.exit(0);
}

loadLocalEnvIfPresent();
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) fail("DATABASE_URL_REQUIRED", "DATABASE_URL is required.");
const parsedUrl = new URL(databaseUrl);
assert.ok(["postgres:", "postgresql:"].includes(parsedUrl.protocol));
assert.equal(isLocalHost(parsedUrl.hostname), false, "Production executor refuses localhost");
assert.equal(parsedUrl.hostname.includes("pooler.supabase.com"), true, "Production executor requires the approved Supabase pooled endpoint");
const environment = requiredArgument("--environment=");
assert.equal(environment, "production", "Production executor requires --environment=production");
const expectedMainSha = requiredArgument("--main-sha=");
const releaseSha = resolveReleaseSha();
assert.equal(releaseSha, expectedMainSha, "Expected main SHA does not match the executing release");

const rawClient = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
  prepare: false,
  ssl: "require",
  onnotice: () => {},
  debug: false,
  connection: { application_name: "securium-batch1-production-executor" },
});

try {
  const target = await inspectProductionTarget(rawClient, parsedUrl.hostname);
  const runner = createRunner(rawClient);
  if (mode === "PLAN") {
    const preflight = await runner.readOnly((database) =>
      createIsmsPBatch1ProductionPreflight(database, {
        mainSha: releaseSha,
        targetFingerprint: target.fingerprint,
      }),
    );
    console.log(JSON.stringify({ ...preflight, plan: summarizePlan(preflight.plan) }, null, 2));
  } else {
    const result = await executeApprovedIsmsPBatch1ProductionMaterialization({
      runner,
      releaseSha,
      target: {
        provider: "supabase",
        environment,
        confirmed: true,
        fingerprint: target.fingerprint,
      },
      input: {
        approvalString: requiredArgument("--approval="),
        expectedMainSha,
        expectedPreflightSha: requiredArgument("--preflight-sha="),
        expectedOperationCount: requiredInteger("--expected-create="),
        expectedConflictCount: requiredInteger("--expected-conflicts="),
        expectedHoldOperations: requiredInteger("--expected-hold="),
        expectedFreshDiffHash: requiredArgument("--fresh-diff-hash="),
        approvalDigest: requiredArgument("--approval-digest="),
        confirmProductionTarget: requiredArgument("--confirm-production-target="),
      },
    });
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  await rawClient.end({ timeout: 5 });
}

function createRunner(client) {
  return {
    readOnly(callback) {
      return client.begin("isolation level repeatable read read only", async (transactionClient) => {
        const guard = await transactionClient.unsafe("SELECT current_setting('transaction_read_only') AS read_only, current_setting('transaction_isolation') AS isolation", []);
        assert.equal(guard[0]?.read_only, "on");
        assert.equal(guard[0]?.isolation, "repeatable read");
        return callback(sessionProvider(transactionClient));
      });
    },
    write(callback) {
      return client.begin("isolation level serializable", async (transactionClient) => {
        const guard = await transactionClient.unsafe("SELECT current_setting('transaction_read_only') AS read_only, current_setting('transaction_isolation') AS isolation", []);
        assert.equal(guard[0]?.read_only, "off");
        assert.equal(guard[0]?.isolation, "serializable");
        return callback(sessionProvider(transactionClient));
      });
    },
  };
}

function sessionProvider(client) {
  const query = async (sql, parameters) => {
    const rows = await client.unsafe(sql, [...parameters]);
    return { rows: Array.from(rows), rowCount: typeof rows.count === "number" ? rows.count : rows.length };
  };
  return new PostgresDatabaseProvider({
    query,
    async transaction() { throw new Error("PRODUCTION_EXECUTOR_NESTED_TRANSACTION_REFUSED"); },
  });
}

async function inspectProductionTarget(client, hostname) {
  return client.begin("isolation level repeatable read read only", async (transactionClient) => {
    const rows = await transactionClient.unsafe(`SELECT current_database() AS database_name,
      current_user AS database_user,
      current_schema() AS schema_name,
      current_setting('server_version_num') AS server_version_num,
      current_setting('transaction_read_only') AS read_only`, []);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].schema_name, "public");
    assert.equal(rows[0].read_only, "on");
    assert.ok(Number(rows[0].server_version_num) >= 170000);
    const identity = {
      database: rows[0].database_name,
      user: rows[0].database_user,
      schema: rows[0].schema_name,
      serverVersion: rows[0].server_version_num,
      endpointHash: sha256(hostname),
    };
    return { fingerprint: sha256(canonicalJson(identity)) };
  });
}

function resolveReleaseSha() {
  const platformSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (platformSha) return assertCommitSha(platformSha);
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim();
  execFileSync("git", ["diff", "--quiet"], { windowsHide: true });
  execFileSync("git", ["diff", "--cached", "--quiet"], { windowsHide: true });
  return assertCommitSha(head);
}

function assertCommitSha(value) {
  assert.match(value, /^[a-f0-9]{40}$/i);
  return value;
}

function summarizePlan(plan) {
  return {
    course: plan.course,
    approvedCount: plan.approvedCount,
    holdCount: plan.holdCount,
    holdOperationCount: plan.holdOperationCount,
    operationSlots: plan.operationSlots,
    counts: plan.counts,
    conflictGate: plan.conflictGate,
    operations: plan.operations,
  };
}

function requiredArgument(prefix) {
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim();
  if (!value) fail("ARGUMENT_REQUIRED", `${prefix.slice(0, -1)} is required.`);
  return value;
}

function requiredInteger(prefix) {
  const value = requiredArgument(prefix);
  if (!/^\d+$/.test(value)) fail("ARGUMENT_INVALID", `${prefix.slice(0, -1)} must be a non-negative integer.`);
  return Number(value);
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
