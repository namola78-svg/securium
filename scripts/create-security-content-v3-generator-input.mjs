import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GENERATOR_OUTPUT_OWNERSHIP,
  INPUT_AUTHORITY_ID,
  INPUT_AUTHORITY_VERSION,
  PROJECTION_RELATIVE_PATH,
  canonicalize,
  projectionByteSha256,
  projectionSemanticSha256,
  serializeCanonical,
  sha256Bytes,
} from "./security-content-v3-generator-input.mjs";
import { networkSecurityQuestionSamples } from "../lib/data/security-certification-network-security-questions.mjs";
import { systemSecurityQuestionSamples } from "../lib/data/security-certification-system-security-questions.mjs";
import { applicationSecurityQuestionSamples } from "../lib/data/security-certification-application-security-questions.mjs";
import { securityCertificationInformationSecurityGeneralQuestionSamples } from "../lib/data/security-certification-information-security-general-questions.mjs";
import { managementLawQuestionSamples } from "../lib/data/security-certification-management-law-questions.mjs";
import { practicalSecurityQuestionSamples } from "../lib/data/security-certification-practical-questions.mjs";
import { officialSecurityCertificationCourseLessons } from "../lib/data/security-certification-course-lessons.mjs";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const inputRoot = resolve(rootDir, "content-inputs/security-content-v3");
const projectionPath = resolve(rootDir, PROJECTION_RELATIVE_PATH);
const manifestPath = resolve(rootDir, "content-inputs/security-content-v3/manifest.json");
const sourceRoot = resolve(rootDir, "securium-content-upgrade-v2");

const questionSources = [
  ["lib/data/security-certification-network-security-questions.mjs", networkSecurityQuestionSamples],
  ["lib/data/security-certification-system-security-questions.mjs", systemSecurityQuestionSamples],
  ["lib/data/security-certification-application-security-questions.mjs", applicationSecurityQuestionSamples],
  ["lib/data/security-certification-information-security-general-questions.mjs", securityCertificationInformationSecurityGeneralQuestionSamples],
  ["lib/data/security-certification-management-law-questions.mjs", managementLawQuestionSamples],
  ["lib/data/security-certification-practical-questions.mjs", practicalSecurityQuestionSamples],
];

const questionRows = questionSources.flatMap(([, questions]) => questions.flatMap((question) =>
  (question.courseLinks ?? []).filter((link) => ["course-ise", "course-isie"].includes(link.courseId)).map((link) => ({
    course_id: link.courseId,
    id: question.id,
    title: question.title,
    content: question.content,
    type: question.type,
    difficulty: question.difficulty,
    answer_config_json: JSON.stringify(question.answerConfig ?? {}),
    status: question.status ?? "PUBLISHED",
    deleted: false,
    source: question.source ?? null,
  })),
));

function courseSuffix(courseId, curriculumNodeId) {
  const prefix = `curriculum-node-${courseId === "course-ise" ? "ise" : "isie"}-2027-2029-`;
  return String(curriculumNodeId).startsWith(prefix) ? String(curriculumNodeId).slice(prefix.length) : String(curriculumNodeId);
}

function courseAggregate(courseId) {
  const lessons = officialSecurityCertificationCourseLessons.filter((lesson) => lesson.courseId === courseId);
  const suffixes = lessons.map((lesson) => courseSuffix(courseId, lesson.curriculumNodeId));
  const parts = suffixes.map((suffix) => suffix.split("-").map((part) => Number(part))).filter((parts) => parts.every(Number.isFinite));
  const subjects = new Set(parts.map((parts) => parts.slice(0, 2).join("-")));
  const topics = new Set(parts.map((parts) => parts.slice(0, 3).join("-")));
  return {
    course_id: courseId,
    subject_count: subjects.size,
    topic_count: topics.size,
    learning_unit_count: new Set(suffixes).size,
    lesson_count: lessons.length,
    content_count: new Set(lessons.map((lesson) => lesson.contentId)).size,
    question_count: questionRows.filter((row) => row.course_id === courseId).length,
    written_question_count: questionRows.filter((row) => row.course_id === courseId && !row.id.includes("practical")).length,
    practical_question_count: questionRows.filter((row) => row.course_id === courseId && row.id.includes("practical")).length,
    ontology_edge_count: null,
    countBasis: "CANONICAL_REPOSITORY_SOURCE_PROJECTION",
  };
}

const projection = canonicalize({
  authority: {
    inputAuthorityId: INPUT_AUTHORITY_ID,
    version: INPUT_AUTHORITY_VERSION,
    type: "GENERATOR_INPUT_PROJECTION",
    sourceOfTruth: "READ_ONLY_PROJECTION_OF_CANONICAL_REPOSITORY_DOMAIN_AUTHORITY",
    runtimeAuthority: false,
    questionAuthority: false,
    ontologyAuthority: false,
    evidenceAuthority: false,
  },
  schema: {
    version: INPUT_AUTHORITY_VERSION,
    representation: "NORMALIZED_JSON",
    nullableValues: "PRESERVED_WHEN_SEMANTICALLY_MEANINGFUL",
    unorderedCollections: "EXPLICITLY_SORTED_BY_STABLE_ID",
    orderedCollections: "ORDER_PRESERVED",
  },
  provider: {
    providerMode: "OFFLINE_PROVIDER_NEUTRAL",
    d1Authority: "D1_GENERATOR_FIXTURE_ONLY",
    historicalD1: "NOT_PRESERVED_AND_NOT_CANONICAL",
    runtimeProvider: "SUPABASE_POSTGRESQL_UNCHANGED",
  },
  privacy: {
    personalData: 0,
    learnerEvidence: 0,
    excludedFields: ["user_id", "email", "account", "learner_activity", "question_attempts", "wrong_notes", "bookmarks", "review_schedules", "user_progress"],
  },
  inputPolicy: {
    unknownInputs: 0,
    sourceDirection: "CANONICAL_AUTHORITY_TO_READ_ONLY_PROJECTION",
    generatedArtifactAsSource: "FORBIDDEN",
  },
  questionPopulationContract: {
    courses: ["course-ise", "course-isie"],
    status: ["PUBLISHED"],
    deleted: false,
    source: "COMMITTED_CANONICAL_QUESTION_MODULES",
    generatedV3Questions: "EXCLUDED_FROM_EXISTING_QUESTION_DUPLICATE_POPULATION",
    learnerRows: "EXCLUDED",
  },
  ontologyPopulationContract: {
    namespace: "security-certification",
    source: "CANONICAL_REPOSITORY_ONTOLOGY_DIRECT_AUTHORITY",
    d1Rows: "EMPTY_NO_UNPINNED_PROVIDER_PROJECTION",
    authorityRole: "READ_ONLY_PROJECTION_NOT_CONCEPT_AUTHORITY",
  },
  theoryInputContract: {
    contentAndLessons: "COMMITTED_CANONICAL_COURSE_LESSON_MODULES",
    normalizedKnowledgeBase: "COMMITTED_V2_SOURCE_INPUT",
    theoryGapDependency: "THEORY_COVERAGE_OUTPUT_TO_THEORY_GAP_ANALYSIS_OUTPUT",
  },
  duplicateAnalysisPopulationContract: {
    fields: ["id", "title", "content", "type", "difficulty", "answer_config_json"],
    source: "COMMITTED_CANONICAL_QUESTION_MODULES",
    generatedV3Questions: "EXCLUDED",
  },
  lineage: {
    migration: { mode: "REPOSITORY_SCHEMA_REFERENCE_ONLY", revision: "drizzle-files-read-only" },
    seed: { mode: "SOURCE_PROJECTION_NO_DATABASE_SEED", revision: "not-applicable" },
  },
  sourceInputs: questionSources.map(([path]) => ({ path, role: "CANONICAL_QUESTION_SOURCE" })),
  courses: [courseAggregate("course-ise"), courseAggregate("course-isie")],
  questionRows,
  ontologyConcepts: [],
  databaseProjection: {
    providerMode: "OFFLINE_PROVIDER_NEUTRAL",
    d1Authority: "D1_GENERATOR_FIXTURE_ONLY",
    courseRows: [courseAggregate("course-ise"), courseAggregate("course-isie")],
    ontologyRows: [],
    userHistory: { represented: false, basis: "NO_LEARNER_DATA_IN_CANONICAL_GENERATOR_FIXTURE" },
    protectedCourseData: { represented: false, basis: "NO_RUNTIME_COURSE_SNAPSHOT_IN_CANONICAL_GENERATOR_FIXTURE" },
    integrity: {
      orphan_questions: 0,
      orphan_contents: 0,
      course_subject_mismatch: 0,
      subject_topic_mismatch: 0,
      content_course_mismatch: 0,
      basis: "CANONICAL_SOURCE_GRAPH_ONLY_NO_DATABASE_ROWS",
    },
  },
});

await mkdir(inputRoot, { recursive: true });
await writeFile(projectionPath, serializeCanonical(projection), "utf8");

const sourcePaths = [
  ...questionSources.map(([path]) => path),
  "lib/data/security-certification-course-lessons.mjs",
  "lib/data/security-content-intelligence-v3.mjs",
  "lib/data/security-content-upgrade-v3.mjs",
  "lib/curriculum/security-certification-ontology.ts",
  "lib/curriculum/security-certification-standards.ts",
  "lib/curriculum/security-certification-content-map.ts",
  "lib/data/security-certification-engineer-practical-log-monitoring-authoring.mjs",
  "lib/ai/retrieval-provider.ts",
  "lib/services/ontology-service.ts",
  "lib/validation.ts",
  "lib/errors.ts",
  ...await walk(sourceRoot),
].map(normalizeRelative).filter((path, index, all) => all.indexOf(path) === index);
const sourceHashes = await hashEntries(sourcePaths);
const generatorPaths = [
  "scripts/build-security-content-v3-analysis.mjs",
  "scripts/validate-security-content-intelligence-v3.mjs",
  "scripts/verify-security-content-v3-source-integrity.mjs",
];
const generatorHashes = await hashEntries(generatorPaths);
const bindingHashes = await hashEntries([
  "scripts/security-content-v3-generator-input.mjs",
  "scripts/validate-security-content-v3-generator-input.mjs",
]);
const projectionByteSha = projectionByteSha256(projection);
const projectionSemanticSha = projectionSemanticSha256(projection);
const manifest = canonicalize({
  identity: { inputAuthorityId: INPUT_AUTHORITY_ID, version: INPUT_AUTHORITY_VERSION, fixtureId: "ise-generator-input-v1-source-projection" },
  authority: {
    type: "GENERATOR_INPUT_PROJECTION",
    canonicalOwner: "content-inputs/security-content-v3/manifest.json",
    sourceOfTruth: "MANIFEST_AND_NORMALIZED_PROJECTION_BYTES",
    runtimeAuthority: false,
    questionAuthority: false,
    ontologyAuthority: false,
    evidenceAuthority: false,
  },
  fixture: {
    path: PROJECTION_RELATIVE_PATH,
    representation: "NORMALIZED_JSON",
    byteSha256: projectionByteSha,
    semanticSha256: projectionSemanticSha,
    semanticHashExcludes: ["generatedAt", "createdAt", "updatedAt", "timestamp"],
  },
  sourceHashes,
  generatorHashes,
  bindingHashes,
  migrationLineage: { mode: "REPOSITORY_SCHEMA_REFERENCE_ONLY", revision: "drizzle-files-read-only" },
  seedLineage: { mode: "SOURCE_PROJECTION_NO_DATABASE_SEED", revision: "not-applicable" },
  provider: { providerMode: "OFFLINE_PROVIDER_NEUTRAL", d1Authority: "D1_GENERATOR_FIXTURE_ONLY", runtimeProvider: "SUPABASE_POSTGRESQL_UNCHANGED" },
  recordCounts: { courses: projection.courses.length, questionRows: projection.questionRows.length, ontologyConcepts: projection.ontologyConcepts.length, personalData: 0, learnerEvidence: 0 },
  serialization: { encoding: "UTF-8", lineEndings: "LF", terminalNewline: "EXACTLY_ONE", objectKeys: "LEXICOGRAPHIC_CANONICALIZATION" },
  environment: { timezone: "UTC", locale: "en-US", encoding: "UTF-8", lineEndings: "LF", terminalNewline: "EXACTLY_ONE", node: ">=22.13.0", providerMode: "OFFLINE_PROVIDER_NEUTRAL", ambientDatabaseCredentials: "PROHIBITED", randomness: "PROHIBITED", sorting: "STABLE_EXPLICIT", timestamps: "EXCLUDED_FROM_SEMANTIC_HASH" },
  privacy: { personalData: 0, learnerEvidence: 0 },
  inputPolicy: { unknownInputs: 0, reportOnlyCounts: "NOT_CANONICAL", disposableCounts: "NOT_CANONICAL", liveDatabase: "PROHIBITED" },
  outputOwnership: GENERATOR_OUTPUT_OWNERSHIP,
});
await writeFile(manifestPath, serializeCanonical(manifest), "utf8");

function normalizeRelative(path) { return relative(rootDir, resolve(rootDir, path)).replaceAll("\\", "/"); }
async function hashEntries(paths) { return Promise.all(paths.sort().map(async (path) => ({ path, sha256: sha256Bytes(await readFile(resolve(rootDir, path))) }))); }
async function walk(root) {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (entry.isFile()) result.push(normalizeRelative(path));
  }
  return result;
}
