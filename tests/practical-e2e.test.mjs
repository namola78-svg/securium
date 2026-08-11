import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 33103;
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
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  for (let attempt = 0; attempt < 480; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Practical E2E server stopped.\n${output}`);
    try {
      const response = await fetch(baseUrl);
      if (response.status > 0) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Practical E2E server did not start.\n${output}`);
});

after(() => {
  if (server?.exitCode === null) server.kill();
});

const user1 = { "oai-authenticated-user-email": "dev-user-1@example.invalid" };
const user2 = { "oai-authenticated-user-email": "dev-user-2@example.invalid" };
const admin = { "oai-authenticated-user-email": "dev-admin@example.invalid" };
const apiHeaders = {
  ...user1,
  origin: baseUrl,
  "content-type": "application/json",
};

test("SW 보안약점 과정은 코드 샘플과 안전한 표시 UI를 제공한다", async () => {
  const overview = await fetch(
    `${baseUrl}/practical/sw-vulnerability-diagnostician`,
    { headers: user1 },
  );
  const overviewHtml = await overview.text();
  assert.equal(overview.status, 200, overviewHtml.slice(0, 1500));
  assert.match(overviewHtml, /보안 코드 분석/);
  assert.match(overviewHtml, /Java/);

  const detail = await fetch(
    `${baseUrl}/practical/sw-vulnerability-diagnostician/code/secure-code-sample-01`,
    { headers: user1 },
  );
  const html = await detail.text();
  assert.equal(detail.status, 200, html.slice(0, 1500));
  assert.match(html, /취약하다고 판단한 코드 줄 선택/);
  assert.match(html, /(?:&lt;|\\u003c)script(?:&gt;|\\u003e)alert/);
  assert.doesNotMatch(html, /<script>alert\('sample'\)<\/script>/);
  assert.match(html, /서버에서 실행하지 않습니다/);
});

test("코드 분석 답안은 라인·CWE·오탐·부분점수를 서버에서 채점하고 멱등 처리한다", async () => {
  const idempotencyKey = `practical-code-${process.pid}-${Date.now()}`;
  const body = {
    courseId: "course-sw-vuln",
    sampleId: "secure-code-sample-01",
    selectedLines: [],
    weaknessId: "weak-sql-injection",
    selectedCweCode: "CWE-89",
    truePositive: false,
    userExplanation: "입력 검증, 허용 목록, 안전한 API 사용을 설명합니다.",
    remediationCode: "return validator.allowListed(input);",
    responseTime: 1200,
    idempotencyKey,
  };
  const first = await fetch(`${baseUrl}/api/practical/code-analysis`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify(body),
  });
  const firstPayload = await first.json();
  assert.equal(first.status, 201, JSON.stringify(firstPayload));
  assert.equal(firstPayload.score, 100);
  assert.equal(firstPayload.cweCode, "CWE-89");
  assert.equal(firstPayload.isCorrect, true);

  const replay = await fetch(`${baseUrl}/api/practical/code-analysis`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify(body),
  });
  const replayPayload = await replay.json();
  assert.equal(replay.status, 201, JSON.stringify(replayPayload));
  assert.equal(replayPayload.attemptId, firstPayload.attemptId);
  assert.equal(replayPayload.idempotentReplay, true);
});

test("개인정보 흐름도는 SVG와 모바일 텍스트 대체 목록을 함께 제공한다", async () => {
  const response = await fetch(
    `${baseUrl}/practical/privacy-impact-assessment/privacy/privacy-scenario-11`,
    { headers: user1 },
  );
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1600));
  assert.match(html, /<svg/);
  assert.match(html, /개인정보 흐름 텍스트 대체 목록/);
  assert.match(html, /정보주체/);
  assert.match(html, /외부 처리자/);
  assert.match(html, /영향평가 답안 작성/);
});

test("영향평가 답안은 사용자별로 저장되고 다른 사용자는 조회할 수 없다", async () => {
  const saved = await fetch(`${baseUrl}/api/practical/privacy-assessment`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({
      scenarioId: "privacy-scenario-11",
      targetDecision: "NOT_REQUIRED",
      selectedAssessmentItems: ["privacy-item-01", "privacy-item-02"],
      identifiedRisks: "과다 수집과 접근권한, 암호화 누락 가능성",
      improvementPlan: "최소 수집, 권한 분리, 암호화를 적용합니다.",
    }),
  });
  const payload = await saved.json();
  assert.equal(saved.status, 200, JSON.stringify(payload));
  assert.ok(payload.answerId);
  assert.ok(payload.score > 0);

  const mine = await fetch(
    `${baseUrl}/api/practical/privacy-assessment?answerId=${payload.answerId}`,
    { headers: user1 },
  );
  assert.equal(mine.status, 200, await mine.text());
  const other = await fetch(
    `${baseUrl}/api/practical/privacy-assessment?answerId=${payload.answerId}`,
    { headers: user2 },
  );
  assert.equal(other.status, 404, await other.text());
});

test("일반 사용자는 실무형 콘텐츠 관리자 API에 접근할 수 없다", async () => {
  const forbidden = await fetch(
    `${baseUrl}/api/admin/practical-specializations`,
    {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        entity: "PRIVACY_ITEM",
        code: "FORBIDDEN_ITEM",
        category: "테스트",
        title: "권한 없는 등록",
        description: "차단되어야 합니다.",
        checkPoints: "없음",
        evidenceExamples: "",
        riskExamples: "",
        improvementExamples: "",
        version: "TEST",
        effectiveDate: "2026-07-27",
        active: true,
      }),
    },
  );
  assert.equal(forbidden.status, 403);

  const page = await fetch(`${baseUrl}/admin/practical-specializations`, {
    headers: admin,
  });
  const html = await page.text();
  assert.equal(page.status, 200, html.slice(0, 1500));
  assert.match(html, /실무형 과정 콘텐츠 관리/);
  assert.match(html, /보안 약점 분류\s*·\s*CWE/);
});
