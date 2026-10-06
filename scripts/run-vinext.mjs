import { spawn } from "node:child_process";
import process from "node:process";
import {
  restoreNextGeneratedTypes,
  snapshotNextGeneratedTypes,
} from "./next-generated-type-preservation.mjs";

const command = process.argv[2];
const commandArguments = process.argv.slice(3);
const allowedCommands = new Set(["dev", "build", "start"]);

if (!allowedCommands.has(command)) {
  console.error("Usage: node scripts/run-vinext.mjs <dev|build|start>");
  process.exit(1);
}

// Vinext 1.0 writes its route helpers to the same hard-coded path Next uses.
// Preserve Next's generated contract around Vinext commands so a Cloudflare
// build cannot poison the subsequent Next typecheck.
const nextTypesSnapshot = await snapshotNextGeneratedTypes();

const child = spawn(
  process.execPath,
  ["node_modules/vinext/dist/cli.js", command, ...commandArguments],
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

child.on("error", async (error) => {
  console.error("Failed to start Vinext:", error);
  try {
    await restoreNextGeneratedTypes(nextTypesSnapshot);
  } catch (restoreError) {
    console.error("Failed to restore Next route types:", restoreError);
  }
  process.exit(1);
});

child.on("close", async (code, signal) => {
  try {
    await restoreNextGeneratedTypes(nextTypesSnapshot);
  } catch (error) {
    console.error("Failed to restore Next route types:", error);
    process.exit(1);
  }
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
