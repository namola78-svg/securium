import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const MODULE_IDS = Array.from({ length: 8 }, (_, index) => `DF-H${String(index + 1).padStart(2, "0")}`);
const EXPECTED_TYPES = {
  conceptRecognition: 7,
  workflowProcess: 7,
  scenarioReasoning: 8,
  artifactInterpretation: 7,
  timelineReasoning: 4,
  falsePositiveAlternativeExplanation: 7,
};
const EXPECTED_DIFFICULTY = { easy: 10, medium: 20, hard: 10 };
const EXPECTED_SOURCE_MANIFEST_SHA256 = "717204c2ba58f53b81eecb1bbc52c2e799d3250194f39e88b61fc177627b1ece";
const REQUIRED_FILES = [
  "manifest.json",
  "course.json",
  "modules.json",
  "objectives.json",
  "theory.json",
  "assessment.json",
  "practicals.json",
  "provenance.json",
  "validator.mjs",
  "validator.test.mjs",
];

async function readJson(root, name) {
  return JSON.parse(await readFile(join(root, name), "utf8"));
}

function addError(errors, condition, message) {
  if (!condition) errors.push(message);
}

function countBy(values) {
  return values.reduce((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}

function duplicateValues(values) {
  return Object.entries(countBy(values))
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function equalCounts(actual, expected) {
  const normalize = (value) => Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
  return JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected));
}

export async function validateFoundation(root = DEFAULT_ROOT, options = {}) {
  const errors = [];
  const data = {};
  for (const name of REQUIRED_FILES.filter((file) => file.endsWith(".json"))) {
    try {
      data[name] = await readJson(root, name);
    } catch (error) {
      errors.push(`${name} is missing or invalid JSON: ${error.message}`);
    }
  }
  if (errors.length) return { valid: false, errors };

  const manifest = data["manifest.json"];
  const course = data["course.json"];
  const modulesFile = data["modules.json"];
  const objectivesFile = data["objectives.json"];
  const theoryFile = data["theory.json"];
  const assessment = data["assessment.json"];
  const practicalsFile = data["practicals.json"];
  const provenance = data["provenance.json"];
  const modules = Array.isArray(modulesFile.modules) ? modulesFile.modules : [];
  const objectives = Array.isArray(objectivesFile.objectives) ? objectivesFile.objectives : [];
  const theory = Array.isArray(theoryFile.theory) ? theoryFile.theory : [];
  const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
  const practicals = Array.isArray(practicalsFile.practicals) ? practicalsFile.practicals : [];

  addError(errors, manifest.manifestId === "SECURIUM_DIGITAL_FORENSICS_8H_FOUNDATION_PRODUCT_AUTHORITY_V1", "wrong Foundation manifest identity");
  addError(errors, manifest.authorityType === "CANONICAL_STATIC_PRODUCT_FOUNDATION_AUTHORITY", "Foundation authority type is not canonical static product authority");
  addError(errors, manifest.productFoundationAuthorityCount === 1, "Foundation authority count is not one");
  addError(errors, manifest.competingProductFoundationAuthorities === 0, "competing Foundation authority is non-zero");
  addError(errors, manifest.status === "DRAFT_UNPUBLISHED", "Foundation is not DRAFT_UNPUBLISHED");
  addError(errors, manifest.durationMinutes === 480, "Foundation duration is not 480 minutes");
  addError(errors, manifest.moduleCount === 8, "Foundation module count is not eight");
  addError(errors, manifest.counts?.course === 1, "course count is not one");
  addError(errors, manifest.counts?.modules === 8, "manifest module count is not eight");
  addError(errors, manifest.counts?.objectives === 32, "manifest objective count is not 32");
  addError(errors, manifest.counts?.theoryAssets === 24, "manifest theory count is not 24");
  addError(errors, manifest.counts?.questions === 40, "manifest question count is not 40");
  addError(errors, manifest.counts?.explanations === 40, "manifest explanation count is not 40");
  addError(errors, manifest.counts?.practicalSpecifications === 8, "manifest practical count is not eight");
  addError(errors, manifest.counts?.executableLabs === 0, "manifest executable lab count is not zero");
  addError(errors, JSON.stringify(manifest.files?.map((file) => file.path)) === JSON.stringify(REQUIRED_FILES), "Foundation file model is missing, reordered, or has unexpected files");

  const identity = manifest.courseIdentity;
  addError(errors, identity?.courseId === "course-digital-forensics-8h", "course ID drift");
  addError(errors, identity?.code === "DF-8H", "course code drift");
  addError(errors, identity?.slug === "digital-forensics-8h", "course slug drift");
  addError(errors, identity?.version === "digital-forensics-8h-foundation.v1", "Foundation version drift");
  for (const field of ["courseId", "code", "slug", "title", "version"]) {
    addError(errors, course[field] === identity[field], `course identity mismatch for ${field}`);
  }
  addError(errors, course.status === "DRAFT_UNPUBLISHED", "course publication status is not draft/unpublished");
  addError(errors, course.durationMinutes === 480, "course duration is not 480 minutes");
  addError(errors, course.rightsAndProvenance?.restrictedSourceExpressionReuse === 0, "course restricted source-expression reuse is non-zero");
  addError(errors, course.rightsAndProvenance?.officialExamOrQualificationClaim === 0, "course makes an official qualification claim");

  addError(errors, equalCounts(countBy(modules.map((module) => module.id)), Object.fromEntries(MODULE_IDS.map((id) => [id, 1]))), "module IDs are not unique and complete");
  addError(errors, modules.length === 8, "module count is not eight");
  addError(errors, modules.every((module) => module.minutes === 60), "each module is not 60 minutes");
  addError(errors, modules.reduce((sum, module) => sum + (module.minutes ?? 0), 0) === 480, "module minutes do not total 480");
  for (const moduleEntry of modules) {
    addError(errors, moduleEntry.sourceSupport?.design === "SECURIUM_INDEPENDENT_DESIGN", `${moduleEntry.id} lacks independent design classification`);
    addError(errors, moduleEntry.sourceSupport?.public === "PUBLIC_FACTUAL_AUTHORITY_REQUIRED", `${moduleEntry.id} lacks public factual authority requirement`);
    addError(errors, moduleEntry.sourceSupport?.localSourceDependence === 0, `${moduleEntry.id} has local source dependence`);
    addError(errors, moduleEntry.objectiveIds?.length === 4, `${moduleEntry.id} does not bind four objectives`);
    addError(errors, moduleEntry.theoryIds?.length === 3, `${moduleEntry.id} does not bind three theory assets`);
    addError(errors, moduleEntry.questionIds?.length === 5, `${moduleEntry.id} does not bind five questions`);
    addError(errors, typeof moduleEntry.practicalId === "string", `${moduleEntry.id} has no practical binding`);
  }

  const objectiveIds = objectives.map((objective) => objective.id);
  addError(errors, objectives.length === 32, "objective count is not 32");
  addError(errors, duplicateValues(objectiveIds).length === 0, "duplicate objective IDs");
  addError(errors, objectivesFile.objectivesPerModule === 4, "objectives per module is not four");
  addError(errors, objectivesFile.orphanObjectives === 0, "objective orphan count is non-zero");
  for (const objective of objectives) {
    addError(errors, MODULE_IDS.includes(objective.module), `${objective.id} has an unknown module`);
    addError(errors, objective.id.startsWith(`${objective.module}-O`), `${objective.id} is not deterministically bound to its module`);
    addError(errors, objective.theoryIds?.length > 0, `${objective.id} has no theory binding`);
    addError(errors, objective.questionIds?.length > 0, `${objective.id} has no question binding`);
    addError(errors, typeof objective.practicalId === "string", `${objective.id} has no practical binding`);
    addError(errors, objective.provenance === "SECURIUM_INDEPENDENTLY_AUTHORED", `${objective.id} has wrong provenance`);
    addError(errors, objective.sourceSupport?.includes("SECURIUM_INDEPENDENT_DESIGN"), `${objective.id} lacks design boundary`);
    addError(errors, !objective.outcome.toLowerCase().includes("understand"), `${objective.id} is vague`);
  }

  const theoryIds = theory.map((asset) => asset.id);
  addError(errors, theory.length === 24, "theory count is not 24");
  addError(errors, duplicateValues(theoryIds).length === 0, "duplicate theory IDs");
  for (const asset of theory) {
    addError(errors, MODULE_IDS.includes(asset.module), `${asset.id} has an unknown module`);
    addError(errors, asset.objectiveIds?.length > 0, `${asset.id} has no objective binding`);
    addError(errors, typeof asset.overview === "string" && asset.overview.length >= 80, `${asset.id} is too shallow`);
    addError(errors, Array.isArray(asset.teachingPoints) && asset.teachingPoints.length >= 3, `${asset.id} lacks teaching points`);
    addError(errors, asset.provenance === "SECURIUM_INDEPENDENTLY_AUTHORED", `${asset.id} has wrong provenance`);
    addError(errors, asset.guardrails?.length > 0, `${asset.id} lacks a guardrail`);
  }
  addError(errors, theory.every((asset) => asset.id.startsWith(`${asset.module}-T`)), "theory IDs are not deterministically module-bound");
  addError(errors, Object.values(countBy(theory.map((asset) => asset.module))).every((count) => count === 3), "theory distribution is not three per module");

  const questionIds = questions.map((question) => question.id);
  addError(errors, questions.length === 40, "question count is not 40");
  addError(errors, duplicateValues(questionIds).length === 0, "duplicate question IDs");
  addError(errors, equalCounts(countBy(questions.map((question) => question.type)), EXPECTED_TYPES), "question type distribution is wrong");
  addError(errors, equalCounts(countBy(questions.map((question) => question.difficulty)), EXPECTED_DIFFICULTY), "question difficulty distribution is wrong");
  addError(errors, assessment.explanationsRequired === "40/40", "explanation completeness is not 40/40");
  addError(errors, assessment.provenance === "SECURIUM_INDEPENDENTLY_AUTHORED", "assessment provenance is not independent");
  addError(errors, assessment.localQuestionWordingReuse === 0, "local question wording reuse is non-zero");
  addError(errors, assessment.questionReconstruction === 0, "question reconstruction is non-zero");
  addError(errors, assessment.restrictedScreenshots === 0, "restricted screenshots are non-zero");
  addError(errors, equalCounts(countBy(questions.map((question) => String(question.answer))), {"0":10,"1":10,"2":10,"3":10}), "answer-position distribution is biased");
  for (const question of questions) {
    addError(errors, MODULE_IDS.includes(question.module), `${question.id} has an unknown module`);
    addError(errors, question.id.startsWith(`${question.module}-Q`), `${question.id} is not deterministically module-bound`);
    addError(errors, question.objectiveIds?.length > 0, `${question.id} has no objective binding`);
    addError(errors, question.theoryIds?.length > 0, `${question.id} has no theory binding`);
    addError(errors, Array.isArray(question.options) && question.options.length === 4, `${question.id} does not have four choices`);
    addError(errors, Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, `${question.id} has invalid answer binding`);
    addError(errors, typeof question.prompt === "string" && question.prompt.length >= 30, `${question.id} has a shallow prompt`);
    addError(errors, typeof question.explanation === "string" && question.explanation.length >= 70, `${question.id} has a shallow explanation`);
    addError(errors, question.provenance === "SECURIUM_INDEPENDENTLY_AUTHORED", `${question.id} has wrong provenance`);
    addError(errors, question.sourceExpressionReuse === 0, `${question.id} has source expression reuse`);
  }

  const practicalIds = practicals.map((practical) => practical.id);
  addError(errors, practicals.length === 8, "practical count is not eight");
  addError(errors, duplicateValues(practicalIds).length === 0, "duplicate practical IDs");
  addError(errors, practicalsFile.total === 8 && practicalsFile.perModule === 1, "practical distribution is wrong");
  addError(errors, practicalsFile.classification === "SYNTHETIC_SPEC_ONLY", "practical classification is not synthetic spec only");
  addError(errors, practicalsFile.executable === false && practicalsFile.executableLabs === 0, "executable practical/lab authority was introduced");
  for (const practical of practicals) {
    addError(errors, MODULE_IDS.includes(practical.module), `${practical.id} has an unknown module`);
    addError(errors, practical.id.startsWith(`${practical.module}-P`), `${practical.id} is not deterministically module-bound`);
    addError(errors, practical.objectiveIds?.length === 4, `${practical.id} does not bind four objectives`);
    addError(errors, practical.classification === "SYNTHETIC_SPEC_ONLY" && practical.provenance.includes("SYNTHETIC_SPEC_ONLY"), `${practical.id} overclaims execution`);
    addError(errors, practical.safetyBoundary && practical.limitations, `${practical.id} lacks safety or limitations`);
    addError(errors, practical.learnerOutput && practical.expectedReasoning?.length >= 2, `${practical.id} lacks usable learner output/reasoning`);
  }
  addError(errors, practicalsFile.caseId === "DF-CASE-001-credential-misuse-exfiltration", "synthetic case ID drift");
  for (const field of ["realPii", "realVictimEvidence", "malwareExecution", "credentialTheftExecution", "uncontrolledNetworkTarget"]) {
    addError(errors, practicalsFile.practicalSafety?.[field] === 0, `${field} safety boundary is non-zero`);
  }

  addError(errors, provenance.sourceAuthority?.manifestPath === "source-evidence-original/digital-forensics/manifest.json", "wrong source manifest path");
  addError(errors, provenance.sourceAuthority?.manifestSha256 === EXPECTED_SOURCE_MANIFEST_SHA256, "source manifest SHA authority drift");
  addError(errors, provenance.sourceAuthority?.localExpressionReuse === 0, "provenance permits local expression reuse");
  addError(errors, provenance.sourceAuthority?.localQuestionWordingReuse === 0, "provenance permits local question wording reuse");
  addError(errors, provenance.sourceAuthority?.h04ToH08LocalSourceDependence === 0, "H04-H08 local-source dependence is non-zero");
  addError(errors, provenance.sourceAuthority?.h04ToH08Structure === "NO_REMAINING_STRUCTURE_FOUND", "H04-H08 local structure is overclaimed");
  addError(errors, provenance.futureCurrentnessGate?.status === "PASS_WITH_LIMITATIONS", "public currentness gate is missing or overclaimed");
  addError(errors, provenance.sourceSupportByModule?.length === 8, "source support matrix is incomplete");
  for (const row of provenance.sourceSupportByModule ?? []) {
    addError(errors, row.design === "SECURIUM_INDEPENDENT_DESIGN", `${row.module} source design provenance is wrong`);
    addError(errors, row.public === "PUBLIC_FACTUAL_AUTHORITY_REQUIRED", `${row.module} public authority requirement is missing`);
    if (["DF-H04", "DF-H05", "DF-H06", "DF-H07", "DF-H08"].includes(row.module)) {
      addError(errors, row.local === "SOURCE_SUPPORT_MISSING_FOR_STRUCTURE", `${row.module} falsely claims local source support`);
    }
  }

  const sourceManifestPath = options.sourceManifestPath
    ? resolve(options.sourceManifestPath)
    : resolve(root, "../../source-evidence-original/digital-forensics/manifest.json");
  try {
    await stat(sourceManifestPath);
    addError(errors, (await sha256(sourceManifestPath)) === EXPECTED_SOURCE_MANIFEST_SHA256, "canonical source manifest bytes changed");
  } catch (error) {
    errors.push(`canonical source manifest unavailable: ${error.message}`);
  }
  const runtimeBoundary = manifest.runtimeBoundary ?? {};
  for (const [field, value] of Object.entries(runtimeBoundary)) {
    if (["runtimeRegistration", "publication", "schemaChanges", "migrationChanges", "drizzleChanges", "databaseOperations", "ontologyMappings", "roleSkillConceptMappings", "evidenceProjection", "learnerSkillState", "masteryComputation", "confidenceComputation", "competencyEvidence", "digitalTwinState"].includes(field)) {
      addError(errors, value === 0, `${field} is non-zero`);
    }
  }
  addError(errors, manifest.sourceAuthority?.restrictedSourceDependence === 0, "manifest restricted-source dependence is non-zero");
  addError(errors, manifest.sourceAuthority?.localExpressionReuse === 0, "manifest source-expression reuse is non-zero");

  if (errors.length) return { valid: false, errors };
  return {
    valid: true,
    errors: [],
    metrics: {
      course: 1,
      modules: modules.length,
      minutes: modules.reduce((sum, module) => sum + module.minutes, 0),
      objectives: objectives.length,
      theoryAssets: theory.length,
      questions: questions.length,
      explanations: questions.filter((question) => question.explanation).length,
      practicals: practicals.length,
      executableLabs: practicalsFile.executableLabs,
      sourceManifestSha256: provenance.sourceAuthority.manifestSha256,
      sourceExpressionReuse: provenance.sourceAuthority.localExpressionReuse,
      h04ToH08LocalSourceDependence: provenance.sourceAuthority.h04ToH08LocalSourceDependence,
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const result = await validateFoundation();
  if (!result.valid) {
    console.error(JSON.stringify({ status: "FAIL", errors: result.errors }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ status: "PASS", validator: "digital-forensics-8h-foundation-v1", metrics: result.metrics }, null, 2));
  }
}
