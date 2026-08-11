import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 33124;
const baseUrl = `http://localhost:${port}`;
const user1 = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": "dev-user-1@example.invalid",
};
const user2 = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": "dev-user-2@example.invalid",
};
const piaAudioId =
  "course-pia-subject-foundation-topic-core-lesson-01-audio-01";
const ismsAudioId =
  "course-isms-p-subject-foundation-topic-core-lesson-01-audio-01";
let server;
let output = "";

before(async () => {
  server = spawn(
    process.execPath,
    [
      "node_modules/vinext/dist/cli.js",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
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
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  for (let attempt = 0; attempt < 480; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Audio E2E server stopped.\n${output}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status > 0) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Audio E2E server did not start.\n${output}`);
});

after(() => {
  if (server?.exitCode === null) server.kill();
});

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
