import { spawn } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: node scripts/run-wrangler.mjs <wrangler arguments>");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["node_modules/wrangler/bin/wrangler.js", ...args],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      WRANGLER_LOG_PATH:
        process.env.WRANGLER_LOG_PATH ?? ".wrangler/wrangler.log",
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
