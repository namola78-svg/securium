import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 33123;
const baseUrl = `http://localhost:${port}`;
const learnerHeaders = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": "dev-user-1@example.invalid",
};
const otherUserHeaders = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": "dev-user-2@example.invalid",
};
let server;
let output = "";
let generatedRequestId = "";

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
        AI_PROVIDER: "mock",
        OPENAI_API_KEY: "",
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
      throw new Error(`AI E2E server stopped early.\n${output}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status > 0) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`AI E2E server did not become ready.\n${output}`);
});

after(() => {
  if (server?.exitCode === null) server.kill();
});

test("비로그인 사용자의 AI 해설 요청을 차단한다", async () => {
  const response = await fetch(
    `${baseUrl}/api/ai/question-explanations`,
    {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({
        questionId: "course-isms-p-question-01",
        courseId: "course-isms-p",
      }),
    },
  );
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.code, "UNAUTHENTICATED");
});

test("수강 사용자는 Mock 표시와 고지가 포함된 문제 AI 해설을 생성한다", async () => {
  const attemptResponse = await fetch(`${baseUrl}/api/question-attempts`, {
    method: "POST",
    headers: learnerHeaders,
    body: JSON.stringify({
      questionId: "course-isms-p-question-02",
      courseId: "course-isms-p",
      answer: "course-isms-p-question-02-choice-01",
      responseTime: 1000,
      idempotencyKey: `ai-e2e-${process.pid}-${Date.now()}`,
    }),
  });
  assert.equal(
    attemptResponse.status,
    201,
    await attemptResponse.text(),
  );

  const response = await fetch(
    `${baseUrl}/api/ai/question-explanations`,
    {
      method: "POST",
      headers: learnerHeaders,
      body: JSON.stringify({
        questionId: "course-isms-p-question-02",
        courseId: "course-isms-p",
      }),
    },
  );
  const payload = await response.json();
  assert.equal(response.status, 201, JSON.stringify(payload));
  assert.equal(payload.result.provider, "mock");
  assert.equal(payload.result.model, "mock-ai-v1");
  assert.equal(payload.result.reviewed, false);
  assert.match(payload.result.disclaimer, /AI가 생성한 참고용 설명/);
  assert.ok(payload.result.sourceContextIds.length > 0);
  generatedRequestId = payload.result.requestId;
});

test("AI 기록은 생성한 사용자만 다시 조회할 수 있다", async () => {
  assert.ok(generatedRequestId);
  const ownerResponse = await fetch(
    `${baseUrl}/api/ai/question-explanations?requestId=${encodeURIComponent(generatedRequestId)}`,
    { headers: learnerHeaders },
  );
  const ownerPayload = await ownerResponse.json();
  assert.equal(ownerResponse.status, 200, JSON.stringify(ownerPayload));
  assert.equal(ownerPayload.result.requestId, generatedRequestId);

  const otherResponse = await fetch(
    `${baseUrl}/api/ai/question-explanations?requestId=${encodeURIComponent(generatedRequestId)}`,
    { headers: otherUserHeaders },
  );
  const otherPayload = await otherResponse.json();
  assert.equal(otherResponse.status, 404);
  assert.equal(otherPayload.code, "AI_EXPLANATION_NOT_FOUND");
});

test("AI 요청 길이 제한을 서버에서도 적용한다", async () => {
  const response = await fetch(
    `${baseUrl}/api/ai/question-explanations`,
    {
      method: "POST",
      headers: learnerHeaders,
      body: JSON.stringify({
        questionId: "x".repeat(5000),
        courseId: "course-isms-p",
      }),
    },
  );
  const payload = await response.json();
  assert.equal(response.status, 413);
  assert.equal(payload.code, "AI_REQUEST_TOO_LARGE");
});

test("문제풀이 UI는 답안 제출 전 생성된 AI 해설 패널을 노출하지 않는다", async () => {
  const response = await fetch(
    `${baseUrl}/practice/isms-p`,
    { headers: learnerHeaders },
  );
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 800));
  assert.match(html, /data-practice-focus-v2/);
  assert.match(html, /data-practice-session-v2/);
  assert.match(html, /aria-label="문제 진행률"/);
  assert.match(html, />정답 확인</);
  assert.doesNotMatch(html, /class="ai-explanation-panel/);
  assert.doesNotMatch(html, />AI 생성 해설</);
  assert.doesNotMatch(html, />AI 해설 미리보기</);
});
