import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 33103;
const baseUrl = `http://localhost:${port}`;
const userHeaders = { "oai-authenticated-user-email": "dev-user-1@example.invalid" };
let server;
let output = "";

before(async () => {
  await localSql(`
    UPDATE questions SET title = 'Mock revision original', content = 'Mock revision original content', explanation = 'Mock revision original explanation', wrong_answer_explanation = 'Mock revision original wrong explanation'
      WHERE id = 'course-isms-p-question-01';
    UPDATE question_choices SET content = CASE WHEN display_order = 1 THEN 'Mock revision old correct' ELSE 'Mock revision old wrong' END,
      is_correct = CASE WHEN display_order = 1 THEN 1 ELSE 0 END
      WHERE question_id = 'course-isms-p-question-01';
    UPDATE question_versions SET snapshot_json = json_object(
      'id', question_id,
      'title', (SELECT title FROM questions WHERE id = question_versions.question_id),
      'content', (SELECT content FROM questions WHERE id = question_versions.question_id),
      'type', (SELECT type FROM questions WHERE id = question_versions.question_id),
      'difficulty', (SELECT difficulty FROM questions WHERE id = question_versions.question_id),
      'explanation', (SELECT explanation FROM questions WHERE id = question_versions.question_id),
      'wrongAnswerExplanation', (SELECT wrong_answer_explanation FROM questions WHERE id = question_versions.question_id),
      'answerConfigJson', (SELECT answer_config_json FROM questions WHERE id = question_versions.question_id),
      'choices', json((SELECT json_group_array(json_object('id', id, 'content', content, 'displayOrder', display_order, 'isCorrect', is_correct, 'explanation', explanation)) FROM question_choices WHERE question_id = question_versions.question_id ORDER BY display_order))
    ), semantic_hash = '${"a".repeat(64)}', human_review_hash = '${"b".repeat(64)}',
      human_reviewed_by = 'user-admin', human_reviewed_at = '2026-09-11T00:00:00.000Z'
      WHERE id = 'course-isms-p-question-01-version-01';
    INSERT INTO ontology_concepts (id, concept_key, label, normalized_label, status)
      VALUES ('mock-revision-concept', 'mock.revision.concept', 'Mock revision concept', 'mock revision concept', 'ACTIVE');
    INSERT INTO question_concepts (id, question_version_id, concept_id, created_by, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at)
      VALUES ('mock-revision-mapping', 'course-isms-p-question-01-version-01', 'mock-revision-concept', 'user-admin', 'MAPS_TO', '{}', '{}', 'APPROVED', 1, 'user-admin', '2026-09-11T00:00:00.000Z');
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

after(() => {
  if (server?.exitCode === null) server.kill();
});

test("a mock attempt grades the bound QuestionVersion after the current question changes", async () => {
  const jsonHeaders = { ...userHeaders, "content-type": "application/json", origin: baseUrl };
  const otherJsonHeaders = { "oai-authenticated-user-email": "dev-user-2@example.invalid", "content-type": "application/json", origin: baseUrl };
  const startResponse = await fetch(`${baseUrl}/api/mock-exams/start`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ mockExamId: "course-isms-p-mock-quick" }),
  });
  const startPayload = await startResponse.json();
  assert.equal(startResponse.status, 201, JSON.stringify(startPayload));
  const attemptId = startPayload.attempt.id;

  const otherAttemptPage = await fetch(`${baseUrl}/mock-exams/attempts/${attemptId}`, {
    headers: { "oai-authenticated-user-email": "dev-user-2@example.invalid" },
  });
  assert.equal(otherAttemptPage.status, 404);

  const otherSaveResponse = await fetch(`${baseUrl}/api/mock-exams/answer`, {
    method: "POST",
    headers: otherJsonHeaders,
    body: JSON.stringify({ attemptId, questionId: "course-isms-p-question-01", answer: "course-isms-p-question-01-choice-01" }),
  });
  assert.equal(otherSaveResponse.status, 404);

  await localSql(`
    UPDATE questions SET version = 2, title = 'Mock revision changed', content = 'Mock revision changed content'
      WHERE id = 'course-isms-p-question-01';
    UPDATE question_choices SET content = CASE WHEN display_order = 1 THEN 'Mock revision changed wrong' ELSE 'Mock revision changed correct' END,
      is_correct = CASE WHEN display_order = 1 THEN 0 ELSE 1 END
      WHERE question_id = 'course-isms-p-question-01';
  `);

  const attemptPage = await fetch(`${baseUrl}/mock-exams/attempts/${attemptId}`, { headers: userHeaders });
  const attemptHtml = await attemptPage.text();
  assert.equal(attemptPage.status, 200, attemptHtml.slice(0, 1000));
  assert.match(attemptHtml, /Mock revision original/);
  assert.doesNotMatch(attemptHtml, /Mock revision changed/);
  assert.doesNotMatch(attemptHtml, /Mock revision original explanation/);
  assert.doesNotMatch(attemptHtml, /Mock revision original wrong explanation/);
  assert.doesNotMatch(attemptHtml, /questionVersionSnapshotJson/);

  const saveResponse = await fetch(`${baseUrl}/api/mock-exams/answer`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      attemptId,
      questionId: "course-isms-p-question-01",
      answer: "course-isms-p-question-01-choice-01",
      questionVersionId: "forged-question-version",
      conceptMappingSetHash: "f".repeat(64),
      score: 100,
    }),
  });
  assert.equal(saveResponse.status, 200, await saveResponse.text());

  const submitResponse = await fetch(`${baseUrl}/api/mock-exams/submit`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ attemptId }),
  });
  const submitPayload = await submitResponse.json();
  assert.equal(submitResponse.status, 200, JSON.stringify(submitPayload));
  assert.equal(submitPayload.result.score, 10);

  const replayResponse = await fetch(`${baseUrl}/api/mock-exams/submit`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ attemptId }),
  });
  assert.equal(replayResponse.status, 409);

  const resultPage = await fetch(`${baseUrl}/mock-exams/attempts/${attemptId}`, { headers: userHeaders });
  const resultHtml = await resultPage.text();
  assert.equal(resultPage.status, 200, resultHtml.slice(0, 1000));
  assert.match(resultHtml, /Mock revision original/);
  assert.match(resultHtml, /Mock revision old correct/);
  assert.doesNotMatch(resultHtml, /Mock revision changed correct/);

  await localSql(`
    INSERT INTO question_versions
      (id, question_id, version, snapshot_json, review_comment, semantic_hash, human_review_hash, human_reviewed_by, human_reviewed_at, created_by)
    SELECT
      'course-isms-p-question-01-version-02',
      id,
      2,
      json_object(
        'id', id,
        'title', title,
        'content', content,
        'type', type,
        'difficulty', difficulty,
        'explanation', explanation,
        'wrongAnswerExplanation', wrong_answer_explanation,
        'answerConfigJson', answer_config_json,
        'choices', json((SELECT json_group_array(json_object('id', id, 'content', content, 'displayOrder', display_order, 'isCorrect', is_correct, 'explanation', explanation)) FROM question_choices WHERE question_id = questions.id ORDER BY display_order))
      ),
      'Mock revision v2 fixture', '${"c".repeat(64)}', '${"d".repeat(64)}', 'user-admin', '2026-09-11T00:00:00.000Z', 'user-admin'
    FROM questions
    WHERE id = 'course-isms-p-question-01';
    INSERT INTO question_concepts
      (id, question_version_id, concept_id, created_by, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at)
    VALUES
      ('mock-revision-mapping-v2', 'course-isms-p-question-01-version-02', 'mock-revision-concept', 'user-admin', 'MAPS_TO', '{}', '{}', 'APPROVED', 1, 'user-admin', '2026-09-11T00:00:00.000Z');
  `);

  const secondStartResponse = await fetch(`${baseUrl}/api/mock-exams/start`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ mockExamId: "course-isms-p-mock-quick" }),
  });
  const secondStartPayload = await secondStartResponse.json();
  assert.equal(secondStartResponse.status, 201, JSON.stringify(secondStartPayload));
  const secondAttemptId = secondStartPayload.attempt.id;
  const secondAttemptPage = await fetch(`${baseUrl}/mock-exams/attempts/${secondAttemptId}`, { headers: userHeaders });
  const secondAttemptHtml = await secondAttemptPage.text();
  assert.equal(secondAttemptPage.status, 200, secondAttemptHtml.slice(0, 1000));
  assert.match(secondAttemptHtml, /Mock revision changed/);
  assert.doesNotMatch(secondAttemptHtml, /Mock revision original content/);

  const secondSaveResponse = await fetch(`${baseUrl}/api/mock-exams/answer`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ attemptId: secondAttemptId, questionId: "course-isms-p-question-01", answer: "course-isms-p-question-01-choice-02" }),
  });
  assert.equal(secondSaveResponse.status, 200, await secondSaveResponse.text());
  const secondSubmitResponse = await fetch(`${baseUrl}/api/mock-exams/submit`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ attemptId: secondAttemptId }),
  });
  const secondSubmitPayload = await secondSubmitResponse.json();
  assert.equal(secondSubmitResponse.status, 200, JSON.stringify(secondSubmitPayload));
  assert.equal(secondSubmitPayload.result.score, 10);
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
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Local D1 fixture SQL failed (${code}).\n${errorOutput}`));
    });
  });
}
