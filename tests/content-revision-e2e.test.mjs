import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { startVinextE2EServer } from "./helpers/vinext-e2e-server.mjs";
import { after, before, test } from "node:test";
import { computeQuestionSemanticHash, stableJson } from "../lib/services/question-governance.ts";

let baseUrl = "";
const lessonId = "course-isms-p-subject-foundation-topic-core-lesson-01";
const cppgLegacyLectureRevisionId = "revision-lecture-course-cppg-subject-foundation-lecture-01";
const user = {
  "content-type": "application/json",
  "oai-authenticated-user-email": "dev-user-1@example.invalid",
};
const admin = {
  "content-type": "application/json",
  "oai-authenticated-user-email": "dev-admin@example.invalid",
};
let server;
let draftId = "";
let latestId = "";

before(async () => {
  server = await startVinextE2EServer({
    readinessPath: "/api/health",
    env: { WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
    validateResponse: async (response) => {
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        return false;
      }
      const health = await response.json();
      return health.status === "ok" && health.database === "ok" && health.runtime === "nodejs";
    },
  });
  baseUrl = server.baseUrl;
  user.origin = baseUrl;
  admin.origin = baseUrl;
});

after(async () => {
  await server?.stop();
});
test("legacy CPPG lecture revision is not learner-visible from historical enrollment", async () => {
  const response = await fetch(`${baseUrl}/content-versions/${cppgLegacyLectureRevisionId}`, { headers: user, redirect: "manual" });
  assert.equal(response.status, 404);
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
  assert.match(oldHtml, /이 화면은 이전 버전입니다/);

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
  assert.match(lessonHtml, /콘텐츠 버전 정보|최신 확인 버전/);
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

for (const [field, value] of Object.entries({
  title: "Changed question title",
  explanation: "Changed explanation",
  wrongAnswerExplanation: "Changed wrong-answer explanation",
  source: "synthetic:changed-source",
  sourceDate: "2026-10-06",
})) {
  test(`G1: published question rejects legacy ${field} change with zero authority mutation`, async () => {
    await assertQuestionPublicationDenied("PUBLISHED", field, { [field]: value });
  });
}

for (const status of ["APPROVED", "DRAFT"]) {
  test(`G1: ${status} question also requires the governed version boundary`, async () => {
    await assertQuestionPublicationDenied(status, status, { explanation: "Changed semantics" });
  });
}

test("G1: a contentDate-only legacy revision cannot silently change sourceDate", async () => {
  await assertQuestionPublicationDenied("PUBLISHED", "content-date", undefined);
});

async function assertQuestionPublicationDenied(status, suffix, snapshot) {
  const questionId = await fixtureGovernedQuestion(status, suffix);
  const created = await post(admin, {
    operation: "CREATE_DRAFT", contentType: "QUESTION_EXPLANATION", contentId: questionId,
    contentDate: "2026-10-07", version: "legacy-2", changeSummary: "Synthetic G1 regression",
    snapshotJson: snapshot === undefined ? undefined : JSON.stringify(snapshot),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  const before = await questionAuthorityState(questionId);
  const published = await post(admin, { operation: "PUBLISH", revisionId: created.payload.id });
  assert.equal(published.response.status, 409, JSON.stringify(published.payload));
  assert.equal(published.payload.code, "QUESTION_GOVERNED_VERSION_REQUIRED");
  assert.deepEqual(await questionAuthorityState(questionId), before);
  assert.equal(before[3][0].revision_status, "draft");
  assert.equal(before[3][0].published_at, null);
}

test("G2: caller review attribution and APPROVED mapping fail before canonical mutation", async () => {
  const candidate = await fixtureTheoryCandidate("claimed-review");
  const before = await theoryAuthorityState(candidate.contentId);
  const result = await post(admin, { operation: "SAVE_GOVERNED_THEORY", ...candidate });
  assert.equal(result.response.status, 409, JSON.stringify(result.payload));
  assert.equal(result.payload.code, "THEORY_SERVER_REVIEW_AUTHORITY_REQUIRED");
  assert.deepEqual(await theoryAuthorityState(candidate.contentId), before);
  assert.deepEqual(before.slice(0, 2), [[], []]);
});

test("G2: matching the ADMIN actor and using SUGGESTED mappings cannot verify a rights or review claim", async () => {
  const candidate = await fixtureTheoryCandidate("self-review");
  candidate.governance.humanReviewedBy = "user-admin";
  candidate.conceptMappings = [{ ...candidate.conceptMappings[0], mappingStatus: "SUGGESTED", reviewedBy: null, reviewedAt: null }];
  const before = await theoryAuthorityState(candidate.contentId);
  const result = await post(admin, { operation: "SAVE_GOVERNED_THEORY", ...candidate });
  assert.equal(result.response.status, 409, JSON.stringify(result.payload));
  assert.equal(result.payload.code, "THEORY_SERVER_REVIEW_AUTHORITY_REQUIRED");
  assert.deepEqual(await theoryAuthorityState(candidate.contentId), before);
});

test("CPPG: unrelated lecture revisions still require the dedicated publication guard", async () => {
  const [[legacy]] = await localSql(`SELECT content_id FROM content_revisions WHERE id = ${sqlLiteral(cppgLegacyLectureRevisionId)};`);
  assert.ok(legacy);
  const created = await post(admin, {
    operation: "CREATE_DRAFT", contentType: "LECTURE", contentId: legacy.content_id,
    contentDate: "2026-10-07", version: "legacy-boundary-cppg", changeSummary: "Synthetic CPPG guard regression",
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  const command = `SELECT * FROM content_revisions WHERE id = ${sqlLiteral(created.payload.id)}; SELECT * FROM lectures WHERE id = ${sqlLiteral(legacy.content_id)};`;
  const before = await localSql(command);
  const result = await post(admin, { operation: "PUBLISH", revisionId: created.payload.id });
  assert.equal(result.response.status, 409, JSON.stringify(result.payload));
  assert.equal(result.payload.code, "CPPG_PUBLICATION_GATE_REQUIRED");
  assert.deepEqual(await localSql(command), before);
});

// All authority metadata below is synthetic and exists only in the wrapper's disposable D1.
async function fixtureGovernedQuestion(status, suffix) {
  const id = `legacy-boundary-question-${suffix}`;
  const governance = {
    blueprintId: "synthetic-legacy-boundary", qualificationJson: "{}", provenanceJson: "{}",
    governanceJson: stableJson({ authoringOrigin: "ORIGINAL_AI_ASSISTED_AUTHORING", rightsStatus: "PASS", similarityStatus: "PASS_LOW_SIMILARITY" }),
    humanReviewHash: "b".repeat(64), humanReviewedBy: "user-content-reviewer", humanReviewedAt: "2026-10-01T00:00:00.000Z",
  };
  const candidate = {
    id, version: 1, title: "Synthetic governed question", content: "Synthetic question content",
    type: "SINGLE_CHOICE", difficulty: "EASY", explanation: "Original explanation",
    wrongAnswerExplanation: "Original wrong-answer explanation", answerConfigJson: "{}",
    source: "synthetic:test", sourceDate: "2026-10-01", courseIds: ["course-isms-p"],
    choices: [
      { id: `${id}-choice-1`, content: "Correct", displayOrder: 1, isCorrect: true, explanation: "" },
      { id: `${id}-choice-2`, content: "Incorrect", displayOrder: 2, isCorrect: false, explanation: "" },
    ],
    conceptMappings: [{ conceptId: "legacy-boundary-concept", qualificationJson: "{}", provenanceJson: "{}", mappingStatus: "APPROVED", reviewedBy: governance.humanReviewedBy, reviewedAt: governance.humanReviewedAt }],
    governance,
  };
  const semanticHash = await computeQuestionSemanticHash({ ...candidate, answerConfigJson: {} });
  const boundGovernance = stableJson({ ...JSON.parse(governance.governanceJson), reviewedSemanticHash: semanticHash });
  await localSql(`
    INSERT OR IGNORE INTO ontology_concepts (id, concept_key, label, normalized_label, status)
      VALUES ('legacy-boundary-concept', 'synthetic.legacy-boundary', 'Synthetic boundary', 'synthetic boundary', 'ACTIVE');
    INSERT INTO questions (id, title, content, type, difficulty, explanation, wrong_answer_explanation, status, source, source_date, version, answer_config_json, created_by, reviewed_by, published_at)
      VALUES (${sqlLiteral(id)}, ${sqlLiteral(candidate.title)}, ${sqlLiteral(candidate.content)}, 'SINGLE_CHOICE', 'EASY', ${sqlLiteral(candidate.explanation)}, ${sqlLiteral(candidate.wrongAnswerExplanation)}, ${sqlLiteral(status)}, 'synthetic:test', '2026-10-01', 1, '{}', 'user-admin', 'user-content-reviewer', ${status === "PUBLISHED" ? "'2026-10-01T00:00:00.000Z'" : "NULL"});
    INSERT INTO question_courses (question_id, course_id) VALUES (${sqlLiteral(id)}, 'course-isms-p');
    INSERT INTO question_choices (id, question_id, content, display_order, is_correct, explanation)
      VALUES (${sqlLiteral(`${id}-choice-1`)}, ${sqlLiteral(id)}, 'Correct', 1, 1, ''), (${sqlLiteral(`${id}-choice-2`)}, ${sqlLiteral(id)}, 'Incorrect', 2, 0, '');
    INSERT INTO question_versions (id, question_id, version, snapshot_json, semantic_hash, blueprint_id, qualification_json, provenance_json, governance_json, human_review_hash, human_reviewed_by, human_reviewed_at, created_by)
      VALUES (${sqlLiteral(`${id}-version-1`)}, ${sqlLiteral(id)}, 1, ${sqlLiteral(stableJson(candidate))}, '${semanticHash}', 'synthetic-legacy-boundary', '{}', '{}', ${sqlLiteral(boundGovernance)}, '${governance.humanReviewHash}', 'user-content-reviewer', '${governance.humanReviewedAt}', 'user-admin');
    INSERT INTO question_concepts (id, question_version_id, concept_id, created_by, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at)
      VALUES (${sqlLiteral(`${id}-mapping`)}, ${sqlLiteral(`${id}-version-1`)}, 'legacy-boundary-concept', 'user-admin', 'MAPS_TO', '{}', '{}', 'APPROVED', 1, 'user-content-reviewer', '${governance.humanReviewedAt}');
  `);
  return id;
}

async function fixtureTheoryCandidate(suffix) {
  const contentId = `legacy-boundary-theory-${suffix}`;
  const canonicalKey = `synthetic.legacy-boundary.${suffix}`;
  await localSql(`
    INSERT OR IGNORE INTO ontology_concepts (id, concept_key, label, normalized_label, status)
      VALUES ('legacy-boundary-concept', 'synthetic.legacy-boundary', 'Synthetic boundary', 'synthetic boundary', 'ACTIVE');
    INSERT INTO contents (id, slug, canonical_key, title, body)
      VALUES (${sqlLiteral(contentId)}, ${sqlLiteral(contentId)}, ${sqlLiteral(canonicalKey)}, 'Synthetic Theory', 'Original candidate body');
  `);
  return {
    canonicalKey, contentId, version: "1.0.0", title: "Synthetic Theory", body: "Caller-authored theory candidate",
    bodyFormat: "MARKDOWN", learningObjectives: ["Explain the boundary"], examples: [], selfChecks: ["Was review verified?"],
    conceptMappings: [{ conceptId: "legacy-boundary-concept", conceptKey: "synthetic.legacy-boundary", qualificationJson: "{}", provenanceJson: "{}", mappingStatus: "APPROVED", reviewedBy: "user-content-reviewer", reviewedAt: "2026-10-01T00:00:00.000Z" }],
    governance: { blueprintId: "synthetic-legacy-boundary", humanReviewHash: "f".repeat(64), humanReviewedBy: "user-content-reviewer", humanReviewedAt: "2026-10-01T00:00:00.000Z", rightsStatus: "PASS_ORIGINAL", authoringOrigin: "SECURIUM_ORIGINAL", copyrightStatus: "PASS_ORIGINAL", restrictedPdfGenerationInput: false, qualificationJson: "{}", provenanceJson: "{}", lifecycle: "CANONICAL_UNPUBLISHED" },
  };
}

function questionAuthorityState(id) {
  return localSql(`
    SELECT * FROM questions WHERE id = ${sqlLiteral(id)};
    SELECT * FROM question_versions WHERE question_id = ${sqlLiteral(id)} ORDER BY version;
    SELECT * FROM question_concepts WHERE question_version_id = ${sqlLiteral(`${id}-version-1`)};
    SELECT * FROM content_revisions WHERE content_type = 'QUESTION_EXPLANATION' AND content_id = ${sqlLiteral(id)} ORDER BY id;
    SELECT * FROM question_choices WHERE question_id = ${sqlLiteral(id)} ORDER BY id;
  `);
}

function theoryAuthorityState(id) {
  return localSql(`
    SELECT * FROM content_revisions WHERE content_id = ${sqlLiteral(id)} ORDER BY id;
    SELECT * FROM content_revision_concepts WHERE revision_id IN (SELECT id FROM content_revisions WHERE content_id = ${sqlLiteral(id)}) ORDER BY id;
    SELECT * FROM contents WHERE id = ${sqlLiteral(id)};
  `);
}

function sqlLiteral(value) { return `'${String(value).replaceAll("'", "''")}'`; }

async function localSql(command) {
  assert.equal(process.env.D1_TEST_MODE, "1", "Use the disposable D1 suite wrapper");
  assert.ok(process.env.D1_TEST_PERSIST_PATH, "Disposable D1 persistence is required");
  const { stdout } = await promisify(execFile)(process.execPath, [
    "scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local", "--config", "wrangler.local.jsonc", "--command", command, "--json",
  ], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  return JSON.parse(stdout).map((result) => result.results);
}
