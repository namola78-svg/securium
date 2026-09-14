import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ownedRoot = await mkdtemp(join(tmpdir(), "securium-http-contract-"));
const environment = { ...process.env };
for (const key of [
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_SEED_URL",
  "POSTGRES_MIGRATION_URL",
  "POSTGRES_VERIFY_URL",
]) {
  delete environment[key];
}
environment.APP_BUILD_TARGET = "cloudflare";
environment.AUTH_PROVIDER = "sites";
environment.DB_PROVIDER = "d1";
environment.D1_TEST_MODE = "1";
environment.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = "false";
environment.MINIFLARE_REGISTRY_PATH = join(ownedRoot, "registry");
environment.WRANGLER_LOG_PATH = join(ownedRoot, "wrangler.log");

let exitCode = 1;
try {
  exitCode = await run(
    process.execPath,
    [
      "scripts/run-d1-test-suite.mjs",
      "--test",
      "--test-concurrency=1",
      "tests/public-course-availability-http-contract.test.mjs",
    ],
    environment,
  );
} finally {
  await rm(ownedRoot, { recursive: true, force: true });
  console.log("SECURIUM_HTTP_CONTRACT_HARNESS_CLEANUP PASS");
}
process.exit(exitCode);

function run(executable, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`HTTP contract runner stopped by ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}
