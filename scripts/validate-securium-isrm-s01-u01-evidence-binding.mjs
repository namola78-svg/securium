import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BINDING_PATH = "content-drafts/securium-isrm-s01-u01-authoring/evidence-binding.json";
export const SOURCE_CLAIMS_PATH = "content-drafts/securium-isrm-s01-u01-authoring/source-claims.json";
export const SNAPSHOT_MANIFEST_PATH = "source-evidence-snapshots/isrm-kca-identity-subject/2026-09-21/manifest.json";

const HTML_SOURCE_ID = "KCA-ISRM-IDENTITY-SUBJECT-PAGE";
const PDF_SOURCE_ID = "KCA-ISRM-EXAM-CRITERIA-2025-2027";
const HTML_HASH = "B5E1FAE56D9F5DE7B1BA48BDDA56DFF5C45E4FAC11F1010D32A237C969891E5E";
const PDF_HASH = "1FF4981397462274BFDE7BBA35753EC613D834AFB7FBDB309687AB4BD83F6DA3";
const LANDING_URL = "https://www.cq.or.kr/qh_quagm02_011.do";
const ISSUER = "한국방송통신전파진흥원";
const C01 = "ISRM-S01-U01-C01";
const C02 = "ISRM-S01-U01-C02";
const C03 = "ISRM-S01-U01-C03";
const C04 = "ISRM-S01-U01-C04";

const EXPECTED = Object.freeze({
  [C01]: Object.freeze({
    sourceId: HTML_SOURCE_ID,
    artifactPath: "source-evidence-snapshots/isrm-kca-identity-subject/2026-09-21/kca-isrm-identity-subject-page.html",
    artifactFileName: "kca-isrm-identity-subject-page.html",
    artifactSha256: HTML_HASH,
    byteSize: 322505,
    contentType: "text/html; charset=utf-8",
    artifactSourceUrl: LANDING_URL,
    canonicalUrl: LANDING_URL,
    semanticSourceIdentity: "KCA-ISRM-IDENTITY-SUBJECT-PAGE",
    documentIdentity: "KCA 민간자격검정 자격검정안내: 정보보호위험관리사(ISRM)",
  }),
  [C02]: Object.freeze({
    sourceId: PDF_SOURCE_ID,
    artifactPath: "source-evidence-snapshots/isrm-kca-identity-subject/2026-09-21/kca-isrm-exam-criteria.pdf",
    artifactFileName: "kca-isrm-exam-criteria.pdf",
    artifactSha256: PDF_HASH,
    byteSize: 112595,
    contentType: "application/x-msdownload;charset=ISO-8859-1",
    artifactSourceUrl: "https://www.cq.or.kr/ac_flecm02_001.do?atchFileId=239198e350f44ce69ac1b5c3bbe0be62&fileSn=5",
    canonicalUrl: LANDING_URL,
    semanticSourceIdentity: "KCA ISRM written-exam criteria, applicability 2025-01-01 through 2027-12-31",
    documentIdentity: "KCA 정보보호위험관리사 출제기준",
    applicability: Object.freeze({ type: "APPLICABILITY_ONLY_NOT_SEMANTIC_VERSION", from: "2025-01-01", to: "2027-12-31", semanticVersion: "UNKNOWN" }),
  }),
});

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();
}

function portableRelativePath(value) {
  return typeof value === "string"
    && value.length > 0
    && !path.isAbsolute(value)
    && !/^[A-Za-z]:[\\/]/.test(value)
    && !value.split(/[\\/]/).includes("..");
}

function isSha256(value) {
  return typeof value === "string" && /^[A-F0-9]{64}$/.test(value);
}

function addError(errors, code, detail) {
  errors.push(`${code}${detail ? `: ${detail}` : ""}`);
}

function requiredString(value, code, errors) {
  if (typeof value !== "string" || value.length === 0) addError(errors, code);
}

function compare(actual, expected, code, errors) {
  if (actual !== expected) addError(errors, code, `expected ${expected}, received ${actual}`);
}

function compareArtifactIdentity(binding, snapshotArtifact, expected, errors) {
  const identity = binding.artifactIdentity;
  if (!identity || typeof identity !== "object") {
    addError(errors, "ARTIFACT_IDENTITY_MISSING", binding.claimId);
    return;
  }
  for (const key of ["artifactPath", "artifactFileName", "artifactSha256", "byteSize", "contentType", "artifactSourceUrl", "semanticSourceIdentity", "documentIdentity"]) {
    if (identity[key] === undefined || identity[key] === null || identity[key] === "") addError(errors, `ARTIFACT_${key.toUpperCase()}_MISSING`, binding.claimId);
  }
  compare(identity.artifactPath, expected.artifactPath, "ARTIFACT_PATH_MISMATCH", errors);
  compare(identity.artifactFileName, expected.artifactFileName, "ARTIFACT_FILENAME_MISMATCH", errors);
  if (!isSha256(identity.artifactSha256)) addError(errors, "ARTIFACT_HASH_MALFORMED", binding.claimId);
  compare(identity.artifactSha256, expected.artifactSha256, "ARTIFACT_HASH_MISMATCH", errors);
  compare(identity.byteSize, expected.byteSize, "ARTIFACT_BYTE_SIZE_MISMATCH", errors);
  compare(identity.contentType, expected.contentType, "ARTIFACT_CONTENT_TYPE_MISMATCH", errors);
  compare(identity.artifactSourceUrl, expected.artifactSourceUrl, "ARTIFACT_SOURCE_URL_MISMATCH", errors);
  compare(identity.semanticSourceIdentity, expected.semanticSourceIdentity, "SEMANTIC_SOURCE_IDENTITY_MISMATCH", errors);
  compare(identity.documentIdentity, expected.documentIdentity, "DOCUMENT_IDENTITY_MISMATCH", errors);
  if (snapshotArtifact) {
    const snapshotArtifactPath = `source-evidence-snapshots/isrm-kca-identity-subject/2026-09-21/${snapshotArtifact.artifactPath}`;
    compare(identity.artifactPath, snapshotArtifactPath, "SNAPSHOT_ARTIFACT_PATH_MISMATCH", errors);
    compare(identity.artifactSha256, snapshotArtifact.sha256, "SNAPSHOT_ARTIFACT_HASH_MISMATCH", errors);
    compare(identity.byteSize, snapshotArtifact.byteSize, "SNAPSHOT_ARTIFACT_BYTE_SIZE_MISMATCH", errors);
    compare(identity.contentType, snapshotArtifact.contentType, "SNAPSHOT_ARTIFACT_CONTENT_TYPE_MISMATCH", errors);
  } else {
    addError(errors, "SNAPSHOT_SOURCE_ID_MISSING", binding.sourceId);
  }
}

function validateC01Locator(locator, errors) {
  if (!locator || locator.type !== "HTML_SEMANTIC_SECTIONS" || !Array.isArray(locator.sections)) {
    addError(errors, "C01_LOCATOR_MISSING_OR_WRONG_TYPE");
    return;
  }
  const headings = new Set(locator.sections.map((section) => section?.heading));
  if (!headings.has("자격개요")) addError(errors, "C01_QUALIFICATION_SECTION_MISSING");
  if (!headings.has("시험과목 및 시험방법")) addError(errors, "C01_SUBJECT_SECTION_MISSING");
  const qualification = locator.sections.find((section) => section?.heading === "자격개요");
  for (const field of ["자격명", "등록번호", "자격발급기관"]) {
    if (!qualification?.fields?.includes(field)) addError(errors, "C01_QUALIFICATION_FIELD_MISSING", field);
  }
  const subject = locator.sections.find((section) => section?.heading === "시험과목 및 시험방법");
  if (!subject?.fields?.includes("필기") || !subject?.fields?.includes("과목") || !subject?.fields?.includes("문제수")) addError(errors, "C01_SUBJECT_FIELDS_MISSING");
  compare(subject?.subjectOrder, 1, "C01_SUBJECT_ORDER_MISMATCH", errors);
  compare(subject?.subjectName, "정보보호 위험관리 계획", "C01_SUBJECT_NAME_MISMATCH", errors);
}

function validateC02Locator(locator, errors) {
  if (!locator || locator.type !== "PDF_PAGE_SEMANTIC_TABLE") {
    addError(errors, "C02_LOCATOR_MISSING_OR_WRONG_TYPE");
    return;
  }
  compare(locator.page, 1, "C02_PDF_PAGE_MISMATCH", errors);
  compare(locator.subject?.number, "I", "C02_SUBJECT_NUMBER_MISMATCH", errors);
  compare(locator.subject?.name, "정보보호 위험관리 계획", "C02_SUBJECT_NAME_MISMATCH", errors);
  compare(locator.majorItem?.number, 1, "C02_MAJOR_ITEM_NUMBER_MISMATCH", errors);
  compare(locator.majorItem?.name, "정보보호 관리의 이해", "C02_MAJOR_ITEM_NAME_MISMATCH", errors);
  if (!Array.isArray(locator.subitems) || locator.subitems.length !== 3) {
    addError(errors, "C02_SUBITEM_LOCATOR_MISSING_OR_WRONG_COUNT");
    return;
  }
  const expected = [
    [1, "정보보호의 정의 및 이해"],
    [2, "조직의 법적 준수해야 할 보호대상 선정"],
    [3, "보호대상의 정보보호 요구사항 파악"],
  ];
  for (const [[number, name], index] of expected.map((item, index) => [item, index])) {
    compare(locator.subitems[index]?.number, number, "C02_SUBITEM_NUMBER_MISMATCH", errors);
    compare(locator.subitems[index]?.name, name, "C02_SUBITEM_NAME_MISMATCH", errors);
  }
}

export function validateEvidenceBinding({ binding, sourceClaims, snapshotManifest, root = ROOT, readLocalArtifacts = false } = {}) {
  const errors = [];
  if (!binding || typeof binding !== "object") return { valid: false, errors: ["BINDING_MANIFEST_MISSING"] };
  compare(binding.schema, "securium.isrm.s01_u01.frozen_evidence_binding.v1", "BINDING_SCHEMA_MISMATCH", errors);
  compare(binding.status, "EVIDENCE_BINDING_ONLY_REVIEW_REQUIRED", "BINDING_STATUS_MISMATCH", errors);
  compare(binding.courseId, "course-isrm", "COURSE_ID_MISMATCH", errors);
  compare(binding.subjectId, "isrm-2025-2027-s01", "SUBJECT_ID_MISMATCH", errors);
  compare(binding.learningUnitId, "isrm-2025-2027-s01-u01", "LEARNING_UNIT_ID_MISMATCH", errors);
  if (!portableRelativePath(binding.sourceClaimsPath) || !portableRelativePath(binding.snapshotManifestPath)) addError(errors, "NON_PORTABLE_METADATA_PATH");
  if (binding.boundaries?.rights !== "UNKNOWN_BLOCKED_REFERENCE_ONLY") addError(errors, "RIGHTS_BOUNDARY_NOT_PRESERVED");
  if (binding.boundaries?.currentness !== "PARTIAL") addError(errors, "CURRENTNESS_BOUNDARY_NOT_PRESERVED");
  if (binding.boundaries?.publication !== "NOT_AUTHORIZED") addError(errors, "PUBLICATION_BOUNDARY_NOT_PRESERVED");
  if (binding.boundaries?.binaryPublicLanding !== "NONE") addError(errors, "BINARY_LANDING_BOUNDARY_NOT_PRESERVED");
  if (binding.boundaries?.sourceExpressionReuse !== 0) addError(errors, "SOURCE_EXPRESSION_REUSE_BOUNDARY_NOT_PRESERVED");
  if (binding.boundaries?.runtimeRegistration !== 0) addError(errors, "RUNTIME_REGISTRATION_BOUNDARY_NOT_PRESERVED");
  for (const key of ["approval", "approved", "publishable", "rightsCleared", "runtimeAuthorized"]) {
    if (Object.prototype.hasOwnProperty.call(binding, key)) addError(errors, "FORBIDDEN_APPROVAL_OR_AUTHORIZATION_FIELD", key);
  }
  if (!sourceClaims || !Array.isArray(sourceClaims.claims)) addError(errors, "SOURCE_CLAIMS_MISSING");
  if (!snapshotManifest || !Array.isArray(snapshotManifest.artifacts)) addError(errors, "SNAPSHOT_MANIFEST_MISSING");
  const claimsById = new Map((sourceClaims?.claims ?? []).map((claim) => [claim.id, claim]));
  const artifactsById = new Map((snapshotManifest?.artifacts ?? []).map((artifact) => [artifact.sourceId, artifact]));
  const expectedClaimIds = [C01, C02];
  if (JSON.stringify(binding.scope?.claimIds) !== JSON.stringify(expectedClaimIds)) addError(errors, "BINDING_SCOPE_MISMATCH");
  if (JSON.stringify(binding.scope?.unsupportedClaimsMustRemainUnbound) !== JSON.stringify([C03, C04])) addError(errors, "UNSUPPORTED_CLAIM_SCOPE_MISMATCH");
  if (!Array.isArray(binding.bindings) || binding.bindings.length !== 2) {
    addError(errors, "BINDING_COUNT_MISMATCH");
    return { valid: errors.length === 0, errors };
  }
  const seenClaims = new Set();
  for (const item of binding.bindings) {
    if (!item || typeof item !== "object") {
      addError(errors, "BINDING_ENTRY_INVALID");
      continue;
    }
    if (seenClaims.has(item.claimId)) addError(errors, "DUPLICATE_CLAIM_BINDING", item.claimId);
    seenClaims.add(item.claimId);
    const expected = EXPECTED[item.claimId];
    if (!expected) {
      addError(errors, "CLAIM_NOT_IN_ALLOWED_SCOPE", item.claimId);
      continue;
    }
    const claim = claimsById.get(item.claimId);
    if (!claim) addError(errors, "CLAIM_NOT_FOUND", item.claimId);
    if (!isSha256(item.claimTextSha256)) addError(errors, "CLAIM_TEXT_HASH_MALFORMED", item.claimId);
    if (claim && item.claimTextSha256 !== sha256(claim.claim)) addError(errors, "CLAIM_TEXT_HASH_MISMATCH", item.claimId);
    compare(item.sourceId, expected.sourceId, "SOURCE_ID_MISMATCH", errors);
    compare(item.issuer, ISSUER, "ISSUER_MISMATCH", errors);
    compare(item.canonicalUrl, expected.canonicalUrl, "CANONICAL_URL_MISMATCH", errors);
    const snapshotArtifact = artifactsById.get(item.sourceId);
    if (!snapshotArtifact) addError(errors, "SOURCE_ID_NOT_IN_SNAPSHOT_MANIFEST", item.sourceId);
    compare(item.retrievedAt, snapshotArtifact?.retrievedAt, "RETRIEVED_AT_MISMATCH", errors);
    compare(item.evidenceClassification, "SUPPORTED", "EVIDENCE_CLASSIFICATION_NOT_SUPPORTED", errors);
    if (!isSha256(item.artifactIdentity?.artifactSha256)) addError(errors, "ARTIFACT_HASH_MALFORMED", item.claimId);
    compareArtifactIdentity(item, snapshotArtifact, expected, errors);
    if (item.claimId === C01) validateC01Locator(item.locator, errors);
    if (item.claimId === C02) {
      validateC02Locator(item.locator, errors);
      if (JSON.stringify(item.documentApplicabilityOrIdentity) !== JSON.stringify(expected.applicability)) addError(errors, "C02_APPLICABILITY_IDENTITY_MISMATCH");
    }
    if (readLocalArtifacts) {
      const artifactPath = item.artifactIdentity?.artifactPath;
      if (!portableRelativePath(artifactPath)) {
        addError(errors, "LOCAL_ARTIFACT_PATH_NOT_PORTABLE", item.claimId);
      } else {
        const absolute = path.resolve(root, artifactPath);
        if (!fs.existsSync(absolute)) {
          addError(errors, "LOCAL_ARTIFACT_MISSING", artifactPath);
        } else {
          const bytes = fs.readFileSync(absolute);
          const actualHash = crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
          if (bytes.length !== item.artifactIdentity.byteSize) addError(errors, "LOCAL_ARTIFACT_BYTE_SIZE_MISMATCH", artifactPath);
          if (actualHash !== item.artifactIdentity.artifactSha256) addError(errors, "LOCAL_ARTIFACT_HASH_MISMATCH", artifactPath);
        }
      }
    }
  }
  if (seenClaims.has(C03) || seenClaims.has(C04)) addError(errors, "UNSUPPORTED_CLAIM_BOUND", [...seenClaims].filter((id) => id === C03 || id === C04).join(","));
  for (const id of expectedClaimIds) if (!seenClaims.has(id)) addError(errors, "EXPECTED_CLAIM_BINDING_MISSING", id);
  return {
    valid: errors.length === 0,
    errors,
    mode: readLocalArtifacts ? "LOCAL_EVIDENCE_VALIDATION" : "BINDING_CONTRACT_VALIDATION",
    boundClaimIds: [...seenClaims],
  };
}

export function loadBindingInputs(root = ROOT) {
  const read = (relativePath) => JSON.parse(fs.readFileSync(path.resolve(root, relativePath), "utf8"));
  return {
    binding: read(BINDING_PATH),
    sourceClaims: read(SOURCE_CLAIMS_PATH),
    snapshotManifest: read(SNAPSHOT_MANIFEST_PATH),
  };
}

export function validateBindingFiles({ root = ROOT, readLocalArtifacts = false } = {}) {
  const inputs = loadBindingInputs(root);
  return validateEvidenceBinding({ ...inputs, root, readLocalArtifacts });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const readLocalArtifacts = process.argv.includes("--with-local-artifacts");
  const result = validateBindingFiles({ readLocalArtifacts });
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}
