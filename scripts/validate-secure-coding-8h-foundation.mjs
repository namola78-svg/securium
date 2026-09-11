import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("content-drafts/secure-coding-8h-foundation");

async function readJson(name) {
  return JSON.parse(await readFile(resolve(root, name), "utf8"));
}

function fail(message) {
  throw new Error(message);
}

const [manifest, theory, objectives, questions, practicals, triads, future] =
  await Promise.all([
    readJson("manifest.json"),
    readJson("theory.json"),
    readJson("objectives.json"),
    readJson("questions.json"),
    readJson("practicals.json"),
    readJson("diagnostic-triads.json"),
    readJson("future-requirements.json"),
  ]);

const modules = manifest.modules;
const moduleIds = modules.map((module) => module.id);
const expectedModuleIds = Array.from({ length: 8 }, (_, index) =>
  `M${String(index + 1).padStart(2, "0")}`,
);
if (JSON.stringify(moduleIds) !== JSON.stringify(expectedModuleIds)) {
  fail("module ordering is not exactly M01..M08");
}
if (manifest.canonicalCourseIdentity.duplicateDeveloper8hCourseAuthority !== 0) {
  fail("duplicate Developer 8H authority is non-zero");
}
if (modules.length !== 8) fail("module count is not 8");
if (modules.reduce((sum, module) => sum + module.minutes, 0) !== 480) {
  fail("module duration does not total 480 minutes");
}

const pythonMinutes = modules.reduce((sum, module) => sum + module.pythonMinutes, 0);
const vibeMinutes = modules.reduce((sum, module) => sum + module.vibeMinutes, 0);
const pythonRatio = pythonMinutes / 480;
const vibeRatio = vibeMinutes / 480;
if (pythonMinutes + vibeMinutes !== 480) fail("Python/Vibe duration does not reconcile");
if (pythonRatio < 0.7 || pythonRatio > 0.8 || vibeRatio < 0.2 || vibeRatio > 0.3) {
  fail("Python/Vibe ratio is outside the target range");
}

const theoryById = new Map(theory.theory.map((asset) => [asset.id, asset]));
const practicalById = new Map(practicals.specifications.map((spec) => [spec.id, spec]));
const questionById = new Map(questions.questions.map((question) => [question.id, question]));
if (objectives.objectives.length !== 32) fail("objective count is not 32");
for (const objective of objectives.objectives) {
  if (!moduleIds.includes(objective.module)) fail(`${objective.id} has no module`);
  if (!theoryById.has(objective.theory)) fail(`${objective.id} has no theory asset`);
  if (!practicalById.has(objective.practicalId)) fail(`${objective.id} has no practical spec`);
  if (!objective.questionIds.length) fail(`${objective.id} has no question evidence`);
  for (const questionId of objective.questionIds) {
    const question = questionById.get(questionId);
    if (!question) fail(`${objective.id} references missing ${questionId}`);
    if (question.module !== objective.module) fail(`${questionId} crosses module boundary`);
  }
  if (!objective.provenance) fail(`${objective.id} has no provenance`);
}

if (questions.questions.length !== 40) fail("question count is not 40");
const answerPositions = new Map();
for (const question of questions.questions) {
  if (!Array.isArray(question.options) || question.options.length !== 4) {
    fail(`${question.id} does not have four options`);
  }
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length) {
    fail(`${question.id} has invalid answer binding`);
  }
  if (!question.explanation) fail(`${question.id} has no explanation`);
  if (question.review?.status !== "ACCEPT" || question.review?.independentReview !== true) {
    fail(`${question.id} lacks independent acceptance review`);
  }
  answerPositions.set(question.answer, (answerPositions.get(question.answer) ?? 0) + 1);
}
if (JSON.stringify(Object.fromEntries([...answerPositions].sort())) !== JSON.stringify({ 0: 9, 1: 11, 2: 10, 3: 10 })) {
  fail("answer-position distribution is biased or not deterministic");
}

const requiredTriads = [
  "SQL Injection", "Command Injection", "Path Traversal", "XSS", "SSRF",
  "Authorization / IDOR", "Deserialization", "Secrets",
];
const triadCategories = new Set(triads.triads.map((triad) => triad.category));
for (const category of requiredTriads) {
  if (!triadCategories.has(category)) fail(`missing triad: ${category}`);
}
if (practicals.specifications.length !== 8) fail("practical spec count is not 8");
if (practicals.specifications.some((spec) => spec.status !== "SPEC_ONLY")) {
  fail("practical status overclaims executable work");
}
if (practicals.capstone.status !== "SPEC_READY_NON_EXECUTABLE") {
  fail("capstone status is not SPEC_READY_NON_EXECUTABLE");
}

const assets = [
  ...modules,
  ...theory.theory,
  ...objectives.objectives,
  ...questions.questions,
  ...triads.triads,
  ...practicals.specifications,
];
if (assets.some((asset) => !asset.provenance)) fail("accepted asset has missing provenance");
if (manifest.unknownProvenanceCount !== 0 || manifest.unknownRightsCountAmongAcceptedAssets !== 0) {
  fail("unknown provenance or rights remains in accepted assets");
}
if (manifest.authorityBoundary.swCertificationContent.includes("this candidate")) {
  fail("SW certification authority collides with the Developer candidate");
}
if (manifest.runtimeRegistrationPerformed || manifest.publicationPerformed || manifest.ontologyProvisioningPerformed || manifest.roleSkillWritesPerformed || manifest.evidenceImplementationPerformed) {
  fail("foundation validator detected prohibited runtime or authority work");
}
if (future.implemented !== false || future.executableLabRequirements.deploymentStatus !== "NOT_BUILT; NOT_DEPLOYED") {
  fail("future requirements overclaim implementation");
}

console.log(JSON.stringify({
  status: "PASS",
  validator: "bounded-secure-coding-8h-foundation-v1",
  checks: {
    oneDeveloper8hAuthority: true,
    coherentModuleOrdering: true,
    totalMinutes480: true,
    pythonVibeRatioInTarget: true,
    noOrphanObjectives: true,
    validQuestionAnswerBinding: true,
    noSystematicAnswerPositionBias: true,
    practicalStatusHonest: true,
    provenanceComplete: true,
    swAuthoritySeparate: true,
    noRuntimeOrPublicationAuthority: true,
  },
  counts: manifest.candidateCounts,
  answerPositionDistribution: Object.fromEntries([...answerPositions].sort()),
}));
