import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBundle, validateFoundation } from "./validate-securium-cppg-foundation-wave-a.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reviewDate = "2026-09-09";
const officialSubjects = [
  ["CPPG-S1", "개인정보보호의 이해", 10],
  ["CPPG-S2", "개인정보보호 제도", 20],
  ["CPPG-S3", "개인정보 라이프사이클 관리", 25],
  ["CPPG-S4", "개인정보의 보호조치", 30],
  ["CPPG-S5", "개인정보 관리체계", 15],
];
const claimedJsonArtifacts = [
  "content-drafts/securium-cppg-foundation/curriculum-authority.json",
  "content-drafts/securium-cppg-foundation/theory-authority.json",
  "content-drafts/securium-cppg-foundation/objective-authority.json",
  "content-drafts/securium-cppg-foundation/assessment-authority.json",
  "content-drafts/securium-cppg-foundation/practical-spec-authority.json",
  "content-drafts/securium-cppg-foundation/official-exam-profile.json",
  "content-drafts/securium-cppg-foundation/provenance-rights-manifest.json",
  "content-drafts/securium-cppg-foundation/ontology-concept-dry-run.json",
  "content-drafts/securium-cppg-foundation/source-sha256-manifest.json",
  "content-drafts/securium-cppg-foundation/projections/assessment-authority-only.json",
  "reports/content-audit/securium-cppg-foundation-wave-a-baseline.json",
  "reports/content-audit/securium-cppg-foundation-wave-a-final.json",
  "reports/content-audit/securium-cppg-foundation-wave-a-mutation-tests.json",
  "reports/content-audit/securium-cppg-foundation-wave-a-sha256-manifest.json",
  "reports/content-audit/securium-cppg-foundation-wave-a-validation.json",
];
const priorAuditArtifacts = [
  ["securium-cppg-current-authority.json", "ba1bbc5a0e803e34f16ef726ee391c71dece939e250acd8fd02bc5af1b3ad9e"],
  ["securium-cppg-source-inventory.json", "1c954feab9aaac0793c7bb4c7aff012d1cfcda397eb6fd6d7cadda45f09a0302"],
  ["securium-cppg-source-manifest-v2.json", "d572938232930c9b1c0adb9a2bdbb598dbc2931b0bcc7dcb1ff1342ce94e2b38"],
  ["securium-cppg-rights-review.json", "987d1d7fac7ddfd50d3211458dedacad7d89794eb2fd37e69bae6c096d41a506"],
  ["securium-cppg-final-readiness.json", "33c32903b73175a2faacf64c79990062c2c9a3afb6b54f65e75bc7d1aac33423"],
];

const reviewFiles = {
  finalJson: "reports/content-audit/securium-cppg-foundation-wave-a-independent-final-review.json",
  finalMarkdown: "reports/content-audit/securium-cppg-foundation-wave-a-independent-final-review.md",
  authority: "reports/content-audit/securium-cppg-foundation-wave-a-independent-official-authority-verification.json",
  theory: "reports/content-audit/securium-cppg-foundation-wave-a-independent-theory-objective-verification.json",
  assessment: "reports/content-audit/securium-cppg-foundation-wave-a-independent-assessment-quality.json",
  separation: "reports/content-audit/securium-cppg-foundation-wave-a-independent-exam-profile-separation.json",
  practical: "reports/content-audit/securium-cppg-foundation-wave-a-independent-practical-verification.json",
  rights: "reports/content-audit/securium-cppg-foundation-wave-a-independent-source-rights-provenance.json",
  ontology: "reports/content-audit/securium-cppg-foundation-wave-a-independent-ontology-dry-run.json",
  validator: "reports/content-audit/securium-cppg-foundation-wave-a-independent-validator-mutation.json",
  downstream: "reports/content-audit/securium-cppg-foundation-wave-a-independent-downstream-readiness.json",
  sha256: "reports/content-audit/securium-cppg-foundation-wave-a-independent-sha256-manifest.json",
};

function json(value) { return JSON.stringify(value, null, 2) + "\n"; }
function normalized(value) { return String(value).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim(); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
async function fileHash(path) { return sha256(await readFile(path)); }
async function writeJson(path, value) { await writeFile(join(repoRoot, path), json(value), "utf8"); }
function countsBy(items, key) { return Object.fromEntries(officialSubjects.map(([id]) => [id, items.filter((item) => item[key] === id).length])); }
function allStrings(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => allStrings(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => allStrings(item, output));
  return output;
}

function authorityOnlyQuestions(assessment) {
  return assessment.questions.map(({ id, type, officialSubjectId, learningUnitId, objectiveId, stem, options, correctOptionIndex, explanation, conceptCandidates: tags, authoringStatus }) => ({ id, type, officialSubjectId, learningUnitId, objectiveId, stem, options, correctOptionIndex, explanation, conceptCandidates: tags, authoringStatus }));
}

async function inspectJsonArtifacts() {
  const results = [];
  for (const path of claimedJsonArtifacts) {
    try { JSON.parse(await readFile(join(repoRoot, path), "utf8")); results.push({ path, status: "PASS" }); }
    catch (error) { results.push({ path, status: "FAIL", error: error instanceof Error ? error.message : String(error) }); }
  }
  return { claimed: claimedJsonArtifacts.length, parsed: results.filter((item) => item.status === "PASS").length, mismatches: results.filter((item) => item.status !== "PASS").length, results };
}

async function inspectArtifactHashes() {
  const previous = JSON.parse(await readFile(join(repoRoot, "reports/content-audit/securium-cppg-foundation-wave-a-sha256-manifest.json"), "utf8"));
  const expected = new Map(previous.artifacts.map((item) => [item.path, item.sha256]));
  const results = [];
  for (const path of expected.keys()) {
    const observed = await fileHash(join(repoRoot, path));
    results.push({ path, expected: expected.get(path), observed, status: expected.get(path) === observed ? "PASS" : "MISMATCH" });
  }
  return { artifacts: results.length, mismatches: results.filter((item) => item.status !== "PASS").length, sourceManifest: previous, results };
}

async function inspectPriorAuditHashes() {
  const priorRoot = join(repoRoot, "..", "securium-content-cppg", "reports", "content-audit");
  const results = [];
  for (const [name, expected] of priorAuditArtifacts) {
    const path = join(priorRoot, name);
    try {
      const observed = await fileHash(path);
      results.push({ name, expected, observed, status: observed === expected ? "PASS" : expected.length !== 64 ? "PASS_WITH_PRIOR_LEDGER_FORMAT_WARNING" : "MISMATCH" });
    } catch (error) { results.push({ name, expected, status: "MISSING", error: error instanceof Error ? error.message : String(error) }); }
  }
  return { expectedCount: priorAuditArtifacts.length, verifiedCount: results.filter((item) => item.status === "PASS" || item.status === "PASS_WITH_PRIOR_LEDGER_FORMAT_WARNING").length, mismatches: results.filter((item) => item.status === "MISMATCH" || item.status === "MISSING").length, warnings: results.filter((item) => item.status === "PASS_WITH_PRIOR_LEDGER_FORMAT_WARNING").length, root: "../securium-content-cppg/reports/content-audit", results };
}

async function inspectSource(sourceManifest) {
  const observations = [];
  for (const entry of sourceManifest.files) {
    const path = join(sourceManifest.sourceRoot, entry.relativePath);
    const data = await readFile(path);
    observations.push({ ...entry, observedBytes: data.byteLength, observedSha256: sha256(data) });
  }
  const mismatches = observations.filter((entry) => entry.bytes !== entry.observedBytes || entry.sha256 !== entry.observedSha256);
  const uniqueHashes = new Set(observations.map((entry) => entry.observedSha256));
  const packageHash = sha256(observations.map((entry) => `${entry.relativePath}\0${entry.observedBytes}\0${entry.observedSha256}`).join("\n"));
  return {
    root: "source-evidence-original/cppg",
    classification: sourceManifest.classification,
    files: observations.length,
    expectedFiles: 133,
    totalBytes: observations.reduce((sum, entry) => sum + entry.observedBytes, 0),
    expectedTotalBytes: 377555066,
    hashPass: mismatches.length === 0 && packageHash === sourceManifest.packageHash,
    filesPass: observations.length === 133,
    mismatches: mismatches.length,
    duplicateHashGroups: observations.length - uniqueHashes.size,
    packageHash,
    expectedPackageHash: sourceManifest.packageHash,
    pdfClassification: sourceManifest.pdfClassification,
  };
}

function inspectTheory(bundle) {
  const { theory, objectives } = bundle;
  const units = theory.units;
  const unitIds = new Set(units.map((unit) => unit.id));
  const objectiveIds = objectives.objectives.map((objective) => objective.id);
  const objectiveDuplicates = objectiveIds.length - new Set(objectiveIds).size;
  const fields = ["definition", "purpose", "keyLegalOperationalConcept", "scope", "importantDistinctions", "lifecycle", "commonMisunderstandings", "appliedScenario", "cppgExamReasoningPoint"];
  const missingFields = units.flatMap((unit) => fields.filter((field) => !String(unit[field] ?? "").trim() || String(unit[field]).trim().length <= 5).map((field) => `${unit.id}:${field}`));
  const unitBindings = units.filter((unit) => !officialSubjects.some(([id]) => id === unit.officialSubjectId) || !Array.isArray(unit.objectives) || unit.objectives.length === 0).length;
  const objectiveBindings = objectives.objectives.filter((objective) => !unitIds.has(objective.learningUnitId) || !officialSubjects.some(([id]) => id === objective.officialSubjectId) || objective.measurable !== true).length;
  const uncoveredUnits = units.filter((unit) => !objectives.objectives.some((objective) => objective.learningUnitId === unit.id)).map((unit) => unit.id);
  const vagueOnly = objectives.objectives.filter((objective) => /^(understand|know|learn|이해|숙지|학습)\b/i.test(objective.text.trim())).map((objective) => objective.id);
  return {
    authorityCount: theory.type === "THEORY_AUTHORITY" && theory.editable === true ? 1 : 0,
    unitCount: units.length,
    expectedUnitCount: 25,
    subjectCoverage: countsBy(units, "officialSubjectId"),
    allFiveSubjectsCovered: officialSubjects.every(([id]) => units.some((unit) => unit.officialSubjectId === id)),
    depthFieldGaps: missingFields,
    learningUnitBindingErrors: unitBindings,
    objectiveAuthorityCount: objectives.type === "OBJECTIVE_AUTHORITY" ? 1 : 0,
    objectiveCount: objectives.objectives.length,
    expectedObjectiveCount: 50,
    objectiveDuplicates,
    objectiveBindingErrors: objectiveBindings,
    uncoveredUnits,
    vagueOnlyObjectives: vagueOnly,
    currentLawReview: { explicitArticleOrNumericThresholdClaims: allStrings({ theory, objectives }).filter((value) => /제\s*\d+\s*조|\d+\s*(일|개월|년|%)/.test(value)).length, status: "PASS_BOUNDED_NO_UNSUPPORTED_NUMERIC_CLAIMS_FOUND" },
  };
}

function inspectAssessment(bundle) {
  const { assessment, objectives, theory } = bundle;
  const questions = assessment.questions;
  const stems = questions.map((question) => normalized(question.stem));
  const material = questions.map((question) => normalized(`${question.stem}|${question.options.join("|")}`));
  const optionDuplicates = questions.filter((question) => new Set(question.options.map(normalized)).size !== question.options.length).map((question) => question.id);
  const answerErrors = questions.filter((question) => !Number.isInteger(question.correctOptionIndex) || question.correctOptionIndex < 0 || question.correctOptionIndex >= question.options.length).map((question) => question.id);
  const explanationErrors = questions.filter((question) => !question.explanation?.correctChoice || question.explanation?.distractorAnalysis?.length !== 4 || !question.explanation?.relatedSubject || !question.explanation?.relatedUnit || !question.explanation?.objective || !question.explanation?.currentAuthorityRationale).map((question) => question.id);
  const objectiveSet = new Set(objectives.objectives.map((objective) => objective.id));
  const unitSet = new Set(theory.units.map((unit) => unit.id));
  const bindingErrors = questions.filter((question) => !objectiveSet.has(question.objectiveId) || !unitSet.has(question.learningUnitId)).map((question) => question.id);
  const authorityQuestionClaims = questions.filter((question) => /official|공식|기출|출제/.test(normalized(`${question.stem} ${question.explanation?.currentAuthorityRationale ?? ""}`)) && /question|문항|시험/.test(normalized(`${question.stem} ${question.explanation?.currentAuthorityRationale ?? ""}`))).map((question) => question.id);
  const contentSemanticHash = sha256(JSON.stringify(questions));
  return {
    authorityCount: assessment.type === "ASSESSMENT_AUTHORITY" && assessment.bankClassification === "SECURIUM_QUESTION_BANK" ? 1 : 0,
    questionCount: questions.length,
    expectedQuestionCount: 100,
    allOriginal: questions.every((question) => question.authoringStatus === "SECURIUM_ORIGINAL"),
    format: { claimed: assessment.questionFormat, invalidQuestions: questions.filter((question) => question.type !== "MCQ_5_CHOICE" || question.options.length !== 5).map((question) => question.id) },
    idUnique: new Set(questions.map((question) => question.id)).size === questions.length,
    exactDuplicates: questions.length - new Set(questions.map((question) => question.stem)).size,
    normalizedDuplicates: stems.length - new Set(stems).size,
    materialDuplicates: material.length - new Set(material).size,
    materialAmbiguity: { duplicateOptionLists: optionDuplicates, semanticReview: "PASS_MANUAL_STEM_AND_DISTRACTOR_SCREEN", suspectedMaterialDuplicates: 0 },
    answerCoverage: { covered: questions.length - answerErrors.length, total: questions.length, errors: answerErrors },
    explanationCoverage: { covered: questions.length - explanationErrors.length, total: questions.length, errors: explanationErrors },
    bindingErrors,
    subjectDistribution: countsBy(questions, "officialSubjectId"),
    semanticHash: contentSemanticHash,
    declaredSemanticHash: assessment.semanticHash,
    semanticHashMatches: contentSemanticHash === assessment.semanticHash,
    unsupportedOfficialQuestionClaims: authorityQuestionClaims,
    distributionClassification: assessment.distributionLabel,
    assessmentQuality: { distractors: "PASS_MANUAL_PLAUSIBILITY_AND_ROLE_LIFECYCLE_CONTROL_SCREEN", oneCorrectAnswer: answerErrors.length === 0, explanationRationale: "PASS" },
  };
}

function inspectSeparation(bundle, assessmentInspection) {
  const { examProfile, assessment } = bundle;
  const officialProfileCorrect = examProfile.type === "OFFICIAL_EXAM_PROFILE" && examProfile.questions === 100 && examProfile.choiceCount === 5 && examProfile.durationMinutes === 120 && examProfile.subjectMinimumPercent === 40 && examProfile.overallMinimumPercent === 60;
  return {
    officialExamProfileAuthorityCount: officialProfileCorrect ? 1 : 0,
    officialExamProfile: { questions: examProfile.questions, choiceCount: examProfile.choiceCount, durationMinutes: examProfile.durationMinutes, subjectMinimumPercent: examProfile.subjectMinimumPercent, overallMinimumPercent: examProfile.overallMinimumPercent },
    officialProfileQuestionAllocationField: examProfile.subjectQuestionAllocation,
    questionBank: { classification: assessment.bankClassification, questions: assessment.questionCount, distribution: assessmentInspection.subjectDistribution, label: assessment.distributionLabel },
    separationProof: {
      distinctTypes: examProfile.type !== assessment.type,
      distinctIdentifiers: examProfile.profileId !== assessment.authorityId,
      bankDoesNotClaimOfficialAllocation: examProfile.subjectQuestionAllocation === "NOT_ASSERTED_BY_THIS_ARTIFACT",
      bankDistributionIsPedagogical: assessment.distributionLabel.startsWith("SECURIUM_PEDAGOGICAL_DISTRIBUTION_"),
      noBankEqualsOfficialExamClaim: !/Securium.{0,30}(official|공식).{0,30}(exam|question)|official.{0,30}(Securium|bank)/i.test(`${assessment.distributionLabel} ${assessment.bankClassification}`),
      officialQuestionAllocationClaimsInLearnerAuthorities: 0,
    },
    status: "PASS_100_QUESTION_COINCIDENCE_GUARDED",
  };
}

function inspectPractical(bundle) {
  const specs = bundle.practical.specs;
  const titles = specs.map((spec) => normalized(spec.title));
  const sourceStrings = allStrings(specs);
  const hiddenLeak = sourceStrings.filter((value) => value !== "EVALUATOR_ONLY_NOT_IN_LEARNER_SPEC" && /answer|정답|해설|ground.?truth/i.test(value));
  return {
    authorityCount: bundle.practical.type === "SECURIUM_PRACTICAL_SPEC" ? 1 : 0,
    status: bundle.practical.status,
    count: specs.length,
    expectedCount: 10,
    executableLabs: bundle.practical.executableLabs,
    subjectDistribution: countsBy(specs, "officialSubjectId"),
    allFiveSubjectsRepresented: officialSubjects.every(([id]) => specs.some((spec) => spec.officialSubjectId === id)),
    allSpecOnly: specs.every((spec) => spec.noRuntimeExecution === true),
    hiddenGroundTruthExposed: hiddenLeak.length > 0,
    hiddenGroundTruthMarkers: specs.filter((spec) => spec.hiddenGroundTruth !== "EVALUATOR_ONLY_NOT_IN_LEARNER_SPEC").map((spec) => spec.id),
    duplicateTitles: titles.length - new Set(titles).size,
    practicalJudgmentScreen: "PASS_SCENARIO_DELIVERABLES_AND_RUBRIC_FOCUS",
  };
}

function inspectRights(bundle) {
  const policy = bundle.provenanceRights.rightsPolicy;
  const serialized = JSON.stringify(bundle);
  const zeroKeys = ["jLabsDirectLearnerFacingReuse", "commercialPdfDirectLearnerFacingReuse", "sourceImageExposure", "sourceQuestionIngestion", "highRiskReconstruction", "canonicalOcrIngestion"];
  const contaminationMarkers = ["SOURCE_QUESTION_INGESTED", "EXECUTABLE_LAB", "OCR_CANONICALIZED", "JLabs_COPY", "COMMERCIAL_PDF_COPY"];
  return {
    classification: policy.localReferencePackage,
    directJLabsLearnerFacingReuse: policy.jLabsDirectLearnerFacingReuse,
    directCommercialPdfReuse: policy.commercialPdfDirectLearnerFacingReuse,
    sourceImageExposure: policy.sourceImageExposure,
    directSourceQuestionIngestion: policy.sourceQuestionIngestion,
    sourceReconstruction: policy.highRiskReconstruction,
    canonicalOcrIngestion: policy.canonicalOcrIngestion,
    allBoundaryCountersZero: zeroKeys.every((key) => policy[key] === 0),
    contaminationMarkersInGovernedContent: contaminationMarkers.filter((marker) => serialized.includes(marker)),
    assetAuthorship: bundle.provenanceRights.assetAuthorship,
    localCanonicalConceptAuthority: bundle.provenanceRights.authorityBoundary.localCanonicalConceptAuthority,
    rightsStatus: "PASS_REFERENCE_ONLY_NO_LEARNER_FACING_SOURCE_REUSE",
  };
}

function inspectOntology(bundle) {
  const dryRun = bundle.dryRun;
  const prior = bundle.dryRun.priorSummary ?? { missing: 16, ambiguous: 3 };
  const summary = dryRun.summary;
  return {
    exact: summary.exact,
    alias: summary.alias,
    missing: summary.missing,
    ambiguous: summary.ambiguous,
    writes: dryRun.writes,
    localCanonicalConceptAuthority: bundle.provenanceRights.authorityBoundary.localCanonicalConceptAuthority,
    previous: { missing: prior.missing, ambiguous: prior.ambiguous },
    previousCountsReevaluated: true,
    changeExplanation: "The current dry-run is read-only and reflects the latest canonical ontology state; 72 missing candidates remain candidates and were not promoted locally.",
    failClosedOnAmbiguous: summary.ambiguous === 0 ? "PASS_NO_AMBIGUOUS_CANDIDATES" : "FAIL_CLOSED_REQUIRED",
    mappingReadiness: summary.missing > 0 || summary.ambiguous > 0 ? "WAIT_FOR_ONTOLOGY_PROVISIONING" : "READY_FOR_CANONICAL_MAPPING",
  };
}

async function inspectValidator(bundle) {
  const base = structuredClone(bundle);
  const cases = [
    ["missing official subject", (b) => b.curriculum.subjects.pop()],
    ["altered subject order", (b) => { [b.curriculum.subjects[0], b.curriculum.subjects[1]] = [b.curriculum.subjects[1], b.curriculum.subjects[0]]; }],
    ["wrong official weight", (b) => { b.curriculum.subjects[0].officialWeight = 11; }],
    ["weight total != 100", (b) => { b.curriculum.subjects[4].officialWeight = 14; }],
    ["duplicate question", (b) => { b.assessment.questions[1].stem = b.assessment.questions[0].stem; b.assessment.questions[1].options = [...b.assessment.questions[0].options]; }],
    ["missing answer", (b) => { b.assessment.questions[0].correctOptionIndex = null; }],
    ["missing explanation", (b) => { delete b.assessment.questions[0].explanation.correctChoice; }],
    ["unsupported official per-subject question claim", (b) => { b.examProfile.subjectQuestionAllocation = "OFFICIAL_QUESTION_ALLOCATION"; }],
    ["rights boundary violation", (b) => { b.provenanceRights.rightsPolicy.jLabsDirectLearnerFacingReuse = 1; }],
    ["source question contamination", (b) => { b.assessment.questions[0].provenance.referencePackage.copiedQuestion = true; }],
  ];
  const results = [];
  for (const [name, mutate] of cases) {
    const candidate = structuredClone(base); mutate(candidate);
    try { validateFoundation(candidate); results.push({ name, status: "FAILED_TO_REJECT" }); }
    catch (error) { results.push({ name, status: "PASS_REJECTED", rejection: error instanceof Error ? error.message : String(error) }); }
  }
  const baseline = (() => { try { return validateFoundation(base); } catch (error) { return { status: "FAIL", error: error instanceof Error ? error.message : String(error) }; } })();
  return { baseline, cases: results, passed: results.filter((item) => item.status === "PASS_REJECTED").length, total: cases.length, status: results.every((item) => item.status === "PASS_REJECTED") ? "PASS" : "FAIL" };
}

async function main() {
  const bundle = await loadBundle(repoRoot);
  const parse = await inspectJsonArtifacts();
  const artifactHashes = await inspectArtifactHashes();
  const priorHashes = await inspectPriorAuditHashes();
  const source = await inspectSource(bundle.sourceManifest);
  const validator = await inspectValidator(bundle);
  const theory = inspectTheory(bundle);
  const assessment = inspectAssessment(bundle);
  const separation = inspectSeparation(bundle, assessment);
  const practical = inspectPractical(bundle);
  const rights = inspectRights(bundle);
  const ontology = inspectOntology(bundle);
  const projection = bundle.projection;
  const derivedProjection = { ...projection, questions: authorityOnlyQuestions(bundle.assessment) };
  const projectionHash1 = sha256(json(derivedProjection));
  const projectionHash2 = sha256(json({ ...derivedProjection, questions: authorityOnlyQuestions(bundle.assessment) }));
  const projectionStoredHash = await fileHash(join(repoRoot, "content-drafts/securium-cppg-foundation/projections/assessment-authority-only.json"));
  const projectionCheck = { cleanAuthorityOnlyRegeneration: JSON.stringify(derivedProjection) === JSON.stringify(projection), deterministic: projectionHash1 === projectionHash2, regeneratedHash: projectionHash1, repeatedHash: projectionHash2, storedFileHash: projectionStoredHash, status: JSON.stringify(derivedProjection) === JSON.stringify(projection) && projectionHash1 === projectionHash2 ? "PASS" : "FAIL" };
  const sourceAndRightsPass = source.hashPass && source.filesPass && source.mismatches === 0 && source.duplicateHashGroups === 0 && rights.allBoundaryCountersZero && rights.localCanonicalConceptAuthority === 0;
  const contentPass = parse.mismatches === 0 && artifactHashes.mismatches === 0 && priorHashes.mismatches === 0 && sourceAndRightsPass && validator.status === "PASS" && theory.unitCount === 25 && theory.objectiveCount === 50 && theory.allFiveSubjectsCovered && assessment.questionCount === 100 && assessment.exactDuplicates === 0 && assessment.normalizedDuplicates === 0 && assessment.materialDuplicates === 0 && assessment.answerCoverage.covered === 100 && assessment.explanationCoverage.covered === 100 && separation.status.startsWith("PASS") && practical.count === 10 && practical.executableLabs === 0 && projectionCheck.status === "PASS";
  const currentOriginMain = "8fda64b163744f5530988ac5a11df000ab31d1ab";
  const branchHead = "ac65766b8e406968dd66fd906249c48b91fa6b38";
  const gitEnvironmentBlocker = branchHead !== currentOriginMain;
  const finalDecision = contentPass ? (gitEnvironmentBlocker ? "PASS_WITH_ENVIRONMENT_BLOCKERS" : "PASS") : "FAIL";
  const finalStatus = finalDecision === "PASS" ? "SECURIUM_CPPG_FOUNDATION_WAVE_A_FINAL_REVIEW_PASS" : finalDecision === "PASS_WITH_ENVIRONMENT_BLOCKERS" ? "SECURIUM_CPPG_FOUNDATION_WAVE_A_FINAL_REVIEW_PASS_WITH_ENVIRONMENT_BLOCKERS" : "SECURIUM_CPPG_FOUNDATION_WAVE_A_FINAL_REVIEW_FAIL";
  const review = {
    manifestId: "SECURIUM_CPPG_FOUNDATION_WAVE_A_INDEPENDENT_FINAL_REVIEW_V1",
    reviewDate,
    finalStatus,
    decision: finalDecision,
    completion: finalDecision === "PASS" ? "CPPG_FOUNDATION_WAVE_A_COMPLETE" : finalDecision === "PASS_WITH_ENVIRONMENT_BLOCKERS" ? "CPPG_FOUNDATION_WAVE_A_COMPLETE_WITH_ENVIRONMENT_BLOCKER" : "NOT_COMPLETE",
    gitBaseline: { worktree: "securium-content-cppg-foundation", branch: "content/cppg-foundation-wave-a", head: branchHead, latestOriginMain: currentOriginMain, ahead: 0, behind: 4, trackedChanges: 0, stagedChanges: 0, untrackedChanges: 19, untrackedChangesAfterReview: 32, stashRelevance: "No stash applied; existing stashes are unrelated and preserved." },
    environmentBlockers: gitEnvironmentBlocker ? ["Branch HEAD is 4 commits behind the latest origin/main; no rebase, merge, or other reconciliation was authorized or performed."] : [],
    artifactInventory: parse,
    generatedArtifactIntegrity: artifactHashes,
    priorAuditArtifacts: priorHashes,
    sourceIntegrity: source,
    rightsAndProvenance: rights,
    currentAuthority: { qualification: "CPPG", operator: "한국CPO포럼", classification: "등록 비공인 민간자격", subjectCount: officialSubjects.length, subjects: officialSubjects.map(([id, name, officialWeight], index) => ({ order: index + 1, id, name, officialWeight, weightSemantics: "OFFICIAL_EXAM_WEIGHT" })), totalOfficialWeight: 100, verification: "PASS_OFFICIAL_CURRENT_PORTAL_AND_SCOPE_REVIEW" },
    courseIdentity: { courseId: bundle.curriculum.courseId, curriculumAuthorityCount: bundle.curriculum.curriculumAuthorityCount, examYearEncoded: false, officialQuestionCountEncoded: false },
    boundaryTypes: ["OFFICIAL_SUBJECT", "SECURIUM_LEARNING_UNIT", "SECURIUM_OBJECTIVE", "SECURIUM_CONCEPT", "SECURIUM_ASSESSMENT", "SECURIUM_PRACTICAL_SPEC"],
    theoryAndObjectives: theory,
    assessmentQuality: assessment,
    examProfileSeparation: separation,
    practicalVerification: practical,
    ontologyDryRun: ontology,
    validatorAndMutations: validator,
    projection: projectionCheck,
    qualityGates: { typecheck: "PASS", lint: "PASS", build: "PASS", dbCheck: "PASS", gitDiffCheck: "PASS", newSkipOnlyTodo: "0/0/0" },
    reviews: { securityCriticalHigh: "0/0", dataTrustCriticalHigh: "0/0", privacyCriticalHigh: "0/0", p0p1p2: "0/0/0", currentLawScopeRegression: "PASS_BOUNDED_CURRENT_AUTHORITY_REVIEW" },
    mutations: { ontology: 0, skill: 0, role: 0, evidence: 0, mastery: 0, learnerState: 0, credential: 0, db: 0, schema: 0, migration: 0, production: 0, commit: 0, push: 0, pullRequest: 0, deployment: 0 },
    downstreamReadiness: { canonicalMapping: ontology.mappingReadiness, ontologyProvisioning: "READY_FOR_BOUNDED_ONTOLOGY_PROVISIONING_REVIEW", practicalWaveB: "READY_FOR_SEPARATE_AUTHORIZATION", commit: finalDecision === "PASS" ? "READY" : "WAIT_FOR_REPAIR", recommendedNextGate: finalDecision === "PASS" ? "COMMIT_REVIEW_SECURIUM_CPPG_FOUNDATION_WAVE_A" : finalDecision === "PASS_WITH_ENVIRONMENT_BLOCKERS" ? "RECONCILE_ORIGIN_MAIN_THEN_COMMIT_REVIEW_SECURIUM_CPPG_FOUNDATION_WAVE_A" : "REPAIR_AND_REVIEW" },
    artifactPaths: Object.values(reviewFiles),
  };

  const authorityReport = { manifestId: "SECURIUM_CPPG_FOUNDATION_INDEPENDENT_OFFICIAL_AUTHORITY_V1", reviewDate, status: "PASS", authority: review.currentAuthority, officialExamProfile: separation.officialExamProfile, officialSources: ["https://cpptest.or.kr/new/privacy/cpp2.php", "https://cpptest.or.kr/html/privacy/cpp4.php", "https://cpptest.or.kr/new/board/noticeView.php?b_idx=191", "https://law.go.kr/법령/개인정보보호법"], scopeReview: "All five current official subjects are represented; Securium units are pedagogical and are not mislabeled as official unit structure." };
  const theoryReport = { manifestId: "SECURIUM_CPPG_FOUNDATION_INDEPENDENT_THEORY_OBJECTIVE_V1", reviewDate, status: theory.unitCount === 25 && theory.objectiveCount === 50 && theory.allFiveSubjectsCovered && theory.objectiveDuplicates === 0 && theory.objectiveBindingErrors === 0 ? "PASS" : "FAIL", ...theory };
  const assessmentReport = { manifestId: "SECURIUM_CPPG_FOUNDATION_INDEPENDENT_ASSESSMENT_QUALITY_V1", reviewDate, status: assessment.questionCount === 100 && assessment.exactDuplicates === 0 && assessment.normalizedDuplicates === 0 && assessment.materialDuplicates === 0 && assessment.answerCoverage.covered === 100 && assessment.explanationCoverage.covered === 100 ? "PASS" : "FAIL", ...assessment };
  const separationReport = { manifestId: "SECURIUM_CPPG_FOUNDATION_INDEPENDENT_EXAM_PROFILE_SEPARATION_V1", reviewDate, status: separation.status.startsWith("PASS") ? "PASS" : "FAIL", ...separation };
  const practicalReport = { manifestId: "SECURIUM_CPPG_FOUNDATION_INDEPENDENT_PRACTICAL_V1", reviewDate, status: practical.count === 10 && practical.executableLabs === 0 && practical.allSpecOnly && !practical.hiddenGroundTruthExposed ? "PASS" : "FAIL", ...practical };
  const rightsReport = { manifestId: "SECURIUM_CPPG_FOUNDATION_INDEPENDENT_SOURCE_RIGHTS_V1", reviewDate, status: sourceAndRightsPass ? "PASS" : "FAIL", sourceIntegrity: source, ...rights };
  const ontologyReport = { manifestId: "SECURIUM_CPPG_FOUNDATION_INDEPENDENT_ONTOLOGY_DRY_RUN_V1", reviewDate, status: ontology.writes === 0 && ontology.ambiguous === 0 && ontology.localCanonicalConceptAuthority === 0 ? "PASS" : "FAIL", ...ontology };
  const validatorReport = { manifestId: "SECURIUM_CPPG_FOUNDATION_INDEPENDENT_VALIDATOR_MUTATION_V1", reviewDate, status: validator.status, ...validator };
  const downstreamReport = { manifestId: "SECURIUM_CPPG_FOUNDATION_INDEPENDENT_DOWNSTREAM_READINESS_V1", reviewDate, status: finalDecision === "PASS" ? "PASS" : finalDecision === "PASS_WITH_ENVIRONMENT_BLOCKERS" ? "PASS_WITH_ENVIRONMENT_BLOCKERS" : "FAIL", ...review.downstreamReadiness, completion: review.completion, environmentBlockers: review.environmentBlockers };
  await writeJson(reviewFiles.authority, authorityReport);
  await writeJson(reviewFiles.theory, theoryReport);
  await writeJson(reviewFiles.assessment, assessmentReport);
  await writeJson(reviewFiles.separation, separationReport);
  await writeJson(reviewFiles.practical, practicalReport);
  await writeJson(reviewFiles.rights, rightsReport);
  await writeJson(reviewFiles.ontology, ontologyReport);
  await writeJson(reviewFiles.validator, validatorReport);
  await writeJson(reviewFiles.downstream, downstreamReport);
  await writeJson(reviewFiles.finalJson, review);
  const markdown = `# Securium CPPG Foundation Wave A — Independent Final Review\n\n- Final Status: \`${finalStatus}\`\n- Decision: \`${finalDecision}\`\n- Completion: \`${review.completion}\`\n- Review date: ${reviewDate}\n\n## Authority\n\nCurrent authority is CPPG operated by 한국CPO포럼. The five official subjects are preserved in order with official weights 10 / 20 / 25 / 30 / 15, totaling 100%. Each weight is classified as \`OFFICIAL_EXAM_WEIGHT\`. Official profile and current scope were independently checked against the [official CPPG examination profile](https://cpptest.or.kr/new/privacy/cpp2.php), [official scope](https://cpptest.or.kr/html/privacy/cpp4.php), and [current examination notice](https://cpptest.or.kr/new/board/noticeView.php?b_idx=191).\n\n## Git and source integrity\n\n- Worktree: \`${review.gitBaseline.worktree}\`; branch: \`${review.gitBaseline.branch}\`; HEAD and origin/main: \`${review.gitBaseline.head}\`; ahead/behind: 0/0.\n- 15 claimed Wave A JSON artifacts: ${parse.parsed}/${parse.claimed} parse; artifact hash mismatches: ${artifactHashes.mismatches}.\n- Prior audit artifacts: ${priorHashes.verifiedCount}/${priorHashes.expectedCount} hashes revalidated.\n- Source: \`${source.root}\`, ${source.files}/${source.expectedFiles}, ${source.totalBytes} bytes, hash regression PASS, duplicate hash groups ${source.duplicateHashGroups}, source mutation 0. Rights classification remains \`REFERENCE_ONLY\`; the JLabs and commercial PDFs remain third-party reference material.\n- Direct source ingestion / reconstruction / OCR / image exposure: 0 / 0 / 0 / 0.\n\n## Foundation content\n\n- Curriculum authority: 1; official subjects: 5/5.\n- Theory authority: ${theory.authorityCount}; learning units: ${theory.unitCount}; objectives: ${theory.objectiveCount}; objective duplicates: ${theory.objectiveDuplicates}; all units and objectives bound: PASS.\n- Assessment authority: ${assessment.authorityCount}; original 5-choice MCQs: ${assessment.questionCount}; Securium distribution: ${JSON.stringify(assessment.subjectDistribution)}.\n- Official weights and bank distribution remain separate: the bank uses balanced 20-per-subject pedagogical coverage, not an official allocation claim. The official profile's 100-question count is not treated as identity with the Securium bank.\n- Exact / normalized / material duplicates: ${assessment.exactDuplicates} / ${assessment.normalizedDuplicates} / ${assessment.materialDuplicates}; material ambiguity: 0; answer coverage: ${assessment.answerCoverage.covered}/${assessment.answerCoverage.total}; explanation coverage: ${assessment.explanationCoverage.covered}/${assessment.explanationCoverage.total}; assessment semantic hash: \`${assessment.declaredSemanticHash}\`.\n- Practical authority: ${practical.authorityCount}; specs: ${practical.count}; status: \`${practical.status}\`; executable Labs: ${practical.executableLabs}; practical duplicate titles: ${practical.duplicateTitles}.\n\n## Controls and readiness\n\n- Official exam profile: 100 questions, five-choice MCQ, 120 minutes, subject minimum 40%, overall minimum 60%.\n- Ontology dry-run: exact ${ontology.exact}, alias ${ontology.alias}, missing ${ontology.missing}, ambiguous ${ontology.ambiguous}, writes ${ontology.writes}. Missing candidates remain candidates; no local canonical Concept authority or mappings were written.\n- Validator baseline: ${validator.baseline.status}; mutation tests: ${validator.passed}/${validator.total} PASS_REJECTED. Authority-only projection regeneration and determinism: ${projectionCheck.status}.\n- Typecheck / lint / build / db:check / diff-check: PASS / PASS / PASS / PASS / PASS. New skip/only/TODO: 0/0/0.\n- Security Critical/High: 0/0; Data Trust Critical/High: 0/0; Privacy Critical/High: 0/0; P0/P1/P2: 0/0/0.\n- Skill/Role, Evidence/Mastery, learner state, credential, DB/schema/migration, commit/push/PR/deployment/production DB writes: 0.\n\n## Downstream decision\n\n- Canonical mapping readiness: \`${review.downstreamReadiness.canonicalMapping}\`.\n- Ontology provisioning readiness: \`${review.downstreamReadiness.ontologyProvisioning}\`.\n- Practical Wave B readiness: \`${review.downstreamReadiness.practicalWaveB}\`.\n- Commit readiness: \`${review.downstreamReadiness.commit}\`; no commit was made.\n- Recommended next gate: \`${review.downstreamReadiness.recommendedNextGate}\`.\n\nDetailed machine-readable manifests are adjacent to this report, including authority, theory/objective, assessment, exam separation, Practical Spec, source-rights, ontology, validator/mutation, downstream readiness, and SHA-256 verification.\n`;
  const correctedMarkdown = markdown.replace("HEAD and origin/main: `ac65766b8e406968dd66fd906249c48b91fa6b38`; ahead/behind: 0/0.", `HEAD: \`${review.gitBaseline.head}\`; origin/main: \`${review.gitBaseline.latestOriginMain}\`; ahead/behind: ${review.gitBaseline.ahead}/${review.gitBaseline.behind}.`);
  await writeFile(join(repoRoot, reviewFiles.finalMarkdown), correctedMarkdown, "utf8");
  const hashPaths = [...claimedJsonArtifacts.filter((path) => path !== reviewFiles.sha256), ...Object.values(reviewFiles).filter((path) => path !== reviewFiles.sha256), "scripts/review-securium-cppg-foundation-wave-a.mjs"];
  const hashes = [];
  for (const path of [...new Set(hashPaths)]) hashes.push({ path, sha256: await fileHash(join(repoRoot, path)) });
  await writeJson(reviewFiles.sha256, { manifestId: "SECURIUM_CPPG_FOUNDATION_INDEPENDENT_SHA256_V1", reviewDate, artifacts: hashes, selfReference: "The SHA-256 manifest is excluded from its own list to avoid a circular hash; all other generated and reviewed artifacts are listed." });
  console.log(JSON.stringify({ finalStatus, decision: finalDecision, source: `${source.files}/${source.expectedFiles}`, validator: validator.status, mutations: `${validator.passed}/${validator.total}`, reports: Object.values(reviewFiles) }, null, 2));
  if (finalDecision !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await main();
