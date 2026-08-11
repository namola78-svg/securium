import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 33109;
const baseUrl = `http://localhost:${port}`;
const admin = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": "dev-admin@example.invalid",
  "cf-connecting-ip": "203.0.113.77",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0",
};
const superAdmin = {
  ...admin,
  "oai-authenticated-user-email": "dev-super-admin@example.invalid",
};
const user = {
  ...admin,
  "oai-authenticated-user-email": "dev-user-1@example.invalid",
};
const lessonId = "course-cppg-subject-foundation-topic-core-lesson-01";
let server;
let output = "";
let revisionId = "";

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
  for (let attempt = 0; attempt < 480; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Audit E2E server stopped.\n${output}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status > 0) return;
    } catch {
      // Server is starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Audit E2E server did not start.\n${output}`);
});

after(() => {
  if (server?.exitCode === null) server.kill();
});

async function postRevision(headers, body) {
  const response = await fetch(`${baseUrl}/api/admin/content-revisions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

test("중요 작업 성공과 실패를 중앙 감사로그로 기록한다", async () => {
  const secretMarker = `DO-NOT-AUDIT-${Date.now()}`;
  const created = await postRevision(admin, {
    operation: "CREATE_DRAFT",
    contentType: "LESSON",
    contentId: lessonId,
    contentDate: "2026-07-27",
    version: `audit-${Date.now()}`,
    changeSummary: "감사로그 통합 검증",
    snapshotJson: JSON.stringify({
      password: secretMarker,
      answerText: secretMarker,
    }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  revisionId = created.payload.id;

  const published = await postRevision(admin, {
    operation: "PUBLISH",
    revisionId,
  });
  assert.equal(published.response.status, 200, JSON.stringify(published.payload));

  const failed = await postRevision(admin, {
    operation: "PUBLISH",
    revisionId,
  });
  assert.equal(failed.response.status, 409);

  const filteredResponse = await fetch(
    `${baseUrl}/api/admin/audit-logs?action=CONTENT_REVISION_PUBLISHED&resourceId=${revisionId}&pageSize=30`,
    { headers: admin },
  );
  const filtered = await filteredResponse.json();
  assert.equal(
    filteredResponse.status,
    200,
    JSON.stringify(filtered),
  );
  const rows = filtered.result.rows;
  assert.ok(rows.some((row) => row.result === "SUCCESS"));
  assert.ok(rows.some((row) => row.result === "FAILURE"));
  assert.doesNotMatch(JSON.stringify(filtered), new RegExp(secretMarker));

  const success = rows.find((row) => row.result === "SUCCESS");
  const detailResponse = await fetch(
    `${baseUrl}/api/admin/audit-logs?id=${success.id}`,
    { headers: admin },
  );
  const detail = await detailResponse.json();
  assert.equal(detailResponse.status, 200, JSON.stringify(detail));
  assert.match(detail.detail.ipHash, /^sha256:/);
  assert.doesNotMatch(detail.detail.ipHash, /203\.0\.113\.77/);
  assert.equal(detail.detail.userAgentSummary, "Chrome/Windows");
  assert.doesNotMatch(JSON.stringify(detail), new RegExp(secretMarker));

  const today = new Date().toISOString().slice(0, 10);
  const datedResponse = await fetch(
    `${baseUrl}/api/admin/audit-logs?fromDate=${today}&toDate=${today}&resourceId=${revisionId}`,
    { headers: admin },
  );
  const dated = await datedResponse.json();
  assert.equal(datedResponse.status, 200, JSON.stringify(dated));
  assert.ok(dated.result.rows.length >= 2);
});

test("일반 사용자의 감사로그 접근과 일반 관리자의 내보내기를 차단한다", async () => {
  const userRead = await fetch(`${baseUrl}/api/admin/audit-logs`, {
    headers: user,
  });
  assert.equal(userRead.status, 403);

  const adminExport = await fetch(
    `${baseUrl}/api/admin/audit-logs/export?result=SUCCESS`,
    { headers: admin },
  );
  assert.equal(adminExport.status, 403);

  const superExport = await fetch(
    `${baseUrl}/api/admin/audit-logs/export?result=SUCCESS`,
    { headers: superAdmin },
  );
  assert.equal(superExport.status, 200);
  assert.match(superExport.headers.get("content-type") ?? "", /text\/csv/);
  const csv = await superExport.text();
  assert.match(csv, /CONTENT_REVISION_PUBLISHED/);
});

test("감사로그 수정·삭제 API를 제공하지 않는다", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await fetch(`${baseUrl}/api/admin/audit-logs`, {
      method,
      headers: admin,
      body: method === "DELETE" ? undefined : "{}",
    });
    assert.equal(response.status, 405, `${method} must be unavailable`);
  }
});

test("관리자 감사로그 화면은 필터·상세·페이지네이션을 제공한다", async () => {
  const response = await fetch(
    `${baseUrl}/admin/audit-logs?action=CONTENT_REVISION_PUBLISHED&result=SUCCESS`,
    { headers: admin },
  );
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1200));
  assert.match(html, /관리자 감사로그/);
  assert.match(html, /CONTENT_REVISION_PUBLISHED/);
  assert.match(html, /페이지 크기/);
  assert.doesNotMatch(html, /method="(?:post|put|patch|delete)"/i);
  assert.doesNotMatch(html, /data-audit-action="(?:edit|delete)"/i);
});
