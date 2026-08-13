import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const argumentsToNode = process.argv.slice(2);
if (argumentsToNode[0] !== "--test") {
  console.error("This wrapper only runs Node test suites.");
  process.exit(1);
}

const persistTo = await mkdtemp(join(tmpdir(), "securium-d1-suite-"));
const environment = {
  ...process.env,
  // The suite owns a temporary D1 fixture and never reuses a developer's
  // .wrangler state or Supabase settings.
  APP_BUILD_TARGET: "cloudflare",
  AUTH_PROVIDER: "sites",
  DB_PROVIDER: "d1",
  D1_TEST_MODE: "1",
  D1_TEST_PERSIST_PATH: persistTo,
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
};

let exitCode = 1;
try {
  await run(process.execPath, [
    "scripts/run-wrangler.mjs",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
  ]);
  await run(process.execPath, [
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
    "--file",
    "db/seed.sql",
  ]);
  exitCode = await run(process.execPath, argumentsToNode, true);
} finally {
  await rm(persistTo, { recursive: true, force: true });
}
process.exit(exitCode);

function run(executable, args, returnCode = false) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, args, {
      stdio: "inherit",
      windowsHide: true,
      env: environment,
    });
    child.on("error", rejectPromise);
    child.on("exit", (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`D1 test process stopped by ${signal}.`));
        return;
      }
      const resolvedCode = code ?? 1;
      if (resolvedCode !== 0 && !returnCode) {
        rejectPromise(
          new Error(`D1 test fixture preparation failed with ${resolvedCode}.`),
        );
        return;
      }
      resolvePromise(resolvedCode);
    });
  });
}
