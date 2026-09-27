import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { computeMockQuestionVersionSemanticHash } from "../lib/services/mock-exam-revision.ts";

const port = 33101;
const baseUrl = `http://localhost:${port}`;
let server;
let output = "";

const mockExamId = "phase3-e2e-mock";
const mockQuestionId = "phase3-e2e-question";
const mockChoiceOneId = "phase3-e2e-question-choice-01";
const mockChoiceTwoId = "phase3-e2e-question-choice-02";
const mockSnapshotJson = JSON.stringify({
  id: mockQuestionId,
  version: 1,
  title: "Phase 3 mock question",
  content: "Phase 3 mock content",
  type: "SINGLE_CHOICE",
  difficulty: "EASY",
  explanation: "Phase 3 mock explanation",
  wrongAnswerExplanation: "Phase 3 mock wrong explanation",
  answerConfigJson: "{}",
  choices: [
    { id: `${mockQuestionId}-choice-01`, content: "Phase 3 correct", displayOrder: 1, isCorrect: true, explanation: "" },
    { id: `${mockQuestionId}-choice-02`, content: "Phase 3 wrong", displayOrder: 2, isCorrect: false, explanation: "" },
  ],
  source: null,
  sourceDate: null,
  courseIds: ["course-isms-p"],
  conceptMappings: [{ conceptId: "phase3-mock-concept", qualificationJson: "{}", provenanceJson: "{}", mappingStatus: "APPROVED", reviewedBy: "user-admin", reviewedAt: "2026-09-11T00:00:00.000Z" }],
  governance: { blueprintId: "phase3-mock-blueprint", qualificationJson: "{}", provenanceJson: "{}", governanceJson: "{}", humanReviewHash: "b".repeat(64), humanReviewedBy: "user-admin", humanReviewedAt: "2026-09-11T00:00:00.000Z" },
});
const mockSemanticHash = await computeMockQuestionVersionSemanticHash(mockSnapshotJson, mockQuestionId);

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

before(async () => {
  await localSql(`
    INSERT INTO questions (id, title, content, type, difficulty, explanation, wrong_answer_explanation, status, source, source_date, version, answer_config_json, is_sample, created_by, reviewed_by, published_at)
      VALUES ('${mockQuestionId}', 'Phase 3 mock question', 'Phase 3 mock content', 'SINGLE_CHOICE', 'EASY', 'Phase 3 mock explanation', 'Phase 3 mock wrong explanation', 'PUBLISHED', 'phase3-test', '2026-09-11', 1, '{}', 0, 'user-admin', 'user-content-reviewer', CURRENT_TIMESTAMP);
    INSERT INTO question_choices (id, question_id, content, display_order, is_correct, explanation) VALUES ('${mockChoiceOneId}', '${mockQuestionId}', 'Phase 3 correct', 1, 1, ''), ('${mockChoiceTwoId}', '${mockQuestionId}', 'Phase 3 wrong', 2, 0, '');
    INSERT INTO mock_exams (id, course_id, title, description, exam_type, question_count, time_limit_minutes, passing_score, max_attempts, randomize_questions, randomize_choices, status, published) VALUES ('${mockExamId}', 'course-isms-p', 'Phase 3 mock exam', 'Phase 3 mock fixture', 'QUICK', 1, 15, 60, 3, 0, 0, 'OPEN', 1);
    INSERT INTO mock_exam_sections (id, mock_exam_id, subject_id, title, question_count, score_weight, display_order) VALUES ('${mockExamId}-section', '${mockExamId}', NULL, 'Phase 3 fixture', 1, 100, 1);
    INSERT INTO mock_exam_questions (mock_exam_id, question_id, section_id, score, display_order) VALUES ('${mockExamId}', '${mockQuestionId}', '${mockExamId}-section', 10, 1);
    INSERT INTO question_versions (id, question_id, version, snapshot_json, review_comment, semantic_hash, human_review_hash, human_reviewed_by, human_reviewed_at, created_by)
      VALUES ('${mockQuestionId}-version-01', '${mockQuestionId}', 1, ${sqlLiteral(mockSnapshotJson)}, 'Phase 3 mock fixture', '${mockSemanticHash}', '${"b".repeat(64)}', 'user-admin', '2026-09-11T00:00:00.000Z', 'user-admin');
    INSERT OR IGNORE INTO ontology_concepts (id, concept_key, label, normalized_label, status) VALUES ('phase3-mock-concept', 'phase3.mock.concept', 'Phase 3 mock concept', 'phase 3 mock concept', 'ACTIVE');
    INSERT INTO question_concepts (id, question_version_id, concept_id, created_by, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at) VALUES ('phase3-mock-mapping', '${mockQuestionId}-version-01', 'phase3-mock-concept', 'user-admin', 'MAPS_TO', '{}', '{}', 'APPROVED', 1, 'user-admin', '2026-09-11T00:00:00.000Z');
  `);
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
  for (let attempt = 0; attempt < 480; attempt += 1) {
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

function localSql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local", "--config", "wrangler.local.jsonc", "--command", sql],
      { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    let errorOutput = "";
    child.stderr.on("data", (chunk) => { errorOutput += chunk.toString(); });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Local D1 fixture SQL failed (${code}).\n${errorOutput}`)));
  });
}

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
  assert.match(html, /data-learn-overview-v2/);
  assert.match(html, /과정 구성/);
  assert.match(html, /href="\/practice\/isms-p\?random=1&amp;count=10"/);

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
      assert.match(html, /학습 결과 요약/);
      assert.match(html, /취약 영역과 다음 학습 행동/);
      assert.match(html, /과정별 성과/);
      assert.match(html, /\/practice\/isms-p\?count=10/);
      assert.match(html, /href="\/reviews"/);
      assert.match(html, /href="\/wrong-notes"/);
    }
    if (path === "/analytics/course-isms-p") {
      assert.match(html, /과정 학습 분석/);
      assert.match(html, /가장 취약한 영역/);
      assert.match(html, /과목별 성과/);
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
    body: JSON.stringify({ mockExamId }),
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
      questionId: mockQuestionId,
      answer: mockChoiceOneId,
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
  assert.match(resultHtml, /data-mock-exam-result-v2/);
  assert.match(resultHtml, /과목별 결과/);

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
