import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 33120;
const baseUrl = `http://localhost:${port}`;
const runId = `${process.pid}-${Date.now()}`;
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
      throw new Error(`E2E server stopped early.\n${output}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status > 0) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`E2E server did not become ready.\n${output}`);
});

test("network security practice flow stays scoped to engineer and industrial engineer courses", async () => {
  await ensureNetworkQuestionSeed();
  await ensureEnrollment("dev-user-1@example.invalid", "course-ise");
  await ensureEnrollment("dev-user-2@example.invalid", "course-isie");

  const engineerResponse = await fetch(
    `${baseUrl}/practice/information-security-engineer?count=10&type=TRUE_FALSE`,
    {
      headers: {
        "oai-authenticated-user-email": "dev-user-1@example.invalid",
      },
    },
  );
  const engineerHtml = await engineerResponse.text();
  assert.equal(engineerResponse.status, 200, engineerHtml.slice(0, 1200));
  assert.match(engineerHtml, /CURRENT PRACTICE/);
  assert.match(engineerHtml, /TRUE FALSE/);
  assert.doesNotMatch(engineerHtml, /"isCorrect":true/);
  assert.doesNotMatch(engineerHtml, /answerConfigJson/);

  const industrialResponse = await fetch(
    `${baseUrl}/practice/information-security-industrial-engineer?count=10&type=MULTIPLE_CHOICE`,
    {
      headers: {
        "oai-authenticated-user-email": "dev-user-2@example.invalid",
      },
    },
  );
  const industrialHtml = await industrialResponse.text();
  assert.equal(industrialResponse.status, 200, industrialHtml.slice(0, 1200));
  assert.match(industrialHtml, /CURRENT PRACTICE/);
  assert.match(industrialHtml, /MULTIPLE CHOICE/);
  assert.doesNotMatch(industrialHtml, /"isCorrect":true/);
  assert.doesNotMatch(industrialHtml, /answerConfigJson/);

  const engineerAttempt = await fetch(`${baseUrl}/api/question-attempts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "oai-authenticated-user-email": "dev-user-1@example.invalid",
    },
    body: JSON.stringify({
      questionId: "network-security-official-sample-q01",
      courseId: "course-ise",
      answer: "network-security-official-sample-q01-true",
      responseTime: 1200,
      idempotencyKey: `network-ise-${runId}`,
    }),
  });
  const engineerAttemptPayload = await readJsonResponse(engineerAttempt);
  assert.equal(
    engineerAttempt.status,
    201,
    JSON.stringify(engineerAttemptPayload),
  );
  assert.equal(engineerAttemptPayload.result.isCorrect, true);

  const industrialAttempt = await fetch(`${baseUrl}/api/question-attempts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "oai-authenticated-user-email": "dev-user-2@example.invalid",
    },
    body: JSON.stringify({
      questionId: "network-security-official-sample-q03",
      courseId: "course-isie",
      answer: [
        "network-security-official-sample-q03-choice-01",
        "network-security-official-sample-q03-choice-02",
        "network-security-official-sample-q03-choice-04",
      ],
      responseTime: 1500,
      idempotencyKey: `network-isie-${runId}`,
    }),
  });
  const industrialAttemptPayload = await readJsonResponse(industrialAttempt);
  assert.equal(
    industrialAttempt.status,
    201,
    JSON.stringify(industrialAttemptPayload),
  );
  assert.equal(industrialAttemptPayload.result.isCorrect, true);

  const leakedCourseAttempt = await fetch(`${baseUrl}/api/question-attempts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "oai-authenticated-user-email": "dev-user-1@example.invalid",
    },
    body: JSON.stringify({
      questionId: "network-security-official-sample-q01",
      courseId: "course-isms-p",
      answer: "network-security-official-sample-q01-true",
      responseTime: 1200,
      idempotencyKey: `network-cross-course-${runId}`,
    }),
  });
  const leakedCoursePayload = await readJsonResponse(leakedCourseAttempt);
  assert.notEqual(leakedCourseAttempt.status, 201);
  assert.equal(leakedCoursePayload.code, "QUESTION_NOT_FOUND");
});

test("network security course lesson extensions render different course contexts", async () => {
  await ensureCourseLessonSeed();
  await ensureEnrollment("dev-user-1@example.invalid", "course-ise");
  await ensureEnrollment("dev-user-2@example.invalid", "course-isie");

  const engineerResponse = await fetch(
    `${baseUrl}/learn/information-security-engineer/course-lessons/course-lesson-ise-official-network-security-overview`,
    {
      headers: {
        "oai-authenticated-user-email": "dev-user-1@example.invalid",
      },
    },
  );
  const engineerHtml = await engineerResponse.text();
  assert.equal(engineerResponse.status, 200, engineerHtml.slice(0, 1200));
  assert.match(engineerHtml, /COURSE CONTEXT/);
  assert.match(engineerHtml, /로그 이벤트/);
  assert.match(engineerHtml, /차단 정책/);
  assert.doesNotMatch(engineerHtml, /기본 대응 방법/);

  const industrialResponse = await fetch(
    `${baseUrl}/learn/information-security-industrial-engineer/course-lessons/course-lesson-isie-official-network-security-overview`,
    {
      headers: {
        "oai-authenticated-user-email": "dev-user-2@example.invalid",
      },
    },
  );
  const industrialHtml = await industrialResponse.text();
  assert.equal(industrialResponse.status, 200, industrialHtml.slice(0, 1200));
  assert.match(industrialHtml, /COURSE CONTEXT/);
  assert.match(industrialHtml, /기본 대응 방법/);
  assert.match(industrialHtml, /보안장비 역할/);
  assert.doesNotMatch(industrialHtml, /로그 이벤트/);
});

test("admin curriculum and shared content pages expose network security coverage", async () => {
  await ensureSecurityCertificationCurriculumSeed();
  await ensureCourseLessonSeed();
  await ensureNetworkQuestionSeed();

  const adminHeaders = {
    "oai-authenticated-user-email": "dev-admin@example.invalid",
  };
  const curriculumResponse = await fetch(
    `${baseUrl}/admin/curriculum?treeId=curriculum-ise-2027-2029-official`,
    { headers: adminHeaders },
  );
  const curriculumHtml = await curriculumResponse.text();
  assert.equal(curriculumResponse.status, 200, curriculumHtml.slice(0, 1200));
  assert.match(curriculumHtml, /curriculum-ise-2027-2029-official/);
  assert.match(curriculumHtml, /정보보안기사/);
  assert.match(curriculumHtml, /네트워크 보안/);
  assert.match(curriculumHtml, /공개 문제/);

  const sharedContentResponse = await fetch(
    `${baseUrl}/admin/shared-content?courseId=course-ise&contentId=content-official-security-cert-network-security-overview`,
    { headers: adminHeaders },
  );
  const sharedContentHtml = await sharedContentResponse.text();
  assert.equal(
    sharedContentResponse.status,
    200,
    sharedContentHtml.slice(0, 1200),
  );
  assert.match(
    sharedContentHtml,
    /official.security-certification.network-security.overview/,
  );
  assert.match(sharedContentHtml, /네트워크 보안/);
  assert.match(sharedContentHtml, /정보보안기사/);
  assert.match(sharedContentHtml, /PUBLISHED/);
});

let networkQuestionSeedApplied = false;
let courseLessonSeedApplied = false;
let securityCertificationCurriculumSeedApplied = false;

async function ensureSecurityCertificationCurriculumSeed() {
  if (securityCertificationCurriculumSeedApplied) return;
  const result = await runCommand(process.execPath, [
    "scripts/apply-security-certification-curriculum-seed.mjs",
    "d1-local",
  ]);
  assert.equal(result.code, 0, result.output);
  assert.match(
    result.output,
    /SECURITY_CERTIFICATION_CURRICULUM_SEED_D1_LOCAL_APPLIED/,
  );
  securityCertificationCurriculumSeedApplied = true;
}

async function ensureNetworkQuestionSeed() {
  if (networkQuestionSeedApplied) return;
  const result = await runCommand(process.execPath, [
    "scripts/apply-network-security-question-seed.mjs",
    "d1-local",
  ]);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /NETWORK_SECURITY_QUESTION_SEED_D1_LOCAL_APPLIED/);
  networkQuestionSeedApplied = true;
}

async function ensureCourseLessonSeed() {
  if (courseLessonSeedApplied) return;
  const result = await runCommand(process.execPath, [
    "scripts/apply-security-certification-course-lessons-seed.mjs",
    "d1-local",
  ]);
  assert.equal(result.code, 0, result.output);
  assert.match(
    result.output,
    /SECURITY_CERTIFICATION_COURSE_LESSON_SEED_D1_LOCAL_APPLIED/,
  );
  courseLessonSeedApplied = true;
}

async function ensureEnrollment(email, courseId) {
  const response = await fetch(`${baseUrl}/api/enrollments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "oai-authenticated-user-email": email,
    },
    body: JSON.stringify({
      courseId,
      returnTo: "/my-courses",
    }),
  });
  const payload = await readJsonResponse(response);
  assert.ok(
    response.status === 201 ||
      (response.status === 409 && payload.code === "DUPLICATE_ENROLLMENT"),
    JSON.stringify(payload),
  );
}

function runCommand(executable, args) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let outputText = "";
    child.stdout.on("data", (chunk) => {
      outputText += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      outputText += chunk.toString();
    });
    child.on("error", (error) =>
      resolve({ code: 1, output: error.message }),
    );
    child.on("close", (code) =>
      resolve({ code: code ?? 1, output: outputText }),
    );
  });
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    assert.fail(
      `Expected JSON but received status ${response.status}: ${text.slice(0, 1200)}`,
    );
  }
}

after(() => {
  if (server?.exitCode === null) server.kill();
});

test("통합 학습 플랫폼 랜딩페이지를 서버 렌더링한다", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const csp = response.headers.get("content-security-policy") ?? "";
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /unsafe-eval/);
  assert.equal(response.headers.get("strict-transport-security"), null);
  assert.match(response.headers.get("x-request-id") ?? "", /^[A-Za-z0-9-]+$/);
  assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/);

  const html = await response.text();
  assert.match(html, /SECURIUM/);
  assert.match(html, /정보보호 전문 역량을/);
  assert.match(html, /과정별 진도 자동 관리/);
  assert.match(html, /AI 기반 맞춤 설명/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("과정 목록을 로컬 D1에서 조회한다", async () => {
  const response = await fetch(`${baseUrl}/courses`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /ISMS-P/);
  assert.match(html, /정보보안기사/);
  assert.match(html, /CPPG 개인정보관리사/);
});

test("로그인 화면이 플랫폼 소유 인증 경로를 사용한다", async () => {
  const response = await fetch(`${baseUrl}/login`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /안전하게 로그인/);
  assert.match(html, /SECURIUM/);
  assert.match(html, /다시 만나서 반갑습니다/);
});

test("비로그인 사용자는 보호 페이지와 API에 접근할 수 없다", async () => {
  const pageResponse = await fetch(`${baseUrl}/dashboard`, {
    redirect: "manual",
  });
  assert.ok([302, 303, 307, 308].includes(pageResponse.status));
  const location = pageResponse.headers.get("location") ?? "";
  assert.match(location, /return_to=%2Fdashboard/);
  assert.doesNotMatch(location, /return_to=%2Flogin/);

  const apiResponse = await fetch(`${baseUrl}/api/learning-settings`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({
      dailyQuestionGoal: 20,
      dailyStudyMinutes: 30,
    }),
  });
  const payload = await apiResponse.json();
  assert.equal(apiResponse.status, 401);
  assert.equal(payload.code, "UNAUTHENTICATED");
});

test("상태 변경 API는 동일 출처 요청만 허용한다", async () => {
  const response = await fetch(`${baseUrl}/api/learning-settings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-email": "dev-user-1@example.invalid",
    },
    body: JSON.stringify({
      dailyQuestionGoal: 20,
      dailyStudyMinutes: 30,
    }),
  });
  const payload = await response.json();
  assert.equal(response.status, 403);
  assert.equal(payload.code, "CSRF_REJECTED");

  const malformedOriginResponse = await fetch(
    `${baseUrl}/api/learning-settings`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "not-a-valid-origin",
        "oai-authenticated-user-email": "dev-user-1@example.invalid",
      },
      body: JSON.stringify({
        dailyQuestionGoal: 20,
        dailyStudyMinutes: 30,
      }),
    },
  );
  const malformedPayload = await malformedOriginResponse.text();
  assert.equal(malformedOriginResponse.status, 403);
  assert.doesNotMatch(malformedPayload, /\bat\s+\S+\s+\([^)]*:\d+:\d+\)/);
});

test("개발 사용자의 여러 수강 과정과 분리된 진도를 표시한다", async () => {
  const response = await fetch(`${baseUrl}/dashboard`, {
    headers: {
      "oai-authenticated-user-email": "dev-user-1@example.invalid",
    },
  });
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1200));
  assert.match(html, /\/learn\/isms-p/);
  assert.match(html, /\/learn\/cppg/);
  assert.match(html, /\/practice\/isms-p/);
  assert.match(html, /\/practice\/cppg/);
  assert.match(html, /과정 진도/);
  assert.match(html, /동시 수강 가능/);
  assert.match(html, /ISMS-P/);
  assert.match(html, /CPPG 개인정보관리사/);
  assert.match(html, /전체 등록/);
});

test("관리자가 학습단위와 레슨을 생성·수정하고 학습자는 공개 범위에서 완료한다", async () => {
  const adminHeaders = {
    "content-type": "application/json",
    origin: baseUrl,
    "oai-authenticated-user-email": "dev-admin@example.invalid",
  };
  const userHeaders = {
    "content-type": "application/json",
    origin: baseUrl,
    "oai-authenticated-user-email": "dev-user-1@example.invalid",
  };
  const codeSuffix = `${process.pid}_${Date.now()}`;
  const unitInput = {
    courseId: "course-isms-p",
    subjectId: "course-isms-p-subject-foundation",
    topicId: "course-isms-p-subject-foundation-topic-core",
    code: `E2E_UNIT_${codeSuffix}`,
    title: `[개발용 CMS 테스트] 학습단위 ${runId}`,
    description: "관리자 CMS와 사용자별 진도 격리를 검증합니다.",
    displayOrder: 9000,
    active: true,
    published: false,
    completionPolicy: "MANUAL",
    minimumProgressPercent: 100,
    minimumStudySeconds: 0,
  };
  const forbiddenResponse = await fetch(
    `${baseUrl}/api/admin/learning-units`,
    {
      method: "POST",
      headers: { ...userHeaders },
      body: JSON.stringify(unitInput),
    },
  );
  assert.equal(forbiddenResponse.status, 403);

  const unitResponse = await fetch(`${baseUrl}/api/admin/learning-units`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify(unitInput),
  });
  const unit = await unitResponse.json();
  assert.equal(unitResponse.status, 201, JSON.stringify(unit));

  const lessonInput = {
    learningUnitId: unit.id,
    topicId: "course-isms-p-subject-foundation-topic-core",
    code: `E2E_LESSON_${codeSuffix}`,
    title: `[개발용 CMS 테스트] 레슨 원본 ${runId}`,
    summary: "검증된 Markdown 렌더링과 완료 기록을 확인합니다.",
    content: [
      "# 제목",
      "",
      "일반 문단과 **강조**입니다.",
      "",
      "- 목록 하나",
      "- 목록 둘",
      "",
      "| 항목 | 값 |",
      "| --- | --- |",
      "| 정책 | 최소권한 |",
      "",
      "> 안전한 인용문",
      "",
      "```text",
      "<script>alert('실행 금지')</script>",
      "```",
      "",
      "![개발용 이미지](https://example.invalid/sample.png)",
    ].join("\n"),
    contentFormat: "MARKDOWN",
    estimatedMinutes: 5,
    displayOrder: 1,
    active: true,
    published: false,
  };
  const lessonResponse = await fetch(`${baseUrl}/api/admin/lessons`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify(lessonInput),
  });
  const lesson = await lessonResponse.json();
  assert.equal(lessonResponse.status, 201, JSON.stringify(lesson));

  const unpublishedResponse = await fetch(
    `${baseUrl}/learn/isms-p/lessons/${lesson.id}`,
    {
      headers: {
        "oai-authenticated-user-email": "dev-user-1@example.invalid",
      },
    },
  );
  assert.equal(unpublishedResponse.status, 404);

  const updateUnitResponse = await fetch(
    `${baseUrl}/api/admin/learning-units`,
    {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        ...unitInput,
        id: unit.id,
        title: `[개발용 CMS 테스트] 학습단위 수정 ${runId}`,
        published: true,
      }),
    },
  );
  assert.equal(updateUnitResponse.status, 200, await updateUnitResponse.text());
  const updatedTitle = `[개발용 CMS 테스트] 레슨 수정 ${runId}`;
  const updateLessonResponse = await fetch(`${baseUrl}/api/admin/lessons`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      ...lessonInput,
      id: lesson.id,
      title: updatedTitle,
      published: true,
    }),
  });
  assert.equal(
    updateLessonResponse.status,
    200,
    await updateLessonResponse.text(),
  );
  const publicUpdatedTitle = updatedTitle.replace(/\[개발용 CMS 테스트\]\s*/, "");

  const publishedResponse = await fetch(
    `${baseUrl}/learn/isms-p/lessons/${lesson.id}`,
    {
      headers: {
        "oai-authenticated-user-email": "dev-user-1@example.invalid",
      },
    },
  );
  const publishedHtml = await publishedResponse.text();
  assert.equal(publishedResponse.status, 200, publishedHtml.slice(0, 1200));
  assert.match(publishedHtml, new RegExp(publicUpdatedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(publishedHtml, /<table/);
  assert.match(publishedHtml, /<blockquote/);
  assert.doesNotMatch(publishedHtml, /<script>alert/);
  assert.match(publishedHtml, /&lt;script&gt;/);

  const nonEnrollmentResponse = await fetch(
    `${baseUrl}/api/lessons/progress`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "oai-authenticated-user-email": "dev-user-2@example.invalid",
      },
      body: JSON.stringify({
        lessonId: lesson.id,
        action: "COMPLETE",
        lastPosition: 10000,
      }),
    },
  );
  assert.equal(nonEnrollmentResponse.status, 404);

  const complete = () =>
    fetch(`${baseUrl}/api/lessons/progress`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        lessonId: lesson.id,
        action: "COMPLETE",
        lastPosition: 10000,
      }),
    });
  const completedResponse = await complete();
  const completed = await completedResponse.json();
  assert.equal(completedResponse.status, 200, JSON.stringify(completed));
  assert.equal(completed.result.status, "COMPLETED");
  assert.equal(typeof completed.result.courseProgressPercent, "number");
  const replayResponse = await complete();
  const replay = await replayResponse.json();
  assert.equal(replayResponse.status, 200, JSON.stringify(replay));
  assert.equal(replay.result.idempotentReplay, true);
  assert.equal(replay.result.completedAt, completed.result.completedAt);

  const isolatedCourseResponse = await fetch(`${baseUrl}/learn/cppg`, {
    headers: {
      "oai-authenticated-user-email": "dev-user-1@example.invalid",
    },
  });
  const isolatedCourseHtml = await isolatedCourseResponse.text();
  assert.equal(isolatedCourseResponse.status, 200);
  assert.doesNotMatch(
    isolatedCourseHtml,
    new RegExp(publicUpdatedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});

test("본문형 레슨을 조회하고 사용자별 완료를 멱등 처리한다", async () => {
  const lessonId =
    "course-isms-p-subject-foundation-topic-core-lesson-01";
  const pageResponse = await fetch(
    `${baseUrl}/learn/isms-p/lessons/${lessonId}`,
    {
      headers: {
        "oai-authenticated-user-email": "dev-user-1@example.invalid",
      },
    },
  );
  const html = await pageResponse.text();
  assert.equal(pageResponse.status, 200, html.slice(0, 1200));
  assert.match(html, /본문형 이론 레슨|THEORY LESSON/);
  assert.doesNotMatch(html, /\[개발용 샘플 본문\]/);
  assert.match(html, /학습용 콘텐츠|학습 기록 원칙/);

  const headers = {
    "content-type": "application/json",
    origin: baseUrl,
    "oai-authenticated-user-email": "dev-user-1@example.invalid",
  };
  const complete = () =>
    fetch(`${baseUrl}/api/lessons/progress`, {
      method: "POST",
      headers,
      body: JSON.stringify({ lessonId, action: "COMPLETE" }),
    });
  const firstResponse = await complete();
  const first = await firstResponse.json();
  assert.equal(firstResponse.status, 200, JSON.stringify(first));
  assert.equal(first.result.status, "COMPLETED");

  const replayResponse = await complete();
  const replay = await replayResponse.json();
  assert.equal(replayResponse.status, 200, JSON.stringify(replay));
  assert.equal(replay.result.idempotentReplay, true);

  const otherUserResponse = await fetch(`${baseUrl}/api/lessons/progress`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "oai-authenticated-user-email": "dev-user-2@example.invalid",
    },
    body: JSON.stringify({ lessonId, action: "COMPLETE" }),
  });
  assert.equal(otherUserResponse.status, 404);
});

test("공개 문제만 표시하고 제출 전 정답 플래그를 노출하지 않는다", async () => {
  const response = await fetch(
    `${baseUrl}/practice/isms-p?count=5&type=SINGLE_CHOICE`,
    {
      headers: {
        "oai-authenticated-user-email": "dev-user-1@example.invalid",
      },
    },
  );
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1200));
  assert.match(html, /CURRENT PRACTICE/);
  assert.match(html, /현재 문제풀이 조건/);
  assert.match(html, /ISMS-P[\s\S]{0,40}문제풀이/);
  assert.doesNotMatch(html, /\[개발용 샘플\]/);
  assert.doesNotMatch(html, /"isCorrect":true/);
  assert.doesNotMatch(html, /answerConfigJson/);
});

test("문제 제출을 서버에서 채점하고 반복 오답을 한 노트에 누적한다", async () => {
  const headers = {
    "content-type": "application/json",
    origin: baseUrl,
    "oai-authenticated-user-email": "dev-user-1@example.invalid",
  };
  for (const suffix of ["one", "two"]) {
    const response = await fetch(`${baseUrl}/api/question-attempts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        questionId: "course-isms-p-question-01",
        courseId: "course-isms-p",
        answer: "course-isms-p-question-01-choice-02",
        responseTime: 1200,
        idempotencyKey: `e2e-${runId}-${suffix}`,
      }),
    });
    const payload = await response.json();
    assert.equal(response.status, 201, JSON.stringify(payload));
    assert.equal(payload.result.isCorrect, false);
    assert.ok(Array.isArray(payload.result.correctAnswer));
  }

  const notesResponse = await fetch(
    `${baseUrl}/wrong-notes?courseId=course-isms-p`,
    {
      headers: {
        "oai-authenticated-user-email": "dev-user-1@example.invalid",
      },
    },
  );
  const notesHtml = await notesResponse.text();
  assert.equal(notesResponse.status, 200);
  assert.match(notesHtml, /CURRENT WRONG NOTES/);
  assert.match(notesHtml, /현재 오답노트 조건/);
  assert.match(notesHtml, /오답[\s\S]{0,50}회/);
});

test("같은 멱등성 키의 문제 제출은 통계에 한 번만 반영한다", async () => {
  const idempotencyKey = `e2e-idempotent-${runId}`;
  const request = () =>
    fetch(`${baseUrl}/api/question-attempts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "oai-authenticated-user-email": "dev-user-1@example.invalid",
      },
      body: JSON.stringify({
        questionId: "course-isms-p-question-01",
        courseId: "course-isms-p",
        answer: "course-isms-p-question-01-choice-02",
        responseTime: 1200,
        idempotencyKey,
      }),
    });

  const firstResponse = await request();
  const first = await firstResponse.json();
  assert.equal(firstResponse.status, 201, JSON.stringify(first));
  assert.equal(first.result.idempotentReplay, false);

  const replayResponse = await request();
  const replay = await replayResponse.json();
  assert.equal(replayResponse.status, 201, JSON.stringify(replay));
  assert.equal(replay.result.idempotentReplay, true);
  assert.equal(replay.result.attemptId, first.result.attemptId);
});

test("다른 사용자의 오답노트와 관리자 문제 작업을 차단한다", async () => {
  const notesResponse = await fetch(`${baseUrl}/wrong-notes`, {
    headers: {
      "oai-authenticated-user-email": "dev-user-2@example.invalid",
    },
  });
  const notesHtml = await notesResponse.text();
  assert.equal(notesResponse.status, 200);
  assert.doesNotMatch(notesHtml, /course-isms-p-question-01/);

  const adminResponse = await fetch(`${baseUrl}/api/admin/questions/workflow`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "oai-authenticated-user-email": "dev-user-1@example.invalid",
    },
    body: JSON.stringify({
      questionId: "course-isms-p-question-01",
      action: "ARCHIVE",
      comment: "",
    }),
  });
  assert.equal(adminResponse.status, 403);
});

test("오늘의 복습은 과정별 복습 CTA와 우선순위 항목을 표시한다", async () => {
  const response = await fetch(`${baseUrl}/reviews`, {
    headers: {
      "oai-authenticated-user-email": "dev-user-1@example.invalid",
    },
  });
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1000));
  assert.match(html, /SMART REVIEW/);
  assert.match(html, /우선 복습 항목/);
  assert.match(html, /\/practice\/isms-p\?reviewOnly=1/);
});

test("관리자 수정 API는 존재하지 않는 ID를 성공으로 처리하지 않는다", async () => {
  const response = await fetch(`${baseUrl}/api/admin/course-groups`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "oai-authenticated-user-email": "dev-admin@example.invalid",
    },
    body: JSON.stringify({
      id: "missing-course-group",
      code: "MISSING_GROUP",
      name: "존재하지 않는 과정군",
      description: "",
      displayOrder: 999,
      active: true,
    }),
  });
  const payload = await response.json();
  assert.equal(response.status, 404);
  assert.equal(payload.code, "COURSE_GROUP_NOT_FOUND");
});

test("문제 수정 실패 시 본문과 연결 정보를 함께 롤백한다", async () => {
  const headers = {
    "content-type": "application/json",
    origin: baseUrl,
    "oai-authenticated-user-email": "dev-admin@example.invalid",
  };
  const originalTitle = `[개발용 트랜잭션 테스트] 원본 ${runId}`;
  const baseInput = {
    title: originalTitle,
    content: "문제 수정 원자성을 검증하는 독립 개발용 샘플입니다.",
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation: "첫 선택지가 정답입니다.",
    wrongAnswerExplanation: "원자적 저장 여부를 확인합니다.",
    source: "SECURIUM transaction test",
    sourceDate: "2026-07-27",
    answerConfigJson: "{}",
    choices: [
      {
        content: "정답",
        displayOrder: 1,
        isCorrect: true,
        explanation: "",
      },
      {
        content: "오답",
        displayOrder: 2,
        isCorrect: false,
        explanation: "",
      },
    ],
    courseIds: ["course-isms-p"],
    subjectIds: ["course-isms-p-subject-foundation"],
    topicIds: ["course-isms-p-subject-foundation-topic-core"],
  };
  const createResponse = await fetch(`${baseUrl}/api/admin/questions`, {
    method: "POST",
    headers,
    body: JSON.stringify(baseInput),
  });
  const created = await createResponse.json();
  assert.equal(createResponse.status, 201, JSON.stringify(created));

  const failedUpdateResponse = await fetch(`${baseUrl}/api/admin/questions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...baseInput,
      id: created.id,
      title: `[실패 시 저장되면 안 됨] ${runId}`,
      choices: baseInput.choices.map((choice) => ({
        ...choice,
        displayOrder: 1,
      })),
    }),
  });
  assert.equal(failedUpdateResponse.status, 500);

  const detailResponse = await fetch(
    `${baseUrl}/admin/questions/${created.id}`,
    {
      headers: {
        "oai-authenticated-user-email": "dev-admin@example.invalid",
      },
    },
  );
  const detailHtml = await detailResponse.text();
  assert.equal(detailResponse.status, 200, detailHtml.slice(0, 1200));
  assert.match(detailHtml, new RegExp(originalTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(detailHtml, /\[실패 시 저장되면 안 됨\]/);
});
