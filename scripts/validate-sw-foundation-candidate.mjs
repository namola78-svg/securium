import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const candidatePath = resolve(
  "content-drafts/securium-sw-security-weakness-foundation-current-main/foundation-candidate.json",
);

const fail = (message) => {
  throw new Error(`SW foundation candidate invariant failed: ${message}`);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;

export function validateCandidate(candidate) {
  assert(candidate.course.id === "course-sw-vuln", "course identity changed");
  assert(candidate.course.code === "SW_VULN_DIAG", "course code changed");
  assert(candidate.course.slug === "sw-vulnerability-diagnostician", "course slug changed");
  assert(candidate.authority.sourceExpressionReuse === false, "source expression reuse enabled");
  assert(candidate.curriculum.length === 6, "curriculum must contain exactly six modules");
  assert(candidate.objectives.length === 12, "curriculum must contain exactly twelve objectives");
  assert(candidate.theory.length === 8, "theory must contain exactly eight units");
  assert(candidate.questions.length === 21, "question wave must contain exactly twenty-one questions");
  assert(candidate.acceptedDiagnosticTriads.length === 7, "question wave must contain exactly seven triads");

  const objectiveIds = new Set(candidate.objectives.map((objective) => objective.id));
  const mappedObjectiveIds = new Set(candidate.curriculum.flatMap((module) => module.objectives));
  assert(objectiveIds.size === mappedObjectiveIds.size, "objective mapping has duplicates or orphans");
  for (const objectiveId of objectiveIds) assert(mappedObjectiveIds.has(objectiveId), `objective is orphaned: ${objectiveId}`);

  const moduleIds = new Set(candidate.curriculum.map((module) => module.id));
  const theoryIds = new Set(candidate.theory.map((unit) => unit.id));
  const questionIds = new Set(candidate.questions.map((question) => question.id));
  assert(questionIds.size === candidate.questions.length, "duplicate question ID");
  const questionById = new Map(candidate.questions.map((question) => [question.id, question]));

  for (const triad of candidate.acceptedDiagnosticTriads) {
    assert(triad.questionIds.length === 3, `${triad.topic} must contain exactly three questions`);
    assert(new Set(triad.questionIds).size === 3, `${triad.topic} has duplicate question references`);
    const members = triad.questionIds.map((questionId) => questionById.get(questionId));
    assert(members.every(Boolean), `${triad.topic} references an unknown question`);
    assert(members.every((question) => question.topic === triad.topic), `${triad.topic} has category mismatch`);
    const roles = members.map((question) => question.role);
    assert(new Set(roles).size === 3 && roles.includes("VULNERABLE") && roles.includes("SECURE") && roles.includes("FALSE_POSITIVE"), `${triad.topic} must contain one vulnerable, secure, and false-positive member`);
  }

  for (const question of candidate.questions) {
    assert(moduleIds.has(question.moduleId), `question has unknown module: ${question.id}`);
    assert(theoryIds.has(question.theoryId), `question has unknown theory: ${question.id}`);
    assert(question.objectiveIds?.length > 0, `question has no objective mapping: ${question.id}`);
    assert(question.objectiveIds.every((id) => objectiveIds.has(id)), `question has unknown objective: ${question.id}`);
    assert(["VULNERABLE", "SECURE", "FALSE_POSITIVE"].includes(question.role), `invalid role: ${question.id}`);
    assert(nonEmpty(question.stem), `missing diagnostic stem: ${question.id}`);
    assert(question.case && typeof question.case === "object", `missing diagnostic case: ${question.id}`);
    assert(nonEmpty(question.case.code), `missing case/code: ${question.id}`);
    assert(nonEmpty(question.case.source), `missing source analysis: ${question.id}`);
    assert(nonEmpty(question.case.validationOrTransformation), `missing validation analysis: ${question.id}`);
    assert(nonEmpty(question.case.sinkOrSensitiveOperation), `missing sink analysis: ${question.id}`);
    assert(Array.isArray(question.case.assumptions) && question.case.assumptions.length > 0, `missing assumptions: ${question.id}`);
    assert(Array.isArray(question.case.evidence) && question.case.evidence.length > 0, `missing evidence anchors: ${question.id}`);
    assert(question.answerKey?.verdict === question.role, `answer key does not match role: ${question.id}`);
    assert(nonEmpty(question.answerKey?.diagnosticConclusion), `missing deterministic conclusion: ${question.id}`);
    assert(question.answerAuthority === "SECURIUM_REAUTHORED_DIAGNOSTIC_KEY", `unbounded answer authority: ${question.id}`);
    assert(nonEmpty(question.explanation) && question.explanation.trim().length >= 80, `insufficient explanation: ${question.id}`);
    assert(question.explanationComplete === true, `incomplete explanation: ${question.id}`);
    assert(question.provenance === "SECURIUM_INDEPENDENTLY_AUTHORED", `unbounded provenance: ${question.id}`);
    assert(question.safeEducationalBoundary === "MINIMAL_STATIC_PSEUDOCODE_NO_EXECUTION", `unsafe educational boundary: ${question.id}`);
    if (question.role === "VULNERABLE") assert(nonEmpty(question.vulnerabilityReason ?? question.explanation), `missing vulnerable reasoning: ${question.id}`);
    if (question.role === "SECURE") {
      assert(nonEmpty(question.mitigationReason ?? question.explanation), `missing secure reasoning: ${question.id}`);
      assert(question.case.validationOrTransformation.toLowerCase() !== "none", `secure case has no control: ${question.id}`);
    }
    if (question.role === "FALSE_POSITIVE") assert(nonEmpty(question.nonExploitabilityReason), `missing false-positive safety reasoning: ${question.id}`);
  }

  assert(candidate.codeExamples.executable === false, "executable example present");
  assert(candidate.practicals.executable === false, "executable practicals enabled");
  assert(candidate.practicals.registered === false, "practicals registered");
  for (const key of ["select", "insert", "update", "delete", "ddl"]) assert(candidate.runtimeMutationCounts[key] === 0, `runtime ${key} count is nonzero`);
  return candidate;
}

export async function loadAndValidateCandidate() {
  return validateCandidate(JSON.parse(await readFile(candidatePath, "utf8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const candidate = await loadAndValidateCandidate();
  console.log(`SW_FOUNDATION_CANDIDATE_VALID modules=${candidate.curriculum.length} objectives=${candidate.objectives.length} theory=${candidate.theory.length} questions=${candidate.questions.length} triads=${candidate.acceptedDiagnosticTriads.length} semanticTriads=7/7`);
}
