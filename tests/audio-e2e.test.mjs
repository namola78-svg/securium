import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const host = "127.0.0.1";
// Vinext 0.0.50 forwards port 0 to Vite, whose dev-server port selection
// treats it as falsy and falls back to 5173. Request a per-process candidate
// instead, then follow the actual Local URL if Vite moves to another port.
const requestedPort = 40_000 + Math.floor(Math.random() * 20_000);
const serverOutputLimit = 64 * 1024;
const serverStartupAttempts = 480;
const serverStartupIntervalMs = 250;
let baseUrl = "";
const user1 = {
  "content-type": "application/json",
  origin: "",
  "oai-authenticated-user-email": "dev-user-1@example.invalid",
};
const user2 = {
  "content-type": "application/json",
  origin: "",
  "oai-authenticated-user-email": "dev-user-2@example.invalid",
};
const piaAudioId =
  "course-pia-subject-foundation-topic-core-lesson-01-audio-01";
const ismsAudioId =
  "course-isms-p-subject-foundation-topic-core-lesson-01-audio-01";
let server;
let output = "";
let outputLineBuffer = "";
let spawnError;
let serverExitCode;
let serverExitSignal;
let serverExited = false;
let invalidLocalUrlError;

before(async () => {
  server = spawn(
    process.execPath,
    [
      "node_modules/vinext/dist/cli.js",
      "dev",
      "--hostname",
      host,
      "--port",
      String(requestedPort),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: ".wrangler/wrangler.log",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  server.once("error", (error) => {
    spawnError = error;
  });
  server.once("exit", (code, signal) => {
    serverExited = true;
    serverExitCode = code;
    serverExitSignal = signal;
  });
  server.stdout.on("data", appendServerOutput);
  server.stderr.on("data", appendServerOutput);
  try {
    for (let attempt = 0; attempt < serverStartupAttempts; attempt += 1) {
      captureBaseUrl(outputLineBuffer);
      if (spawnError) {
        throw startupFailure("Audio E2E server failed to spawn.");
      }
      if (serverExited || server.exitCode !== null) {
        throw startupFailure("Audio E2E server stopped before readiness.");
      }
      if (invalidLocalUrlError) {
        throw startupFailure(invalidLocalUrlError.message);
      }
      try {
        if (baseUrl) {
          const readinessUrl = new URL(
            `/api/audio/progress?audioContentId=${encodeURIComponent(piaAudioId)}`,
            baseUrl,
          );
          const response = await fetch(readinessUrl, {
            headers: {
              "oai-authenticated-user-email": user1["oai-authenticated-user-email"],
            },
            signal: AbortSignal.timeout(1_000),
          });
          if (response.ok) {
            user1.origin = baseUrl;
            user2.origin = baseUrl;
            console.log(`AUDIO_E2E_SERVER_READY origin=${baseUrl}`);
            return;
          }
        }
      } catch {
        // Server is still starting.
      }
      await new Promise((resolve) =>
        setTimeout(resolve, serverStartupIntervalMs),
      );
    }
    throw startupFailure(
      baseUrl
        ? `Audio E2E server did not become ready at ${baseUrl}.`
        : "Audio E2E server did not report a valid Local URL.",
    );
  } catch (error) {
    try {
      await stopServer();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Audio E2E server startup and cleanup both failed.",
      );
    }
    throw error;
  }
});

function appendServerOutput(chunk) {
  const text = chunk.toString();
  output = `${output}${text}`.slice(-serverOutputLimit);
  outputLineBuffer = `${outputLineBuffer}${text}`.slice(-serverOutputLimit);
  const lines = outputLineBuffer.split(/\r?\n/);
  outputLineBuffer = lines.pop() ?? "";
  for (const line of lines) captureBaseUrl(line);
}

function captureBaseUrl(line) {
  if (baseUrl || invalidLocalUrlError) return;
  const cleanLine = line.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
  const match = cleanLine.match(/\bLocal:\s*(\S+)/i);
  if (!match) return;

  const rawUrl = match[1];
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    invalidLocalUrlError = new Error(
      "Audio E2E server reported an invalid Local URL.",
    );
    return;
  }

  const parsedPort = Number(parsedUrl.port);
  if (
    parsedUrl.protocol !== "http:" ||
    parsedUrl.hostname !== host ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash ||
    !Number.isInteger(parsedPort) ||
    parsedPort < 1 ||
    parsedPort > 65_535
  ) {
    invalidLocalUrlError = new Error(
      "Audio E2E server reported a non-loopback or invalid Local URL.",
    );
    return;
  }

  baseUrl = parsedUrl.origin;
}

function startupFailure(message) {
  const details = [message];
  if (spawnError) details.push(`Spawn error: ${spawnError.message}`);
  if (serverExited || server?.exitCode !== null) {
    details.push(
      `Server exit: code=${serverExitCode ?? "unknown"} signal=${serverExitSignal ?? "none"}`,
    );
  }
  if (output) details.push(output);
  return new Error(details.join("\n"));
}

after(async () => {
  await stopServer();
});

async function stopServer() {
  if (!server) return;
  if (serverExited || server.exitCode !== null || spawnError) {
    if (serverExited || server.exitCode !== null) {
      console.log("AUDIO_E2E_SERVER_CLEANUP PASS (server already exited)");
    }
    return;
  }
  const gracefulExit = waitForServerExit(5_000);
  server.kill();
  if (await gracefulExit) {
    console.log("AUDIO_E2E_SERVER_CLEANUP PASS");
    return;
  }
  const forcedExit = waitForServerExit(5_000);
  server.kill("SIGKILL");
  if (!(await forcedExit)) {
    throw new Error("Audio E2E server did not exit during cleanup.");
  }
  console.log("AUDIO_E2E_SERVER_CLEANUP PASS");
}

function waitForServerExit(timeoutMs) {
  if (!server || serverExited || server.exitCode !== null) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      server?.off("exit", handleExit);
      resolve(false);
    }, timeoutMs);
    timeout.unref();
    const handleExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    server.once("exit", handleExit);
  });
}

async function save(headers, body) {
  const response = await fetch(`${baseUrl}/api/audio/progress`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

async function read(headers, audioContentId) {
  const response = await fetch(
    `${baseUrl}/api/audio/progress?audioContentId=${audioContentId}`,
    { headers },
  );
  return { response, payload: await response.json() };
}

async function runLocalSql(command) {
  const child = spawn(
    process.execPath,
    [
      "scripts/run-wrangler.mjs",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "wrangler.local.jsonc",
      "--command",
      command,
    ],
    { env: process.env, stdio: ["ignore", "ignore", "pipe"], windowsHide: true },
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`Local SQL stopped by ${signal}.`));
      else if (code !== 0) reject(new Error(`Local SQL failed with ${code}. ${stderr}`));
      else resolve();
    });
  });
}

test("same audio progress writes when the canonical published revision changes", async () => {
  const audioRevisionId = `revision-audio-${piaAudioId}`;
  const nextRevisionId = "test-revision-audio-v2";
  const first = await save(user1, {
    audioContentId: piaAudioId,
    currentPositionSeconds: 50,
    complete: false,
  });
  assert.equal(first.response.status, 200, JSON.stringify(first.payload));

  await runLocalSql(`
    UPDATE content_revisions
    SET is_latest = 0, revision_status = 'superseded', superseded_at = '2026-09-08T00:00:00.000Z'
    WHERE id = '${audioRevisionId}';
    INSERT INTO content_revisions
      (id, content_type, content_id, course_id, title, content_date, version,
       revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
       change_summary, is_latest, created_by)
    SELECT '${nextRevisionId}', content_type, content_id, course_id, title,
      content_date, '2', 'published', snapshot_json, reviewed_at, reviewed_by,
      '2026-09-08T00:00:00.000Z', 'revision transition test', 1, created_by
    FROM content_revisions
    WHERE id = '${audioRevisionId}';
  `);

  const revisionChanged = await save(user1, {
    audioContentId: piaAudioId,
    currentPositionSeconds: 50,
    complete: false,
  });
  assert.equal(revisionChanged.response.status, 200, JSON.stringify(revisionChanged.payload));
  assert.equal(revisionChanged.payload.result.idempotentReplay, false);
  assert.equal(revisionChanged.payload.result.contentRevisionId, nextRevisionId);

  const equalReplay = await save(user1, {
    audioContentId: piaAudioId,
    currentPositionSeconds: 50,
    complete: false,
  });
  assert.equal(equalReplay.payload.result.idempotentReplay, true);
  assert.equal(equalReplay.payload.result.contentRevisionId, nextRevisionId);
});

test("오디오 재생 위치를 저장하고 레슨에서 이어 듣기를 표시한다", async () => {
  const saved = await save(user1, {
    audioContentId: piaAudioId,
    currentPositionSeconds: 32,
    complete: false,
  });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.payload));
  assert.equal(saved.payload.result.currentPositionSeconds, 32);

  const readBack = await read(user1, piaAudioId);
  assert.equal(readBack.response.status, 200, JSON.stringify(readBack.payload));
  assert.equal(readBack.payload.result.currentPositionSeconds, 32);

  const equalReplay = await save(user1, {
    audioContentId: piaAudioId,
    currentPositionSeconds: 32,
    complete: false,
  });
  assert.equal(equalReplay.response.status, 200, JSON.stringify(equalReplay.payload));
  assert.equal(equalReplay.payload.result.idempotentReplay, true);

  const page = await fetch(
    `${baseUrl}/learn/privacy-impact-assessment/lessons/course-pia-subject-foundation-topic-core-lesson-01`,
    { headers: user1 },
  );
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /오디오 학습/);
  assert.match(html, /브라우저 제공 음성/);
  assert.match(html, /이어서 듣기/);
  assert.doesNotMatch(html, /실제 강사 음성입니다/);
});

test("오디오 길이를 초과한 재생 위치를 차단한다", async () => {
  const result = await save(user1, {
    audioContentId: piaAudioId,
    currentPositionSeconds: 91,
    complete: false,
  });
  assert.equal(result.response.status, 400);
  assert.equal(result.payload.code, "AUDIO_POSITION_OUT_OF_RANGE");
});

test("오디오 진도는 사용자별로 격리한다", async () => {
  const before = await read(user2, piaAudioId);
  assert.equal(before.response.status, 200, JSON.stringify(before.payload));

  const saved = await save(user1, {
    audioContentId: piaAudioId,
    currentPositionSeconds: 37,
    complete: false,
  });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.payload));

  const after = await read(user2, piaAudioId);
  assert.equal(after.response.status, 200, JSON.stringify(after.payload));
  assert.equal(
    after.payload.result.currentPositionSeconds,
    before.payload.result.currentPositionSeconds,
  );
  assert.equal(after.payload.result.completedAt, before.payload.result.completedAt);
});

test("비공개 오디오와 비수강 과정 오디오 접근을 차단한다", async () => {
  const privateResult = await save(user1, {
    audioContentId: "private-audio-pia-sample",
    currentPositionSeconds: 0,
    complete: false,
  });
  assert.equal(privateResult.response.status, 404);

  const unenrolledResult = await save(user2, {
    audioContentId: ismsAudioId,
    currentPositionSeconds: 0,
    complete: false,
  });
  assert.equal(unenrolledResult.response.status, 404);
});

test("완료 기록은 중복 생성하지 않고 완료 시각을 유지한다", async () => {
  const first = await save(user1, {
    audioContentId: piaAudioId,
    currentPositionSeconds: 90,
    complete: true,
  });
  assert.equal(first.response.status, 200, JSON.stringify(first.payload));
  assert.equal(first.payload.result.completed, true);

  const second = await save(user1, {
    audioContentId: piaAudioId,
    currentPositionSeconds: 90,
    complete: true,
  });
  assert.equal(second.response.status, 200, JSON.stringify(second.payload));
  assert.equal(second.payload.result.completed, true);
  assert.equal(second.payload.result.idempotentReplay, true);
  assert.equal(
    second.payload.result.completedAt,
    first.payload.result.completedAt,
  );
});
