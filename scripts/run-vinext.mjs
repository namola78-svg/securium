import { spawn } from "node:child_process";
import process from "node:process";

const command = process.argv[2];
const allowedCommands = new Set(["dev", "build", "start"]);

if (!allowedCommands.has(command)) {
  console.error("Usage: node scripts/run-vinext.mjs <dev|build|start>");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["node_modules/vinext/dist/cli.js", command],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      APP_BUILD_TARGET: "cloudflare",
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
