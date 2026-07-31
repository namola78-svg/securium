import postgres from "postgres";
import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const CONFIRM_FLAG = "--confirm-production-seed";
const CONFIRM_ENV_NAME = "SECURIUM_CONFIRM_SECURITY_CERTIFICATION_CURRICULUM_SEED";
const CONFIRM_ENV_VALUE = "APPLY_SECURITY_CERTIFICATION_CURRICULUM_SEED";
const VALID_TARGETS = new Set(["d1-local", "d1-remote", "postgres"]);

const target = process.argv[2] ?? "d1-local";

if (!VALID_TARGETS.has(target)) {
  fail("SECURITY_CERTIFICATION_CURRICULUM_SEED_TARGET_INVALID");
}

const d1SeedPath = resolve(
  "db",
  "seeds",
  "security-certification-curriculum-2027-2029.d1.sql",
);
const postgresSeedPath = resolve(
  "db",
  "seeds",
  "security-certification-curriculum-2027-2029.postgres.sql",
);

if (target === "d1-local") {
  await assertFileExists(d1SeedPath);
  await runD1LocalSeed();
  process.exit(0);
}

assertProductionSeedApproval();

if (target === "d1-remote") {
  await assertFileExists(d1SeedPath);
  await runD1RemoteSeed();
  process.exit(0);
}

await assertFileExists(postgresSeedPath);
await runPostgresSeed();

async function runD1LocalSeed() {
  const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
  await runProcess(process.execPath, [
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    configPath,
    "--file",
    d1SeedPath,
  ]);
  console.log("SECURITY_CERTIFICATION_CURRICULUM_SEED_D1_LOCAL_APPLIED");
}

async function runD1RemoteSeed() {
  const configPath = argValue("--config=");
  if (!configPath) {
    fail(
      "D1_REMOTE_CONFIG_REQUIRED",
      "Pass --config=<wrangler production config> explicitly for D1 remote seed.",
    );
  }

  await runProcess(process.execPath, [
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--remote",
    "--config",
    configPath,
    "--file",
    d1SeedPath,
  ]);
  console.log("SECURITY_CERTIFICATION_CURRICULUM_SEED_D1_REMOTE_APPLIED");
}

async function runPostgresSeed() {
  const connectionUrl = resolvePostgresSeedUrl();
  const sql = postgres(connectionUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: false,
    ssl: "require",
    onnotice: false,
    debug: false,
    connection: {
      application_name: "securium-security-certification-curriculum-seed",
    },
  });

  try {
    await sql.unsafe(await readFile(postgresSeedPath, "utf8"));
  } catch (error) {
    fail("SECURITY_CERTIFICATION_CURRICULUM_SEED_POSTGRES_FAILED", safeErrorCode(error));
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("SECURITY_CERTIFICATION_CURRICULUM_SEED_POSTGRES_APPLIED");
}

function assertProductionSeedApproval() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    fail(
      "CONFIRM_FLAG_REQUIRED",
      `Run with ${CONFIRM_FLAG} only after approving the production data change.`,
    );
  }

  if (process.env[CONFIRM_ENV_NAME] !== CONFIRM_ENV_VALUE) {
    fail(
      "CONFIRM_ENV_REQUIRED",
      `Set ${CONFIRM_ENV_NAME}=${CONFIRM_ENV_VALUE} before running.`,
    );
  }
}

function resolvePostgresSeedUrl() {
  const connectionUrl =
    process.env.POSTGRES_SEED_URL?.trim() ||
    process.env.POSTGRES_MIGRATION_URL?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!connectionUrl) {
    fail(
      "POSTGRES_SEED_URL_REQUIRED",
      "Set POSTGRES_SEED_URL, POSTGRES_MIGRATION_URL, DIRECT_URL, or DATABASE_URL.",
    );
  }

  return connectionUrl;
}

async function assertFileExists(path) {
  try {
    await access(path);
  } catch {
    fail(
      "SECURITY_CERTIFICATION_CURRICULUM_SEED_SQL_NOT_FOUND",
      "Run npm run curriculum:security-certification:sql first.",
    );
  }
}

function argValue(prefix) {
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function runProcess(executable, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, {
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
    });

    child.on("error", () => {
      fail("SECURITY_CERTIFICATION_CURRICULUM_SEED_PROCESS_FAILED");
    });
    child.on("close", (code) => {
      if (code !== 0) {
        fail("SECURITY_CERTIFICATION_CURRICULUM_SEED_PROCESS_FAILED");
      }
      resolvePromise();
    });
  });
}

function safeErrorCode(error) {
  if (!error || typeof error !== "object") return "UNKNOWN";
  const code = "code" in error ? error.code : undefined;
  if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code)) return code;
  const name = "name" in error ? error.name : undefined;
  if (typeof name === "string" && /^[A-Za-z0-9_]+$/.test(name)) return name;
  return "UNKNOWN";
}

function fail(code, message) {
  console.error(message ? `${code}:${message}` : code);
  process.exit(1);
}
