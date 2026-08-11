import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SECURITY_CONTENT_V3_CONCEPT_MAP,
  SECURITY_CONTENT_V3_SOURCE_COURSE_ID,
  buildSecurityContentIntelligenceV3Plan,
  buildSecurityContentV3Plan,
  generateSecurityContentIntelligenceV3Sql,
  generateSecurityContentV3Sql,
} from "../lib/data/security-content-upgrade-v3.mjs";

const concepts = Object.keys(SECURITY_CONTENT_V3_CONCEPT_MAP);

function fixture() {
  return {
    lessons: concepts.map((concept) => ({
      id: `sec-upgrade-lesson-${concept.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: `${concept} 학습`,
      concepts: [concept],
      source_refs: ["source-ref"],
      difficulty: 3,
      learningObjectives: ["학습 목표"],
      overview: "개요",
      keyPoints: ["핵심"],
      practiceTip: "실무 팁",
      fieldExample: "현장 예시",
      relatedConcepts: [],
      provenance: { canonicalConcept: concept },
    })),
    writtenQuestions: [question("sec-upgrade-written-001", "DNS security", "single_choice")],
    practicalQuestions: [question("sec-upgrade-practical-001", "Logging and incident response", "LOG_ANALYSIS")],
  };
}

function question(id: string, concept: string, type: string) {
  return {
    id,
    concepts: [concept],
    type,
    difficulty: 3,
    prompt: "새로운 시나리오",
    choices: type === "single_choice" ? ["정답", "오답"] : [],
    answer_index: type === "single_choice" ? 0 : undefined,
    answer_outline: type === "single_choice" ? undefined : ["채점 기준"],
    explanation: "독립 작성 해설",
    source_refs: ["source-ref"],
  };
}

test("V3 concept map은 32개 canonical concept를 공식 기사 curriculum node에 연결한다", () => {
  assert.equal(concepts.length, 32);
  assert.equal(SECURITY_CONTENT_V3_SOURCE_COURSE_ID, "course-ise");
  assert.equal(
    SECURITY_CONTENT_V3_CONCEPT_MAP["DNS security"].curriculumNodeId,
    "curriculum-node-ise-2027-2029-01-03-01-04",
  );
  assert.equal(
    SECURITY_CONTENT_V3_CONCEPT_MAP["Email authentication"].subjectCode,
    "APPLICATION_SECURITY",
  );
  assert.equal(
    SECURITY_CONTENT_V3_CONCEPT_MAP["Risk management"].subjectCode,
    "SECURITY_LAW",
  );
});

test("V3 plan은 원본 ID를 유지하고 실기 provenance를 산업기사로 추정하지 않는다", () => {
  const plan = buildSecurityContentV3Plan(fixture());
  assert.equal(plan.contents.length, 32);
  assert.deepEqual(plan.questions.map((row) => row.id), [
    "sec-upgrade-written-001",
    "sec-upgrade-practical-001",
  ]);
  assert.equal(plan.questions[0].subjectId, "course-ise-subject-application_security");
  assert.equal(plan.questions[1].answerConfig.examTrack, "PRACTICAL");
  assert.ok(plan.ontologyEdges.every((edge) => edge.courseId === "course-ise"));
});

test("V3 SQL은 두 보안 자격 과정 밖의 Course를 쓰지 않고 연결 무결성을 보강한다", () => {
  for (const dialect of ["d1", "postgres"] as const) {
    const sql = generateSecurityContentV3Sql(fixture(), { dialect });
    assert.match(sql, /course-ise/);
    assert.match(sql, /course-isie/);
    assert.match(sql, /content_question_links/);
    assert.match(sql, /question_versions/);
    assert.match(sql, /ontology_concepts/);
    assert.match(sql, /ontology_edges/);
    for (const forbidden of [
      "course-isms-p",
      "course-isrm",
      "course-sw-vuln",
      "course-cppg",
      "course-pia",
    ]) {
      assert.equal(sql.includes(forbidden), false);
    }
  }
});

test("V3 runner는 source package에 쓰지 않고 임시 SQL만 사용한다", async () => {
  const runner = await readFile("scripts/security-content-upgrade-v3.mjs", "utf8");
  assert.match(runner, /readFile\(join\(root, "data", "normalized-knowledge-base\.json"\)/);
  assert.doesNotMatch(runner, /writeFile\(join\(root/);
  assert.match(runner, /mkdtemp\(join\(tmpdir\(\)/);
});

test("V3 intelligence plan은 gap 기반 기사/산업기사 이론과 문제를 분리한다", () => {
  const plan = buildSecurityContentIntelligenceV3Plan();
  assert.deepEqual(plan.sourceSummary, {
    contentCount: 18,
    questionCount: 27,
    writtenQuestionCount: 18,
    practicalQuestionCount: 9,
    courseIseContentCount: 10,
    courseIsieContentCount: 8,
  });
  assert.equal(plan.questions.filter((row) => row.courseId === "course-ise").length, 15);
  assert.equal(plan.questions.filter((row) => row.courseId === "course-isie").length, 12);
  assert.ok(plan.courseLessons.every((row) => row.curriculumNodeId.includes(row.courseId === "course-ise" ? "node-ise-" : "node-isie-")));
});

test("V3 intelligence 문제는 필기와 실기 품질 metadata를 갖는다", () => {
  const plan = buildSecurityContentIntelligenceV3Plan();
  const allowedTypes = new Set(["SINGLE_CHOICE", "CODE_ANALYSIS", "LOG_ANALYSIS", "CASE_ANALYSIS"]);
  for (const question of plan.questions) {
    assert.ok(allowedTypes.has(question.type));
    assert.ok(question.answerConfig.provenance.sourceRefs.length > 0);
    assert.equal(question.answerConfig.provenance.sourceTextImported, false);
    if (question.examTrack === "WRITTEN") {
      assert.equal(question.choices.length, 4);
      assert.equal(question.choices.filter((choice: { isCorrect: boolean }) => choice.isCorrect).length, 1);
      assert.ok(question.choices.filter((choice: { isCorrect: boolean }) => !choice.isCorrect).every((choice: { explanation: string }) => choice.explanation.length >= 6));
    } else {
      assert.ok(question.answerConfig.scoringPoints.length >= 3);
      assert.ok(question.answerConfig.expectedAnswer.length >= 80);
    }
  }
});

test("V3 intelligence 이론은 필수 설명 섹션과 canonical Concept를 연결한다", () => {
  const plan = buildSecurityContentIntelligenceV3Plan();
  for (const content of plan.contents) {
    const body = JSON.parse(content.body);
    for (const key of ["core", "mechanism", "threatDefense", "examPoints", "confusion", "practical", "writtenPoints", "practicalPoints", "relatedConcepts", "prerequisiteConcepts", "provenance"]) {
      assert.notEqual(body[key], undefined, `${content.id}:${key}`);
    }
    assert.ok(content.body.length >= 900);
    assert.ok(content.coreConcepts.length >= 2);
  }
});

test("V3 intelligence SQL은 canonical Concept와 사용자 이력을 변경하지 않는다", () => {
  for (const dialect of ["d1", "postgres"] as const) {
    const sql = generateSecurityContentIntelligenceV3Sql({ dialect });
    assert.match(sql, /course-ise/);
    assert.match(sql, /course-isie/);
    assert.doesNotMatch(sql, /INSERT INTO "ontology_concepts"/);
    assert.doesNotMatch(sql, /(INSERT INTO|UPDATE|DELETE FROM) "?(question_attempts|wrong_notes|bookmarks|user_progress|user_lesson_progress|user_course_lesson_progress|review_schedules)/);
    for (const forbidden of ["course-isms-p", "course-isrm", "course-sw-vuln", "course-cppg", "course-pia"]) assert.equal(sql.includes(forbidden), false);
    const deletes = sql.match(/DELETE FROM[\s\S]*?;/g) ?? [];
    assert.ok(deletes.length > 0);
    assert.ok(deletes.every((statement) => statement.includes("question_id") && statement.includes(" IN (")));
  }
});

test("V3 intelligence PostgreSQL connected dry-run은 명시적 승인 후에도 항상 rollback한다", async () => {
  const runner = await readFile("scripts/security-content-intelligence-v3.mjs", "utf8");
  assert.match(runner, /--confirm-connected-dry-run/);
  assert.match(runner, /SECURIUM_CONFIRM_SECURITY_CONTENT_V3_CONNECTED_DRY_RUN/);
  assert.match(runner, /ROLLBACK_SECURITY_CONTENT_V3/);
  assert.match(runner, /PASS_CONNECTED_ROLLBACK/);
  assert.match(runner, /await client\.unsafe\("ROLLBACK;"\)/);
  assert.match(runner, /PROTECTED_COURSE_CHANGED_AFTER_ROLLBACK/);
  assert.match(runner, /USER_DATA_CHANGED_AFTER_ROLLBACK/);
  assert.match(runner, /POSTGRES_VERIFY_URL \|\| process\.env\.DATABASE_URL/);
  assert.match(runner, /BLOCKED_REMOTE_SCHEMA_PREREQUISITE/);
  assert.match(runner, /transactionApplyAttempted: transactionStarted/);
  assert.match(runner, /generateSecurityContentV3Sql\(source, \{ dialect: "postgres", actorId \}\)/);
  assert.match(runner, /canonicalBootstrapIncluded: true/);
  assert.match(runner, /resolveContentActor/);
});

test("V3 intelligence PostgreSQL production apply는 이중 승인과 동일 SQL 해시를 요구한다", async () => {
  const runner = await readFile("scripts/security-content-intelligence-v3.mjs", "utf8");
  assert.match(runner, /--confirm-production-apply/);
  assert.match(runner, /SECURIUM_CONFIRM_SECURITY_CONTENT_V3_PRODUCTION_APPLY/);
  assert.match(runner, /SECURIUM_SECURITY_CONTENT_V3_SQL_SHA256/);
  assert.match(runner, /resolveContentActorForProduction/);
  assert.match(runner, /postgres-connected-dry-run\.json/);
  assert.match(runner, /connectedReport\.sqlSha256 !== sqlSha256/);
  assert.match(runner, /POSTGRES_MIGRATION_URL \|\| process\.env\.POSTGRES_SEED_URL \|\| process\.env\.DATABASE_URL \|\| process\.env\.DIRECT_URL/);
});
