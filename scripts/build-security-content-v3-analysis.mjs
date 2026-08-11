import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { basename, extname, join, relative, resolve } from "node:path";
import {
  SECURITY_CONTENT_V3_CONCEPT_MAP,
} from "../lib/data/security-content-upgrade-v3.mjs";
import {
  buildSecurityCertificationOntologyConcepts,
} from "../lib/curriculum/security-certification-ontology.ts";
import {
  officialSecurityCertificationContents,
  officialSecurityCertificationCourseLessons,
} from "../lib/data/security-certification-course-lessons.mjs";

const sourceRoot = resolve(
  argValue("--source-root=") ||
    process.env.SECURIUM_CONTENT_V2_SOURCE_ROOT ||
    "securium-content-upgrade-v2",
);
const outputRoot = resolve("reports/content-v3");
const configPath = argValue("--config=") || "wrangler.local.jsonc";

if (!existsSync(sourceRoot)) throw new Error("SECURITY_CONTENT_V3_SOURCE_ROOT_MISSING");
await mkdir(outputRoot, { recursive: true });

const [sourceFileInventory, sourceExtraction, normalizedKb] = await Promise.all([
  readJson(join(sourceRoot, "data", "source-file-inventory.json")),
  readJson(join(sourceRoot, "reports", "source-text-extraction.json")),
  readJson(join(sourceRoot, "data", "normalized-knowledge-base.json")),
]);
const legacyFileMetadata = new Map(
  (sourceFileInventory.files ?? []).map((file) => [normalizePath(file.path), file]),
);
const extractedTextByFile = sourceExtraction.files ?? {};

const sourceInventory = await buildSourceInventory();
const sourceProvenance = buildSourceProvenance(sourceInventory);
const d1Baseline = await buildD1Baseline();
const postgresBaseline = buildPostgresBaseline();
const conceptFrequency = buildConceptFrequency(sourceInventory);
const d1OntologyConcepts = await queryD1OntologyConcepts();
const ontologyMatchReport = buildOntologyMatchReport(d1OntologyConcepts);
const d1QuestionRows = await queryD1Questions();
const theoryCoverage = buildTheoryCoverage(conceptFrequency, d1QuestionRows);
const theoryGapAnalysis = buildTheoryGapAnalysis(theoryCoverage);
const questionGenerationPlan = buildQuestionGenerationPlan(theoryGapAnalysis);

await Promise.all([
  writeJson("source-inventory.json", {
    generatedAt: new Date().toISOString(),
    sourceRoot,
    summary: summarizeInventory(sourceInventory),
    files: sourceInventory,
  }),
  writeJson("source-provenance.json", {
    generatedAt: new Date().toISOString(),
    policy: "REFERENCE_ONLY_NO_VERBATIM_IMPORT",
    records: sourceProvenance,
  }),
  writeJson("baseline-d1.json", d1Baseline),
  writeJson("baseline-postgres.json", postgresBaseline),
  writeJson("concept-frequency.json", conceptFrequency),
  writeJson("ontology-match-report.json", ontologyMatchReport),
  writeJson("theory-coverage.json", theoryCoverage),
  writeJson("theory-gap-analysis.json", theoryGapAnalysis),
  writeJson("question-generation-plan.json", questionGenerationPlan),
]);

console.log(
  JSON.stringify(
    {
      status: "SECURITY_CONTENT_V3_ANALYSIS_COMPLETE",
      sourceFiles: sourceInventory.length,
      provenanceRecords: sourceProvenance.length,
      concepts: conceptFrequency.concepts.length,
      ontologyReused: ontologyMatchReport.summary.reusedCanonicalConcepts,
      ontologyNewCandidates: ontologyMatchReport.summary.newCanonicalCandidates,
      theoryGaps: theoryGapAnalysis.summary.totalGaps,
      plannedContents: questionGenerationPlan.summary.plannedTheoryContents,
      plannedQuestions: questionGenerationPlan.summary.plannedQuestions,
      postgresBaseline: postgresBaseline.status,
    },
    null,
    2,
  ),
);

async function buildSourceInventory() {
  const paths = await walk(sourceRoot);
  const rows = [];
  for (const path of paths) {
    const relativePath = normalizePath(relative(sourceRoot, path));
    const info = await stat(path);
    const extension = extname(path).toLowerCase();
    const legacy = legacyFileMetadata.get(relativePath) ?? legacyFileMetadata.get(basename(path));
    const classification = classifySourceFile(relativePath, extension, legacy);
    rows.push({
      source_file: relativePath,
      source_type: sourceType(extension),
      detected_title: basename(path, extension),
      target_course_candidate: classification.targetCourse,
      exam_type: classification.examType,
      written_or_practical: classification.track,
      year: classification.year,
      round: classification.round,
      subject: classification.subject,
      source_location:
        extension === ".pdf"
          ? `pages 1-${legacy?.pages ?? "unknown"}`
          : "whole file",
      confidence: classification.confidence,
      parsing_status: legacy?.status ?? (isControlFile(relativePath) ? "REFERENCE_ONLY" : "DISCOVERED"),
      usable: classification.usable,
      sha256: await sha256(path),
      size_bytes: info.size,
      pages: extension === ".pdf" ? legacy?.pages ?? null : null,
      text_extracted: legacy?.textExtracted ?? Boolean(extractedTextByFile[relativePath] ?? extractedTextByFile[basename(path)]),
      notes: classification.notes,
    });
  }
  return rows.sort((a, b) => a.source_file.localeCompare(b.source_file));
}

function classifySourceFile(relativePath, extension, legacy) {
  const name = basename(relativePath);
  const year = Number(name.match(/(?:19|20)\d{2}/)?.[0]) || null;
  const round = Number(name.match(/(?:제|_|\s)(\d{1,2})(?:회|회차)/)?.[1]) || null;
  if (name === "2022 2회차 산업기사 필기.pdf") {
    return classification("course-isie", "WRITTEN", "written", year, 2, "mixed", 1, true, "시험명이 명시된 산업기사 필기 원천");
  }
  if (name === "2026 정보보안기사 올인원_구매인증 이벤트 자료.pdf") {
    return classification("course-ise", "MIXED", "mixed", 2026, null, "mixed", 1, true, "정보보안기사 이론·필기·실기 복합 원천");
  }
  if (name === "정보보안기사 실기 기출.txt") {
    return classification("course-ise", "PRACTICAL", "practical", null, null, "정보보안 실무", 1, true, "정보보안기사 실기 단답·서술·실무형 원천");
  }
  if (extension === ".pdf" && /정보보안기사|보안기사/.test(name)) {
    return classification("course-ise", "WRITTEN", "written", year, round, "mixed", 0.98, true, "시험명이 명시된 정보보안기사 필기 원천");
  }
  if (isControlFile(relativePath)) {
    return classification(null, "REFERENCE", "reference", year, round, null, 1, true, "분석 정책·스키마·파생 데이터 참조 파일");
  }
  if ([".json", ".md", ".py", ".ts"].includes(extension)) {
    return classification(null, "REFERENCE", "reference", year, round, null, 0.95, true, "V2 분석 산출물 또는 도구; 서비스 콘텐츠 직접 import 금지");
  }
  return classification(null, legacy?.classification ?? "UNKNOWN", "unknown", year, round, null, 0.3, false, "자동 분류 근거 부족; review 대상");
}

function classification(targetCourse, examType, track, year, round, subject, confidence, usable, notes) {
  return { targetCourse, examType, track, year, round, subject, confidence, usable, notes };
}

function buildSourceProvenance(inventory) {
  return inventory.map((file) => {
    const legacy = legacyFileMetadata.get(file.source_file) ?? legacyFileMetadata.get(basename(file.source_file));
    return {
      provenance_id: `source:${slug(file.source_file)}`,
      source_file: file.source_file,
      source_type: file.source_type,
      source_year: file.year,
      source_round: file.round,
      source_location: file.source_location,
      target_course: file.target_course_candidate,
      written_or_practical: file.written_or_practical,
      subject: file.subject,
      topic_candidate: file.subject === "mixed" ? "multi-topic" : file.subject,
      concept_candidates: legacy?.concepts ?? [],
      question_pattern: inferQuestionPattern(file),
      difficulty: inferSourceDifficulty(file),
      confidence: file.confidence,
      automatic_db_eligible:
        Boolean(file.target_course_candidate) &&
        file.confidence >= 0.9 &&
        ["written", "practical", "mixed"].includes(file.written_or_practical),
      policy: "CONCEPT_AND_PATTERN_REFERENCE_ONLY",
    };
  });
}

function buildConceptFrequency(inventory) {
  const examSources = inventory.filter(
    (file) => file.usable && ["WRITTEN", "PRACTICAL", "MIXED"].includes(file.exam_type),
  );
  const concepts = Object.entries(SECURITY_CONTENT_V3_CONCEPT_MAP).map(
    ([sourceConcept, mapping]) => {
      const aliases = unique([sourceConcept, mapping.label, ...mapping.aliases]);
      const sourceOccurrences = [];
      for (const file of examSources) {
        const text = extractedTextByFile[file.source_file] ?? extractedTextByFile[basename(file.source_file)] ?? "";
        const count = aliases.reduce((total, alias) => total + countOccurrences(text, alias), 0);
        if (count > 0) {
          sourceOccurrences.push({
            source_file: file.source_file,
            target_course: file.target_course_candidate,
            track: file.written_or_practical,
            year: file.year,
            count,
          });
        }
      }
      return {
        concept: mapping.label,
        source_concept: sourceConcept,
        aliases,
        subject_code: mapping.subjectCode,
        occurrence_count: sum(sourceOccurrences.map((row) => row.count)),
        source_file_count: sourceOccurrences.length,
        written_occurrence_count: sum(sourceOccurrences.filter((row) => row.track === "written").map((row) => row.count)),
        practical_occurrence_count: sum(sourceOccurrences.filter((row) => row.track === "practical").map((row) => row.count)),
        mixed_occurrence_count: sum(sourceOccurrences.filter((row) => row.track === "mixed").map((row) => row.count)),
        course_ise_occurrence_count: sum(sourceOccurrences.filter((row) => row.target_course === "course-ise").map((row) => row.count)),
        course_isie_occurrence_count: sum(sourceOccurrences.filter((row) => row.target_course === "course-isie").map((row) => row.count)),
        latest_year: Math.max(0, ...sourceOccurrences.map((row) => row.year ?? 0)) || null,
        recent: sourceOccurrences.some((row) => (row.year ?? 0) >= 2022),
        source_occurrences: sourceOccurrences,
      };
    },
  );
  return {
    generatedAt: new Date().toISOString(),
    method: "case-insensitive alias occurrence count over extracted source text; mixed documents are reported separately",
    sourceFileCount: examSources.length,
    concepts: concepts.sort((a, b) => b.occurrence_count - a.occurrence_count),
  };
}

function buildOntologyMatchReport(d1Concepts = []) {
  const existing = [
    ...buildSecurityCertificationOntologyConcepts(),
    ...d1Concepts.map((concept) => ({
      key: concept.concept_key,
      label: concept.label,
      aliases: concept.aliases,
      origin: "D1_BASELINE",
    })),
  ];
  const matches = Object.entries(SECURITY_CONTENT_V3_CONCEPT_MAP).map(
    ([sourceConcept, mapping]) => {
      const lookups = unique([sourceConcept, mapping.label, ...mapping.aliases].map(normalize));
      const candidates = existing.filter((concept) =>
        [concept.label, ...concept.aliases].map(normalize).some((value) => lookups.includes(value)),
      );
      return {
        source_concept: sourceConcept,
        preferred_label: mapping.label,
        match_status: candidates.length ? "REUSE_EXISTING" : "NEW_CANDIDATE_REVIEW_REQUIRED",
        matched_concept_keys: candidates.map((concept) => concept.key),
        matched_labels: candidates.map((concept) => concept.label),
        matched_origins: unique(candidates.map((concept) => concept.origin ?? "REPOSITORY_CANONICAL")),
        aliases_to_add: candidates.length ? unique([sourceConcept, ...mapping.aliases]).filter((alias) => !candidates.some((candidate) => [candidate.label, ...candidate.aliases].map(normalize).includes(normalize(alias)))) : [],
        confidence: candidates.length ? 1 : 0.65,
      };
    },
  );
  return {
    generatedAt: new Date().toISOString(),
    namespace: "security-certification",
    summary: {
      analyzedConcepts: matches.length,
      reusedCanonicalConcepts: matches.filter((row) => row.match_status === "REUSE_EXISTING").length,
      newCanonicalCandidates: matches.filter((row) => row.match_status !== "REUSE_EXISTING").length,
      aliasesToAdd: sum(matches.map((row) => row.aliases_to_add.length)),
    },
    matches,
  };
}

function buildTheoryCoverage(frequency, questionRows) {
  const contents = officialSecurityCertificationContents;
  const courseLessons = officialSecurityCertificationCourseLessons;
  const contentById = new Map(contents.map((content) => [content.id, content]));
  const rows = [];
  for (const courseId of ["course-ise", "course-isie"]) {
    const courseContentIds = new Set(
      courseLessons.filter((lesson) => lesson.courseId === courseId).map((lesson) => lesson.contentId),
    );
    if (courseId === "course-ise") {
      for (const lesson of normalizedKb.lessons) courseContentIds.add(lesson.id);
    }
    for (const conceptRow of frequency.concepts) {
      const mapping = SECURITY_CONTENT_V3_CONCEPT_MAP[conceptRow.source_concept];
      const lookups = unique([conceptRow.source_concept, mapping.label, ...mapping.aliases].map(normalize));
      const matchedContents = [...courseContentIds].filter((contentId) => {
        const content = contentById.get(contentId) ?? normalizedKb.lessons.find((lesson) => lesson.id === contentId);
        if (!content) return false;
        const haystack = normalize([
          content.title,
          content.summary,
          ...(content.coreConcepts ?? content.concepts ?? []),
          content.body,
          content.overview,
        ].filter(Boolean).join(" "));
        return lookups.some((lookup) => haystack.includes(lookup));
      });
      const practicalContentIds = matchedContents.filter((contentId) =>
        courseLessons.some(
          (lesson) =>
            lesson.courseId === courseId &&
            lesson.contentId === contentId &&
            lesson.curriculumNodeId.includes("-02-01"),
        ),
      );
      const conceptQuestions = questionRows.filter((question) => {
        if (question.course_id !== courseId) return false;
        const text = normalize(`${question.title} ${question.content}`);
        return lookups.some((lookup) => text.includes(lookup));
      });
      const completeness = completenessScore(matchedContents.map((id) => contentById.get(id) ?? normalizedKb.lessons.find((lesson) => lesson.id === id)).filter(Boolean));
      rows.push({
        course_id: courseId,
        concept: mapping.label,
        source_concept: conceptRow.source_concept,
        subject_code: mapping.subjectCode,
        source_occurrence_count: courseId === "course-ise" ? conceptRow.course_ise_occurrence_count : conceptRow.course_isie_occurrence_count,
        written_occurrence_count: conceptRow.written_occurrence_count,
        practical_occurrence_count: conceptRow.practical_occurrence_count,
        recent: conceptRow.recent,
        lesson_exists: matchedContents.length > 0,
        content_exists: matchedContents.length > 0,
        content_count: matchedContents.length,
        practical_theory_content_count: practicalContentIds.length,
        question_count: conceptQuestions.length,
        practical_question_count: conceptQuestions.filter(isPracticalQuestion).length,
        theory_completeness: completeness,
        prerequisite_coverage: completeness >= 70 ? "ADEQUATE" : completeness >= 40 ? "PARTIAL" : "MISSING",
        matched_content_ids: matchedContents,
      });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    method: "canonical alias match against current official CourseLesson content plus D1 question bank",
    rows,
  };
}

function buildTheoryGapAnalysis(coverage) {
  const gaps = coverage.rows.map((row) => {
    let score = 0;
    if (!row.content_exists) score += 45;
    if (row.theory_completeness < 60) score += 20;
    if (row.practical_occurrence_count > 0 && row.practical_theory_content_count === 0) score += 20;
    if (row.question_count === 0) score += 10;
    if (row.practical_occurrence_count > 0 && row.practical_question_count === 0) score += 10;
    if (row.recent) score += 5;
    return {
      ...row,
      gap_score: Math.min(100, score),
      gap_severity: score >= 60 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW",
      recommended_action:
        score >= 60
          ? "CREATE_TRACK_SPECIFIC_THEORY_AND_QUESTIONS"
          : score >= 30
            ? "ENRICH_THEORY_AND_ADD_MISSING_PATTERN"
            : "REUSE_AND_LINK_EXISTING",
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalGaps: gaps.filter((row) => row.gap_severity !== "LOW").length,
      high: gaps.filter((row) => row.gap_severity === "HIGH").length,
      medium: gaps.filter((row) => row.gap_severity === "MEDIUM").length,
      low: gaps.filter((row) => row.gap_severity === "LOW").length,
    },
    gaps: gaps.sort((a, b) => b.gap_score - a.gap_score),
  };
}

function buildQuestionGenerationPlan(gapAnalysis) {
  const plannedTheory = [
    ...writtenTheoryPlans(),
    ...practicalTheoryPlans(),
  ];
  const questionPlans = questionPlansFromCoverage();
  return {
    generatedAt: new Date().toISOString(),
    derivation: "one focused theory unit per official subject/practical area, plus only uncovered reasoning patterns identified from source and current D1 coverage",
    summary: {
      plannedTheoryContents: plannedTheory.length,
      plannedQuestions: questionPlans.length,
      courseIseTheory: plannedTheory.filter((row) => row.target_course === "course-ise").length,
      courseIsieTheory: plannedTheory.filter((row) => row.target_course === "course-isie").length,
      courseIseQuestions: questionPlans.filter((row) => row.target_course === "course-ise").length,
      courseIsieQuestions: questionPlans.filter((row) => row.target_course === "course-isie").length,
      reviewQueue: gapAnalysis.gaps.filter((row) => row.gap_severity === "HIGH" && row.source_occurrence_count === 0).length,
    },
    theory_plan: plannedTheory,
    question_plan: questionPlans,
  };
}

function writtenTheoryPlans() {
  const rows = [
    ["course-ise", "SYSTEM_SECURITY", "시스템 권한·감사 증거 기반 판단", ["Linux 보안", "Windows 보안", "감사 및 책임추적성"]],
    ["course-ise", "NETWORK_SECURITY", "프로토콜·경계 장비 복합 판단", ["TLS", "IDS/IPS", "방화벽 및 WAF"]],
    ["course-ise", "APPLICATION_SECURITY", "웹·API 입력 및 세션 보안 판단", ["SQL Injection", "XSS/CSRF", "웹 및 API 보안"]],
    ["course-ise", "SECURITY_FOUNDATION", "암호·인증·접근통제 비교 판단", ["암호 알고리즘", "인증", "접근통제"]],
    ["course-ise", "SECURITY_LAW", "위험·거버넌스·사고대응 근거 판단", ["위험관리", "정보보호 관리 및 법규", "BCP 및 재해복구"]],
    ["course-isie", "SYSTEM_SECURITY", "기본 계정·권한·로그 점검", ["Linux 보안", "Windows 보안"]],
    ["course-isie", "NETWORK_SECURITY", "기본 네트워크 공격과 보안장비 구분", ["서비스 거부", "ARP Spoofing", "IDS/IPS"]],
    ["course-isie", "APPLICATION_SECURITY", "기본 서비스·입력값 보안", ["DNS", "SQL Injection", "XSS/CSRF"]],
    ["course-isie", "SECURITY_FOUNDATION", "기본 암호·인증·해시 적용", ["인증", "해시함수", "디지털서명 및 PKI"]],
  ];
  return rows.map(([target_course, subject_code, title, concepts]) => ({ target_course, track: "WRITTEN", subject_code, title, concepts, action: "CREATE_COURSE_TRACK_SPECIFIC_CONTENT" }));
}

function practicalTheoryPlans() {
  const rows = [
    ["course-ise", "02-01-01", "복합 시스템·네트워크 보안특성 분석", ["네트워크 구조와 OSI", "가상화 및 클라우드 보안"]],
    ["course-ise", "02-01-02", "취약 코드·설정 진단과 보완", ["취약점 관리", "SQL Injection", "명령어 및 코드 인젝션"]],
    ["course-ise", "02-01-03", "로그 타임라인·침해사고 대응", ["로그 분석 및 침해 대응", "디지털 포렌식"]],
    ["course-ise", "02-01-04", "위험평가와 보호대책 이행계획", ["위험관리", "감사 및 책임추적성"]],
    ["course-ise", "02-01-05", "최신 위협의 운영 영향 평가", ["EDR", "악성코드 및 랜섬웨어"]],
    ["course-isie", "02-01-01", "기본 시스템·프로토콜 보안특성 확인", ["Linux 보안", "TLS", "DNS"]],
    ["course-isie", "02-01-02", "기본 보안설정 점검과 보완", ["취약점 관리", "방화벽 및 WAF"]],
    ["course-isie", "02-01-03", "기본 로그 판별과 초동 대응", ["로그 분석 및 침해 대응", "IDS/IPS"]],
    ["course-isie", "02-01-04", "최신 보안 동향의 기본 적용", ["EDR", "이메일 인증"]],
  ];
  return rows.map(([target_course, node_suffix, title, concepts]) => ({ target_course, track: "PRACTICAL", curriculum_node_suffix: node_suffix, title, concepts, action: "CREATE_COURSE_TRACK_SPECIFIC_CONTENT" }));
}

function questionPlansFromCoverage() {
  const plans = [];
  for (const row of writtenTheoryPlans()) {
    plans.push(
      { target_course: row.target_course, track: "WRITTEN", subject_code: row.subject_code, pattern: "CONCEPT_COMPARISON", difficulty: row.target_course === "course-ise" ? "HARD" : "MEDIUM", concepts: row.concepts },
      { target_course: row.target_course, track: "WRITTEN", subject_code: row.subject_code, pattern: "SCENARIO_DECISION", difficulty: row.target_course === "course-ise" ? "HARD" : "MEDIUM", concepts: row.concepts },
    );
  }
  for (const row of practicalTheoryPlans()) {
    plans.push({ target_course: row.target_course, track: "PRACTICAL", curriculum_node_suffix: row.curriculum_node_suffix, pattern: practicalPattern(row.curriculum_node_suffix), difficulty: row.target_course === "course-ise" ? "HARD" : "MEDIUM", concepts: row.concepts });
  }
  return plans;
}

function practicalPattern(nodeSuffix) {
  if (nodeSuffix.endsWith("02")) return "CONFIG_OR_CODE_ANALYSIS";
  if (nodeSuffix.endsWith("03")) return "LOG_AND_INCIDENT_ANALYSIS";
  if (nodeSuffix.endsWith("04")) return "RISK_OR_TREND_DECISION";
  if (nodeSuffix.endsWith("05")) return "THREAT_TREND_OPERATION_DECISION";
  return "ARCHITECTURE_AND_PROTOCOL_ANALYSIS";
}

async function buildD1Baseline() {
  const targetRows = await d1Query(`
SELECT c.id AS course_id,
 (SELECT COUNT(*) FROM subjects s WHERE s.course_id=c.id AND s.deleted_at IS NULL) AS subject_count,
 (SELECT COUNT(*) FROM topics t JOIN subjects s ON s.id=t.subject_id WHERE s.course_id=c.id AND t.deleted_at IS NULL) AS topic_count,
 (SELECT COUNT(*) FROM learning_units lu WHERE lu.course_id=c.id AND lu.deleted_at IS NULL) AS learning_unit_count,
 (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id AND l.deleted_at IS NULL) AS lesson_count,
 (SELECT COUNT(DISTINCT cl.content_id) FROM course_lessons cl WHERE cl.course_id=c.id AND cl.deleted_at IS NULL) AS content_count,
 (SELECT COUNT(DISTINCT qc.question_id) FROM question_courses qc WHERE qc.course_id=c.id) AS question_count,
 (SELECT COUNT(DISTINCT q.id) FROM question_courses qc JOIN questions q ON q.id=qc.question_id WHERE qc.course_id=c.id AND NOT (q.id LIKE 'sec-upgrade-practical-%' OR q.id LIKE 'practical-security-%' OR COALESCE(json_extract(q.answer_config_json,'$.examTrack'),'')='PRACTICAL')) AS written_question_count,
 (SELECT COUNT(DISTINCT q.id) FROM question_courses qc JOIN questions q ON q.id=qc.question_id WHERE qc.course_id=c.id AND (q.id LIKE 'sec-upgrade-practical-%' OR q.id LIKE 'practical-security-%' OR json_extract(q.answer_config_json,'$.examTrack')='PRACTICAL')) AS practical_question_count,
 (SELECT COUNT(*) FROM ontology_edges oe WHERE oe.course_id=c.id) AS ontology_edge_count,
 (SELECT COUNT(*) FROM question_attempts qa WHERE qa.course_id=c.id)+(SELECT COUNT(*) FROM wrong_notes wn WHERE wn.course_id=c.id)+(SELECT COUNT(*) FROM bookmarks b WHERE b.course_id=c.id)+(SELECT COUNT(*) FROM review_schedules rs WHERE rs.course_id=c.id)+(SELECT COUNT(*) FROM user_progress up WHERE up.course_id=c.id)+(SELECT COUNT(*) FROM user_course_lesson_progress uclp WHERE uclp.course_id=c.id) AS user_history_count
FROM courses c WHERE c.id IN ('course-ise','course-isie') ORDER BY c.id;`);
  const integrity = (await d1Query(integritySql()))[0] ?? {};
  const protectedCourses = await d1Query(protectedSnapshotSql());
  return {
    generatedAt: new Date().toISOString(),
    database: "D1_LOCAL",
    status: "CAPTURED",
    branch: "agent/security-content-upgrade-v3",
    baseCommit: "34a4007d21063d2fae12fffe5db2805303c545b8",
    targetCourses: targetRows,
    integrity,
    protectedCourses,
  };
}

function buildPostgresBaseline() {
  const available = ["POSTGRES_VERIFY_URL", "DATABASE_URL", "POSTGRES_SEED_URL", "POSTGRES_MIGRATION_URL", "DIRECT_URL"].some((name) => process.env[name]?.trim());
  return {
    generatedAt: new Date().toISOString(),
    database: "POSTGRES_SUPABASE",
    status: available ? "CONNECTION_AVAILABLE_NOT_QUERIED_BY_ANALYSIS_SCRIPT" : "UNAVAILABLE_NO_CONNECTION_URL",
    counts: null,
    synchronizationAttempted: false,
    writeAttempted: false,
    note: "D1 and PostgreSQL baselines are intentionally independent. Production apply requires explicit approval.",
  };
}

async function queryD1Questions() {
  return d1Query(`
SELECT qc.course_id,q.id,q.title,q.content,q.type,q.difficulty,q.answer_config_json
FROM questions q JOIN question_courses qc ON qc.question_id=q.id
WHERE qc.course_id IN ('course-ise','course-isie')
ORDER BY qc.course_id,q.id;`);
}

async function queryD1OntologyConcepts() {
  const rows = await d1Query(`
SELECT oc.concept_key,oc.label,oa.alias
FROM ontology_concepts oc
LEFT JOIN ontology_aliases oa ON oa.concept_id=oc.id
WHERE oc.namespace='security-certification' AND oc.status<>'ARCHIVED'
ORDER BY oc.concept_key,oa.normalized_alias;`);
  const grouped = new Map();
  for (const row of rows) {
    const concept = grouped.get(row.concept_key) ?? {
      concept_key: row.concept_key,
      label: row.label,
      aliases: [],
    };
    if (row.alias) concept.aliases.push(row.alias);
    grouped.set(row.concept_key, concept);
  }
  return [...grouped.values()];
}

function integritySql() {
  return `SELECT
 (SELECT COUNT(*) FROM questions q WHERE EXISTS (SELECT 1 FROM question_subjects qs JOIN subjects s ON s.id=qs.subject_id WHERE qs.question_id=q.id AND s.course_id IN ('course-ise','course-isie')) AND NOT EXISTS (SELECT 1 FROM question_courses qc WHERE qc.question_id=q.id AND qc.course_id IN ('course-ise','course-isie'))) AS orphan_questions,
 (SELECT COUNT(*) FROM course_lessons cl LEFT JOIN contents c ON c.id=cl.content_id WHERE cl.course_id IN ('course-ise','course-isie') AND c.id IS NULL) AS orphan_contents,
 (SELECT COUNT(*) FROM question_subjects qs JOIN subjects s ON s.id=qs.subject_id WHERE s.course_id IN ('course-ise','course-isie') AND NOT EXISTS (SELECT 1 FROM question_courses qc WHERE qc.question_id=qs.question_id AND qc.course_id=s.course_id)) AS course_subject_mismatch,
 (SELECT COUNT(*) FROM question_topics qt JOIN topics t ON t.id=qt.topic_id JOIN subjects s ON s.id=t.subject_id WHERE s.course_id IN ('course-ise','course-isie') AND NOT EXISTS (SELECT 1 FROM question_subjects qs WHERE qs.question_id=qt.question_id AND qs.subject_id=t.subject_id)) AS subject_topic_mismatch,
 (SELECT COUNT(*) FROM course_lessons cl JOIN curriculum_nodes cn ON cn.id=cl.curriculum_node_id JOIN curriculum_trees ct ON ct.id=cn.curriculum_tree_id WHERE cl.course_id IN ('course-ise','course-isie') AND cl.course_id<>ct.course_id) AS content_course_mismatch;`;
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

function completenessScore(contents) {
  if (!contents.length) return 0;
  return Math.max(
    ...contents.map((content) => {
      const text = [content.body, content.overview, content.summary, ...(content.learningObjectives ?? [])].filter(Boolean).join(" ");
      let score = Math.min(35, Math.floor(text.length / 120));
      if ((content.learningObjectives ?? []).length >= 2) score += 15;
      if ((content.coreConcepts ?? content.concepts ?? []).length >= 1) score += 10;
      if (/실무|예시|scenario|사례/i.test(text)) score += 10;
      if (/시험|필기|실기|오답|혼동/i.test(text)) score += 10;
      if (/대응|방어|통제|완화/i.test(text)) score += 10;
      if (/원리|동작|흐름/i.test(text)) score += 10;
      return Math.min(100, score);
    }),
  );
}

function isPracticalQuestion(question) {
  try {
    return question.id.includes("practical") || JSON.parse(question.answer_config_json || "{}").examTrack === "PRACTICAL";
  } catch {
    return question.id.includes("practical");
  }
}

function inferQuestionPattern(file) {
  if (file.written_or_practical === "written") return "four_choice_concept_comparison_and_application";
  if (file.written_or_practical === "practical") return "short_answer_essay_log_config_code_and_incident_response";
  if (file.written_or_practical === "mixed") return "theory_written_and_practical_mixed";
  return "reference_only";
}

function inferSourceDifficulty(file) {
  if (file.target_course_candidate === "course-ise" && file.written_or_practical === "practical") return "MEDIUM_TO_HARD";
  if (file.target_course_candidate === "course-isie") return "EASY_TO_MEDIUM";
  if (file.target_course_candidate === "course-ise") return "MEDIUM_TO_HARD";
  return null;
}

function summarizeInventory(rows) {
  return {
    totalFiles: rows.length,
    pdfFiles: rows.filter((row) => row.source_type === "PDF").length,
    txtFiles: rows.filter((row) => row.source_type === "TXT").length,
    referenceFiles: rows.filter((row) => row.exam_type === "REFERENCE").length,
    usableFiles: rows.filter((row) => row.usable).length,
    unusableFiles: rows.filter((row) => !row.usable).length,
    courseIseCandidates: rows.filter((row) => row.target_course_candidate === "course-ise").length,
    courseIsieCandidates: rows.filter((row) => row.target_course_candidate === "course-isie").length,
    ambiguousCourseFiles: rows.filter((row) => !row.target_course_candidate && ["WRITTEN", "PRACTICAL", "MIXED"].includes(row.exam_type)).length,
  };
}

async function d1Query(statement) {
  const result = await runCapture(process.execPath, [
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    configPath,
    "--command",
    statement,
  ]);
  if (result.code !== 0) throw new Error(`SECURITY_CONTENT_V3_D1_QUERY_FAILED:${result.stdout.slice(-500)}`);
  const clean = result.stdout.replace(/\u001b\[[0-9;]*m/g, "");
  const start = clean.indexOf("[\n");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("SECURITY_CONTENT_V3_D1_JSON_MISSING");
  return JSON.parse(clean.slice(start, end + 1))[0]?.results ?? [];
}

function runCapture(executable, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      windowsHide: true,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stdout += chunk; });
    child.on("error", () => resolvePromise({ code: 1, stdout }));
    child.on("close", (code) => resolvePromise({ code: code ?? 1, stdout }));
  });
}

async function walk(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(name, value) {
  await writeFile(join(outputRoot, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isControlFile(path) {
  return ["manifest.json", "content.schema.json", "content-policy.ts", "CODEX_TASK.md", "README.md"].includes(path);
}

function sourceType(extension) {
  return (
    (({ ".pdf": "PDF", ".txt": "TXT", ".json": "JSON", ".md": "MARKDOWN", ".ts": "TYPESCRIPT", ".py": "PYTHON" })[extension] ??
      extension.replace(".", "").toUpperCase()) ||
    "UNKNOWN"
  );
}

function countOccurrences(text, alias) {
  const normalizedAlias = String(alias).trim();
  if (normalizedAlias.length < 3) return 0;
  return [...String(text).matchAll(new RegExp(escapeRegex(normalizedAlias), "giu"))].length;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(value) {
  return String(value).normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").trim().replace(/\s+/g, " ");
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function slug(value) {
  return normalize(value).replaceAll(" ", "-");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function argValue(prefix) {
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}
