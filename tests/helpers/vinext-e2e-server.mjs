import { spawn, spawnSync } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { connect, createServer } from "node:net";
import path from "node:path";
import process from "node:process";
import {
  restoreNextGeneratedTypes,
  snapshotNextGeneratedTypes,
} from "../../scripts/next-generated-type-preservation.mjs";

const host = "127.0.0.1";
const defaultReadinessTimeoutMs = 120_000;
const requestTimeoutMs = 1_000;
const childExitTimeoutMs = 5_000;
const pollIntervalMs = 250;
const outputLimit = 64 * 1024;
const transientNetworkCodes = new Set(["ECONNREFUSED", "ECONNRESET"]);

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
  const nextTypesSnapshot = await snapshotNextGeneratedTypes();
  const readinessStartedAt = Date.now();
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
  let readinessStatus;
  let readinessElapsedMs;
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    stdout = (stdout + text).slice(-outputLimit);
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    stderr = (stderr + text).slice(-outputLimit);
  });
  child.once("error", (error) => {
    spawnError = error;
  });
  child.once("exit", (code, signal) => {
    exitCode = code;
    exitSignal = signal;
  });

  try {
    const readiness = await waitForHttpReadiness({
      child,
      url: new URL(readinessPath, baseUrl),
      headers: readinessHeaders,
      validateResponse,
      timeoutMs,
      deadlineAt: readinessStartedAt + timeoutMs,
      getSpawnError: () => spawnError,
    });
    readinessStatus = readiness.status;
    readinessElapsedMs = Date.now() - readinessStartedAt;
    console.info("Vinext E2E readiness PASS " + JSON.stringify({
      pid: child.pid,
      port: selectedPort,
      readinessPath,
      status: readinessStatus,
      readinessMs: readinessElapsedMs,
    }));
  } catch (error) {
    const cleanupErrors = await cleanupStartupFailure({
      child,
      stop: () => child.pid ? stopChild(child) : Promise.resolve(),
      removeLock: () => child.pid ? removeOwnedVinextDevLock({
        cwd: process.cwd(), child, port: selectedPort, baseUrl,
      }) : Promise.resolve(false),
      restore: () => restoreNextGeneratedTypes(nextTypesSnapshot),
    });
    const details = [
      error.message,
      "Command: " + command + " " + args.join(" "),
      "Exit: code=" + (exitCode ?? child.exitCode ?? "unknown") + " signal=" + (exitSignal ?? child.signalCode ?? "none"),
    ];
    if (stdout) details.push("stdout:\n" + stdout);
    if (stderr) details.push("stderr:\n" + stderr);
    for (const cleanupError of cleanupErrors) details.push("Cleanup: " + cleanupError.message);
    throw new Error(details.join("\n"), { cause: error });
  }

  const handle = {
    baseUrl,
    child,
    get diagnostics() {
      return {
        pid: child.pid,
        port: selectedPort,
        baseUrl,
        readinessPath,
        readinessStatus,
        readinessMs: readinessElapsedMs,
        childRunning: child.exitCode === null && child.signalCode === null,
        exitCode: child.exitCode,
        exitSignal: child.signalCode,
      };
    },
    async stop() {
      try {
        await stopChild(child);
        return await removeOwnedVinextDevLock({
          cwd: process.cwd(),
          child,
          port: selectedPort,
          baseUrl,
        });
      } finally {
        await restoreNextGeneratedTypes(nextTypesSnapshot);
      }
    },
  };
  return handle;
}

export async function removeOwnedVinextDevLock({ cwd, child, port, baseUrl }) {
  if (
    !child?.pid ||
    (child.exitCode === null && child.signalCode === null)
  ) {
    return false;
  }
  const lockPath = path.join(cwd, ".vinext", "dev", "lock.json");
  let serialized;
  let lock;
  try {
    serialized = await readFile(lockPath, "utf8");
    lock = JSON.parse(serialized);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  if (
    lock.pid !== child.pid ||
    lock.port !== port ||
    lock.hostname !== host ||
    lock.appUrl !== baseUrl ||
    typeof lock.cwd !== "string" ||
    path.resolve(lock.cwd) !== path.resolve(cwd)
  ) {
    return false;
  }
  if ((await readFile(lockPath, "utf8")) !== serialized) return false;
  await unlink(lockPath);
  return true;
}

export async function cleanupStartupFailure({ stop, removeLock, restore }) {
  const errors = [];
  try {
    await stop();
  } catch (error) {
    errors.push(error);
  }
  try {
    await removeLock();
  } catch (error) {
    errors.push(error);
  }
  try {
    await restore();
  } catch (error) {
    errors.push(error);
  }
  return errors;
}

export async function waitForHttpReadiness({
  child,
  url,
  headers,
  validateResponse = (response) => response.ok,
  timeoutMs,
  getSpawnError = () => undefined,
  fetchImpl = fetch,
  probeTcpImpl = probeTcp,
  getPortOwner = getTcpListenerPid,
  isOwnedProcess = isProcessInChildTree,
  deadlineAt = Date.now() + timeoutMs,
}) {
  const deadline = deadlineAt;
  const readinessUrl = url instanceof URL ? url : new URL(url);
  if (readinessUrl.protocol !== "http:" || readinessUrl.hostname !== host || !readinessUrl.port) {
    throw new TypeError("Vinext readiness must use an explicit HTTP loopback address on 127.0.0.1.");
  }
  const port = Number(readinessUrl.port);
  let lastFailure = "Readiness endpoint returned a non-success response.";
  while (Date.now() < deadline) {
    const spawnError = getSpawnError();
    if (spawnError) throw new Error("Dev server failed to spawn: " + spawnError.message);
    throwIfChildExited(child, port, getPortOwner, isOwnedProcess);
    let response;
    const connected = await probeTcpImpl(readinessUrl.hostname, port);
    throwIfChildExited(child, port, getPortOwner, isOwnedProcess);
    if (!connected) {
      lastFailure = "Expected loopback port is not listening at " + readinessUrl.hostname + ":" + port + ".";
      await waitForNextProbe(deadline);
      continue;
    }
    const ownerPid = getPortOwner(port);
    throwIfChildExited(child, port, getPortOwner, isOwnedProcess);
    if (!Number.isInteger(ownerPid) || ownerPid < 1) {
      lastFailure = "Could not verify the process owning loopback port " + port + ".";
      await waitForNextProbe(deadline);
      continue;
    }
    if (!isOwnedProcess(ownerPid, child.pid)) {
      throw new Error("Foreign process " + ownerPid + " owns Vinext readiness port " + port + ".");
    }
    try {
      response = await fetchImpl(readinessUrl, {
        headers,
        signal: AbortSignal.timeout(Math.min(requestTimeoutMs, Math.max(1, deadline - Date.now()))),
      });
    } catch (error) {
      if (!isStartupTransientNetworkError(error)) {
        throw new Error("Vinext readiness request failed unexpectedly: " + (error?.cause?.code ?? error?.message ?? error), { cause: error });
      }
      lastFailure = "Readiness request is still starting: " + (error?.cause?.code ?? error?.code ?? error?.message ?? error) + ".";
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      await cancelResponseBody(response);
      throwIfChildExited(child, port, getPortOwner, isOwnedProcess);
    }
    const lateSpawnError = getSpawnError();
    if (lateSpawnError) {
      await cancelResponseBody(response);
      throw new Error("Dev server failed to spawn: " + lateSpawnError.message);
    }
    if (response) {
      let ready = false;
      let validationError;
      try {
        ready = await validateResponse(response);
      } catch (error) {
        validationError = error;
        lastFailure = "Readiness response did not match the expected application contract: " + (error?.message ?? error) + ".";
      }
      const bodySettled = response.bodyUsed || await cancelResponseBody(response, Math.min(100, Math.max(1, deadline - Date.now())));
      if (!bodySettled) {
        lastFailure = "Readiness response body cleanup did not settle promptly.";
      }
      if (child.exitCode !== null || child.signalCode !== null) {
        throwIfChildExited(child, port, getPortOwner, isOwnedProcess);
      }
      if (ready) {
        return { status: response.status };
      }
      if (response.status < 200 || response.status >= 300) {
        lastFailure = "Readiness endpoint returned HTTP " + response.status + ".";
      } else if (!validationError) {
        lastFailure = "Readiness response did not match the expected application contract.";
      }
    }
    await waitForNextProbe(deadline);
  }
  throw new Error("Dev server readiness timed out after " + timeoutMs + "ms for " + readinessUrl + ": " + lastFailure);
}

function probeTcp(hostname, port) {
  return new Promise((resolve) => {
    const connection = connect({ host: hostname, port });
    let settled = false;
    const finish = (connected) => {
      if (settled) return;
      settled = true;
      connection.destroy();
      resolve(connected);
    };
    connection.once("connect", () => finish(true));
    connection.once("error", () => finish(false));
    connection.setTimeout(100, () => finish(false));
  });
}

function throwIfChildExited(child, port, getPortOwner, isOwnedProcess) {
  if (child.exitCode === null && child.signalCode === null) return;
  if (child.pid) {
    const ownerPid = getPortOwner(port);
    if (Number.isInteger(ownerPid) && ownerPid > 0 && !isOwnedProcess(ownerPid, child.pid)) {
      throw new Error("Foreign process " + ownerPid + " owns Vinext readiness port " + port + ".");
    }
  }
  throw new Error("Dev server exited before readiness: code=" + (child.exitCode ?? "unknown") + " signal=" + (child.signalCode ?? "none"));
}

function waitForNextProbe(deadline) {
  return new Promise((resolve) => setTimeout(resolve, Math.min(pollIntervalMs, Math.max(1, deadline - Date.now()))));
}

async function cancelResponseBody(response, timeoutMs = 100) {
  let cancellation;
  try {
    cancellation = response?.body?.cancel();
  } catch {
    return false;
  }
  if (!cancellation) return true;
  let timer;
  const timedOut = Symbol("body cancellation timeout");
  const result = await Promise.race([
    Promise.resolve(cancellation).then(() => true, () => false),
    new Promise((resolve) => { timer = setTimeout(() => resolve(timedOut), timeoutMs); }),
  ]);
  clearTimeout(timer);
  return result === true;
}

function isStartupTransientNetworkError(error) {
  let current = error;
  while (current) {
    if (transientNetworkCodes.has(current.code)) return true;
    current = current.cause;
  }
  return error?.name === "TimeoutError" || error?.name === "AbortError";
}

function getTcpListenerPid(port) {
  if (process.platform === "win32") {
    const result = spawnSync("netstat.exe", ["-ano", "-p", "tcp"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5_000,
    });
    if (result.error || result.status !== 0) {
      throw new Error("Could not inspect Windows TCP listeners: " + (result.error?.message ?? result.stderr ?? result.status));
    }
    for (const line of result.stdout.split(/\r?\n/)) {
      const fields = line.trim().split(/\s+/);
      if (fields[0]?.toUpperCase() !== "TCP" || fields[3]?.toUpperCase() !== "LISTENING") continue;
      if (!fields[1]?.endsWith(":" + port)) continue;
      const pid = Number(fields[4]);
      if (Number.isInteger(pid) && pid > 0) return pid;
    }
    return null;
  }
  const result = spawnSync("sh", ["-c", "ss -ltnp 'sport = :" + port + "' 2>/dev/null"], {
    encoding: "utf8",
    timeout: 5_000,
  });
  if (result.status !== 0) throw new Error("Could not inspect TCP listeners: " + (result.stderr ?? result.status));
  const match = result.stdout.match(/pid=(\d+)/);
  return match ? Number(match[1]) : null;
}

function isProcessInChildTree(processId, rootPid) {
  if (!Number.isInteger(processId) || !Number.isInteger(rootPid)) return false;
  if (processId === rootPid) return true;
  const command = process.platform === "win32"
    ? ["powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "Get-CimInstance Win32_Process | ForEach-Object { '{0},{1}' -f $_.ProcessId,$_.ParentProcessId }"]]
    : ["ps", ["-eo", "pid=,ppid="]];
  const result = spawnSync(command[0], command[1], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5_000,
  });
  if (result.error || result.status !== 0) {
    throw new Error("Could not verify Vinext process ownership: " + (result.error?.message ?? result.stderr ?? result.status));
  }
  const parents = new Map();
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+)[,\s]+(\d+)$/);
    if (match) parents.set(Number(match[1]), Number(match[2]));
  }
  let current = processId;
  const visited = new Set();
  while (current && !visited.has(current)) {
    if (current === rootPid) return true;
    visited.add(current);
    current = parents.get(current);
  }
  return false;
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

export async function stopChild(child, {
  platform = process.platform,
  spawnSyncImpl = spawnSync,
  timeoutMs = childExitTimeoutMs,
} = {}) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = waitForChildExit(child, timeoutMs);
  if (platform === "win32" && child.pid) {
    const result = spawnSyncImpl("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
      timeout: timeoutMs,
    });
    if (result.error || result.status !== 0) {
      const settled = await exited;
      if (settled) return;
      throw new Error("taskkill.exe failed to stop Vinext child " + child.pid + ": " + (result.error?.message ?? result.stderr ?? "exit status " + result.status));
    }
  } else if (child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
  if (await exited) return;
  if (platform !== "win32" && child.pid) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
  if (await waitForChildExit(child, timeoutMs)) return;
  throw new Error("Vinext child " + (child.pid ?? "unknown") + " did not exit within " + timeoutMs + "ms.");
}

export function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    let timer;
    const finish = (exited) => {
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    child.once("exit", onExit);
    timer = setTimeout(() => finish(child.exitCode !== null || child.signalCode !== null), timeoutMs);
  });
}
