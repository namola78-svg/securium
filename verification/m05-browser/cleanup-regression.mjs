import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stopOwnedChild } from "./lifecycle.mjs";

const harnessDir = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.join(harnessDir, "browser_server.py");
const repoRoot = path.resolve(harnessDir, "..", "..");
const tempPrefix = "securium-m05-browser-";

function tempDirs() {
  return new Set(
    fs.readdirSync(os.tmpdir(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(tempPrefix))
      .map((entry) => entry.name),
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runChild(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(String(chunk)));
  child.stderr.on("data", (chunk) => stderr.push(String(chunk)));
  return { child, stdout, stderr };
}

function waitForExit(child, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("child exit timeout")), timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

async function testOwnedChildFallback() {
  const { child } = runChild(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
  const started = Date.now();
  const result = await stopOwnedChild(child, {
    gracefulStopTimeoutMs: 50,
    forceStopTimeoutMs: 500,
    requestStop: () => {},
  });
  assert.equal(result.forced, true);
  assert.equal(result.terminated, true);
  assert.ok(Date.now() - started < 2000);
}

async function testMissingPythonCleansRuntime() {
  const before = tempDirs();
  const evidencePath = path.join(harnessDir, "evidence", "browser-verification-result.json");
  const missingPython = path.join(os.tmpdir(), `m05-missing-python-${process.pid}.exe`);
  const env = {
    ...process.env,
    PYTHON: missingPython,
    M05_BROWSER_EXECUTABLE: process.execPath,
    M05_BROWSER_MODE: "http",
  };
  const { child, stdout, stderr } = runChild(process.execPath, [path.join(harnessDir, "run-browser-verification.mjs")], { env });
  const exit = await waitForExit(child);
  assert.equal(exit.code, 2);
  await wait(100);
  const after = tempDirs();
  assert.deepEqual([...after].filter((name) => !before.has(name)), []);
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.final_status, "BROWSER_VERIFICATION_NOT_RUN");
  assert.equal(evidence.cleanup.runtime_dir_removed, true);
  assert.match([...stdout, ...stderr].join(""), /BROWSER_VERIFICATION_NOT_RUN|PROCESS_ERROR|ENOENT/);
}

async function testBrowserFailureCleansRuntime() {
  const before = tempDirs();
  const evidencePath = path.join(harnessDir, "evidence", "browser-verification-result.json");
  const env = {
    ...process.env,
    PYTHON: process.env.PYTHON || "python",
    M05_BROWSER_EXECUTABLE: path.join(harnessDir, "README.md"),
    M05_BROWSER_MODE: "http",
  };
  const { child } = runChild(process.execPath, [path.join(harnessDir, "run-browser-verification.mjs")], { env });
  const exit = await waitForExit(child, 10000);
  assert.equal(exit.code, 2);
  await wait(100);
  const after = tempDirs();
  assert.deepEqual([...after].filter((name) => !before.has(name)), []);
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.final_status, "BROWSER_VERIFICATION_NOT_RUN");
  assert.equal(evidence.cleanup.runtime_dir_removed, true);
  assert.equal(evidence.cleanup.server_stop.terminated, true);
}

async function testPortConflictPreservesListener() {
  const occupied = net.createServer();
  await new Promise((resolve, reject) => {
    occupied.once("error", reject);
    occupied.listen(0, "127.0.0.1", resolve);
  });
  const occupiedPort = occupied.address().port;
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), tempPrefix));
  const python = process.env.PYTHON || "python";
  const { child, stdout } = runChild(python, [
    "-u", serverScript,
    "--mode", "http",
    "--port", String(occupiedPort),
    "--attacker-port", "0",
    "--runtime-dir", runtimeDir,
  ]);
  const exit = await waitForExit(child);
  assert.equal(occupied.listening, true);
  occupied.close();
  assert.equal(exit.code, 2);
  assert.match(stdout.join(""), /START_ERROR/);
  assert.equal(fs.existsSync(runtimeDir), true);
  fs.rmSync(runtimeDir, { recursive: true, force: true });
}

await testOwnedChildFallback();
await testMissingPythonCleansRuntime();
await testBrowserFailureCleansRuntime();
await testPortConflictPreservesListener();
console.log("cleanup regression checks passed");
