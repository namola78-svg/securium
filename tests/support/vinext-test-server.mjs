import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import os from "node:os";
import process from "node:process";

const DEFAULT_TIMEOUT_MS = 180_000;
const SLOW_STARTUP_THRESHOLD_MS = 120_000;
const POLL_INTERVAL_MS = 250;
const HTTP_PROBE_TIMEOUT_MS = 1_000;
const OUTPUT_LIMIT = 64_000;
const DIAGNOSTIC_OUTPUT_LIMIT = 4_000;
const RESOURCE_CONTENTION_FREE_MEMORY_THRESHOLD = 1.5 * 1024 ** 3;

export const READINESS_FAILURE_CLASSIFICATIONS = Object.freeze([
  "PROCESS_EXITED_BEFORE_READY",
  "PORT_COLLISION",
  "READINESS_TIMEOUT",
  "HTTP_NEVER_READY",
  "RESOURCE_CONTENTION_SUSPECTED",
  "READY",
  "PROCESS_EXITED_AFTER_READY",
]);

export async function startVinextTestServer({
  cwd = process.cwd(),
  env = {},
  label = "Vinext integration",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  slowStartupThresholdMs = SLOW_STARTUP_THRESHOLD_MS,
} = {}) {
  const runId = `${process.pid}-${Date.now()}-${randomUUID()}`;
  const startedAt = Date.now();
  const state = {
    runId,
    ownerPid: process.pid,
    childPid: null,
    cwd,
    label,
    startedAt,
    command: [],
    portStrategy: "OS_SELECTED_PORT_WITH_STRICT_PORT",
    requestedPort: null,
    port: null,
    portCollisionDetected: false,
    baseUrl: "",
    output: "",
    firstOutputAt: null,
    firstStdoutAt: null,
    firstStderrAt: null,
    firstStdout: "",
    firstStderr: "",
    readinessAt: null,
    firstSuccessfulHttpAt: null,
    exitAt: null,
    exitCode: null,
    exitSignal: null,
    exited: false,
    intentionalStop: false,
    runtimeFailure: null,
    cleanup: null,
  };

  state.requestedPort = await allocateLoopbackPort();
  state.port = state.requestedPort;
  state.command = [
    process.execPath,
    "node_modules/vinext/dist/cli.js",
    "dev",
    "--host",
    "127.0.0.1",
    "--port",
    String(state.requestedPort),
    "--strictPort",
  ];

  const child = spawn(process.execPath, state.command.slice(1), {
    cwd,
    env: {
      ...process.env,
      ...env,
      SECURIUM_HARNESS_RUN_ID: runId,
      SECURIUM_HARNESS_OWNER_PID: String(process.pid),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  state.childPid = child.pid ?? null;

  let resolveExit;
  const exitPromise = new Promise((resolve) => {
    resolveExit = resolve;
  });

  const appendOutput = (stream, chunk) => {
    const text = chunk.toString();
    const now = Date.now();
    state.firstOutputAt ??= now;
    if (stream === "stdout") {
      state.firstStdoutAt ??= now;
      if (!state.firstStdout) state.firstStdout = redact(text).slice(0, 2_000);
    } else {
      state.firstStderrAt ??= now;
      if (!state.firstStderr) state.firstStderr = redact(text).slice(0, 2_000);
    }
    state.output = `${state.output}${text}`.slice(-OUTPUT_LIMIT);
    captureBaseUrl(state);
  };

  child.stdout.on("data", (chunk) => appendOutput("stdout", chunk));
  child.stderr.on("data", (chunk) => appendOutput("stderr", chunk));
  child.once("error", (error) => {
    state.output = `${state.output}\n${redact(error.message)}`.slice(-OUTPUT_LIMIT);
  });
  child.once("exit", (code, signal) => {
    state.exited = true;
    state.exitAt = Date.now();
    state.exitCode = code;
    state.exitSignal = signal;
    if (!state.intentionalStop && state.readinessAt) {
      state.runtimeFailure = {
        classification: "PROCESS_EXITED_AFTER_READY",
        message: `${label} exited after becoming ready (code=${code ?? "null"}, signal=${signal ?? "null"}).`,
      };
    }
    resolveExit();
  });

  try {
    while (Date.now() - startedAt < timeoutMs) {
      if (state.exited) {
        throw createHarnessError(state, classifyProcessExit(state), label);
      }
      if (state.baseUrl) {
        try {
          const response = await fetch(state.baseUrl, {
            signal: AbortSignal.timeout(HTTP_PROBE_TIMEOUT_MS),
          });
          if (response.status > 0) {
            state.readinessAt = Date.now();
            state.firstSuccessfulHttpAt = state.readinessAt;
            const handle = createHandle(child, state, exitPromise, {
              timeoutMs,
              slowStartupThresholdMs,
            });
            emitTrace(handle);
            return handle;
          }
        } catch {
          // The URL is known, but the server is not accepting requests yet.
        }
      }
      await delay(POLL_INTERVAL_MS);
    }

    throw createHarnessError(state, classifyTimeout(state), label);
  } catch (error) {
    try {
      await stopOwnedProcess(child, state, exitPromise);
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
    }
    throw error;
  }
}

function createHandle(child, state, exitPromise, options) {
  let stopPromise;
  return {
    get baseUrl() {
      return state.baseUrl;
    },
    get port() {
      return state.port;
    },
    get runId() {
      return state.runId;
    },
    get childPid() {
      return state.childPid;
    },
    get failure() {
      return state.runtimeFailure;
    },
    get diagnostics() {
      return snapshot(state, options);
    },
    assertRunning() {
      if (state.runtimeFailure) {
        const error = new Error(state.runtimeFailure.message);
        error.failureClassification = state.runtimeFailure.classification;
        error.diagnostics = snapshot(state, options);
        throw error;
      }
      if (state.exited && !state.intentionalStop) {
        const error = createHarnessError(state, "PROCESS_EXITED_AFTER_READY", "Vinext");
        error.diagnostics = snapshot(state, options);
        throw error;
      }
    },
    async stop() {
      stopPromise ??= stopOwnedProcess(child, state, exitPromise);
      const cleanup = await stopPromise;
      state.cleanup = cleanup;
      emitTrace(this);
      return cleanup;
    },
  };
}

function captureBaseUrl(state) {
  if (state.baseUrl) return;
  const cleanOutput = state.output.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
  const match = cleanOutput.match(
    /Local:\s+(https?:\/\/(?:localhost|127\.0\.0\.1):(\d+))(?:\/|\s|$)/i,
  );
  if (!match) return;
  state.baseUrl = new URL(match[1]).origin;
  state.port = Number(match[2]);
  state.portCollisionDetected = state.port !== state.requestedPort;
}

function allocateLoopbackPort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not allocate a loopback port for Vinext."));
        return;
      }
      probe.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function classifyProcessExit(state) {
  if (state.portCollisionDetected || hasPortCollision(state.output)) return "PORT_COLLISION";
  return "PROCESS_EXITED_BEFORE_READY";
}

function classifyTimeout(state) {
  if (state.portCollisionDetected || hasPortCollision(state.output)) return "PORT_COLLISION";
  if (resourceContentionSuspected()) return "RESOURCE_CONTENTION_SUSPECTED";
  if (state.baseUrl) return "HTTP_NEVER_READY";
  return "READINESS_TIMEOUT";
}

function hasPortCollision(output) {
  return /(EADDRINUSE|address already in use|port .* in use|failed to bind)/i.test(output);
}

function resourceContentionSuspected() {
  return (
    process.env.SECURIUM_HARNESS_ASSUME_CONTENTION === "1" ||
    os.freemem() < RESOURCE_CONTENTION_FREE_MEMORY_THRESHOLD
  );
}

function createHarnessError(state, classification, label) {
  const error = new Error(
    `${label} readiness failed: ${classification}.\n${redact(state.output).slice(-DIAGNOSTIC_OUTPUT_LIMIT)}`,
  );
  error.failureClassification = classification;
  error.diagnostics = snapshot(state, { timeoutMs: DEFAULT_TIMEOUT_MS });
  return error;
}

function snapshot(state, { timeoutMs, slowStartupThresholdMs = SLOW_STARTUP_THRESHOLD_MS } = {}) {
  const observedAt = state.readinessAt ?? Date.now();
  const readinessDurationMs = state.readinessAt
    ? state.readinessAt - state.startedAt
    : observedAt - state.startedAt;
  return {
    runId: state.runId,
    ownerPid: state.ownerPid,
    childPid: state.childPid,
    cwd: state.cwd,
    label: state.label,
    command: state.command,
    portStrategy: state.portStrategy,
    requestedPort: state.requestedPort,
    port: state.port,
    portCollisionDetected: state.portCollisionDetected,
    baseUrl: state.baseUrl || null,
    startedAt: new Date(state.startedAt).toISOString(),
    firstOutputAt: toIso(state.firstOutputAt),
    firstStdoutAt: toIso(state.firstStdoutAt),
    firstStderrAt: toIso(state.firstStderrAt),
    firstStdout: state.firstStdout,
    firstStderr: state.firstStderr,
    readinessAt: toIso(state.readinessAt),
    firstSuccessfulHttpAt: toIso(state.firstSuccessfulHttpAt),
    readinessDurationMs,
    slowStartup: readinessDurationMs > slowStartupThresholdMs,
    timeoutMs,
    exitAt: toIso(state.exitAt),
    exitCode: state.exitCode,
    exitSignal: state.exitSignal,
    failureClassification: state.runtimeFailure?.classification ?? (state.readinessAt ? "READY" : null),
    runtimeFailure: state.runtimeFailure,
    cleanup: state.cleanup,
    outputTail: redact(state.output).slice(-DIAGNOSTIC_OUTPUT_LIMIT),
  };
}

async function stopOwnedProcess(child, state, exitPromise) {
  if (state.intentionalStop && state.exited) {
    return await verifyPortReleased(state.port);
  }
  state.intentionalStop = true;
  const stopStartedAt = Date.now();
  if (process.platform === "win32" && state.childPid) {
    spawnSync("taskkill.exe", ["/PID", String(state.childPid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else if (!state.exited) {
    child.kill("SIGTERM");
  }
  let exited = await waitForExit(state, exitPromise, 5_000);
  if (!exited && process.platform !== "win32" && state.childPid) {
    try {
      process.kill(-state.childPid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
    exited = await waitForExit(state, exitPromise, 5_000);
  }
  if (!exited) {
    throw new Error(`Owned Vinext process ${state.childPid ?? "unknown"} did not exit during cleanup.`);
  }
  const portReleased = await verifyPortReleased(state.port);
  if (!portReleased) {
    throw new Error(`Owned Vinext port ${state.port ?? "unknown"} was not released during cleanup.`);
  }
  return {
    ownerPid: state.ownerPid,
    childPid: state.childPid,
    stoppedAt: new Date().toISOString(),
    cleanupDurationMs: Date.now() - stopStartedAt,
    processExited: true,
    portReleased: true,
  };
}

async function waitForExit(state, exitPromise, timeoutMs) {
  if (state.exited) return true;
  await Promise.race([exitPromise, delay(timeoutMs)]);
  return state.exited;
}

async function verifyPortReleased(port) {
  if (!port) return true;
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (await canListen(port)) return true;
    await delay(100);
  }
  return false;
}

function canListen(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => {
      probe.close(() => resolve(true));
    });
  });
}

function emitTrace(handle) {
  if (process.env.SECURIUM_HARNESS_TRACE !== "1") return;
  console.log(`SECURIUM_HARNESS_TRACE ${JSON.stringify(handle.diagnostics)}`);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function redact(value) {
  return String(value)
    .replace(/((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|database[_-]?url)[^=\s]*=)\S+/gi, "$1[REDACTED]")
    .replace(/(Bearer\s+)\S+/gi, "$1[REDACTED]");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
