import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 33101;
const baseUrl = `http://localhost:${port}`;
let server;
let output = "";

before(async () => {
  server = spawn(
    process.execPath,
    ["node_modules/vinext/dist/cli.js", "dev", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  server.stdout.on("data", (chunk) => { output += chunk.toString(); });
  server.stderr.on("data", (chunk) => { output += chunk.toString(); });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`E2E server stopped.\n${output}`);
    try {
      const response = await fetch(baseUrl);
      if (response.status > 0) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`E2E server did not start.\n${output}`);
});

after(() => {
  if (server?.exitCode === null) server.kill();
});

const userHeader = {
  "oai-authenticated-user-email": "dev-user-1@example.invalid",
};

test("첫 단계는 열리고 잠긴 다음 단계의 조작 접근은 차단한다", async () => {
  const pageResponse = await fetch(`${baseUrl}/learn/isms-p`, {
    headers: userHeader,
  });
  const html = await pageResponse.text();
  assert.equal(pageResponse.status, 200, html.slice(0, 1200));
  assert.match(html, /AVAILABLE/);
  assert.match(html, /LOCKED/);

  const lockedResponse = await fetch(`${baseUrl}/api/levels`, {
    method: "POST",
    headers: { ...userHeader, "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ levelId: "course-isms-p-level-2", action: "START" }),
  });
  assert.equal(lockedResponse.status, 403);
});

test("오늘 복습과 학습 분석을 사용자별 서버 데이터로 렌더링한다", async () => {
  for (const path of ["/reviews", "/analytics", "/analytics/course-isms-p"]) {
    const response = await fetch(`${baseUrl}${path}`, { headers: userHeader });
    const html = await response.text();
    assert.equal(response.status, 200, `${path}: ${html.slice(0, 800)}`);
    if (path === "/reviews") assert.match(html, /ISMS-P/);
    if (path === "/analytics") {
      assert.match(html, /COURSE ACTIONS/);
      assert.match(html, /\/practice\/isms-p\?count=10/);
    }
    if (path === "/analytics/course-isms-p") {
      assert.match(html, /우선 복습 권장|주제별 우선 복습 영역/);
      assert.match(html, /\/practice\/isms-p\?/);
      assert.doesNotMatch(html, /course-cppg-subject/);
    }
  }
});

test("모의고사는 동시 제출 하나만 반영하고 실패 요청의 부분 결과를 남기지 않는다", async () => {
  const headers = {
    ...userHeader,
    "content-type": "application/json",
    origin: baseUrl,
  };
  const startResponse = await fetch(`${baseUrl}/api/mock-exams/start`, {
    method: "POST",
    headers,
    body: JSON.stringify({ mockExamId: "course-isms-p-mock-quick" }),
  });
  const startPayload = await startResponse.json();
  assert.equal(startResponse.status, 201, JSON.stringify(startPayload));
  const attemptId = startPayload.attempt.id;

  const pageResponse = await fetch(`${baseUrl}/mock-exams/attempts/${attemptId}`, {
    headers: userHeader,
  });
  const html = await pageResponse.text();
  assert.equal(pageResponse.status, 200, html.slice(0, 1200));
  assert.doesNotMatch(html, /"isCorrect":true/);
  assert.doesNotMatch(html, /correctAnswer/);

  const otherUserResponse = await fetch(
    `${baseUrl}/mock-exams/attempts/${attemptId}`,
    {
      headers: {
        "oai-authenticated-user-email": "dev-user-2@example.invalid",
      },
    },
  );
  assert.equal(otherUserResponse.status, 404);

  const saveResponse = await fetch(`${baseUrl}/api/mock-exams/answer`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      attemptId,
      questionId: "course-isms-p-question-01",
      answer: "course-isms-p-question-01-choice-01",
    }),
  });
  assert.equal(saveResponse.status, 200, await saveResponse.text());

  const submitRequest = () =>
    fetch(`${baseUrl}/api/mock-exams/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify({ attemptId }),
    });
  const concurrentResponses = await Promise.all([
    submitRequest(),
    submitRequest(),
  ]);
  const statuses = concurrentResponses.map((response) => response.status).sort();
  assert.deepEqual(statuses, [200, 409]);
  const successfulResponse = concurrentResponses.find(
    (response) => response.status === 200,
  );
  assert.ok(successfulResponse);
  const submitPayload = await successfulResponse.json();
  assert.equal(typeof submitPayload.result.score, "number");

  const resultResponse = await fetch(
    `${baseUrl}/mock-exams/attempts/${attemptId}`,
    { headers: userHeader },
  );
  const resultHtml = await resultResponse.text();
  assert.equal(resultResponse.status, 200, resultHtml.slice(0, 1200));
  assert.match(resultHtml, /과목별 분석/);

  const duplicateResponse = await submitRequest();
  assert.equal(duplicateResponse.status, 409);
});

test("일반 사용자는 단계 관리자 API에 접근할 수 없다", async () => {
  const response = await fetch(`${baseUrl}/api/admin/levels`, {
    method: "POST",
    headers: { ...userHeader, "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({
      courseId: "course-isms-p",
      code: "FORBIDDEN",
      number: 99,
      title: "forbidden",
      description: "",
      passingScore: 60,
      displayOrder: 99,
      active: true,
      published: false,
    }),
  });
  assert.equal(response.status, 403);
});

test("비로그인 사용자는 관리자 API에 접근할 수 없다", async () => {
  const response = await fetch(`${baseUrl}/api/admin/levels`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({
      courseId: "course-isms-p",
      code: "UNAUTHENTICATED",
      number: 99,
      title: "unauthenticated",
      description: "",
      passingScore: 60,
      displayOrder: 99,
      active: true,
      published: false,
    }),
  });
  assert.equal(response.status, 401);
});
