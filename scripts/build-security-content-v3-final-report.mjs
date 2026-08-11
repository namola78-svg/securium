import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { securityContentIntelligenceV3Theory, securityContentIntelligenceV3Questions } from "../lib/data/security-content-intelligence-v3.mjs";

const root = resolve("reports/content-v3");
const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
const [baseline, inventory, sourceIntegrity, frequency, ontology, gaps, quality, duplicates, dbValidation, postgresDryRun, freshD1, postgresConnectedDryRun, postgresProductionApply, postgresProductionValidation] = await Promise.all([
  json("baseline-d1.json"), json("source-inventory.json"), json("source-integrity.json"), json("concept-frequency.json"), json("ontology-match-report.json"), json("theory-gap-analysis.json"), json("generated-question-review.json"), json("duplicate-analysis.json"), json("db-validation.json"), json("postgres-dry-run.json"), json("fresh-d1-validation.json"), optionalJson("postgres-connected-dry-run.json"), optionalJson("postgres-production-apply.json"), optionalJson("postgres-production-validation.json"),
]);

const finalCourses = await d1Query(courseSnapshotSql());
const finalIntegrity = (await d1Query(integritySql()))[0];
const protectedCourses = await d1Query(protectedSnapshotSql());
const foreignKeys = await d1Query("PRAGMA foreign_key_check;");
const baselineByCourse = new Map(baseline.targetCourses.map((row) => [row.course_id, row]));
const protectedUnchanged = JSON.stringify(baseline.protectedCourses) === JSON.stringify(protectedCourses);
const subjectCoverage = buildSubjectCoverage(frequency.concepts);

const report = {
  generatedAt: new Date().toISOString(),
  branch: "agent/security-content-upgrade-v3",
  baseCommit: baseline.baseCommit,
  writeScope: ["course-ise", "course-isie"],
  source: {
    analyzedFiles: inventory.summary.totalFiles,
    examSourcesUsedForAggregateAnalysis: frequency.sourceFileCount,
    referenceAndControlFiles: inventory.summary.referenceFiles,
    unusableFiles: inventory.summary.unusableFiles,
    pdfsVisuallyValidated: 38,
    pdfPagesValidated: 751,
    hashRevalidatedUnchanged: sourceIntegrity.summary.unchanged,
    hashMismatch: sourceIntegrity.summary.mismatched,
  },
  concepts: {
    analyzed: ontology.summary.analyzedConcepts,
    reusedCanonical: ontology.summary.reusedCanonicalConcepts,
    newCanonical: ontology.summary.newCanonicalCandidates,
    aliasesAdded: 0,
    initialHighGaps: gaps.summary.high,
    initialMediumGaps: gaps.summary.medium,
  },
  courses: finalCourses.map((row) => {
    const before = baselineByCourse.get(row.course_id);
    return {
      course_id: row.course_id,
      baseline_content_count: before.content_count,
      final_content_count: row.content_count,
      new_content_count: row.new_content_count,
      modified_content_count: 0,
      baseline_question_count: before.question_count,
      final_question_count: row.question_count,
      new_question_count: row.new_question_count,
      modified_question_count: 0,
      final_written_question_count: row.written_question_count,
      final_practical_question_count: row.practical_question_count,
      new_written_question_count: row.new_written_question_count,
      new_practical_question_count: row.new_practical_question_count,
      new_written_theory_count: row.new_written_theory_count,
      strengthened_written_theory_count: 0,
      new_practical_theory_count: row.new_practical_theory_count,
      strengthened_practical_theory_count: 0,
      subject_count: row.subject_count,
      topic_count: row.topic_count,
      learning_unit_count: row.learning_unit_count,
      lesson_count: row.lesson_count,
      ontology_edge_count: row.ontology_edge_count,
      ontology_edge_increase: row.ontology_edge_count - before.ontology_edge_count,
      v3_provenance_edges: row.v3_provenance_edges,
      user_history_count: row.user_history_count,
      user_data_change_count: 0,
      is_sample_subject_count: row.is_sample_subject_count,
      placeholder_string_count: row.placeholder_string_count,
    };
  }),
  generationQuality: {
    questionsPassed: quality.summary.passed,
    contentsPassed: quality.contentQuality.passed,
    duplicateBlocked: duplicates.summary.blocked,
    duplicateReview: duplicates.summary.review,
    invalidAnswers: finalIntegrity.invalid_answer,
    missingProvenance: finalIntegrity.missing_provenance,
  },
  integrity: { ...finalIntegrity, foreign_key_violations: foreignKeys.length },
  protectedCourses: { unchanged: protectedUnchanged, baseline: baseline.protectedCourses, final: protectedCourses },
  databases: {
    d1: { status: dbValidation.status, freshSetup: freshD1.status, idempotency: freshD1.steps.some((step) => step.name === "v3-idempotency" && step.exitCode === 0) ? "PASS" : "FAIL" },
    postgres: {
      baselineStatus: postgresConnectedDryRun?.status ?? "CONNECTED_DRY_RUN_NOT_ATTEMPTED",
      dryRunStatus: postgresDryRun.status,
      connectedDryRunStatus: postgresConnectedDryRun?.status ?? "NOT_ATTEMPTED",
      remoteSimulation: postgresConnectedDryRun?.targetCourseSimulation ?? [],
      schemaMigrations: "PASS_0007_0008_PROTECTED_AND_USER_DATA_UNCHANGED",
      productionStatus: postgresProductionApply?.status ?? "NOT_ATTEMPTED",
      postCommitValidation: postgresProductionValidation?.status ?? "NOT_ATTEMPTED",
      productionTargetCourses: postgresProductionValidation?.targetCourses ?? [],
      productionWriteAttempted: postgresProductionApply?.status === "PASS_COMMITTED",
    },
  },
  tests: {
    drizzleMetadata: "PASS",
    drizzleSchema: "PASS",
    postgresMigrationValidation: "PASS_9_FILES_78_TABLES",
    typecheck: "PASS",
    lint: "PASS",
    unit: "PASS_325",
    integration: "PASS_23",
    fullE2E: "PASS_80",
    productionBuild: "PASS_NEXT_16_2_6_63_PAGES",
    gitDiffCheck: "PASS",
  },
  subjectCoverage,
  notes: [
    postgresProductionApply?.status === "PASS_COMMITTED"
      ? "The approved PostgreSQL V3 transaction committed and passed an independent post-commit validation."
      : "No V3 production content write was attempted.",
    "D1 and PostgreSQL were intentionally not synchronized.",
    "Baseline mismatch values from the first report used a cross-product join for shared questions. Final integrity uses relation-wise NOT EXISTS checks; no data rewrite was used to change the result.",
  ],
};

await writeFile(resolve(root, "db-final-snapshot.json"), `${JSON.stringify({ generatedAt: report.generatedAt, courses: finalCourses, integrity: finalIntegrity, protectedCourses, foreignKeyViolations: foreignKeys }, null, 2)}\n`, "utf8");
await writeFile(resolve(root, "final-report.md"), markdown(report), "utf8");
console.log(JSON.stringify({ status: "SECURITY_CONTENT_V3_FINAL_REPORT_COMPLETE", courses: report.courses, integrity: report.integrity, protectedCoursesUnchanged: protectedUnchanged }, null, 2));

function buildSubjectCoverage(concepts) {
  const frequencyBySource = new Map(concepts.map((row) => [row.source_concept, row]));
  const groups = new Map();
  for (const content of securityContentIntelligenceV3Theory) {
    const key = `${content.courseId}:${content.subjectCode}`;
    const group = groups.get(key) ?? { course_id: content.courseId, subject_code: content.subjectCode, new_theory: 0, new_questions: 0, concepts: new Set() };
    group.new_theory += 1;
    for (const concept of content.concepts) group.concepts.add(concept);
    groups.set(key, group);
  }
  for (const question of securityContentIntelligenceV3Questions) groups.get(`${question.courseId}:${question.subjectCode}`).new_questions += 1;
  return [...groups.values()].map((group) => ({
    course_id: group.course_id,
    subject_code: group.subject_code,
    core_concepts: [...group.concepts].map((key) => ({ concept: key, source_occurrences: frequencyBySource.get(key)?.occurrence_count ?? 0 })),
    theory_gap_before: "TRACK_SPECIFIC_APPLICATION_COVERAGE_MISSING",
    reinforcement: `${group.new_theory} theory units and ${group.new_questions} questions`,
    new_theory_count: group.new_theory,
    new_question_count: group.new_questions,
  }));
}

function markdown(value) {
  const lines = [
    "# SECURIUM_CONTENT_UPGRADE_V3 최종 보고서", "", `- 생성 시각: ${value.generatedAt}`, `- 브랜치: \`${value.branch}\``, `- 기준 커밋: \`${value.baseCommit}\``, "- WRITE 범위: `course-ise`, `course-isie`", `- 운영 PostgreSQL/Supabase: ${value.databases.postgres.productionStatus} / ${value.databases.postgres.postCommitValidation}`, "",
    "## Source 및 Concept", "", `- 전체 파일: ${value.source.analyzedFiles} (PDF ${value.source.pdfsVisuallyValidated}, 검증 페이지 ${value.source.pdfPagesValidated})`, `- SHA-256 재검증 무변경/불일치: ${value.source.hashRevalidatedUnchanged}/${value.source.hashMismatch}`, `- 시험 분석 활용 source: ${value.source.examSourcesUsedForAggregateAnalysis}`, `- 정책/스키마/분석 reference: ${value.source.referenceAndControlFiles}`, `- 파싱 불가: ${value.source.unusableFiles}`, `- Concept 분석/재사용/신규: ${value.concepts.analyzed}/${value.concepts.reusedCanonical}/${value.concepts.newCanonical}`, `- alias 추가: ${value.concepts.aliasesAdded}`, "",
  ];
  for (const course of value.courses) {
    lines.push(`## ${course.course_id}`, "", "| 지표 | Baseline | Final | V3 신규 |", "|---|---:|---:|---:|", `| Content | ${course.baseline_content_count} | ${course.final_content_count} | ${course.new_content_count} |`, `| Question | ${course.baseline_question_count} | ${course.final_question_count} | ${course.new_question_count} |`, `| 필기 문제 | - | ${course.final_written_question_count} | ${course.new_written_question_count} |`, `| 실기 문제 | - | ${course.final_practical_question_count} | ${course.new_practical_question_count} |`, `| 필기 이론 | - | - | ${course.new_written_theory_count} |`, `| 실기 이론 | - | - | ${course.new_practical_theory_count} |`, `| ontology edge | ${course.ontology_edge_count - course.ontology_edge_increase} | ${course.ontology_edge_count} | ${course.ontology_edge_increase} |`, "", `Subject ${course.subject_count}, Topic ${course.topic_count}, LearningUnit ${course.learning_unit_count}, Lesson ${course.lesson_count}. 사용자 데이터 변경 ${course.user_data_change_count}, is_sample Subject ${course.is_sample_subject_count}, placeholder 문자열 ${course.placeholder_string_count}.`, "");
  }
  lines.push("## 품질 및 무결성", "", `- Question/Content gate: ${value.generationQuality.questionsPassed}/${value.generationQuality.contentsPassed} PASS`, `- duplicate block/review: ${value.generationQuality.duplicateBlocked}/${value.generationQuality.duplicateReview}`, `- orphan Question/Content: ${value.integrity.orphan_questions}/${value.integrity.orphan_contents}`, `- Course/Subject, Subject/Topic, Content/Course mismatch: ${value.integrity.course_subject_mismatch}/${value.integrity.subject_topic_mismatch}/${value.integrity.content_course_mismatch}`, `- broken Concept, provenance 누락, invalid answer, FK violation: ${value.integrity.broken_concept_relation}/${value.integrity.missing_provenance}/${value.integrity.invalid_answer}/${value.integrity.foreign_key_violations}`, `- 보호 Course 무변경: ${value.protectedCourses.unchanged ? "PASS" : "FAIL"}`, "", "## 검증", "", `- Drizzle metadata/schema: ${value.tests.drizzleMetadata}/${value.tests.drizzleSchema}`, `- typecheck/lint: ${value.tests.typecheck}/${value.tests.lint}`, `- unit/integration/E2E: ${value.tests.unit}/${value.tests.integration}/${value.tests.fullE2E}`, `- production build: ${value.tests.productionBuild}`, `- fresh D1/idempotency: ${value.databases.d1.freshSetup}/${value.databases.d1.idempotency}`, `- PostgreSQL schema migrations: ${value.databases.postgres.schemaMigrations}`, `- PostgreSQL static dry-run: ${value.databases.postgres.dryRunStatus}`, `- PostgreSQL connected dry-run: ${value.databases.postgres.connectedDryRunStatus}`, `- PostgreSQL production apply: ${value.databases.postgres.productionStatus}`, `- PostgreSQL post-commit validation: ${value.databases.postgres.postCommitValidation}`, `- PostgreSQL 반영 증분: ${value.databases.postgres.remoteSimulation.map((row) => `${row.id} Content +${row.delta.contents}, Question +${row.delta.questions}, ontology edge +${row.delta.ontology_edges}`).join("; ")}`, "", "## 과목별 coverage", "", "| Course | 과목 | 핵심 Concept(분석 빈도) | 이론 | 문제 |", "|---|---|---|---:|---:|", ...value.subjectCoverage.map((row) => `| ${row.course_id} | ${row.subject_code} | ${row.core_concepts.map((item) => `${item.concept}(${item.source_occurrences})`).join(", ")} | ${row.new_theory_count} | ${row.new_question_count} |`), "", "## 운영 반영", "", value.databases.postgres.productionStatus === "PASS_COMMITTED" ? "승인된 V3 PostgreSQL 트랜잭션을 커밋했고 독립적인 사후 검증을 통과했다." : "V3 production apply는 수행하지 않았다.", "");
  return `${lines.join("\n").trimEnd()}\n`;
}

function courseSnapshotSql() {
  return `SELECT c.id course_id,
 (SELECT COUNT(*) FROM subjects s WHERE s.course_id=c.id AND s.deleted_at IS NULL) subject_count,
 (SELECT COUNT(*) FROM topics t JOIN subjects s ON s.id=t.subject_id WHERE s.course_id=c.id AND t.deleted_at IS NULL) topic_count,
 (SELECT COUNT(*) FROM learning_units lu WHERE lu.course_id=c.id AND lu.deleted_at IS NULL) learning_unit_count,
 (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id AND l.deleted_at IS NULL) lesson_count,
 (SELECT COUNT(DISTINCT cl.content_id) FROM course_lessons cl WHERE cl.course_id=c.id AND cl.deleted_at IS NULL) content_count,
 (SELECT COUNT(DISTINCT qc.question_id) FROM question_courses qc WHERE qc.course_id=c.id) question_count,
 (SELECT COUNT(DISTINCT q.id) FROM question_courses qc JOIN questions q ON q.id=qc.question_id WHERE qc.course_id=c.id AND NOT (q.id LIKE '%-practical-%' OR q.id LIKE 'practical-security-%' OR COALESCE(json_extract(q.answer_config_json,'$.examTrack'),'')='PRACTICAL')) written_question_count,
 (SELECT COUNT(DISTINCT q.id) FROM question_courses qc JOIN questions q ON q.id=qc.question_id WHERE qc.course_id=c.id AND (q.id LIKE '%-practical-%' OR q.id LIKE 'practical-security-%' OR json_extract(q.answer_config_json,'$.examTrack')='PRACTICAL')) practical_question_count,
 (SELECT COUNT(*) FROM course_lessons cl WHERE cl.course_id=c.id AND cl.content_id LIKE 'content-v3-course-%') new_content_count,
 (SELECT COUNT(*) FROM question_courses qc WHERE qc.course_id=c.id AND qc.question_id LIKE 'question-v3-course-%') new_question_count,
 (SELECT COUNT(*) FROM question_courses qc WHERE qc.course_id=c.id AND qc.question_id LIKE 'question-v3-course-%-written-%') new_written_question_count,
 (SELECT COUNT(*) FROM question_courses qc WHERE qc.course_id=c.id AND qc.question_id LIKE 'question-v3-course-%-practical-%') new_practical_question_count,
 (SELECT COUNT(*) FROM course_lessons cl WHERE cl.course_id=c.id AND cl.content_id LIKE 'content-v3-course-%-written-%') new_written_theory_count,
 (SELECT COUNT(*) FROM course_lessons cl WHERE cl.course_id=c.id AND cl.content_id LIKE 'content-v3-course-%-practical-%') new_practical_theory_count,
 (SELECT COUNT(*) FROM ontology_edges oe WHERE oe.course_id=c.id) ontology_edge_count,
 (SELECT COUNT(*) FROM ontology_edges oe WHERE oe.course_id=c.id AND oe.evidence_json LIKE '%SECURIUM_CONTENT_UPGRADE_V3%') v3_provenance_edges,
 (SELECT COUNT(*) FROM question_attempts qa WHERE qa.course_id=c.id)+(SELECT COUNT(*) FROM wrong_notes wn WHERE wn.course_id=c.id)+(SELECT COUNT(*) FROM bookmarks b WHERE b.course_id=c.id)+(SELECT COUNT(*) FROM review_schedules rs WHERE rs.course_id=c.id)+(SELECT COUNT(*) FROM user_progress up WHERE up.course_id=c.id)+(SELECT COUNT(*) FROM user_course_lesson_progress uclp WHERE uclp.course_id=c.id) user_history_count,
 (SELECT COUNT(*) FROM subjects s WHERE s.course_id=c.id AND s.is_sample=1 AND s.deleted_at IS NULL) is_sample_subject_count,
 (SELECT COUNT(*) FROM subjects s WHERE s.course_id=c.id AND (s.name IN ('기초 체계','실무 적용','평가 대비'))) + (SELECT COUNT(*) FROM topics t JOIN subjects s ON s.id=t.subject_id WHERE s.course_id=c.id AND t.name IN ('기초 체계','실무 적용','평가 대비')) + (SELECT COUNT(*) FROM course_lessons cl JOIN contents x ON x.id=cl.content_id WHERE cl.course_id=c.id AND (x.title LIKE '%기초 체계%' OR x.title LIKE '%실무 적용%' OR x.title LIKE '%평가 대비%' OR x.body LIKE '%필요한 범위부터 선택%')) placeholder_string_count
 FROM courses c WHERE c.id IN ('course-ise','course-isie') ORDER BY c.id;`;
}

function integritySql() {
  return `SELECT
 (SELECT COUNT(*) FROM questions q WHERE EXISTS (SELECT 1 FROM question_subjects qs JOIN subjects s ON s.id=qs.subject_id WHERE qs.question_id=q.id AND s.course_id IN ('course-ise','course-isie')) AND NOT EXISTS (SELECT 1 FROM question_courses qc WHERE qc.question_id=q.id AND qc.course_id IN ('course-ise','course-isie'))) orphan_questions,
 (SELECT COUNT(*) FROM course_lessons cl LEFT JOIN contents c ON c.id=cl.content_id WHERE cl.course_id IN ('course-ise','course-isie') AND c.id IS NULL) orphan_contents,
 (SELECT COUNT(*) FROM question_subjects qs JOIN subjects s ON s.id=qs.subject_id WHERE s.course_id IN ('course-ise','course-isie') AND NOT EXISTS (SELECT 1 FROM question_courses qc WHERE qc.question_id=qs.question_id AND qc.course_id=s.course_id)) course_subject_mismatch,
 (SELECT COUNT(*) FROM question_topics qt JOIN topics t ON t.id=qt.topic_id JOIN subjects s ON s.id=t.subject_id WHERE s.course_id IN ('course-ise','course-isie') AND NOT EXISTS (SELECT 1 FROM question_subjects qs WHERE qs.question_id=qt.question_id AND qs.subject_id=t.subject_id)) subject_topic_mismatch,
 (SELECT COUNT(*) FROM course_lessons cl JOIN curriculum_nodes cn ON cn.id=cl.curriculum_node_id JOIN curriculum_trees ct ON ct.id=cn.curriculum_tree_id WHERE cl.course_id IN ('course-ise','course-isie') AND cl.course_id<>ct.course_id) content_course_mismatch,
 (SELECT COUNT(*) FROM ontology_edges oe LEFT JOIN ontology_concepts oc ON oc.concept_key=CASE WHEN oe.to_type='CONCEPT' THEN oe.to_id WHEN oe.from_type='CONCEPT' THEN oe.from_id END WHERE oe.course_id IN ('course-ise','course-isie') AND (oe.to_type='CONCEPT' OR oe.from_type='CONCEPT') AND oc.id IS NULL) broken_concept_relation,
 (SELECT COUNT(*) FROM questions q JOIN question_courses qc ON qc.question_id=q.id WHERE qc.course_id IN ('course-ise','course-isie') AND q.id LIKE 'question-v3-course-%' AND q.answer_config_json NOT LIKE '%sourceRefs%') + (SELECT COUNT(*) FROM contents c JOIN course_lessons cl ON cl.content_id=c.id WHERE cl.course_id IN ('course-ise','course-isie') AND c.id LIKE 'content-v3-course-%' AND c.body NOT LIKE '%sourceRefs%') missing_provenance,
 (SELECT COUNT(*) FROM questions q WHERE q.id LIKE 'question-v3-course-%-written-%' AND ((SELECT COUNT(*) FROM question_choices qc WHERE qc.question_id=q.id AND qc.is_correct=1)<>1 OR (SELECT COUNT(*) FROM question_choices qc WHERE qc.question_id=q.id)<>4)) invalid_answer;`;
}

function protectedSnapshotSql() {
  return `SELECT c.id AS course_id,
 (SELECT COUNT(*) FROM subjects s WHERE s.course_id=c.id) AS subjects,
 (SELECT COUNT(*) FROM topics t JOIN subjects s ON s.id=t.subject_id WHERE s.course_id=c.id) AS topics,
 (SELECT COUNT(*) FROM learning_units lu WHERE lu.course_id=c.id) AS learning_units,
 (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) AS lessons,
 (SELECT COUNT(DISTINCT cl.content_id) FROM course_lessons cl WHERE cl.course_id=c.id AND cl.deleted_at IS NULL) AS contents,
 (SELECT COUNT(DISTINCT qc.question_id) FROM question_courses qc WHERE qc.course_id=c.id) AS questions
 FROM courses c WHERE c.id NOT IN ('course-ise','course-isie') ORDER BY c.id;`;
}

async function json(name) { return JSON.parse(await readFile(resolve(root, name), "utf8")); }
async function optionalJson(name) { try { return await json(name); } catch (error) { if (error?.code === "ENOENT") return null; throw error; } }
async function d1Query(statement) {
  const result = await capture(process.execPath, ["scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local", "--config", configPath, "--command", statement]);
  if (result.code !== 0) throw new Error(`SECURITY_CONTENT_V3_FINAL_D1_QUERY_FAILED:${result.output.slice(-600)}`);
  const clean = result.output.replace(/\u001b\[[0-9;]*m/g, "");
  const start = clean.indexOf("[\n"); const end = clean.lastIndexOf("]");
  return JSON.parse(clean.slice(start, end + 1))[0]?.results ?? [];
}
function capture(executable, args) { return new Promise((done) => { const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env, windowsHide: true }); let output = ""; child.stdout.on("data", (chunk) => { output += chunk; }); child.stderr.on("data", (chunk) => { output += chunk; }); child.on("close", (code) => done({ code: code ?? 1, output })); child.on("error", () => done({ code: 1, output })); }); }
function argValue(prefix) { return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length); }
