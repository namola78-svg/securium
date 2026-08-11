import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const persistTo = await mkdtemp(join(tmpdir(), "securium-v3-fresh-d1-"));
const config = "wrangler.local.jsonc";
const sourceRoot = resolve(process.env.SECURIUM_CONTENT_V2_SOURCE_ROOT || "securium-content-upgrade-v2");
const steps = [];
try {
  await run("migrations", ["scripts/run-wrangler.mjs", "d1", "migrations", "apply", "DB", "--local", "--config", config, "--persist-to", persistTo]);
  await run("base-seed", ["scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local", "--config", config, "--persist-to", persistTo, "--file", "db/seed.sql"]);
  await run("official-security-curriculum", ["scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local", "--config", config, "--persist-to", persistTo, "--file", "db/seeds/security-certification-curriculum-2027-2029.d1.sql"]);
  await run("v2-adapter", ["scripts/security-content-upgrade-v3.mjs", "seed:d1-local", `--source-root=${sourceRoot}`, `--persist-to=${persistTo}`]);
  await run("v3-intelligence", ["scripts/security-content-intelligence-v3.mjs", "seed:d1-local", `--persist-to=${persistTo}`]);
  await run("v3-idempotency", ["scripts/security-content-intelligence-v3.mjs", "seed:d1-local", `--persist-to=${persistTo}`]);
  const report = { generatedAt: new Date().toISOString(), status: "PASS", isolatedPersistPath: "TEMPORARY_REMOVED", steps };
  await writeFile(resolve("reports/content-v3/fresh-d1-validation.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(persistTo, { recursive: true, force: true });
}

async function run(name, args) {
  const started = Date.now();
  const result = await capture(process.execPath, args);
  steps.push({ name, exitCode: result.code, durationMs: Date.now() - started });
  if (result.code !== 0) throw new Error(`SECURITY_CONTENT_V3_FRESH_D1_FAILED:${name}:${result.output.slice(-1000)}`);
}

function capture(executable, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env, windowsHide: true });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("close", (code) => resolvePromise({ code: code ?? 1, output }));
    child.on("error", () => resolvePromise({ code: 1, output }));
  });
}
