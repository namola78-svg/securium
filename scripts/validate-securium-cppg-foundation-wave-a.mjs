import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_SUBJECTS = [
  ["CPPG-S1", "개인정보보호의 이해", 10],
  ["CPPG-S2", "개인정보보호 제도", 20],
  ["CPPG-S3", "개인정보 라이프사이클 관리", 25],
  ["CPPG-S4", "개인정보의 보호조치", 30],
  ["CPPG-S5", "개인정보 관리체계", 15],
];

function fail(message) { throw new Error(message); }
function assert(condition, message) { if (!condition) fail(message); }
function unique(values, label) { assert(new Set(values).size === values.length, `${label} contains duplicates`); }
function normalized(value) { return String(value).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim(); }

export function validateFoundation(bundle) {
  const { curriculum, theory, objectives, assessment, practical, examProfile, provenanceRights, dryRun, sourceManifest, projection } = bundle;
  assert(curriculum.curriculumAuthorityCount === 1, "exactly one curriculum authority required");
  assert(curriculum.courseId === "course-cppg", "course identity must be course-cppg");
  assert(curriculum.subjects.length === 5, "five official subjects required");
  EXPECTED_SUBJECTS.forEach(([id, name, weight], index) => {
    const subject = curriculum.subjects[index];
    assert(subject?.id === id, `official subject order mismatch at ${index + 1}`);
    assert(subject?.name === name, `official subject name mismatch for ${id}`);
    assert(subject?.order === index + 1, `official subject order number mismatch for ${id}`);
    assert(subject?.officialWeight === weight, `official weight mismatch for ${id}`);
    assert(subject?.weightSemantics === "OFFICIAL_EXAM_WEIGHT", `official weight semantics missing for ${id}`);
  });
  assert(curriculum.subjects.reduce((sum, subject) => sum + subject.officialWeight, 0) === 100, "official weights must total 100");
  assert(theory.type === "THEORY_AUTHORITY" && theory.editable === true, "one editable theory authority required");
  assert(theory.units.length >= 5, "theory must have sufficient granularity");
  unique(theory.units.map((unit) => unit.id), "learning unit IDs");
  const subjectIds = new Set(EXPECTED_SUBJECTS.map(([id]) => id));
  for (const unit of theory.units) {
    assert(unit.type === "SECURIUM_LEARNING_UNIT" && subjectIds.has(unit.officialSubjectId), `invalid learning-unit binding ${unit.id}`);
    for (const field of ["definition", "purpose", "keyLegalOperationalConcept", "scope", "importantDistinctions", "lifecycle", "commonMisunderstandings", "appliedScenario", "cppgExamReasoningPoint"]) assert(String(unit[field]).trim().length > 5, `theory depth missing for ${unit.id}:${field}`);
    assert(Array.isArray(unit.objectives) && unit.objectives.length > 0, `unit has no objectives ${unit.id}`);
  }
  assert(objectives.type === "OBJECTIVE_AUTHORITY", "one objective authority required");
  unique(objectives.objectives.map((objective) => objective.id), "objective IDs");
  const unitIds = new Set(theory.units.map((unit) => unit.id));
  for (const objective of objectives.objectives) assert(objective.measurable && unitIds.has(objective.learningUnitId) && subjectIds.has(objective.officialSubjectId), `invalid objective binding ${objective.id}`);
  for (const unit of theory.units) assert(objectives.objectives.some((objective) => objective.learningUnitId === unit.id), `objective authority does not cover ${unit.id}`);
  assert(assessment.type === "ASSESSMENT_AUTHORITY" && assessment.bankClassification === "SECURIUM_QUESTION_BANK", "canonical assessment authority required");
  assert(assessment.questionCount === 100 && assessment.questions.length === 100, "Foundation bank must contain exactly 100 bounded questions");
  assert(assessment.distributionLabel === "SECURIUM_PEDAGOGICAL_DISTRIBUTION_BALANCED_20_PER_SUBJECT_FOR_FOUNDATION_COVERAGE", "question distribution label must be pedagogical");
  unique(assessment.questions.map((question) => question.id), "question IDs");
  const stems = assessment.questions.map((question) => normalized(question.stem)); unique(stems, "normalized question stems");
  const material = assessment.questions.map((question) => normalized(`${question.stem}|${question.options.join("|")}`)); unique(material, "material question fingerprints");
  const subjectCounts = Object.fromEntries(EXPECTED_SUBJECTS.map(([id]) => [id, 0]));
  for (const question of assessment.questions) {
    assert(question.authoringStatus === "SECURIUM_ORIGINAL", `non-original question ${question.id}`);
    assert(question.type === "MCQ_5_CHOICE" && question.options.length === 5, `question format/options invalid ${question.id}`);
    assert(Number.isInteger(question.correctOptionIndex) && question.correctOptionIndex >= 0 && question.correctOptionIndex < 5, `answer missing/invalid ${question.id}`);
    assert(question.explanation?.correctChoice && question.explanation?.distractorAnalysis?.length === 4 && question.explanation?.relatedSubject && question.explanation?.relatedUnit && question.explanation?.objective && question.explanation?.currentAuthorityRationale, `explanation incomplete ${question.id}`);
    assert(subjectIds.has(question.officialSubjectId) && unitIds.has(question.learningUnitId), `question binding invalid ${question.id}`);
    assert(objectives.objectives.some((objective) => objective.id === question.objectiveId && objective.learningUnitId === question.learningUnitId), `question objective binding invalid ${question.id}`);
    subjectCounts[question.officialSubjectId] += 1;
    assert(question.provenance?.authorship === "SECURIUM_INDEPENDENT_AUTHORSHIP", `question provenance missing ${question.id}`);
    assert(question.provenance.referencePackage.copiedText === false && question.provenance.referencePackage.copiedQuestion === false && question.provenance.referencePackage.sourceImageUsed === false, `source contamination marker on ${question.id}`);
  }
  assert(JSON.stringify(subjectCounts) === JSON.stringify({ "CPPG-S1": 20, "CPPG-S2": 20, "CPPG-S3": 20, "CPPG-S4": 20, "CPPG-S5": 20 }), `subject coverage is not 20 each: ${JSON.stringify(subjectCounts)}`);
  assert(examProfile.type === "OFFICIAL_EXAM_PROFILE" && examProfile.questions === 100 && examProfile.choiceCount === 5 && examProfile.durationMinutes === 120 && examProfile.subjectMinimumPercent === 40 && examProfile.overallMinimumPercent === 60, "official exam profile mismatch");
  assert(examProfile.subjectQuestionAllocation === "NOT_ASSERTED_BY_THIS_ARTIFACT", "unsupported official per-subject allocation claim");
  assert(practical.type === "SECURIUM_PRACTICAL_SPEC" && practical.status === "SPEC_ONLY" && practical.executableLabs === 0 && practical.specs.length === 10, "practical authority/status/count mismatch");
  unique(practical.specs.map((spec) => spec.id), "practical IDs");
  for (const spec of practical.specs) { assert(spec.noRuntimeExecution === true && spec.hiddenGroundTruth === "EVALUATOR_ONLY_NOT_IN_LEARNER_SPEC", `practical safety boundary missing ${spec.id}`); assert(subjectIds.has(spec.officialSubjectId), `practical subject binding invalid ${spec.id}`); }
  assert(provenanceRights.rightsPolicy.localReferencePackage === "REFERENCE_ONLY", "local reference rights boundary violated");
  for (const key of ["jLabsDirectLearnerFacingReuse", "commercialPdfDirectLearnerFacingReuse", "sourceImageExposure", "sourceQuestionIngestion", "highRiskReconstruction", "canonicalOcrIngestion"]) assert(provenanceRights.rightsPolicy[key] === 0, `rights/source boundary violated: ${key}`);
  assert(provenanceRights.authorityBoundary.localCanonicalConceptAuthority === 0, "local canonical concept authority must remain zero");
  assert(dryRun.writes === 0 && dryRun.summary.ambiguous === 0, "ontology dry-run must be read-only and fail-closed");
  assert(projection.projectionMode === "AUTHORITY_ONLY" && projection.generatedFrom === assessment.authorityId && projection.semanticHash === assessment.semanticHash, "projection is not authority-only or hash-bound");
  assert(JSON.stringify(projection.questions) === JSON.stringify(assessment.questions.map(({ id, type, officialSubjectId, learningUnitId, objectiveId, stem, options, correctOptionIndex, explanation, conceptCandidates, authoringStatus }) => ({ id, type, officialSubjectId, learningUnitId, objectiveId, stem, options, correctOptionIndex, explanation, conceptCandidates, authoringStatus }))), "projection differs from assessment authority");
  assert(sourceManifest.classification === "SOURCE_PACKAGE_REFERENCE_ONLY" && sourceManifest.fileCount === 133 && sourceManifest.totalBytes === 377555066 && sourceManifest.fileTypeCounts.JPG === 131 && sourceManifest.fileTypeCounts.PDF === 2 && sourceManifest.duplicateFiles === 0 && sourceManifest.sha256Mismatch === 0, "source package regression");
  assert(sourceManifest.pdfClassification.every((pdf) => pdf.classification.includes("REFERENCE_ONLY")), "PDF rights boundary violated");
  const serialized = JSON.stringify(bundle);
  assert(!serialized.includes("officialQuestionAllocation"), "unsupported official question allocation field found");
  assert(!serialized.includes("SOURCE_QUESTION_INGESTED"), "source question ingestion marker found");
  assert(!serialized.includes("EXECUTABLE_LAB"), "executable Lab marker found");
  return { status: "PASS", officialSubjects: 5, theoryUnits: theory.units.length, objectives: objectives.objectives.length, questions: assessment.questions.length, subjectCounts, practicalSpecs: practical.specs.length, ontology: dryRun.summary };
}

export async function revalidateSourceManifest(sourceManifest) {
  const observed = await Promise.all(sourceManifest.files.map(async (entry) => {
    const path = join(sourceManifest.sourceRoot, entry.relativePath);
    const data = await readFile(path);
    return { ...entry, observedBytes: data.byteLength, observedSha256: createHash("sha256").update(data).digest("hex") };
  }));
  const mismatches = observed.filter((entry) => entry.bytes !== entry.observedBytes || entry.sha256 !== entry.observedSha256);
  const duplicateHashCount = observed.length - new Set(observed.map((entry) => entry.observedSha256)).size;
  assert(mismatches.length === 0, `${mismatches.length} source hash mismatches`);
  assert(duplicateHashCount === 0, `${duplicateHashCount} duplicate source hashes`);
  assert(observed.length === 133, `source file count changed: ${observed.length}`);
  return { filesRevalidated: observed.length, mismatches: mismatches.length, duplicateHashGroups: duplicateHashCount };
}

export async function loadBundle(repoRoot) {
  const root = join(repoRoot, "content-drafts", "securium-cppg-foundation");
  const read = async (name) => JSON.parse(await readFile(join(root, name), "utf8"));
  return { curriculum: await read("curriculum-authority.json"), theory: await read("theory-authority.json"), objectives: await read("objective-authority.json"), assessment: await read("assessment-authority.json"), practical: await read("practical-spec-authority.json"), examProfile: await read("official-exam-profile.json"), provenanceRights: await read("provenance-rights-manifest.json"), dryRun: await read("ontology-concept-dry-run.json"), sourceManifest: await read("source-sha256-manifest.json"), projection: await read("projections/assessment-authority-only.json") };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const bundle = await loadBundle(repoRoot);
  const result = validateFoundation(bundle);
  const source = await revalidateSourceManifest(bundle.sourceManifest);
  const finalResult = { manifestId: "SECURIUM_CPPG_FOUNDATION_VALIDATION_V1", ...result, source, generatedAt: "2026-09-08", mutationTests: "see securium-cppg-foundation-wave-a-mutation-tests.json" };
  await writeFile(join(repoRoot, "reports", "content-audit", "securium-cppg-foundation-wave-a-validation.json"), `${JSON.stringify(finalResult, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(finalResult, null, 2));
}
