import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const command = process.argv[2];
const allowedCommands = new Set(["dev", "build", "start"]);

if (!allowedCommands.has(command)) {
  console.error("Usage: node scripts/run-vinext.mjs <dev|build|start>");
  process.exit(1);
}

// Vinext 1.0 writes its route helpers to the same hard-coded path Next uses.
// Preserve Next's generated contract around Vinext commands so a Cloudflare
// build cannot poison the subsequent Next typecheck.
const nextRoutesPath = path.resolve(".next/types/routes.d.ts");
const nextEnvPath = path.resolve("next-env.d.ts");
let nextRoutesSnapshot;
let nextEnvSnapshot;
try {
  const currentRoutes = await readFile(nextRoutesPath, "utf8");
  if (currentRoutes.startsWith("// This file is generated automatically by Next.js")) {
    nextRoutesSnapshot = currentRoutes;
    try {
      nextEnvSnapshot = await readFile(nextEnvPath, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

async function restoreNextRoutes() {
  if (nextRoutesSnapshot === undefined) return;
  await writeFile(nextRoutesPath, nextRoutesSnapshot, "utf8");
  if (nextEnvSnapshot !== undefined) {
    await writeFile(nextEnvPath, nextEnvSnapshot, "utf8");
  }
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

child.on("error", async (error) => {
  console.error("Failed to start Vinext:", error);
  try {
    await restoreNextRoutes();
  } catch (restoreError) {
    console.error("Failed to restore Next route types:", restoreError);
  }
  process.exit(1);
});

child.on("close", async (code, signal) => {
  try {
    await restoreNextRoutes();
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
