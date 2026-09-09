import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(root, "content-drafts", "securium-isrm-foundation");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(contentRoot, name), "utf8"));
}

export function validateProductAuthority() {
  const manifest = readJson("manifest.json");
  const course = readJson("course.json");
  const subjects = readJson("subject-authority.json");
  const curriculum = readJson("curriculum-authority.json");
  const theory = readJson("theory-authority.json");
  const assessment = readJson("assessment-authority.json");
  const practicals = readJson("practical-spec-authority.json");
  const source = readJson("source-manifest.json");
  const provenance = readJson("provenance-rights-manifest.json");
  const errors = [];
  const expectedNames = [
    "정보보호 위험관리 계획",
    "정보보호 위험평가",
    "정보보호 위험대응",
    "정보보호 관리체계운영",
    "정보보호 위험대책관리",
  ];
  const expectedAllocations = [20, 20, 20, 10, 10];
  const expectedSourceHashes = [
    "BD15551DCA7A7E72197C713244D5AB165D7C26C89DA56A174CA15BB4E4AC82D0",
    "DDA6DF2C6163D32F361F5773FDDA648884AB2E72D0C523F5C52297FD1D148C61",
    "1FF4981397462274BFDE7BBA35753EC613D834AFB7FBDB309687AB4BD83F6DA3",
  ];
  const subjectIds = new Set(subjects.subjects.map((subject) => subject.id));
  const unitIds = new Set(curriculum.units.map((unit) => unit.id));
  const serialized = JSON.stringify({ manifest, course, subjects, curriculum, theory, assessment, practicals, source, provenance });

  if (manifest.authorityType !== "CANONICAL_STATIC_PRODUCT_CONTENT_AUTHORITY") errors.push("manifest authority type");
  if (manifest.files.length !== 8 || manifest.reportDependencies !== 0) errors.push("package closure");
  if (course.courseId !== "course-isrm" || course.courseAuthorityCount !== 1) errors.push("course identity");
  if (course.subjectCount !== 5 || course.pedagogicalUnitCount !== 12 || course.theoryAssetCount !== 3 || course.questionCount !== 30 || course.practicalSpecCount !== 10) errors.push("course counts");
  if (subjects.subjectCount !== 5 || JSON.stringify(subjects.subjects.map((subject) => subject.officialName)) !== JSON.stringify(expectedNames)) errors.push("subject identities");
  if (JSON.stringify(subjects.subjects.map((subject) => subject.allocation)) !== JSON.stringify(expectedAllocations)) errors.push("subject allocations");
  if (subjects.subjects.some((subject) => subject.allocationClassification !== "OFFICIAL_EXAM_METADATA" || subject.scopeClaim !== "IDENTITY_ONLY")) errors.push("allocation semantics");
  if (curriculum.unitCount !== 12 || curriculum.units.some((unit) => unit.classification !== "SECURIUM_PEDAGOGICAL" || unit.unsupportedOfficialClaim !== false || !subjectIds.has(unit.subjectId))) errors.push("curriculum boundary");
  if (theory.assetCount !== 3 || theory.assets.length !== 3 || theory.assets.some((asset) => asset.decision !== "ACCEPT_INDEPENDENT_REAUTHOR" || asset.sourceExpressionReuse !== 0 || asset.bodyContentAddedInThisGate !== false)) errors.push("theory boundary");
  if (assessment.questionCount !== 30 || assessment.questions.length !== 30 || new Set(assessment.questions.map((question) => question.id)).size !== 30) errors.push("question count or uniqueness");
  if (assessment.officialKcaQuestionCount !== 0 || assessment.thirdPartyQuestionCount !== 0 || assessment.sourceExpressionReuse !== 0 || assessment.questions.some((question) => question.authoringStatus !== "SECURIUM_INDEPENDENT" || question.decision !== "ACCEPT" || question.answerAuthority !== "PRESENT" || question.explanation !== "PRESENT" || !subjectIds.has(question.officialSubjectId) || !unitIds.has(question.learningUnitId))) errors.push("question authority");
  if (practicals.practicalCount !== 10 || practicals.practicals.length !== 10 || practicals.executableRegistration !== 0 || practicals.execution !== 0 || practicals.officialExamContent !== false || practicals.practicals.some((practical) => practical.classification !== "SYNTHETIC" || practical.mode !== "SPEC_ONLY" || practical.officialExamContent !== false)) errors.push("practical boundary");
  if (source.certification !== "ISRM" || source.issuer !== "KCA" || source.registration !== "2024-004467" || source.officialSourceSemanticVersion !== "OFFICIAL_SOURCE_SEMANTIC_VERSION_UNKNOWN" || source.detailedOfficialScope !== "PARTIAL" || source.rightsClassification !== "FACTUAL_USE_ONLY") errors.push("source limitation");
  if (source.officialSources.length !== 3 || JSON.stringify(source.officialSources.map((item) => item.sha256)) !== JSON.stringify(expectedSourceHashes) || source.officialSources.some((item) => item.officialExpressionAuthority !== false || item.rightsClassification !== "FACTUAL_USE_ONLY")) errors.push("official source authority");
  if (source.excludedSources.length !== 2 || source.excludedSources.some((item) => item.classification !== "COMMERCIAL_RESTRICTED" || item.canonicalAuthoringAuthority !== false || item.contentUsed !== false)) errors.push("commercial exclusion");
  if (provenance.unknownProvenanceAccepted !== 0 || provenance.commercialInfluence !== 0 || provenance.officialExpressionReproduction !== 0 || provenance.rights.commercialCanonicalDependency !== 0) errors.push("provenance rights");
  if (serialized.includes("reports/content-audit") || /[A-Z]:\\|[A-Z]:\//.test(serialized)) errors.push("report or local path dependency");
  return {
    valid: errors.length === 0,
    errors,
    metrics: {
      course: 1,
      subjects: 5,
      curriculumUnits: 12,
      theoryAssets: 3,
      questions: 30,
      practicalSpecs: 10,
      officialSources: 3,
      commercialSourceAuthority: 0,
      unknownProvenance: 0,
      reportDependencies: 0,
      runtimeRegistration: 0,
      ontologyProvisioning: 0,
      roleSkillWrites: 0,
      evidenceMaterialization: 0,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const result = validateProductAuthority();
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}
