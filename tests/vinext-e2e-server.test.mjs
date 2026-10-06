import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { test } from "node:test";
import { waitForHttpReadiness } from "./helpers/vinext-e2e-server.mjs";

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
        validateResponse: async (response) => {
          const health = await response.json();
          return response.ok && health.status === "ok" && health.runtime === "nodejs";
        },
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
      }),
      /exited before readiness: code=1/,
    );
    assert.equal(bindError?.code, "EADDRINUSE");
  } finally {
    conflictingListener.close();
    await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  }
});
