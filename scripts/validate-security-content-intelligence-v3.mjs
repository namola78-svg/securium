import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  buildSecurityContentIntelligenceV3Plan,
} from "../lib/data/security-content-upgrade-v3.mjs";

const outputRoot = resolve("reports/content-v3");
const sourceRoot = resolve(process.env.SECURIUM_CONTENT_V2_SOURCE_ROOT || "securium-content-upgrade-v2");
const configPath = argValue("--config=") || "wrangler.local.jsonc";
const persistTo = argValue("--persist-to=");
const plan = buildSecurityContentIntelligenceV3Plan();
const existing = await d1Query(`SELECT id,title,content,answer_config_json FROM questions WHERE id NOT LIKE 'question-v3-course-%';`);
const sourceExtraction = JSON.parse(await readFile(resolve(sourceRoot, "reports/source-text-extraction.json"), "utf8"));

const generatedReview = plan.questions.map(validateQuestion);
const theoryReview = plan.contents.map(validateContent);
const duplicateAnalysis = analyzeDuplicates(existing, plan.questions, sourceExtraction.files ?? {});
const failed = generatedReview.filter((row) => row.validation_status !== "PASS");
const contentFailed = theoryReview.filter((row) => row.validation_status !== "PASS");
const duplicateBlocked = duplicateAnalysis.matches.filter((row) => row.decision === "BLOCK");

await writeJson("generated-question-review.json", {
  generatedAt: new Date().toISOString(),
  policy: "ALL_AUTOMATIC_GATES_MUST_PASS_BEFORE_DB_INSERT",
  summary: {
    reviewed: generatedReview.length,
    passed: generatedReview.length - failed.length,
    failed: failed.length,
    written: plan.questions.filter((item) => item.examTrack === "WRITTEN").length,
    practical: plan.questions.filter((item) => item.examTrack === "PRACTICAL").length,
  },
  questions: generatedReview,
  contentQuality: {
    reviewed: theoryReview.length,
    passed: theoryReview.length - contentFailed.length,
    failed: contentFailed.length,
    contents: theoryReview,
  },
});
await writeJson("duplicate-analysis.json", duplicateAnalysis);

if (failed.length || contentFailed.length || duplicateBlocked.length) {
  throw new Error(`SECURITY_CONTENT_INTELLIGENCE_V3_QUALITY_GATE_FAILED:q=${failed.length},c=${contentFailed.length},d=${duplicateBlocked.length}`);
}

console.log(JSON.stringify({
  status: "SECURITY_CONTENT_INTELLIGENCE_V3_QUALITY_GATE_PASSED",
  questions: generatedReview.length,
  contents: theoryReview.length,
  blockedDuplicates: duplicateBlocked.length,
  reviewMatches: duplicateAnalysis.matches.filter((row) => row.decision === "REVIEW").length,
}, null, 2));

function validateQuestion(question) {
  const provenance = question.answerConfig.provenance;
  const conceptEdges = plan.ontologyEdges.filter((edge) => edge.fromType === "QUESTION" && edge.fromId === question.id && edge.toType === "CONCEPT");
  const checks = {
    target_course: ["course-ise", "course-isie"].includes(question.courseId),
    subject_course_match: question.subjectId.startsWith(`${question.courseId}-subject-`),
    topic_subject_match: question.topicId.startsWith(`${question.subjectId}-topic-`),
    track_valid: ["WRITTEN", "PRACTICAL"].includes(question.examTrack),
    concept_linked: conceptEdges.length > 0,
    explanation_substantive: question.explanation.length >= 30,
    provenance_present: provenance?.sourceRefs?.length > 0 && provenance.sourceTextImported === false,
    deterministic_identity: question.id.startsWith(`question-v3-${question.courseId}-`),
    written_answer_valid: question.examTrack !== "WRITTEN" || (question.choices.length === 4 && question.choices.filter((choice) => choice.isCorrect).length === 1),
    distractor_rationale_present: question.examTrack !== "WRITTEN" || question.choices.filter((choice) => !choice.isCorrect).every((choice) => choice.explanation.length >= 6),
    practical_scoring_present: question.examTrack !== "PRACTICAL" || (question.answerConfig.scoringPoints.length >= 3 && question.answerConfig.expectedAnswer.length >= 80),
  };
  return {
    question_id: question.id,
    target_course: question.courseId,
    written_or_practical: question.examTrack,
    question_type: question.type,
    validation_status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    checks,
  };
}

function validateContent(content) {
  const body = JSON.parse(content.body);
  const required = ["core", "mechanism", "threatDefense", "examPoints", "confusion", "practical", "relatedConcepts", "prerequisiteConcepts", "provenance"];
  const checks = {
    deterministic_identity: /^content-v3-course-is(?:e|ie)-/.test(content.id),
    substantive_length: content.body.length >= 900,
    required_sections: required.every((key) => body[key] !== undefined),
    concepts_linked: content.coreConcepts.length >= 2,
    provenance_present: body.provenance?.sourceRefs?.length > 0 && body.provenance.sourceTextImported === false,
    no_placeholder: !/기초 체계|실무 적용|평가 대비|필요한 범위부터 선택/.test(content.title + content.body),
  };
  return { content_id: content.id, validation_status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL", checks };
}

function analyzeDuplicates(existingRows, newQuestions, sourceFiles) {
  const rows = newQuestions.map((question) => ({ id: question.id, text: question.content, answer: JSON.stringify(question.answerConfig) }));
  const existingNormalized = existingRows.map((row) => ({ id: row.id, text: normalize(`${row.title} ${row.content}`), answer: normalize(row.answer_config_json ?? "") }));
  const sourceLines = Object.entries(sourceFiles).flatMap(([file, text]) => String(text).split(/\r?\n/).map((line, index) => ({ file, location: `line ${index + 1}`, text: normalize(line) })).filter((row) => row.text.length >= 30 && row.text.length <= 800));
  const matches = [];
  for (let i = 0; i < rows.length; i += 1) {
    const current = { ...rows[i], normalized: normalize(rows[i].text) };
    for (let j = 0; j < i; j += 1) compare(current, { ...rows[j], normalized: normalize(rows[j].text) }, "NEW_TO_NEW", matches);
    for (const old of existingNormalized) compare(current, old, "NEW_TO_EXISTING", matches);
    let bestSource = null;
    for (const line of sourceLines) {
      const similarity = dice(current.normalized, line.text);
      if (!bestSource || similarity > bestSource.similarity) bestSource = { ...line, similarity };
    }
    if (bestSource && bestSource.similarity >= 0.72) {
      matches.push({ question_id: current.id, compared_to: bestSource.file, source_location: bestSource.location, check: "SOURCE_STEM_SIMILARITY", similarity: round(bestSource.similarity), decision: bestSource.similarity >= 0.86 ? "BLOCK" : "REVIEW" });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    method: "exact and normalized equality plus character bigram Dice similarity; source lines are compared independently",
    thresholds: { review: 0.72, block: 0.86 },
    summary: {
      generatedQuestions: rows.length,
      existingQuestionsCompared: existingRows.length,
      sourceLinesCompared: sourceLines.length,
      exactDuplicates: matches.filter((row) => row.check.includes("EXACT")).length,
      blocked: matches.filter((row) => row.decision === "BLOCK").length,
      review: matches.filter((row) => row.decision === "REVIEW").length,
    },
    matches,
  };
}

function compare(current, other, scope, matches) {
  const exact = current.normalized === other.text;
  const similarity = dice(current.normalized, other.text);
  if (exact || similarity >= 0.72) matches.push({
    question_id: current.id,
    compared_to: other.id,
    check: exact ? `${scope}_NORMALIZED_EXACT` : `${scope}_STEM_SIMILARITY`,
    similarity: round(similarity),
    decision: exact || similarity >= 0.86 ? "BLOCK" : "REVIEW",
  });
}

function normalize(value) {
  return String(value).normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").trim().replace(/\s+/g, " ");
}

function dice(a, b) {
  const left = bigrams(a);
  const right = bigrams(b);
  if (!left.length || !right.length) return 0;
  let overlap = 0;
  const counts = new Map();
  for (const value of right) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const value of left) if ((counts.get(value) ?? 0) > 0) { overlap += 1; counts.set(value, counts.get(value) - 1); }
  return (2 * overlap) / (left.length + right.length);
}

function bigrams(value) {
  const compact = value.replace(/\s+/g, " ");
  const result = [];
  for (let i = 0; i < compact.length - 1; i += 1) result.push(compact.slice(i, i + 2));
  return result;
}

function round(value) { return Math.round(value * 10000) / 10000; }

async function writeJson(name, value) {
  await writeFile(resolve(outputRoot, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function d1Query(statement) {
  const result = await runCapture(process.execPath, ["scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local", "--config", configPath, ...(persistTo ? ["--persist-to", persistTo] : []), "--command", statement]);
  if (result.code !== 0) throw new Error(`SECURITY_CONTENT_INTELLIGENCE_V3_D1_QUERY_FAILED:${result.stdout.slice(-400)}`);
  const clean = result.stdout.replace(/\u001b\[[0-9;]*m/g, "");
  const start = clean.indexOf("[\n");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("SECURITY_CONTENT_INTELLIGENCE_V3_D1_JSON_MISSING");
  return JSON.parse(clean.slice(start, end + 1))[0]?.results ?? [];
}

function runCapture(executable, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env, windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stdout += chunk; });
    child.on("close", (code) => resolvePromise({ code: code ?? 1, stdout }));
    child.on("error", () => resolvePromise({ code: 1, stdout }));
  });
}

function argValue(prefix) { return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length); }
