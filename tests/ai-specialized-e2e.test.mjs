import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 48000 + (process.pid % 1000);
const baseUrl = `http://localhost:${port}`;
const runId = `${process.pid}-${Date.now()}`;
const user1 = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": `security-ai-user-1-${runId}@example.invalid`,
};
const user2 = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": `security-ai-user-2-${runId}@example.invalid`,
};
const admin = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": "dev-admin@example.invalid",
};
let server;
let output = "";
let writtenRecordId = "";
let user1PrivacyAnswerId = "";

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
        AI_DAILY_LIMIT: "200",
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
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Specialized AI E2E server stopped.\n${output}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status > 0) {
        ready = true;
        break;
      }
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) {
    throw new Error(`Specialized AI E2E server did not start.\n${output}`);
  }
  await Promise.all([
    enroll(user1, "course-isrm"),
    enroll(user1, "course-pia"),
    enroll(user1, "course-sw-vuln"),
    enroll(user2, "course-ise"),
    enroll(user2, "course-pia"),
  ]);
});

after(() => {
  if (server?.exitCode === null) server.kill();
});

async function enroll(headers, courseId) {
  const response = await fetch(`${baseUrl}/api/enrollments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ courseId }),
  });
  if (![200, 201].includes(response.status)) {
    throw new Error(
      `Could not prepare ${courseId}: ${response.status} ${await response.text()}`,
    );
  }
}

test("서술형 AI 보조채점은 기존 규칙 점수를 변경하지 않는다", async () => {
  const body = {
    questionId: "spec-ise-question-16",
    answer: "자산과 위협을 식별하고 최소 권한과 로그 통제를 적용한다.",
  };
  const beforeResponse = await fetch(
    `${baseUrl}/api/specialized/written-grade`,
    { method: "POST", headers: user2, body: JSON.stringify(body) },
  );
  const beforePayload = await beforeResponse.json();
  assert.equal(beforeResponse.status, 200, JSON.stringify(beforePayload));

  const aiResponse = await fetch(`${baseUrl}/api/ai/specialized`, {
    method: "POST",
    headers: user2,
    body: JSON.stringify({
      targetType: "WRITTEN_ANSWER",
      courseId: "course-ise",
      ...body,
    }),
  });
  const aiPayload = await aiResponse.json();
  assert.equal(aiResponse.status, 201, JSON.stringify(aiPayload));
  assert.equal(aiPayload.result.provider, "mock");
  assert.equal(aiPayload.result.content.advisoryOnly, true);
  writtenRecordId = aiPayload.result.recordId;

  const afterResponse = await fetch(
    `${baseUrl}/api/specialized/written-grade`,
    { method: "POST", headers: user2, body: JSON.stringify(body) },
  );
  const afterPayload = await afterResponse.json();
  assert.equal(afterResponse.status, 200, JSON.stringify(afterPayload));
  assert.equal(
    afterPayload.result.earnedScore,
    beforePayload.result.earnedScore,
  );
  assert.equal(
    afterPayload.result.maximumScore,
    beforePayload.result.maximumScore,
  );
});

test("ISRM 위험 시나리오는 요청한 과정 밖의 데이터와 혼합하지 않는다", async () => {
  const mixedResponse = await fetch(`${baseUrl}/api/ai/specialized`, {
    method: "POST",
    headers: user1,
    body: JSON.stringify({
      targetType: "RISK_SCENARIO",
      courseId: "course-pia",
      scenarioId: "sample-risk-scenario-01",
    }),
  });
  assert.equal(mixedResponse.status, 404);

  const validResponse = await fetch(`${baseUrl}/api/ai/specialized`, {
    method: "POST",
    headers: user1,
    body: JSON.stringify({
      targetType: "RISK_SCENARIO",
      courseId: "course-isrm",
      scenarioId: "sample-risk-scenario-01",
    }),
  });
  const payload = await validResponse.json();
  assert.equal(validResponse.status, 201, JSON.stringify(payload));
  assert.equal(payload.result.targetType, "RISK_SCENARIO");
  assert.match(payload.result.content.assetReview, /자산/);
});

test("영향평가 AI 검토는 사용자별 답안을 격리한다", async () => {
  const saveResponse = await fetch(
    `${baseUrl}/api/practical/privacy-assessment`,
    {
      method: "POST",
      headers: user1,
      body: JSON.stringify({
        scenarioId: "privacy-scenario-11",
        targetDecision: "REQUIRED",
        selectedAssessmentItems: ["privacy-item-01"],
        identifiedRisks: "과다 수집과 접근권한 위험",
        improvementPlan: "최소 수집과 권한 분리",
      }),
    },
  );
  const saved = await saveResponse.json();
  assert.equal(saveResponse.status, 200, JSON.stringify(saved));
  user1PrivacyAnswerId = saved.answerId;

  const ownResponse = await fetch(`${baseUrl}/api/ai/specialized`, {
    method: "POST",
    headers: user1,
    body: JSON.stringify({
      targetType: "PRIVACY_ASSESSMENT",
      courseId: "course-pia",
      answerId: user1PrivacyAnswerId,
    }),
  });
  const ownPayload = await ownResponse.json();
  assert.equal(ownResponse.status, 201, JSON.stringify(ownPayload));
  assert.equal(ownPayload.result.targetType, "PRIVACY_ASSESSMENT");
  assert.match(ownPayload.result.content.referenceDate, /^\d{4}-\d{2}-\d{2}$/);

  const otherResponse = await fetch(`${baseUrl}/api/ai/specialized`, {
    method: "POST",
    headers: user2,
    body: JSON.stringify({
      targetType: "PRIVACY_ASSESSMENT",
      courseId: "course-pia",
      answerId: user1PrivacyAnswerId,
    }),
  });
  assert.equal(otherResponse.status, 404);
});

test("보안약점 코드 설명 요청 길이를 제한한다", async () => {
  const response = await fetch(`${baseUrl}/api/ai/specialized`, {
    method: "POST",
    headers: user1,
    body: JSON.stringify({
      targetType: "SECURE_CODE",
      courseId: "course-sw-vuln",
      attemptId: "x".repeat(20_000),
    }),
  });
  const payload = await response.json();
  assert.equal(response.status, 413);
  assert.equal(payload.code, "AI_REQUEST_TOO_LARGE");
});

test("AI 원본과 관리자 수정본 이력을 분리한다", async () => {
  assert.ok(writtenRecordId);
  const editedResult = {
    reviewerSummary: "관리자가 별도로 작성한 검수본",
    approved: true,
  };
  const reviewResponse = await fetch(
    `${baseUrl}/api/admin/ai-reviews`,
    {
      method: "POST",
      headers: admin,
      body: JSON.stringify({
        generationId: writtenRecordId,
        action: "APPROVED_WITH_EDITS",
        reviewNote: "원본은 유지하고 표현을 보완함",
        editedResult,
        reviewedContentTitle: "",
      }),
    },
  );
  const reviewPayload = await reviewResponse.json();
  assert.equal(reviewResponse.status, 200, JSON.stringify(reviewPayload));

  const listResponse = await fetch(
    `${baseUrl}/api/admin/ai-reviews?limit=200`,
    { headers: admin },
  );
  const listPayload = await listResponse.json();
  assert.equal(listResponse.status, 200, JSON.stringify(listPayload));
  const record = listPayload.records.find(
    (item) => item.id === writtenRecordId,
  );
  assert.ok(record);
  assert.equal(record.originalResult.reviewerSummary, undefined);
  assert.equal(record.reviews[0].editedResult.reviewerSummary, editedResult.reviewerSummary);
  assert.equal(record.reviewStatus, "APPROVED_WITH_EDITS");
});

test("일반 사용자는 관리자 AI 검수 API에 접근할 수 없다", async () => {
  const getResponse = await fetch(
    `${baseUrl}/api/admin/ai-reviews`,
    { headers: user1 },
  );
  assert.equal(getResponse.status, 403);

  const postResponse = await fetch(
    `${baseUrl}/api/admin/ai-reviews`,
    {
      method: "POST",
      headers: user1,
      body: JSON.stringify({
        generationId: writtenRecordId,
        action: "REVIEWED",
        reviewNote: "",
        editedResult: {},
        reviewedContentTitle: "",
      }),
    },
  );
  assert.equal(postResponse.status, 403);
});
