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
  assert.match(engineerHtml, /현재 문제풀이 조건/);
  assert.match(engineerHtml, /풀이 안내/);
  assert.match(engineerHtml, /AI 참고 해설은 채점 이후 요청할 수 있으며 공식 채점 결과가 아닙니다/);
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
  assert.match(industrialHtml, /현재 문제풀이 조건/);
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

test("learner curriculum overview renders compact path summary and inspector", async () => {
  await ensureSecurityCertificationCurriculumSeed();
  await ensureCourseLessonSeed();
  await ensureNetworkQuestionSeed();
  await ensureSecurityCertificationCurriculumActive();
  await ensureEnrollment("dev-user-1@example.invalid", "course-ise");

  const response = await fetch(`${baseUrl}/learn/information-security-engineer`, {
    headers: {
      "oai-authenticated-user-email": "dev-user-1@example.invalid",
    },
  });
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1200));
  assert.match(html, /OFFICIAL CURRICULUM PATH/);
  assert.match(html, /CURRICULUM INSPECTOR/);
  assert.match(html, /Stable Key/);
  assert.match(html, /course-lesson-ise-official-network-security-overview/);
  assert.match(html, /\/practice\/information-security-engineer\?/);
  assert.match(html, /전체 펼치기/);
  assert.match(html, /전체 접기/);
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
  assert.match(curriculumHtml, /노드 연결률/);
  assert.match(curriculumHtml, /레슨 연결률/);
  assert.match(curriculumHtml, /미연결/);
  assert.match(curriculumHtml, /공개 문제/);
  assert.match(curriculumHtml, /기사·산업기사 공식 커리큘럼 커버리지/);
  assert.match(curriculumHtml, /전체 학습 노드/);
  assert.match(curriculumHtml, /문항 연결률/);
  assert.match(curriculumHtml, /100% 준비/);
  assert.match(curriculumHtml, /Content 미연결 노드/);
  assert.match(curriculumHtml, /문항 공백 노드/);
  assert.match(curriculumHtml, /미연결 Content 노드가 없습니다/);
  assert.match(curriculumHtml, /문항 공백 노드가 없습니다/);
  assert.match(curriculumHtml, /공통 콘텐츠 관리로 이동/);
  assert.match(curriculumHtml, /\/admin\/shared-content\?courseId=course-ise/);
  assert.match(curriculumHtml, /OPERATIONAL COURSELESSON GAPS/);
  assert.match(curriculumHtml, /COVERAGE ACTION QUEUE/);
  assert.match(curriculumHtml, /Operational readiness/);
  assert.match(curriculumHtml, /Operational coverage checklist/);
  assert.match(curriculumHtml, /TREE_STATUS/);
  assert.match(curriculumHtml, /COURSELESSON_LINK_GAP/);
  assert.match(curriculumHtml, /CONTENT_METADATA_GAP/);
  assert.match(curriculumHtml, /read-only signals/);
  assert.match(curriculumHtml, /CourseLesson gaps/);
  assert.match(curriculumHtml, /(CourseLesson gap|Content gap|Question gap)/);
  assert.match(
    curriculumHtml,
    /(\/admin\/shared-content\?courseId=course-ise&amp;contentId=|CourseLesson)/,
  );
  assert.match(curriculumHtml, /courseLessonId=course-lesson-/);
  assert.match(curriculumHtml, /운영 DB 선택 트리/);
  assert.match(curriculumHtml, /정식 seed 기준/);
  assert.match(curriculumHtml, /운영 반영 확인 포인트/);
  assert.match(curriculumHtml, /비교 기준 분리/);
  assert.match(curriculumHtml, /추천 후보/);
  assert.match(curriculumHtml, /연결 준비/);

  const createTemporaryContentResponse = await fetch(
    `${baseUrl}/api/admin/shared-content`,
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "content-type": "application/json",
        origin: baseUrl,
      },
      body: JSON.stringify({
        operation: "saveContent",
        content: {
          slug: `rendered-admin-link-${runId}`,
          canonicalKey: `test.rendered-admin-link.${runId}`,
          title: "Rendered HTML temporary content",
          summary: "Temporary content for admin linking flow test.",
          body: "Temporary content body for admin linking flow test.",
          bodyFormat: "MARKDOWN",
          learningObjectivesJson: "[]",
          coreConceptsJson: "[]",
          practicalExamplesJson: "[]",
          diagramsJson: "[]",
          mediaJson: "[]",
          version: "test",
          status: "PUBLISHED",
        },
      }),
    },
  );
  const createTemporaryContentPayload = await readJsonResponse(
    createTemporaryContentResponse,
  );
  assert.equal(
    createTemporaryContentResponse.status,
    201,
    JSON.stringify(createTemporaryContentPayload),
  );
  const temporaryContentId = createTemporaryContentPayload.id;
  assert.match(temporaryContentId, /^[0-9a-f-]{36}$/);
  const temporaryCourseLessonSortOrder = 80000 + (Date.now() % 10000);

  const createUnlinkedCourseLessonResponse = await fetch(
    `${baseUrl}/api/admin/shared-content`,
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "content-type": "application/json",
        origin: baseUrl,
      },
      body: JSON.stringify({
        operation: "saveCourseLesson",
        courseLesson: {
          courseId: "course-ise",
          curriculumNodeId: "",
          lessonId: "",
          contentId: temporaryContentId,
          displayTitle: "Rendered HTML temporary unlinked CourseLesson",
          sortOrder: temporaryCourseLessonSortOrder,
          difficulty: "",
          importance: 50,
          estimatedMinutes: 7,
          isRequired: true,
          unlockCondition: "",
          completionRule: "MANUAL",
          status: "PUBLISHED",
        },
      }),
    },
  );
  const createUnlinkedCourseLessonPayload = await readJsonResponse(
    createUnlinkedCourseLessonResponse,
  );
  assert.equal(
    createUnlinkedCourseLessonResponse.status,
    201,
    JSON.stringify(createUnlinkedCourseLessonPayload),
  );
  const temporaryCourseLessonId = createUnlinkedCourseLessonPayload.id;
  assert.match(temporaryCourseLessonId, /^[0-9a-f-]{36}$/);

  const unlinkedCourseLessonsResponse = await fetch(
    `${baseUrl}/api/admin/shared-content?scope=courseLessons&courseId=course-ise`,
    { headers: adminHeaders },
  );
  const unlinkedCourseLessonsPayload = await readJsonResponse(
    unlinkedCourseLessonsResponse,
  );
  assert.equal(
    unlinkedCourseLessonsResponse.status,
    200,
    JSON.stringify(unlinkedCourseLessonsPayload),
  );
  assert.equal(
    unlinkedCourseLessonsPayload.courseLessons.find(
      (lesson) => lesson.id === temporaryCourseLessonId,
    )?.curriculumNodeId,
    null,
  );
  const targetCurriculumNodeId = "curriculum-node-ise-2027-2029-02";
  const linkedCourseLessonSortOrder =
    Math.max(
      temporaryCourseLessonSortOrder,
      0,
      ...unlinkedCourseLessonsPayload.courseLessons
        .filter((lesson) => lesson.curriculumNodeId === targetCurriculumNodeId)
        .map((lesson) => Number(lesson.sortOrder) || 0),
    ) + 1;

  const linkCourseLessonResponse = await fetch(
    `${baseUrl}/api/admin/shared-content`,
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "content-type": "application/json",
        origin: baseUrl,
      },
      body: JSON.stringify({
        operation: "saveCourseLesson",
        courseLesson: {
          id: temporaryCourseLessonId,
          courseId: "course-ise",
          curriculumNodeId: targetCurriculumNodeId,
          lessonId: "",
          contentId: temporaryContentId,
          displayTitle: "Rendered HTML temporary unlinked CourseLesson",
          sortOrder: linkedCourseLessonSortOrder,
          difficulty: "",
          importance: 50,
          estimatedMinutes: 7,
          isRequired: true,
          unlockCondition: "",
          completionRule: "MANUAL",
          status: "PUBLISHED",
        },
      }),
    },
  );
  assert.equal(
    linkCourseLessonResponse.status,
    200,
    JSON.stringify(await readJsonResponse(linkCourseLessonResponse)),
  );

  const linkedCourseLessonsResponse = await fetch(
    `${baseUrl}/api/admin/shared-content?scope=courseLessons&courseId=course-ise`,
    { headers: adminHeaders },
  );
  const linkedCourseLessonsPayload = await readJsonResponse(
    linkedCourseLessonsResponse,
  );
  assert.equal(
    linkedCourseLessonsPayload.courseLessons.find(
      (lesson) => lesson.id === temporaryCourseLessonId,
    )?.curriculumNodeId,
    targetCurriculumNodeId,
  );

  const sharedContentResponse = await fetch(
    `${baseUrl}/admin/shared-content?courseId=course-ise&contentId=content-official-security-cert-network-security-overview&courseLessonId=course-lesson-ise-official-network-security-overview&curriculumNodeId=curriculum-node-ise-2027-2029-02`,
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
  assert.match(
    sharedContentHtml,
    /\/admin\/curriculum\?treeId=curriculum-ise-2027-2029-official/,
  );
  assert.match(sharedContentHtml, /선택된 커리큘럼 노드/);
  assert.match(sharedContentHtml, /커버리지 화면에서 넘어온 노드입니다/);
  assert.match(sharedContentHtml, /전체 CourseLesson 보기/);
  assert.match(sharedContentHtml, /이 노드에 새 CourseLesson 연결/);
  assert.match(
    sharedContentHtml,
    /(추천 Content 후보|자동으로 추천할 미연결 Content)/,
  );
  assert.match(
    sharedContentHtml,
    /(임시 입력됩니다|자동으로 추천할 미연결 Content)/,
  );
});

let networkQuestionSeedApplied = false;
let courseLessonSeedApplied = false;
let securityCertificationCurriculumSeedApplied = false;
let securityCertificationCurriculumActive = false;

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

async function ensureSecurityCertificationCurriculumActive() {
  if (securityCertificationCurriculumActive) return;
  const result = await runCommand(process.execPath, [
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
    "--command",
    [
      "UPDATE curriculum_trees SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP",
      "WHERE course_id IN ('course-ise', 'course-isie')",
      "AND status = 'ACTIVE'",
      "AND id NOT IN ('curriculum-ise-2027-2029-official', 'curriculum-isie-2027-2029-official');",
      "UPDATE curriculum_trees SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP",
      "WHERE id IN ('curriculum-ise-2027-2029-official', 'curriculum-isie-2027-2029-official');",
    ].join(" "),
  ]);
  assert.equal(result.code, 0, result.output);
  securityCertificationCurriculumActive = true;
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
  const visibleHtml = html.split('<script id="_R_">')[0];
  assert.match(visibleHtml, /SECURIUM/);
  assert.match(visibleHtml, /AI-POWERED SECURITY LEARNING/);
  assert.match(visibleHtml, /hero-title-line/);
  assert.match(visibleHtml, /hero-panel/);
  assert.match(visibleHtml, /공식 기준 기반 학습 코어/);
  assert.match(visibleHtml, /Knowledge-linked Learning/);
  assert.match(visibleHtml, /signal-list/);
  assert.match(visibleHtml, /KISA/);
  assert.match(visibleHtml, /NCS/);
  assert.match(visibleHtml, /검증 가능/);
  assert.doesNotMatch(visibleHtml, /인증기준 2\.6 접근통제/);
  assert.doesNotMatch(visibleHtml, /진행률/);
  assert.doesNotMatch(visibleHtml, /68%/);
  assert.match(visibleHtml, /SECURIUM LEARNING CHAIN/);
  assert.match(visibleHtml, /learning-chain-list/);
  assert.match(visibleHtml, /KISA/);
  assert.match(visibleHtml, /NCS/);
  assert.match(visibleHtml, /취약 개념 재추천/);
  assert.match(visibleHtml, /KNOWLEDGE PLATFORM/);
  assert.match(visibleHtml, /knowledge-platform-stack/);
  assert.match(visibleHtml, /knowledge-platform-equation/);
  assert.match(visibleHtml, /개념 연결/);
  assert.match(visibleHtml, /이론 콘텐츠/);
  assert.match(visibleHtml, /근거 해설/);
  assert.match(visibleHtml, /맞춤 복습/);
  assert.match(visibleHtml, /VERIFIABLE AI EXPLANATION/);
  assert.match(visibleHtml, /검증 가능한 근거/);
  assert.match(visibleHtml, /ISMS-P/);
  assert.match(visibleHtml, /LEARNER DASHBOARD/);
  assert.match(visibleHtml, /learner-dashboard-card/);
  assert.match(visibleHtml, /취약 영역/);
  assert.match(visibleHtml, /오늘 완료/);
  assert.match(visibleHtml, /2\/5/);
  assert.match(visibleHtml, /오늘 학습 시작하기/);
  assert.match(visibleHtml, /START WITH SECURIUM/);
  assert.match(visibleHtml, /landing-final-cta/);
  assert.match(visibleHtml, /무료로 학습 시작하기/);
  assert.match(visibleHtml, /과정 먼저 둘러보기/);
  assert.doesNotMatch(visibleHtml, /개 과정이 준비되어 있습니다/);
  assert.doesNotMatch(visibleHtml, /Phase 1/);
  assert.doesNotMatch(visibleHtml, /개발용 샘플/);
  assert.doesNotMatch(visibleHtml, /COMMON LEARNING CORE/);
  assert.doesNotMatch(visibleHtml, /codex-preview/);
  assert.doesNotMatch(visibleHtml, /react-loading-skeleton/);
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

test("관리자 대시보드는 Console Shell, Toolbar, Inspector 계약을 서버 렌더링한다", async () => {
  const response = await fetch(`${baseUrl}/admin`, {
    headers: {
      "oai-authenticated-user-email": "dev-admin@example.invalid",
    },
  });
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1200));
  assert.match(html, /SECURIUM ADMIN/);
  assert.match(html, /관리자 콘솔/);
  assert.match(html, /운영 현황/);
  assert.match(html, /관리자 본문으로 이동/);
  assert.match(html, /admin-mobile-nav-button/);
  assert.match(html, /aria-controls="admin-sidebar-navigation"/);
  assert.match(html, /account-drawer-trigger/);
  assert.match(html, /aria-controls="admin-account-drawer"/);
  assert.match(html, /ds-page-toolbar/);
  assert.match(html, /ds-workspace-layout/);
  assert.match(html, /선택 항목 상세 정보/);
  assert.match(html, /운영 상태 요약/);
  assert.match(html, /Curriculum Coverage/);
  assert.match(html, /Ontology Explorer/);
  assert.match(html, /AI Trace Console/);
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
  assert.match(html, /과정별 기록 분리/);
  assert.match(html, /추천 다음 행동/);
  assert.match(html, /바로 시작하기/);
  assert.match(html, /오늘 할 학습/);
  assert.match(html, /이어서 학습/);
  assert.match(html, /최근 학습 요약/);
  assert.match(html, /ISMS-P/);
  assert.match(html, /CPPG 개인정보관리사/);
  assert.match(html, /등록 과정/);
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
  assert.match(html, /현재 문제풀이 조건/);
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
  assert.match(notesHtml, /WRONG NOTE INSIGHT/);
  assert.match(notesHtml, /\/practice\/isms-p\?wrongOnly=1/);
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
  assert.match(html, /TODAY REVIEW PLAN/);
  assert.match(html, /REVIEW INSPECTOR/);
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

test("admin analytics page uses the shared console inspector pattern", async () => {
  const response = await fetch(`${baseUrl}/admin/analytics`, {
    headers: {
      "oai-authenticated-user-email": "dev-admin@example.invalid",
    },
  });
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1200));
  assert.match(html, /OPERATIONS ANALYTICS/);
  assert.match(html, /학습 운영 통계/);
  assert.match(html, /ds-workspace-layout/);
  assert.match(html, /ds-inspector-panel/);
  assert.match(html, /ANALYTICS INSPECTOR/);
  assert.match(html, /Metric formula/);
  assert.match(html, /Source data/);
  assert.match(html, /0으로 나누는 오류를 방지합니다/);
});

test("core admin operations pages share the console inspector contract", async () => {
  const pages = [
    {
      path: "/admin/coverage",
      header: /COVERAGE OPERATIONS/,
      inspector: /COVERAGE INSPECTOR/,
      adjacent: [/Curriculum/, /Shared Content/],
    },
    {
      path: "/admin/ontology",
      header: /ONTOLOGY ENGINE/,
      inspector: /ONTOLOGY INSPECTOR/,
      adjacent: [/View curriculum/, /View AI trace/],
    },
    {
      path: "/admin/ai-explainability",
      header: /AI EXPLAINABILITY/,
      inspector: /AI TRACE INSPECTOR/,
      adjacent: [/Ontology/, /AI Reviews/],
    },
    {
      path: "/admin/content-revisions",
      header: /CONTENT REVISION CONTROL/,
      inspector: /REVISION INSPECTOR/,
      adjacent: [/Shared Content/, /AI Retrieval/],
    },
    {
      path: "/admin/analytics",
      header: /OPERATIONS ANALYTICS/,
      inspector: /ANALYTICS INSPECTOR/,
      adjacent: [/Coverage/, /AI Trace/],
    },
  ];

  for (const page of pages) {
    const response = await fetch(`${baseUrl}${page.path}`, {
      headers: {
        "oai-authenticated-user-email": "dev-admin@example.invalid",
      },
    });
    const html = await response.text();
    assert.equal(response.status, 200, `${page.path}\n${html.slice(0, 1200)}`);
    assert.match(html, page.header, page.path);
    assert.match(html, /ds-page-toolbar/, page.path);
    assert.match(html, /ds-workspace-layout/, page.path);
    assert.match(html, /ds-inspector-panel/, page.path);
    assert.match(html, page.inspector, page.path);
    for (const pattern of page.adjacent) {
      assert.match(html, pattern, page.path);
    }
  }
});

test("admin question reports page uses the shared workspace inspector primitive", async () => {
  const response = await fetch(`${baseUrl}/admin/question-reports`, {
    headers: {
      "oai-authenticated-user-email": "dev-admin@example.invalid",
    },
  });
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1200));
  assert.match(html, /QUESTION REPORTS/);
  assert.match(html, /문제 신고 관리/);
  assert.match(html, /신고 큐/);
  assert.match(html, /ds-page-toolbar/);
  assert.match(html, /ds-workspace-layout/);
  assert.match(html, /ds-inspector-panel/);
  assert.match(html, /REPORT INSPECTOR/);
});
