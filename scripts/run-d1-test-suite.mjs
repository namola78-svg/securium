import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const argumentsToNode = process.argv.slice(2);
const SUBPROCESS_TIMEOUT_MS = 10 * 60 * 1_000;
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
    let settled = false;
    let forceKillTimer;
    const child = spawn(executable, args, {
      stdio: "inherit",
      windowsHide: true,
      env: environment,
    });
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
      forceKillTimer.unref?.();
      rejectPromise(new Error(`D1 test subprocess timed out after ${SUBPROCESS_TIMEOUT_MS}ms: ${executable} ${args.join(" ")}`));
    }, SUBPROCESS_TIMEOUT_MS);
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      rejectPromise(error);
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      clearTimeout(forceKillTimer);
      if (settled) return;
      settled = true;
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
