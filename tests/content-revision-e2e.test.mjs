import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 49900 + (process.pid % 80);
const baseUrl = `http://localhost:${port}`;
const lessonId = "course-isms-p-subject-foundation-topic-core-lesson-01";
const user = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": "dev-user-1@example.invalid",
};
const admin = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": "dev-admin@example.invalid",
};
let server;
let output = "";
let draftId = "";
let latestId = "";

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
      env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
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
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Content revision E2E server stopped.\n${output}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status > 0) return;
    } catch {
      // Server is starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Content revision E2E server did not start.\n${output}`);
});

after(() => {
  if (server?.exitCode === null) server.kill();
});

async function post(headers, body) {
  const response = await fetch(`${baseUrl}/api/admin/content-revisions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

test("새 버전 초안을 생성하고 일반 사용자의 초안 접근을 차단한다", async () => {
  const version = `2${Date.now().toString().slice(-6)}`;
  const created = await post(admin, {
    operation: "CREATE_DRAFT",
    contentType: "LESSON",
    contentId: lessonId,
    contentDate: "2026-07-27",
    version,
    changeSummary: "[E2E] 기준일 및 버전 게시 검증",
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  draftId = created.payload.id;

  const draft = await fetch(`${baseUrl}/content-versions/${draftId}`, {
    headers: user,
  });
  assert.equal(draft.status, 404);
});

test("버전 게시 시 이전 버전을 superseded 처리하고 최신 단일성을 유지한다", async () => {
  const published = await post(admin, {
    operation: "PUBLISH",
    revisionId: draftId,
  });
  assert.equal(
    published.response.status,
    200,
    JSON.stringify(published.payload),
  );

  const latestPage = await fetch(`${baseUrl}/content-versions/${draftId}`, {
    headers: user,
  });
  const latestHtml = await latestPage.text();
  assert.equal(latestPage.status, 200, latestHtml.slice(0, 1000));
  assert.match(latestHtml, /최신 검수 버전/);

  const successor = await post(admin, {
    operation: "CREATE_DRAFT",
    contentType: "LESSON",
    contentId: lessonId,
    contentDate: "2026-07-28",
    version: `3${Date.now().toString().slice(-6)}`,
    changeSummary: "[E2E] 최신 단일성 재검증",
  });
  assert.equal(successor.response.status, 201, JSON.stringify(successor.payload));
  latestId = successor.payload.id;
  const successorPublish = await post(admin, {
    operation: "PUBLISH",
    revisionId: latestId,
  });
  assert.equal(
    successorPublish.response.status,
    200,
    JSON.stringify(successorPublish.payload),
  );

  const oldPage = await fetch(`${baseUrl}/content-versions/${draftId}`, {
    headers: user,
  });
  const oldHtml = await oldPage.text();
  assert.equal(oldPage.status, 200, oldHtml.slice(0, 1000));
  assert.match(oldHtml, /구버전/);

  const secondPublish = await post(admin, {
    operation: "PUBLISH",
    revisionId: latestId,
  });
  assert.equal(secondPublish.response.status, 409);
});

test("영향 콘텐츠를 조회하고 기존 학습 기록을 유지한다", async () => {
  const adminPage = await fetch(
    `${baseUrl}/admin/content-revisions?contentType=LESSON&contentId=${lessonId}`,
    { headers: admin },
  );
  const adminHtml = await adminPage.text();
  assert.equal(adminPage.status, 200, adminHtml.slice(0, 1200));
  assert.match(adminHtml, /영향 콘텐츠/);
  assert.match(adminHtml, /문제/);
  assert.match(adminHtml, /강의/);
  assert.match(adminHtml, /오디오/);

  const complete = await fetch(`${baseUrl}/api/lessons/progress`, {
    method: "POST",
    headers: user,
    body: JSON.stringify({ lessonId, action: "COMPLETE" }),
  });
  const completed = await complete.json();
  assert.equal(complete.status, 200, JSON.stringify(completed));
  assert.equal(completed.result.status, "COMPLETED");

  const lesson = await fetch(
    `${baseUrl}/learn/isms-p/lessons/${lessonId}`,
    { headers: user },
  );
  const lessonHtml = await lesson.text();
  assert.equal(lesson.status, 200, lessonHtml.slice(0, 1200));
  assert.match(lessonHtml, /완료됨/);
  assert.match(lessonHtml, /콘텐츠 버전 정보|최신 검수 버전/);
});

test("이전 버전을 보관하고 최신 버전은 보관하지 못한다", async () => {
  const archived = await post(admin, {
    operation: "ARCHIVE",
    revisionId: draftId,
  });
  assert.equal(archived.response.status, 200, JSON.stringify(archived.payload));

  const latestArchive = await post(admin, {
    operation: "ARCHIVE",
    revisionId: latestId,
  });
  assert.equal(latestArchive.response.status, 409);
});

test("일반 사용자는 콘텐츠 버전 관리자 API를 호출할 수 없다", async () => {
  const blocked = await post(user, {
    operation: "ARCHIVE",
    revisionId: latestId,
  });
  assert.equal(blocked.response.status, 403);
});
