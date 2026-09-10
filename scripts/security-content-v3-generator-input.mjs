import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export const INPUT_AUTHORITY_ID = "ise-generator-input.v1";
export const INPUT_AUTHORITY_VERSION = "ise-generator-input.v1";
export const INPUT_AUTHORITY_ROOT = "content-inputs/security-content-v3";
export const MANIFEST_RELATIVE_PATH = `${INPUT_AUTHORITY_ROOT}/manifest.json`;
export const PROJECTION_RELATIVE_PATH = `${INPUT_AUTHORITY_ROOT}/database-projection.json`;
export const EXPECTED_NODE_VERSION = "22.13.0";
export const EXPECTED_LOCALE = "en-US";

export const CANONICAL_GENERATOR_BINDING_PATHS = Object.freeze([
  "scripts/build-security-content-v3-analysis.mjs",
  "scripts/validate-security-content-intelligence-v3.mjs",
  "scripts/verify-security-content-v3-source-integrity.mjs",
]);

export const CANONICAL_BINDING_PATHS = Object.freeze([
  "scripts/security-content-v3-generator-input.mjs",
  "scripts/validate-security-content-v3-generator-input.mjs",
]);

export const CANONICAL_SOURCE_BINDING_PATHS = Object.freeze([
  "lib/ai/retrieval-provider.ts",
  "lib/curriculum/security-certification-content-map.ts",
  "lib/curriculum/security-certification-ontology.ts",
  "lib/curriculum/security-certification-standards.ts",
  "lib/data/security-certification-application-security-questions.mjs",
  "lib/data/security-certification-course-lessons.mjs",
  "lib/data/security-certification-engineer-practical-log-monitoring-authoring.mjs",
  "lib/data/security-certification-information-security-general-questions.mjs",
  "lib/data/security-certification-management-law-questions.mjs",
  "lib/data/security-certification-network-security-questions.mjs",
  "lib/data/security-certification-practical-questions.mjs",
  "lib/data/security-certification-system-security-questions.mjs",
  "lib/data/security-content-intelligence-v3.mjs",
  "lib/data/security-content-upgrade-v3.mjs",
  "lib/errors.ts",
  "lib/services/ontology-service.ts",
  "lib/validation.ts",
  "securium-content-upgrade-v2/2022 2회차 산업기사 필기.pdf",
  "securium-content-upgrade-v2/2022 4회차 보안기사 필기.pdf",
  "securium-content-upgrade-v2/2026 정보보안기사 올인원_구매인증 이벤트 자료.pdf",
  "securium-content-upgrade-v2/CODEX_TASK.md",
  "securium-content-upgrade-v2/README.md",
  "securium-content-upgrade-v2/content-policy.ts",
  "securium-content-upgrade-v2/content.schema.json",
  "securium-content-upgrade-v2/data/canonical-concepts.json",
  "securium-content-upgrade-v2/data/final-audit.json",
  "securium-content-upgrade-v2/data/normalized-kb-import-plan.json",
  "securium-content-upgrade-v2/data/normalized-knowledge-base.json",
  "securium-content-upgrade-v2/data/practical-seeds.json",
  "securium-content-upgrade-v2/data/provenance-template.json",
  "securium-content-upgrade-v2/data/source-file-inventory.json",
  "securium-content-upgrade-v2/data/source-inventory.json",
  "securium-content-upgrade-v2/data/theory-seeds.json",
  "securium-content-upgrade-v2/data/written-seeds.json",
  "securium-content-upgrade-v2/manifest.json",
  "securium-content-upgrade-v2/reports/content-import-report.md",
  "securium-content-upgrade-v2/reports/final-content-import-report.md",
  "securium-content-upgrade-v2/reports/source-text-extraction.json",
  "securium-content-upgrade-v2/scripts/analyze-source-corpus.py",
  "securium-content-upgrade-v2/scripts/build-normalized-kb.py",
  "securium-content-upgrade-v2/scripts/finalize-report.py",
  "securium-content-upgrade-v2/scripts/generate-local-draft-import-sql.py",
  "securium-content-upgrade-v2/scripts/prepare-import-plan.py",
  "securium-content-upgrade-v2/scripts/validate.py",
  "securium-content-upgrade-v2/정보보안기사 실기 기출.txt",
  "securium-content-upgrade-v2/정보보안기사 필기-2023년도 제4회_2023.10.07_babayetu.tistory.com.pdf",
  "securium-content-upgrade-v2/정보보안기사20130706(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20131026(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20140405(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20140927(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20150328(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20150919(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20160402(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20160924(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20170325(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20170909(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20180331(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20180908(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20190323(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20190907(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20200530(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20200905(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20210327(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20210904(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20220313(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20220625(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사20230311(교사용).pdf",
  "securium-content-upgrade-v2/정보보안기사_01회_필기_기출문제.pdf",
  "securium-content-upgrade-v2/정보보안기사_02회_필기_기출문제.pdf",
  "securium-content-upgrade-v2/정보보안기사_03회_필기_기출문제.pdf",
  "securium-content-upgrade-v2/정보보안기사_04회_필기_기출문제.pdf",
  "securium-content-upgrade-v2/정보보안기사_05회_필기_기출문제.pdf",
  "securium-content-upgrade-v2/정보보안기사_06회_필기_기출문제.pdf",
  "securium-content-upgrade-v2/정보보안기사_07회_필기_기출문제.pdf",
  "securium-content-upgrade-v2/정보보안기사_08회_필기_기출문제.pdf",
  "securium-content-upgrade-v2/정보보안기사_09회_필기_기출문제.pdf",
  "securium-content-upgrade-v2/정보보안기사_10회_필기_기출문제.pdf",
  "securium-content-upgrade-v2/정보보안기사_11회_필기_기출문제.pdf",
  "securium-content-upgrade-v2/정보보안기사_12회_필기_기출문제.pdf",
  "securium-content-upgrade-v2/정보보안기사_14회_필기_기출문제.pdf",
]);

export const GENERATOR_OUTPUT_OWNERSHIP = Object.freeze([
  ...[
    "source-inventory.json",
    "source-provenance.json",
    "baseline-d1.json",
    "baseline-postgres.json",
    "concept-frequency.json",
    "ontology-match-report.json",
    "theory-coverage.json",
    "theory-gap-analysis.json",
    "question-generation-plan.json",
  ].map((file) => ({
    path: `reports/content-v3/${file}`,
    generator: "scripts/build-security-content-v3-analysis.mjs",
    family: "ANALYSIS_OUTPUT",
  })),
  ...["generated-question-review.json", "duplicate-analysis.json"].map((file) => ({
    path: `reports/content-v3/${file}`,
    generator: "scripts/validate-security-content-intelligence-v3.mjs",
    family: "QUALITY_OUTPUT",
  })),
  {
    path: "reports/content-v3/source-integrity.json",
    generator: "scripts/verify-security-content-v3-source-integrity.mjs",
    family: "SOURCE_INTEGRITY_OUTPUT",
  },
]);

const helperPath = normalizePath(fileURLToPath(import.meta.url));

export function normalizePath(value) {
  return String(value).replaceAll("\\", "/");
}

export function compareCanonicalStrings(left, right) {
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function isCanonicalRelativePath(value) {
  const normalized = normalizePath(value);
  return normalized === value &&
    normalized.length > 0 &&
    !normalized.startsWith("/") &&
    !/^[A-Za-z]:/.test(normalized) &&
    !normalized.startsWith("//") &&
    !normalized.includes("://") &&
    !normalized.split("/").includes("..");
}

function sameSet(actual, expected) {
  return actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    new Set(expected).size === expected.length &&
    actual.every((value) => expected.includes(value));
}

function ownershipKey(entry) {
  return `${normalizePath(entry?.path ?? "")}\u0000${entry?.generator ?? ""}\u0000${entry?.family ?? ""}`;
}

function validateExactBindingSet(entries, expectedPaths, code, fail) {
  if (!Array.isArray(entries)) {
    fail(code);
    return;
  }
  const paths = entries.map((entry) => normalizePath(entry?.path ?? ""));
  const invalidPaths = paths.filter((path) => !isCanonicalRelativePath(path));
  if (invalidPaths.length) fail(`${code}_PATH_BOUNDARY`, invalidPaths);
  if (!sameSet(paths, expectedPaths)) fail(`${code}_SET_MISMATCH`, { expected: expectedPaths, actual: paths });
}

function validateOutputOwnership(entries, fail) {
  if (!Array.isArray(entries)) {
    fail("OUTPUT_OWNERSHIP_INVALID");
    return;
  }
  const expected = GENERATOR_OUTPUT_OWNERSHIP.map(ownershipKey);
  const actual = entries.map(ownershipKey);
  const paths = entries.map((entry) => normalizePath(entry?.path ?? ""));
  if (paths.some((path) => !isCanonicalRelativePath(path))) {
    fail("OUTPUT_OWNERSHIP_PATH_BOUNDARY", paths.filter((path) => !isCanonicalRelativePath(path)));
  }
  if (new Set(paths).size !== paths.length) fail("OUTPUT_OWNERSHIP_DUPLICATE_PATH", paths);
  if (!sameSet(actual, expected)) fail("OUTPUT_OWNERSHIP_SET_MISMATCH", { expected, actual });
}

function validateUniqueRows(rows, keyOf, code, fail) {
  if (!Array.isArray(rows)) return;
  const keys = rows.map(keyOf);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length) fail(code, [...new Set(duplicates)]);
}

export function repoRootFromModule(moduleUrl = import.meta.url) {
  return resolve(dirname(fileURLToPath(moduleUrl)), "..");
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareCanonicalStrings)
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function normalizeProjection(projection) {
  const copy = structuredClone(projection);
  if (Array.isArray(copy.courses)) {
    copy.courses.sort((a, b) => compareCanonicalStrings(a.course_id, b.course_id));
  }
  if (Array.isArray(copy.questionRows)) {
    copy.questionRows.sort((a, b) =>
      compareCanonicalStrings(`${a.course_id}:${a.id}`, `${b.course_id}:${b.id}`),
    );
  }
  if (Array.isArray(copy.ontologyConcepts)) {
    copy.ontologyConcepts.sort((a, b) =>
      compareCanonicalStrings(a.concept_key, b.concept_key),
    );
    for (const concept of copy.ontologyConcepts) {
      if (Array.isArray(concept.aliases)) concept.aliases.sort(compareCanonicalStrings);
    }
  }
  if (Array.isArray(copy.protectedCourses)) {
    copy.protectedCourses.sort((a, b) => compareCanonicalStrings(a.course_id, b.course_id));
  }
  if (Array.isArray(copy.sourceInputs)) {
    copy.sourceInputs.sort((a, b) => compareCanonicalStrings(a.path, b.path));
  }
  if (Array.isArray(copy.databaseProjection?.courseRows)) {
    copy.databaseProjection.courseRows.sort((a, b) => compareCanonicalStrings(a.course_id, b.course_id));
  }
  if (Array.isArray(copy.databaseProjection?.ontologyRows)) {
    copy.databaseProjection.ontologyRows.sort((a, b) =>
      compareCanonicalStrings(a.concept_key ?? a.concept_id, b.concept_key ?? b.concept_id),
    );
  }
  return canonicalize(copy);
}

export function semanticPayload(value) {
  return stripNonSemantic(normalizeProjection(value));
}

function stripNonSemantic(value) {
  if (Array.isArray(value)) return value.map(stripNonSemantic);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["generatedAt", "createdAt", "updatedAt", "timestamp"].includes(key))
      .map(([key, child]) => [key, stripNonSemantic(child)]),
  );
}

export function serializeCanonical(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Text(text) {
  return sha256Bytes(Buffer.from(text, "utf8"));
}

export function projectionByteSha256(projection) {
  return sha256Text(serializeCanonical(projection));
}

export function projectionSemanticSha256(projection) {
  return sha256Text(serializeCanonical(semanticPayload(projection)));
}

export async function fileSha256(rootDir, relativePath) {
  const path = isAbsolute(relativePath) ? relativePath : resolve(rootDir, relativePath);
  const root = await realpath(rootDir);
  const target = await realpath(path);
  const targetRelative = relative(root, target);
  if (isAbsolute(targetRelative) || targetRelative.startsWith("..")) {
    throw new Error(`GENERATOR_INPUT_PATH_ESCAPE:${relativePath}`);
  }
  return sha256Bytes(await readFile(target));
}

export function authorityMetadata(authority, generatorPath) {
  const generator = authority.manifest.generatorHashes.find(
    (entry) => entry.path === normalizePath(generatorPath),
  );
  if (!generator) throw new Error(`GENERATOR_HASH_BINDING_MISSING:${generatorPath}`);
  return {
    inputAuthorityId: authority.manifest.identity.inputAuthorityId,
    inputAuthorityVersion: authority.manifest.identity.version,
    inputAuthorityHash: authority.manifest.fixture.semanticSha256,
    inputAuthoritySemanticSha256: authority.manifest.fixture.semanticSha256,
    inputAuthorityByteSha256: authority.manifest.fixture.byteSha256,
    generatorPath: generator.path,
    generatorHash: generator.sha256,
    generatorSha256: generator.sha256,
    providerMode: authority.manifest.provider.providerMode,
    environmentPolicyHash: sha256Text(serializeCanonical(authority.manifest.environment)),
  };
}

export function authorityStalenessReasons(outputMetadata, authority, generatorPath) {
  const expected = authorityMetadata(authority, generatorPath);
  const checks = [
    ["INPUT_AUTHORITY_ID_CHANGED", outputMetadata?.inputAuthorityId === expected.inputAuthorityId],
    ["INPUT_AUTHORITY_VERSION_CHANGED", outputMetadata?.inputAuthorityVersion === expected.inputAuthorityVersion],
    ["INPUT_AUTHORITY_SEMANTIC_HASH_CHANGED", outputMetadata?.inputAuthorityHash === expected.inputAuthorityHash],
    ["INPUT_AUTHORITY_BYTE_HASH_CHANGED", outputMetadata?.inputAuthorityByteSha256 === expected.inputAuthorityByteSha256],
    ["GENERATOR_PATH_CHANGED", outputMetadata?.generatorPath === expected.generatorPath],
    ["GENERATOR_HASH_CHANGED", outputMetadata?.generatorHash === expected.generatorHash],
    ["PROVIDER_MODE_CHANGED", outputMetadata?.providerMode === expected.providerMode],
    ["ENVIRONMENT_POLICY_CHANGED", outputMetadata?.environmentPolicyHash === expected.environmentPolicyHash],
  ];
  return {
    stale: checks.some(([, matches]) => !matches),
    reasons: checks.filter(([, matches]) => !matches).map(([reason]) => reason),
  };
}

export async function loadGeneratorInputAuthority({
  rootDir = repoRootFromModule(),
  verify = true,
} = {}) {
  const manifestPath = resolve(rootDir, MANIFEST_RELATIVE_PATH);
  const projectionPath = resolve(rootDir, PROJECTION_RELATIVE_PATH);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const projectionText = await readFile(projectionPath, "utf8");
  const projection = JSON.parse(projectionText);
  const authority = { rootDir, manifest, projection, manifestPath, projectionPath };
  if (verify) await validateGeneratorInputAuthority(authority);
  return authority;
}

export async function validateGeneratorInputAuthority({
  rootDir,
  manifest,
  projection,
  projectionPath,
  allowManifestPath = false,
} = {}) {
  const failures = [];
  const fail = (code, detail) => failures.push({ code, detail });

  if (manifest?.identity?.inputAuthorityId !== INPUT_AUTHORITY_ID) fail("INPUT_AUTHORITY_ID_INVALID");
  if (manifest?.identity?.version !== INPUT_AUTHORITY_VERSION) fail("INPUT_AUTHORITY_VERSION_INVALID");
  if (manifest?.authority?.type !== "GENERATOR_INPUT_PROJECTION") fail("AUTHORITY_TYPE_INVALID");
  if (manifest?.authority?.runtimeAuthority !== false) fail("RUNTIME_AUTHORITY_ESCALATION");
  if (manifest?.authority?.questionAuthority !== false) fail("QUESTION_AUTHORITY_ESCALATION");
  if (manifest?.authority?.ontologyAuthority !== false) fail("ONTOLOGY_AUTHORITY_ESCALATION");
  if (manifest?.authority?.evidenceAuthority !== false) fail("EVIDENCE_AUTHORITY_ESCALATION");
  if (manifest?.provider?.providerMode !== "OFFLINE_PROVIDER_NEUTRAL") fail("PROVIDER_MODE_INVALID");
  if (manifest?.provider?.d1Authority !== "D1_GENERATOR_FIXTURE_ONLY") fail("D1_AUTHORITY_INVALID");
  if (manifest?.environment?.timezone !== "UTC") fail("TIMEZONE_POLICY_INVALID");
  if (manifest?.environment?.encoding !== "UTF-8") fail("ENCODING_POLICY_INVALID");
  if (manifest?.environment?.lineEndings !== "LF") fail("LINE_ENDING_POLICY_INVALID");
  if (manifest?.environment?.terminalNewline !== "EXACTLY_ONE") fail("TERMINAL_NEWLINE_POLICY_INVALID");
  if (manifest?.environment?.node !== EXPECTED_NODE_VERSION) fail("NODE_VERSION_POLICY_INVALID");
  if (manifest?.environment?.nodeAuthority !== ".github/workflows/ci.yml:actions/setup-node@v7/node-version") fail("NODE_VERSION_AUTHORITY_INVALID");
  if (manifest?.environment?.locale !== EXPECTED_LOCALE) fail("LOCALE_POLICY_INVALID");
  if (manifest?.environment?.randomness !== "PROHIBITED") fail("RANDOMNESS_POLICY_INVALID");
  if (manifest?.environment?.ambientDatabaseCredentials !== "PROHIBITED") fail("AMBIENT_DB_CREDENTIAL_POLICY_INVALID");
  if (!Array.isArray(manifest?.sourceHashes) || manifest.sourceHashes.some((entry) => !entry?.path || !/^[a-f0-9]{64}$/.test(entry.sha256))) fail("SOURCE_HASH_BINDING_INVALID");
  if (!Array.isArray(manifest?.generatorHashes) || manifest.generatorHashes.some((entry) => !entry?.path || !/^[a-f0-9]{64}$/.test(entry.sha256))) fail("GENERATOR_HASH_BINDING_INVALID");
  if (!Array.isArray(manifest?.bindingHashes) || manifest.bindingHashes.some((entry) => !entry?.path || !/^[a-f0-9]{64}$/.test(entry.sha256))) fail("BINDING_HASH_BINDING_INVALID");
  validateExactBindingSet(manifest?.sourceHashes, [...CANONICAL_SOURCE_BINDING_PATHS], "SOURCE_HASH_BINDING", fail);
  validateExactBindingSet(manifest?.generatorHashes, [...CANONICAL_GENERATOR_BINDING_PATHS], "GENERATOR_HASH_BINDING", fail);
  validateExactBindingSet(manifest?.bindingHashes, [...CANONICAL_BINDING_PATHS], "BINDING_HASH_BINDING", fail);
  validateOutputOwnership(manifest?.outputOwnership, fail);
  if (manifest?.inputPolicy?.unknownInputs !== 0) fail("UNKNOWN_INPUT_POLICY_INVALID");
  if (manifest?.privacy?.personalData !== 0 || manifest?.privacy?.learnerEvidence !== 0) fail("PRIVACY_POLICY_INVALID");
  if (projection?.authority?.inputAuthorityId !== INPUT_AUTHORITY_ID) fail("PROJECTION_AUTHORITY_ID_INVALID");
  if (projection?.authority?.runtimeAuthority !== false) fail("PROJECTION_RUNTIME_AUTHORITY_ESCALATION");
  if (projection?.authority?.questionAuthority !== false) fail("PROJECTION_QUESTION_AUTHORITY_ESCALATION");
  if (projection?.authority?.ontologyAuthority !== false) fail("PROJECTION_ONTOLOGY_AUTHORITY_ESCALATION");
  if (projection?.authority?.evidenceAuthority !== false) fail("PROJECTION_EVIDENCE_AUTHORITY_ESCALATION");
  if (projection?.privacy?.personalData !== 0 || projection?.privacy?.learnerEvidence !== 0) fail("PROJECTION_PRIVACY_POLICY_INVALID");
  if (projection?.inputPolicy?.unknownInputs !== 0) fail("PROJECTION_UNKNOWN_INPUT_POLICY_INVALID");
  if (projection?.databaseProjection?.providerMode !== "OFFLINE_PROVIDER_NEUTRAL") fail("PROJECTION_PROVIDER_MODE_INVALID");
  if (projection?.databaseProjection?.d1Authority !== "D1_GENERATOR_FIXTURE_ONLY") fail("PROJECTION_D1_AUTHORITY_INVALID");
  if (projection?.questionPopulationContract?.source !== "COMMITTED_CANONICAL_QUESTION_MODULES") fail("QUESTION_POPULATION_AUTHORITY_INVALID");
  if (projection?.questionPopulationContract?.learnerRows !== "EXCLUDED") fail("QUESTION_LEARNER_ROW_POLICY_INVALID");
  if (projection?.ontologyPopulationContract?.authorityRole !== "READ_ONLY_PROJECTION_NOT_CONCEPT_AUTHORITY") fail("ONTOLOGY_POPULATION_AUTHORITY_INVALID");
  if (projection?.theoryInputContract?.theoryGapDependency !== "THEORY_COVERAGE_OUTPUT_TO_THEORY_GAP_ANALYSIS_OUTPUT") fail("THEORY_GAP_DEPENDENCY_INVALID");
  if (!Array.isArray(projection?.questionRows)) fail("QUESTION_PROJECTION_INVALID");
  if (!Array.isArray(projection?.ontologyConcepts)) fail("ONTOLOGY_PROJECTION_INVALID");
  validateUniqueRows(projection?.courses, (row) => row?.course_id, "DUPLICATE_COURSE_ROW", fail);
  validateUniqueRows(projection?.questionRows, (row) => `${row?.course_id}:${row?.id}`, "DUPLICATE_QUESTION_ROW", fail);
  validateUniqueRows(projection?.ontologyConcepts, (row) => row?.concept_key, "DUPLICATE_ONTOLOGY_ROW", fail);
  validateUniqueRows(projection?.sourceInputs, (row) => row?.path, "DUPLICATE_SOURCE_INPUT", fail);
  validateUniqueRows(projection?.databaseProjection?.courseRows, (row) => row?.course_id, "DUPLICATE_DATABASE_COURSE_ROW", fail);
  validateUniqueRows(projection?.databaseProjection?.ontologyRows, (row) => row?.concept_key ?? row?.concept_id, "DUPLICATE_DATABASE_ONTOLOGY_ROW", fail);
  for (const concept of projection?.ontologyConcepts ?? []) {
    validateUniqueRows(concept?.aliases, (alias) => alias, "DUPLICATE_ONTOLOGY_ALIAS", fail);
  }
  const boundSourcePaths = new Set((manifest?.sourceHashes ?? []).map((entry) => entry.path));
  for (const input of projection?.sourceInputs ?? []) {
    if (!boundSourcePaths.has(input.path)) fail("PROJECTION_SOURCE_INPUT_UNBOUND", input.path);
  }
  if (projection?.databaseProjection?.userHistory?.represented !== false) fail("LEARNER_HISTORY_ESCALATION");
  if (projection?.databaseProjection?.protectedCourseData?.represented !== false) fail("PROTECTED_RUNTIME_DATA_ESCALATION");
  try {
    assertSafeProjectionObject(projection);
  } catch (error) {
    fail("PROJECTION_FORBIDDEN_FIELD", error instanceof Error ? error.message : String(error));
  }

  const serializedProjection = serializeCanonical(projection);
  const projectionBytes = Buffer.from(serializedProjection, "utf8");
  if (projectionPath) {
    const actualBytes = await readFile(projectionPath);
    if (!actualBytes.equals(projectionBytes)) fail("PROJECTION_SERIALIZATION_NONCANONICAL");
    if (actualBytes.includes(0xef) && actualBytes[0] === 0xef) fail("PROJECTION_BOM_PRESENT");
    if (actualBytes.includes(13)) fail("PROJECTION_CRLF_PRESENT");
    if (!actualBytes.toString("utf8").endsWith("\n") || actualBytes.toString("utf8").endsWith("\n\n")) fail("PROJECTION_TERMINAL_NEWLINE_INVALID");
  }
  const actualByteSha = sha256Bytes(projectionBytes);
  const actualSemanticSha = projectionSemanticSha256(projection);
  if (manifest?.fixture?.byteSha256 !== actualByteSha) fail("FIXTURE_BYTE_HASH_MISMATCH", { expected: manifest?.fixture?.byteSha256, actual: actualByteSha });
  if (manifest?.fixture?.semanticSha256 !== actualSemanticSha) fail("FIXTURE_SEMANTIC_HASH_MISMATCH", { expected: manifest?.fixture?.semanticSha256, actual: actualSemanticSha });
  if (manifest?.fixture?.path !== PROJECTION_RELATIVE_PATH) fail("FIXTURE_PATH_INVALID");

  if (rootDir) {
    for (const entry of manifest?.sourceHashes ?? []) {
      const path = normalizePath(entry?.path ?? "");
      if (!CANONICAL_SOURCE_BINDING_PATHS.includes(path) || !isCanonicalRelativePath(path)) continue;
      try {
        const actual = await fileSha256(rootDir, path);
        if (actual !== entry.sha256) fail("SOURCE_HASH_MISMATCH", { path, expected: entry.sha256, actual });
      } catch (error) {
        fail("SOURCE_HASH_UNREADABLE", { path, error: error instanceof Error ? error.message : String(error) });
      }
    }
    for (const entry of manifest?.generatorHashes ?? []) {
      const path = normalizePath(entry?.path ?? "");
      if (!CANONICAL_GENERATOR_BINDING_PATHS.includes(path) || !isCanonicalRelativePath(path)) continue;
      try {
        const actual = await fileSha256(rootDir, path);
        if (actual !== entry.sha256) fail("GENERATOR_HASH_MISMATCH", { path, expected: entry.sha256, actual });
      } catch (error) {
        fail("GENERATOR_HASH_UNREADABLE", { path, error: error instanceof Error ? error.message : String(error) });
      }
    }
    for (const entry of manifest?.bindingHashes ?? []) {
      const path = normalizePath(entry?.path ?? "");
      if (!CANONICAL_BINDING_PATHS.includes(path) || !isCanonicalRelativePath(path)) continue;
      try {
        const actual = await fileSha256(rootDir, path);
        if (actual !== entry.sha256) fail("BINDING_HASH_MISMATCH", { path, expected: entry.sha256, actual });
      } catch (error) {
        fail("BINDING_HASH_UNREADABLE", { path, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  if (!allowManifestPath && failures.length) {
    const error = new Error("SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID");
    error.failures = failures;
    throw error;
  }
  return { ok: failures.length === 0, failures, fixtureByteSha256: actualByteSha, fixtureSemanticSha256: actualSemanticSha };
}

export function assertSafeProjectionObject(value) {
  const forbidden = new Set(["user_id", "userId", "email", "learner", "password", "access_token", "question_attempts", "wrong_notes", "bookmarks", "review_schedules", "user_progress", "user_course_lesson_progress"]);
  const found = [];
  const visit = (current) => {
    if (!current || typeof current !== "object") return;
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(current)) {
      if (forbidden.has(key)) found.push(key);
      visit(child);
    }
  };
  visit(value);
  if (found.length) throw new Error(`PROJECTION_PERSONAL_OR_EVIDENCE_FIELD:${found.join(",")}`);
  return true;
}

export const SUPPORTING_BINDING_PATH = helperPath;
