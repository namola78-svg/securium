import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 33102;
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
    if (server.exitCode !== null) throw new Error(`Specialized E2E server stopped.\n${output}`);
    try {
      const response = await fetch(baseUrl);
      if (response.status > 0) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Specialized E2E server did not start.\n${output}`);
});

after(() => {
  if (server?.exitCode === null) server.kill();
});

const user1 = { "oai-authenticated-user-email": "dev-user-1@example.invalid" };
const user2 = { "oai-authenticated-user-email": "dev-user-2@example.invalid" };

test("ISMS-P 인증기준과 연결된 결함·문제·법령을 조회한다", async () => {
  const overview = await fetch(`${baseUrl}/specialized/isms-p`, { headers: user1 });
  const overviewHtml = await overview.text();
  assert.equal(overview.status, 200, overviewHtml.slice(0, 1200));
  assert.match(overviewHtml, /인증 기준/);
  assert.match(overviewHtml, /결함 사례/);
  assert.match(overviewHtml, /학습 사례/);

  const detail = await fetch(
    `${baseUrl}/specialized/isms-p/ISMS_STANDARD/sample-isms-standard-01`,
    { headers: user1 },
  );
  const detailHtml = await detail.text();
  assert.equal(detail.status, 200, detailHtml.slice(0, 1200));
  assert.match(detailHtml, /주요 증적/);
  assert.match(detailHtml, /관련 결함 사례/);
  assert.match(detailHtml, /관련 문제/);
  assert.match(detailHtml, /관련 법령/);
});

test("법령 버전을 조회하고 하나의 조문을 여러 과정에서 공유한다", async () => {
  const cppg = await fetch(
    `${baseUrl}/specialized/cppg/LEGAL_ARTICLE/sample-legal-article-01`,
    { headers: user1 },
  );
  assert.equal(
    cppg.status,
    404,
    "Legacy CPPG sample flags without canonical publication proof must remain hidden.",
  );

  const engineer = await fetch(
    `${baseUrl}/specialized/information-security-engineer/LEGAL_ARTICLE/sample-legal-article-01`,
    { headers: user2 },
  );
  assert.equal(engineer.status, 200, (await engineer.text()).slice(0, 1200));
});

test("기사 서술형은 공식 점수가 아닌 키워드 기반 부분점수만 반환한다", async () => {
  const response = await fetch(`${baseUrl}/api/specialized/written-grade`, {
    method: "POST",
    headers: { ...user2, origin: baseUrl, "content-type": "application/json" },
    body: JSON.stringify({
      questionId: "spec-ise-question-16",
      answer: "자산을 식별하고 로그 통제를 적용합니다.",
    }),
  });
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload.result.advisoryOnly, true);
  assert.ok(payload.result.earnedScore > 0);
  assert.ok(payload.result.earnedScore < payload.result.maximumScore);
  assert.ok(payload.result.missingRequired.length > 0);
});

test("기사와 산업기사의 수강 및 진도는 별도 과정으로 유지된다", async () => {
  const response = await fetch(`${baseUrl}/my-courses`, { headers: user2 });
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1200));
  assert.match(html, /정보보안기사/);
  assert.match(html, /정보보안산업기사/);
});

test("위험 계산 방법을 변경할 수 있고 위험등록부는 사용자별로 분리된다", async () => {
  const apiHeaders = { ...user1, origin: baseUrl, "content-type": "application/json" };
  const multiply = await fetch(`${baseUrl}/api/specialized/risk-calculate`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ methodId: "risk-method-multiply", likelihood: 3, impact: 4 }),
  }).then((response) => response.json());
  const weighted = await fetch(`${baseUrl}/api/specialized/risk-calculate`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ methodId: "risk-method-weighted", likelihood: 3, impact: 4 }),
  }).then((response) => response.json());
  assert.notEqual(multiply.result.riskValue, weighted.result.riskValue);

  const owner = `e2e-owner-${process.pid}-${Date.now()}`;
  const save = await fetch(`${baseUrl}/api/specialized/risk-register`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({
      scenarioId: "sample-risk-scenario-01",
      asset: "개발용 테스트 자산",
      threat: "개발용 위협",
      vulnerability: "개발용 취약점",
      likelihood: 3,
      impact: 4,
      treatment: "추가 통제 적용",
      owner,
      dueDate: "",
      status: "OPEN",
    }),
  });
  assert.equal(save.status, 201, await save.text());
  const mine = await fetch(`${baseUrl}/api/specialized/risk-register`, { headers: user1 }).then((response) => response.text());
  const other = await fetch(`${baseUrl}/api/specialized/risk-register`, { headers: user2 }).then((response) => response.text());
  assert.match(mine, new RegExp(owner));
  assert.doesNotMatch(other, new RegExp(owner));
});

test("일반 사용자는 특화 콘텐츠 관리자 변경을 수행할 수 없다", async () => {
  const response = await fetch(`${baseUrl}/api/admin/specialized`, {
    method: "POST",
    headers: { ...user1, origin: baseUrl, "content-type": "application/json" },
    body: JSON.stringify({
      entity: "ISMS_STANDARD",
      code: "FORBIDDEN",
      title: "권한 없는 변경",
      majorCategory: "테스트",
      middleCategory: "테스트",
      description: "차단되어야 합니다.",
      keyPoints: "없음",
      evidenceExamples: "없음",
      defectExamples: "없음",
      auditPoints: "없음",
      version: "TEST",
      effectiveDate: "2026-07-27",
      sourceUrl: "",
      active: true,
    }),
  });
  assert.equal(response.status, 403);
});

test("관리자는 특화 콘텐츠와 버전·위험등급 관리 화면을 조회한다", async () => {
  const response = await fetch(`${baseUrl}/admin/specialized`, {
    headers: { "oai-authenticated-user-email": "dev-admin@example.invalid" },
  });
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1200));
  assert.match(html, /과정별 특화 콘텐츠/);
  assert.match(html, /법령·조문/);
  assert.match(html, /위험관리 시나리오/);
});

test("legacy CPPG enrollment cannot authorize specialized AI or bookmark actions", async () => {
  const headers = { ...user1, origin: baseUrl, "content-type": "application/json" };
  const ai = await fetch(`${baseUrl}/api/ai/specialized`, {
    method: "POST",
    headers,
    body: JSON.stringify({ targetType: "WRITTEN_ANSWER", courseId: "course-cppg", questionId: "spec-cppg-question-01", answer: "legacy CPPG sample answer" }),
  });
  assert.equal(ai.status, 403, await ai.text());

  const bookmark = await fetch(`${baseUrl}/api/specialized/bookmarks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ courseId: "course-cppg", contentType: "LEGAL_ARTICLE", contentId: "sample-legal-article-01" }),
  });
  assert.equal(bookmark.status, 403, await bookmark.text());
});

test("legacy CPPG assessment history and course-lesson progress stay hidden without projection proof", async () => {
  const fixture = {
    questionId: "course-cppg-question-01",
    nonCppgQuestionId: "course-isms-p-question-01",
    title: "CPPG-HISTORICAL-QUESTION-SECRET",
    attemptId: "cppg-visibility-history-fixture-attempt",
    bookmarkId: "cppg-visibility-history-fixture-bookmark",
    wrongNoteId: "cppg-visibility-history-fixture-wrong-note",
    courseLessonId: "course-lesson-cppg-access-control",
    contentId: "content-shared-access-control-basics",
    progressId: "cppg-visibility-history-fixture-progress",
  };
  await runLocalSql(`
    UPDATE questions SET title = '${fixture.title}' WHERE id = '${fixture.questionId}';
    INSERT OR REPLACE INTO question_attempts
      (id, idempotency_key, user_id, question_id, course_id, selected_answer, is_correct, score, response_time)
      VALUES ('${fixture.attemptId}', '${fixture.attemptId}', 'user-learner-1', '${fixture.questionId}', 'course-cppg', '[]', 0, 0, 1);
    INSERT OR REPLACE INTO bookmarks (id, user_id, target_type, target_id, course_id)
      VALUES ('${fixture.bookmarkId}', 'user-learner-1', 'QUESTION', '${fixture.questionId}', 'course-cppg');
    INSERT OR REPLACE INTO wrong_notes (id, user_id, question_id, course_id, last_attempt_id, wrong_count, user_memo)
      VALUES ('${fixture.wrongNoteId}', 'user-learner-1', '${fixture.questionId}', 'course-cppg', '${fixture.attemptId}', 1, 'historical memo');
    INSERT OR REPLACE INTO user_course_lesson_progress
      (id, user_id, course_id, course_lesson_id, content_id, content_version, status, progress_percent, time_spent_seconds)
      SELECT '${fixture.progressId}', 'user-learner-1', 'course-cppg', cl.id, c.id, c.version, 'IN_PROGRESS', 37, 18
      FROM course_lessons cl JOIN contents c ON c.id = cl.content_id
      WHERE cl.id = '${fixture.courseLessonId}' AND cl.content_id = '${fixture.contentId}';
  `);

  const headers = { ...user1, origin: baseUrl, "content-type": "application/json" };
  const bookmarkWrite = await fetch(`${baseUrl}/api/bookmarks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ targetType: "QUESTION", targetId: fixture.questionId, courseId: "course-cppg" }),
  });
  assert.equal(bookmarkWrite.status, 404, await bookmarkWrite.text());

  const bookmarksPage = await fetch(`${baseUrl}/bookmarks`, { headers: user1 });
  const bookmarksHtml = await bookmarksPage.text();
  assert.equal(bookmarksPage.status, 200, bookmarksHtml.slice(0, 1000));
  assert.doesNotMatch(bookmarksHtml, new RegExp(fixture.title));

  const wrongNotesPage = await fetch(`${baseUrl}/wrong-notes`, { headers: user1 });
  const wrongNotesHtml = await wrongNotesPage.text();
  assert.equal(wrongNotesPage.status, 200, wrongNotesHtml.slice(0, 1000));
  assert.doesNotMatch(wrongNotesHtml, new RegExp(fixture.title));

  const nonCppgBookmark = await fetch(`${baseUrl}/api/bookmarks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ targetType: "QUESTION", targetId: fixture.nonCppgQuestionId, courseId: "course-isms-p" }),
  });
  assert.equal(nonCppgBookmark.status, 200, await nonCppgBookmark.text());

  const progressWrite = await fetch(`${baseUrl}/api/course-lessons/progress`, {
    method: "POST",
    headers,
    body: JSON.stringify({ courseLessonId: fixture.courseLessonId, action: "UPDATE", progressPercent: 90, timeSpentSeconds: 99 }),
  });
  assert.equal(progressWrite.status, 404, await progressWrite.text());

  const retained = await runLocalSql(`
    SELECT
      (SELECT count(*) FROM bookmarks WHERE id = '${fixture.bookmarkId}') AS bookmark_count,
      (SELECT count(*) FROM wrong_notes WHERE id = '${fixture.wrongNoteId}') AS wrong_note_count,
      (SELECT count(*) FROM question_attempts WHERE id = '${fixture.attemptId}') AS attempt_count,
      (SELECT progress_percent FROM user_course_lesson_progress WHERE id = '${fixture.progressId}') AS progress_percent;
  `, true);
  assert.match(retained, /"bookmark_count"\s*:\s*1/);
  assert.match(retained, /"wrong_note_count"\s*:\s*1/);
  assert.match(retained, /"attempt_count"\s*:\s*1/);
  assert.match(retained, /"progress_percent"\s*:\s*37/);
});

function runLocalSql(sql, json = false) {
  return new Promise((resolve, reject) => {
    const args = ["scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local", "--config", "wrangler.local.jsonc", "--command", sql];
    if (json) args.push("--json");
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let outputText = "";
    child.stdout.on("data", (chunk) => { outputText += chunk.toString(); });
    child.stderr.on("data", (chunk) => { outputText += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(outputText) : reject(new Error(`Disposable D1 fixture SQL failed (${code}).\n${outputText}`)));
  });
}
