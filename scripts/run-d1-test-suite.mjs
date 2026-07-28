import { spawn } from "node:child_process";
import process from "node:process";

const argumentsToNode = process.argv.slice(2);
if (argumentsToNode[0] !== "--test") {
  console.error("This wrapper only runs Node test suites.");
  process.exit(1);
}

const child = spawn(process.execPath, argumentsToNode, {
  stdio: "inherit",
  windowsHide: true,
  env: {
    ...process.env,
    // Local integration and E2E suites own their D1 fixtures. Explicitly
    // isolate them from a developer's Supabase settings in .env.local.
    APP_BUILD_TARGET: "cloudflare",
    DB_PROVIDER: "d1",
    D1_TEST_MODE: "1",
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
