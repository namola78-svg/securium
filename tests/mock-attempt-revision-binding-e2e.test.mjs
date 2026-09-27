import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { computeMockQuestionVersionSemanticHash } from "../lib/services/mock-exam-revision.ts";

const port = 33103;
const baseUrl = `http://localhost:${port}`;
const userHeaders = { "oai-authenticated-user-email": "dev-user-1@example.invalid" };
let server;
let output = "";

const questionId = "course-isms-p-question-01";
const conceptId = "mock-revision-concept";
const governance = {
  blueprintId: "mock-revision-blueprint",
  qualificationJson: "{}",
  provenanceJson: "{}",
  governanceJson: "{}",
  humanReviewHash: "b".repeat(64),
  humanReviewedBy: "user-admin",
  humanReviewedAt: "2026-09-11T00:00:00.000Z",
};

function makeSnapshot({ version, title, content, explanation, wrongExplanation, firstChoice, secondChoice, correctDisplayOrder }) {
  return JSON.stringify({
    id: questionId,
    version,
    title,
    content,
    type: "SINGLE_CHOICE",
    difficulty: "EASY",
    explanation,
    wrongAnswerExplanation: wrongExplanation,
    answerConfigJson: "{}",
    choices: [
      { id: `${questionId}-choice-01`, content: firstChoice, displayOrder: 1, isCorrect: correctDisplayOrder === 1, explanation: "" },
      { id: `${questionId}-choice-02`, content: secondChoice, displayOrder: 2, isCorrect: correctDisplayOrder === 2, explanation: "" },
    ],
    source: null,
    sourceDate: null,
    courseIds: ["course-isms-p"],
    conceptMappings: [{
      conceptId,
      qualificationJson: "{}",
      provenanceJson: "{}",
      mappingStatus: "APPROVED",
      reviewedBy: "user-admin",
      reviewedAt: "2026-09-11T00:00:00.000Z",
    }],
    governance,
  });
}

const oldSnapshotJson = makeSnapshot({
  version: 1,
  title: "Mock revision original",
  content: "Mock revision original content",
  explanation: "Mock revision original explanation",
  wrongExplanation: "Mock revision original wrong explanation",
  firstChoice: "Mock revision old correct",
  secondChoice: "Mock revision old wrong",
  correctDisplayOrder: 1,
});
const oldSemanticHash = await computeMockQuestionVersionSemanticHash(oldSnapshotJson, questionId);

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

before(async () => {
  await localSql(`
    DELETE FROM mock_exam_questions WHERE mock_exam_id = 'course-isms-p-mock-quick' AND question_id <> '${questionId}';
    UPDATE mock_exams SET question_count = 1, max_attempts = 10 WHERE id = 'course-isms-p-mock-quick';
    UPDATE questions SET title = 'Mock revision original', content = 'Mock revision original content', explanation = 'Mock revision original explanation', wrong_answer_explanation = 'Mock revision original wrong explanation', version = 1
      WHERE id = '${questionId}';
    UPDATE question_choices SET content = CASE WHEN display_order = 1 THEN 'Mock revision old correct' ELSE 'Mock revision old wrong' END,
      is_correct = CASE WHEN display_order = 1 THEN 1 ELSE 0 END
      WHERE question_id = '${questionId}';
    DELETE FROM question_concepts WHERE question_version_id = '${questionId}-version-01';
    UPDATE question_versions SET snapshot_json = ${sqlLiteral(oldSnapshotJson)}, semantic_hash = '${oldSemanticHash}', human_review_hash = '${"b".repeat(64)}',
      human_reviewed_by = 'user-admin', human_reviewed_at = '2026-09-11T00:00:00.000Z'
      WHERE id = '${questionId}-version-01';
    INSERT OR IGNORE INTO ontology_concepts (id, concept_key, label, normalized_label, status)
      VALUES ('mock-revision-concept', 'mock.revision.concept', 'Mock revision concept', 'mock revision concept', 'ACTIVE');
    INSERT INTO question_concepts (id, question_version_id, concept_id, created_by, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at)
      VALUES ('mock-revision-mapping', '${questionId}-version-01', 'mock-revision-concept', 'user-admin', 'MAPS_TO', '{}', '{}', 'APPROVED', 1, 'user-admin', '2026-09-11T00:00:00.000Z');
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
  const startMock = () => fetch(`${baseUrl}/api/mock-exams/start`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ mockExamId: "course-isms-p-mock-quick" }),
  });
  const initialRows = await countAttemptRows();

  await localSql(`DELETE FROM question_concepts WHERE question_version_id = '${questionId}-version-01';`);
  const missingMapping = await startMock();
  assert.equal(missingMapping.status, 409);
  assert.equal(await countAttemptRows(), initialRows);
  await localSql(`
    INSERT INTO question_concepts
      (id, question_version_id, concept_id, created_by, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at)
    VALUES ('mock-revision-mapping', '${questionId}-version-01', '${conceptId}', 'user-admin', 'MAPS_TO', '{}', '{}', 'APPROVED', 1, 'user-admin', '2026-09-11T00:00:00.000Z');
  `);

  await localSql(`UPDATE question_versions SET snapshot_json = '{}' WHERE id = '${questionId}-version-01';`);
  const corruptSnapshot = await startMock();
  assert.equal(corruptSnapshot.status, 409);
  assert.equal(await countAttemptRows(), initialRows);
  await localSql(`UPDATE question_versions SET snapshot_json = ${sqlLiteral(oldSnapshotJson)} WHERE id = '${questionId}-version-01';`);

  await localSql(`DELETE FROM question_concepts WHERE question_version_id = '${questionId}-version-01'; DELETE FROM question_versions WHERE id = '${questionId}-version-01';`);
  const missingVersion = await startMock();
  assert.equal(missingVersion.status, 409);
  assert.equal(await countAttemptRows(), initialRows);
  await localSql(`
    INSERT INTO question_versions
      (id, question_id, version, snapshot_json, review_comment, semantic_hash, human_review_hash, human_reviewed_by, human_reviewed_at, created_by)
    VALUES ('${questionId}-version-01', '${questionId}', 1, ${sqlLiteral(oldSnapshotJson)}, 'Mock revision v1 fixture', '${oldSemanticHash}', '${"b".repeat(64)}', 'user-admin', '2026-09-11T00:00:00.000Z', 'user-admin');
  `);
  await localSql(`
    INSERT INTO question_concepts
      (id, question_version_id, concept_id, created_by, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at)
    VALUES ('mock-revision-mapping', '${questionId}-version-01', '${conceptId}', 'user-admin', 'MAPS_TO', '{}', '{}', 'APPROVED', 1, 'user-admin', '2026-09-11T00:00:00.000Z');
  `);

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
    body: JSON.stringify({ attemptId, questionId, answer: `${questionId}-choice-01` }),
  });
  assert.equal(otherSaveResponse.status, 404);

  await localSql(`
    UPDATE questions SET version = 2, title = 'Mock revision changed', content = 'Mock revision changed content'
      WHERE id = '${questionId}';
    UPDATE question_choices SET content = CASE WHEN display_order = 1 THEN 'Mock revision changed wrong' ELSE 'Mock revision changed correct' END,
      is_correct = CASE WHEN display_order = 1 THEN 0 ELSE 1 END
      WHERE question_id = '${questionId}';
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
      questionId,
      answer: `${questionId}-choice-01`,
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
  assert.equal(submitPayload.result.score, 100);

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

  const newSnapshotJson = makeSnapshot({
    version: 2,
    title: "Mock revision changed",
    content: "Mock revision changed content",
    explanation: "Mock revision original explanation",
    wrongExplanation: "Mock revision original wrong explanation",
    firstChoice: "Mock revision changed wrong",
    secondChoice: "Mock revision changed correct",
    correctDisplayOrder: 2,
  });
  const newSemanticHash = await computeMockQuestionVersionSemanticHash(newSnapshotJson, questionId);
  await localSql(`
    INSERT INTO question_versions
      (id, question_id, version, snapshot_json, review_comment, semantic_hash, human_review_hash, human_reviewed_by, human_reviewed_at, created_by)
    SELECT
      '${questionId}-version-02',
      id,
      2,
      ${sqlLiteral(newSnapshotJson)},
      'Mock revision v2 fixture', '${newSemanticHash}', '${"d".repeat(64)}', 'user-admin', '2026-09-11T00:00:00.000Z', 'user-admin'
    FROM questions
    WHERE id = '${questionId}';
    INSERT INTO question_concepts
      (id, question_version_id, concept_id, created_by, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at)
    VALUES
      ('mock-revision-mapping-v2', '${questionId}-version-02', 'mock-revision-concept', 'user-admin', 'MAPS_TO', '{}', '{}', 'APPROVED', 1, 'user-admin', '2026-09-11T00:00:00.000Z');
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
    body: JSON.stringify({ attemptId: secondAttemptId, questionId, answer: `${questionId}-choice-02` }),
  });
  assert.equal(secondSaveResponse.status, 200, await secondSaveResponse.text());
  const secondSubmitResponse = await fetch(`${baseUrl}/api/mock-exams/submit`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ attemptId: secondAttemptId }),
  });
  const secondSubmitPayload = await secondSubmitResponse.json();
  assert.equal(secondSubmitResponse.status, 200, JSON.stringify(secondSubmitPayload));
  assert.equal(secondSubmitPayload.result.score, 100);
});

function localSql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local", "--config", "wrangler.local.jsonc", "--command", sql],
      { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    let errorOutput = "";
    let standardOutput = "";
    child.stdout.on("data", (chunk) => { standardOutput += chunk.toString(); });
    child.stderr.on("data", (chunk) => { errorOutput += chunk.toString(); });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(standardOutput);
      else reject(new Error(`Local D1 fixture SQL failed (${code}).\n${errorOutput}`));
    });
  });
}

async function countAttemptRows() {
  const output = await localSql("SELECT count(*) AS count FROM mock_exam_attempts WHERE user_id = 'user-learner-1' AND mock_exam_id = 'course-isms-p-mock-quick';");
  const counts = [...output.matchAll(/\"count\"\s*:\s*(\d+)/g)];
  return Number(counts.at(-1)?.[1] ?? -1);
}
