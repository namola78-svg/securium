import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import {
  cleanupStartupFailure,
  removeOwnedVinextDevLock,
  stopChild,
  waitForHttpReadiness,
} from "./helpers/vinext-e2e-server.mjs";

function fakeChild() {
  const child = new EventEmitter();
  child.pid = 43210;
  child.exitCode = null;
  child.signalCode = null;
  return child;
}

test("Windows teardown accepts taskkill success followed by child exit", async () => {
  const child = fakeChild();
  await stopChild(child, {
    platform: "win32",
    timeoutMs: 100,
    spawnSyncImpl: () => {
      child.exitCode = 0;
      child.emit("exit", 0, null);
      return { status: 0 };
    },
  });
  assert.equal(child.exitCode, 0);
});

test("Windows taskkill failure reports promptly when the child does not exit", async (t) => {
  const child = fakeChild();
  const requestedTimeouts = [];
  t.mock.method(globalThis, "setTimeout", (callback, delay, ...args) => {
    requestedTimeouts.push(delay);
    queueMicrotask(() => callback(...args));
    return 0;
  });

  await assert.rejects(stopChild(child, {
    platform: "win32",
    timeoutMs: 20,
    spawnSyncImpl: () => ({ status: 1, stderr: "denied" }),
  }), /taskkill\.exe failed.*denied/);
  assert.deepEqual(requestedTimeouts, [20]);
  assert.equal(child.exitCode, null);
  assert.equal(child.signalCode, null);
  assert.equal(child.listenerCount("exit"), 0);
});

test("Windows taskkill timeout reports promptly when the child does not exit", async (t) => {
  const child = fakeChild();
  const requestedTimeouts = [];
  t.mock.method(globalThis, "setTimeout", (callback, delay, ...args) => {
    requestedTimeouts.push(delay);
    queueMicrotask(() => callback(...args));
    return 0;
  });

  await assert.rejects(stopChild(child, {
    platform: "win32",
    timeoutMs: 20,
    spawnSyncImpl: () => ({ error: Object.assign(new Error("taskkill timed out"), { code: "ETIMEDOUT" }) }),
  }), /taskkill\.exe failed.*timed out/);
  assert.deepEqual(requestedTimeouts, [20]);
  assert.equal(child.exitCode, null);
  assert.equal(child.signalCode, null);
  assert.equal(child.listenerCount("exit"), 0);
});

test("Windows teardown bounds waiting when the child never emits exit", async () => {
  const child = fakeChild();
  await assert.rejects(stopChild(child, {
    platform: "win32",
    timeoutMs: 20,
    spawnSyncImpl: () => ({ status: 0 }),
  }), /did not exit within 20ms/);
});

test("already exited child needs no Windows taskkill", async () => {
  const child = fakeChild();
  child.exitCode = 0;
  await stopChild(child, { platform: "win32", spawnSyncImpl: () => assert.fail("unexpected taskkill") });
});

for (const failures of [["stop"], ["removeLock"], ["stop", "removeLock"]]) {
  test("startup cleanup always restores generated types when " + failures.join(" and ") + " fails", async () => {
    const calls = [];
    const operation = (name) => async () => {
      calls.push(name);
      if (failures.includes(name)) throw new Error(name + " failed");
    };
    const errors = await cleanupStartupFailure({
      stop: operation("stop"),
      removeLock: operation("removeLock"),
      restore: operation("restore"),
    });
    assert.deepEqual(calls, ["stop", "removeLock", "restore"]);
    assert.equal(errors.length, failures.length);
    assert.deepEqual(errors.map((error) => error.message), failures.map((name) => name + " failed"));
  });
}

test("Vinext cleanup removes only a lock owned by the stopped helper child", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "vinext-owned-lock-"));
  const lockPath = path.join(cwd, ".vinext", "dev", "lock.json");
  const owner = {
    cwd,
    child: { pid: 43210, exitCode: null, signalCode: null },
    port: 43123,
    baseUrl: "http://127.0.0.1:43123",
  };
  try {
    await mkdir(path.dirname(lockPath), { recursive: true });
    const writeLock = (pid = owner.child.pid) => writeFile(lockPath, JSON.stringify({
      pid,
      port: owner.port,
      hostname: "127.0.0.1",
      appUrl: owner.baseUrl,
      cwd,
    }));

    await writeLock();
    assert.equal(await removeOwnedVinextDevLock(owner), false);
    assert.equal(JSON.parse(await readFile(lockPath, "utf8")).pid, owner.child.pid);

    owner.child.exitCode = 0;
    assert.equal(await removeOwnedVinextDevLock(owner), true);
    await assert.rejects(access(lockPath), { code: "ENOENT" });

    await writeLock(owner.child.pid + 1);
    assert.equal(await removeOwnedVinextDevLock(owner), false);
    assert.equal(JSON.parse(await readFile(lockPath, "utf8")).pid, owner.child.pid + 1);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Vinext readiness fails when the child exits non-zero before responding", async () => {
  const child = spawn(process.execPath, ["-e", "process.exit(23)"], {
    stdio: "ignore",
    windowsHide: true,
  });
  await assert.rejects(
    waitForHttpReadiness({
      child,
      url: "http://127.0.0.1:1/__debug",
      timeoutMs: 2_000,
    }),
    /exited before readiness: code=23/,
  );
});

test("Vinext readiness fails when the endpoint never returns success", async () => {
  const readinessServer = createHttpServer((_request, response) => {
    response.statusCode = 503;
    response.end("not ready");
  });
  await new Promise((resolve) => readinessServer.listen(0, "127.0.0.1", resolve));
  const address = readinessServer.address();
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
    windowsHide: true,
  });
  try {
    await assert.rejects(
      waitForHttpReadiness({
        child,
        url: "http://127.0.0.1:" + address.port + "/__debug",
        timeoutMs: 100,
        getPortOwner: () => child.pid,
        isOwnedProcess: () => true,
      }),
      /readiness timed out.*HTTP 503/,
    );
  } finally {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    if (child.exitCode === null) await exited;
    await new Promise((resolve, reject) => readinessServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("Vinext readiness rejects a successful response from the wrong server", async () => {
  const readinessServer = createHttpServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ service: "unrelated" }));
  });
  await new Promise((resolve) => readinessServer.listen(0, "127.0.0.1", resolve));
  const address = readinessServer.address();
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
    windowsHide: true,
  });
  try {
    await assert.rejects(
      waitForHttpReadiness({
        child,
        url: "http://127.0.0.1:" + address.port + "/api/health",
        timeoutMs: 100,
        getPortOwner: () => child.pid,
        validateResponse: async (response) => {
          const health = await response.json();
          return response.ok && health.status === "ok" && health.runtime === "nodejs";
        },
        isOwnedProcess: () => true,
      }),
      /readiness timed out.*did not match the expected application contract/,
    );
  } finally {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    if (child.exitCode === null) await exited;
    await new Promise((resolve, reject) => readinessServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("Vinext readiness fails when the child cannot bind the requested port", async () => {
  const listener = createNetServer((socket) => socket.destroy());
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  const conflictingListener = createNetServer();
  const child = { exitCode: null, signalCode: null };
  let bindError;
  conflictingListener.once("error", (error) => {
    bindError = error;
    child.exitCode = 1;
  });
  conflictingListener.listen(port, "127.0.0.1");
  try {
    await assert.rejects(
      waitForHttpReadiness({
        child,
        url: "http://127.0.0.1:" + port + "/__debug",
        timeoutMs: 2_000,
        isOwnedProcess: () => true,
      }),
      /exited before readiness: code=1/,
    );
    assert.equal(bindError?.code, "EADDRINUSE");
  } finally {
    conflictingListener.close();
    await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  }
});

test("Vinext readiness rejects a listening port owned by a foreign process", async () => {
  const readinessServer = createHttpServer((_request, response) => response.end("unrelated"));
  await new Promise((resolve) => readinessServer.listen(0, "127.0.0.1", resolve));
  const address = readinessServer.address();
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
    windowsHide: true,
  });
  let requests = 0;
  try {
    await assert.rejects(
      waitForHttpReadiness({
        child,
        url: "http://127.0.0.1:" + address.port + "/__debug",
        timeoutMs: 2_000,
        getPortOwner: () => child.pid + 1,
        isOwnedProcess: (ownerPid, rootPid) => ownerPid === rootPid,
        fetchImpl: (...args) => {
          requests += 1;
          return fetch(...args);
        },
      }),
      /Foreign process .* owns Vinext readiness port/,
    );
    assert.equal(requests, 0);
  } finally {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    if (child.exitCode === null) await exited;
    await new Promise((resolve, reject) => readinessServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("Vinext readiness identifies a foreign owner after the child exits on a bind conflict", async () => {
  const listener = createNetServer((socket) => socket.destroy());
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const child = { pid: 12345, exitCode: 1, signalCode: null };
  try {
    await assert.rejects(
      waitForHttpReadiness({
        child,
        url: "http://127.0.0.1:" + listener.address().port + "/__debug",
        timeoutMs: 2_000,
        getPortOwner: () => 54321,
        isOwnedProcess: () => false,
      }),
      /Foreign process 54321 owns Vinext readiness port/,
    );
  } finally {
    await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  }
});

for (const code of ["ECONNREFUSED", "ECONNRESET"]) {
  test("Vinext readiness retries startup " + code + " while the owned server is alive", async () => {
    const readinessServer = createHttpServer((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ status: "ok" }));
    });
    await new Promise((resolve) => readinessServer.listen(0, "127.0.0.1", resolve));
    const address = readinessServer.address();
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore",
      windowsHide: true,
    });
    let attempts = 0;
    try {
      const readiness = await waitForHttpReadiness({
        child,
        url: "http://127.0.0.1:" + address.port + "/__debug",
        timeoutMs: 2_000,
        getPortOwner: () => child.pid,
        isOwnedProcess: (ownerPid, rootPid) => ownerPid === rootPid,
        fetchImpl: async (...args) => {
          attempts += 1;
          if (attempts === 1) {
            const error = new TypeError("fetch failed");
            error.cause = { code };
            throw error;
          }
          return fetch(...args);
        },
        validateResponse: async (response) => (await response.json()).status === "ok",
      });
      assert.equal(readiness.status, 200);
      assert.equal(attempts, 2);
    } finally {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      if (child.exitCode === null) await exited;
      await new Promise((resolve, reject) => readinessServer.close((error) => error ? reject(error) : resolve()));
    }
  });
}

test("Vinext readiness requires a TCP listener before probing HTTP", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
    windowsHide: true,
  });
  let requests = 0;
  try {
    await assert.rejects(
      waitForHttpReadiness({
        child,
        url: "http://127.0.0.1:1/__debug",
        timeoutMs: 100,
        fetchImpl: async () => {
          requests += 1;
          return new Response("ok");
        },
      }),
      /readiness timed out.*port is not listening/,
    );
    assert.equal(requests, 0);
  } finally {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    if (child.exitCode === null) await exited;
  }
});

test("Vinext readiness keeps retrying when response-body cleanup times out", async () => {
  const child = { pid: 12345, exitCode: null, signalCode: null };
  let attempts = 0;
  try {
    await assert.rejects(
      waitForHttpReadiness({
        child,
        url: "http://127.0.0.1:43123/__debug",
        timeoutMs: 1_000,
        getPortOwner: () => child.pid,
        isOwnedProcess: (ownerPid, rootPid) => ownerPid === rootPid,
        probeTcpImpl: async () => true,
        fetchImpl: async () => {
          attempts += 1;
          const response = new Response("ready");
          response.body.cancel = async () => {
            throw new DOMException("cleanup timeout", "TimeoutError");
          };
          return response;
        },
        validateResponse: () => false,
      }),
      /readiness timed out.*application contract/,
    );
    assert.ok(attempts > 1);
  } finally {
    child.exitCode = 0;
  }
});
