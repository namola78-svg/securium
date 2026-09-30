import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import process from "node:process";

const host = "127.0.0.1";
const defaultReadinessTimeoutMs = 120_000;
const requestTimeoutMs = 1_000;
const pollIntervalMs = 250;
const outputLimit = 64 * 1024;

export async function startVinextE2EServer({
  port,
  readinessPath,
  readinessHeaders,
  validateResponse = (response) => response.ok,
  timeoutMs = defaultReadinessTimeoutMs,
  env = {},
} = {}) {
  if (typeof readinessPath !== "string" || !readinessPath.startsWith("/")) {
    throw new TypeError("Vinext E2E server requires an application readiness path.");
  }
  const selectedPort = port ?? await reserveLoopbackPort();
  if (!Number.isInteger(selectedPort) || selectedPort < 1 || selectedPort > 65_535) {
    throw new RangeError("Invalid Vinext E2E port: " + selectedPort);
  }
  const baseUrl = "http://" + host + ":" + selectedPort;
  const command = process.execPath;
  const args = [
    "node_modules/vite/bin/vite.js",
    "dev",
    "--host",
    host,
    "--port",
    String(selectedPort),
    "--strictPort",
  ];
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  let stdout = "";
  let stderr = "";
  let spawnError;
  let exitCode;
  let exitSignal;
  child.stdout.on("data", (chunk) => {
    stdout = (stdout + chunk.toString()).slice(-outputLimit);
  });
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-outputLimit);
  });
  child.once("error", (error) => {
    spawnError = error;
  });
  child.once("exit", (code, signal) => {
    exitCode = code;
    exitSignal = signal;
  });

  try {
    await waitForHttpReadiness({
      child,
      url: new URL(readinessPath, baseUrl),
      headers: readinessHeaders,
      validateResponse,
      timeoutMs,
      getSpawnError: () => spawnError,
    });
  } catch (error) {
    if (child.pid) await stopChild(child);
    const details = [
      error.message,
      "Command: " + command + " " + args.join(" "),
      "Exit: code=" + (exitCode ?? child.exitCode ?? "unknown") + " signal=" + (exitSignal ?? child.signalCode ?? "none"),
    ];
    if (stdout) details.push("stdout:\n" + stdout);
    if (stderr) details.push("stderr:\n" + stderr);
    throw new Error(details.join("\n"), { cause: error });
  }

  return {
    baseUrl,
    child,
    stop: () => stopChild(child),
  };
}

export async function waitForHttpReadiness({
  child,
  url,
  headers,
  validateResponse = (response) => response.ok,
  timeoutMs,
  getSpawnError = () => undefined,
  fetchImpl = fetch,
}) {
  const deadline = Date.now() + timeoutMs;
  let lastFailure = "Readiness endpoint returned a non-success response.";
  while (Date.now() < deadline) {
    const spawnError = getSpawnError();
    if (spawnError) throw new Error("Dev server failed to spawn: " + spawnError.message);
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("Dev server exited before readiness: code=" + (child.exitCode ?? "unknown") + " signal=" + (child.signalCode ?? "none"));
    }
    let response;
    try {
      response = await fetchImpl(url, {
        headers,
        signal: AbortSignal.timeout(Math.min(requestTimeoutMs, Math.max(1, deadline - Date.now()))),
      });
    } catch (error) {
      lastFailure = "Readiness request failed: " + (error?.cause?.code ?? error?.message ?? error) + ".";
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      await response?.body?.cancel();
      throw new Error("Dev server exited before readiness: code=" + (child.exitCode ?? "unknown") + " signal=" + (child.signalCode ?? "none"));
    }
    const lateSpawnError = getSpawnError();
    if (lateSpawnError) {
      await response?.body?.cancel();
      throw new Error("Dev server failed to spawn: " + lateSpawnError.message);
    }
    if (response) {
      let ready = false;
      try {
        ready = await validateResponse(response.clone());
      } catch (error) {
        lastFailure = "Readiness response did not match the expected application contract: " + (error?.message ?? error) + ".";
      }
      await response.body?.cancel();
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error("Dev server exited before readiness: code=" + (child.exitCode ?? "unknown") + " signal=" + (child.signalCode ?? "none"));
      }
      if (ready) return;
      if (response.status < 200 || response.status >= 300) {
        lastFailure = "Readiness endpoint returned HTTP " + response.status + ".";
      } else {
        lastFailure = "Readiness response did not match the expected application contract.";
      }
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(pollIntervalMs, Math.max(1, deadline - Date.now()))));
  }
  throw new Error("Dev server readiness timed out after " + timeoutMs + "ms for " + url + ": " + lastFailure);
}

async function reserveLoopbackPort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, host, resolve);
  });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a loopback port.");
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else if (child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
  const graceful = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 5_000);
      timer.unref?.();
    }),
  ]);
  if (graceful) return;
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else if (child.pid) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
  await exited;
}
