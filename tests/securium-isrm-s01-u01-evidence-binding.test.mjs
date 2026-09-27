import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ROOT,
  BINDING_PATH,
  SOURCE_CLAIMS_PATH,
  VALIDATION_MODES,
  loadBindingInputs,
  validateBindingFiles,
  validateEvidenceBinding,
} from "../scripts/validate-securium-isrm-s01-u01-evidence-binding.mjs";

const inputs = loadBindingInputs(ROOT, VALIDATION_MODES.BINDING_CONTRACT_VALIDATION);

function clone(value) {
  return structuredClone(value);
}

function invalidWith(mutator) {
  const mutated = clone(inputs.binding);
  mutator(mutated);
  const result = validateEvidenceBinding({
    binding: mutated,
    sourceClaims: inputs.sourceClaims,
    root: ROOT,
    mode: VALIDATION_MODES.BINDING_CONTRACT_VALIDATION,
  });
  assert.equal(result.valid, false, `expected invalid binding, got ${JSON.stringify(result)}`);
  return result;
}

function localFixtureRoot(contents = ["synthetic-html", "synthetic-pdf"]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "securium-isrm-local-"));
  const manifest = { artifacts: [] };
  inputs.binding.bindings.forEach((item, index) => {
    const relativePath = item.artifactIdentity.artifactPath;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents[index]);
    manifest.artifacts.push({
      sourceId: item.sourceId,
      artifactPath: path.basename(relativePath),
      retrievedAt: item.retrievedAt,
      sha256: item.artifactIdentity.artifactSha256,
      byteSize: item.artifactIdentity.byteSize,
      contentType: item.artifactIdentity.contentType,
    });
  });
  return {
    root,
    manifest,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

test("C01/C02 frozen evidence binding passes without reading local binary", () => {
  const result = validateEvidenceBinding({
    binding: inputs.binding,
    sourceClaims: inputs.sourceClaims,
    root: "C:/reviewer-independent-contract-only",
    mode: VALIDATION_MODES.BINDING_CONTRACT_VALIDATION,
  });
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.deepEqual(result.boundClaimIds, ["ISRM-S01-U01-C01", "ISRM-S01-U01-C02"]);
  assert.equal(result.mode, "BINDING_CONTRACT_VALIDATION");
});

test("validation mode options normalize strictly and never downgrade local requests", () => {
  const defaultResult = validateBindingFiles({ root: ROOT });
  assert.equal(defaultResult.valid, true, JSON.stringify(defaultResult));
  assert.equal(defaultResult.mode, VALIDATION_MODES.BINDING_CONTRACT_VALIDATION);

  for (const options of [
    { mode: VALIDATION_MODES.BINDING_CONTRACT_VALIDATION },
    { readLocalArtifacts: false },
    { mode: VALIDATION_MODES.BINDING_CONTRACT_VALIDATION, readLocalArtifacts: false },
  ]) {
    const result = validateBindingFiles({ root: ROOT, ...options });
    assert.equal(result.valid, true, JSON.stringify(result));
    assert.equal(result.mode, VALIDATION_MODES.BINDING_CONTRACT_VALIDATION);
  }

  const localRequests = [
    { mode: VALIDATION_MODES.LOCAL_EVIDENCE_VALIDATION },
    { readLocalArtifacts: true },
    { mode: VALIDATION_MODES.LOCAL_EVIDENCE_VALIDATION, readLocalArtifacts: true },
  ];
  for (const options of localRequests) {
    const result = validateBindingFiles({ root: ROOT, ...options });
    assert.equal(result.valid, false, JSON.stringify(result));
    assert.equal(result.mode, VALIDATION_MODES.LOCAL_EVIDENCE_VALIDATION);
    assert.deepEqual(result.errors, ["LOCAL_EVIDENCE_INPUT_MISSING"]);
  }

  for (const options of [
    { mode: VALIDATION_MODES.BINDING_CONTRACT_VALIDATION, readLocalArtifacts: true },
    { mode: VALIDATION_MODES.LOCAL_EVIDENCE_VALIDATION, readLocalArtifacts: false },
  ]) {
    const result = validateBindingFiles({ root: ROOT, ...options });
    assert.equal(result.valid, false);
    assert.match(result.errors[0], /^VALIDATION_MODE_CONFLICT/);
  }

  for (const options of [
    { mode: "LOCAL" },
    { mode: "AUTO" },
    { mode: "" },
    { mode: null },
    { mode: {} },
    { readLocalArtifacts: "true" },
    { readLocalArtifacts: 1 },
    { readLocalArtifacts: {} },
    { readLocalArtifacts: null },
  ]) {
    const result = validateBindingFiles({ root: ROOT, ...options });
    assert.equal(result.valid, false);
    assert.match(result.errors[0], /INVALID/);
  }
});

test("explicit local evidence validation requires the manifest and local artifacts", () => {
  const result = validateEvidenceBinding({
    binding: inputs.binding,
    sourceClaims: inputs.sourceClaims,
    root: ROOT,
    mode: VALIDATION_MODES.LOCAL_EVIDENCE_VALIDATION,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("SNAPSHOT_MANIFEST_MISSING"));

  const missing = localFixtureRoot();
  try {
    fs.unlinkSync(path.join(missing.root, inputs.binding.bindings[0].artifactIdentity.artifactPath));
    const missingResult = validateEvidenceBinding({
      binding: inputs.binding,
      sourceClaims: inputs.sourceClaims,
      snapshotManifest: missing.manifest,
      root: missing.root,
      mode: VALIDATION_MODES.LOCAL_EVIDENCE_VALIDATION,
    });
    assert.equal(missingResult.valid, false);
    assert.ok(missingResult.errors.some((error) => error.startsWith("LOCAL_ARTIFACT_MISSING")));
  } finally {
    missing.cleanup();
  }
});

test("local evidence validation rejects wrong hashes and swapped artifacts", () => {
  const wrong = localFixtureRoot();
  try {
    const wrongResult = validateEvidenceBinding({
      binding: inputs.binding,
      sourceClaims: inputs.sourceClaims,
      snapshotManifest: wrong.manifest,
      root: wrong.root,
      mode: VALIDATION_MODES.LOCAL_EVIDENCE_VALIDATION,
    });
    assert.equal(wrongResult.valid, false);
    assert.ok(wrongResult.errors.some((error) => error.startsWith("LOCAL_ARTIFACT_HASH_MISMATCH")));
  } finally {
    wrong.cleanup();
  }

  const swapped = localFixtureRoot(["synthetic-pdf", "synthetic-html"]);
  try {
    const swappedResult = validateEvidenceBinding({
      binding: inputs.binding,
      sourceClaims: inputs.sourceClaims,
      snapshotManifest: swapped.manifest,
      root: swapped.root,
      mode: VALIDATION_MODES.LOCAL_EVIDENCE_VALIDATION,
    });
    assert.equal(swappedResult.valid, false);
    assert.ok(swappedResult.errors.some((error) => error.startsWith("LOCAL_ARTIFACT_HASH_MISMATCH")));
  } finally {
    swapped.cleanup();
  }
});

test("frozen artifact hashes are exact and fail closed", () => {
  invalidWith((binding) => { binding.bindings[0].artifactIdentity.artifactSha256 = "0".repeat(64); });
  invalidWith((binding) => { binding.bindings[1].artifactIdentity.artifactSha256 = "F".repeat(64); });
  invalidWith((binding) => { binding.bindings[0].artifactIdentity.artifactSha256 = "not-a-sha256"; });
  invalidWith((binding) => { delete binding.bindings[0].artifactIdentity.artifactSha256; });
});

test("C01 and C02 cannot swap frozen artifacts", () => {
  invalidWith((binding) => {
    const first = binding.bindings[0].artifactIdentity;
    binding.bindings[0].sourceId = binding.bindings[1].sourceId;
    binding.bindings[0].artifactIdentity = clone(binding.bindings[1].artifactIdentity);
    binding.bindings[0].documentApplicabilityOrIdentity = clone(binding.bindings[1].documentApplicabilityOrIdentity);
    binding.bindings[0].locator = clone(binding.bindings[1].locator);
    assert.equal(first.artifactFileName, "kca-isrm-identity-subject-page.html");
  });
  invalidWith((binding) => { binding.bindings[1].sourceId = "substituted-source"; });
  invalidWith((binding) => { binding.bindings[1].artifactIdentity.artifactFileName = "other.pdf"; });
});

test("locators fail closed when absent or semantically wrong", () => {
  invalidWith((binding) => { delete binding.bindings[0].locator; });
  invalidWith((binding) => { binding.bindings[1].locator.page = 2; });
  invalidWith((binding) => { binding.bindings[1].locator.subject.name = "다른 과목"; });
  invalidWith((binding) => { binding.bindings[1].locator.majorItem.name = "다른 주요항목"; });
  invalidWith((binding) => { binding.bindings[1].locator.subitems[2].number = 4; });
});

test("binding and local artifact paths reject traversal and absolute paths", () => {
  for (const escaped of ["../manifest.json", "..\\manifest.json", "C:\\outside\\artifact.html", "/outside/artifact.html", "\\\\server\\share\\artifact.html"]) {
    invalidWith((binding) => { binding.snapshotManifestPath = escaped; });
  }
  for (const escaped of ["../artifact.html", "..\\artifact.html", "C:\\outside\\artifact.html", "/outside/artifact.html", "\\\\server\\share\\artifact.html"]) {
    invalidWith((binding) => { binding.bindings[0].artifactIdentity.artifactPath = escaped; });
  }
});

test("claim substitution and claim text substitution fail closed", () => {
  invalidWith((binding) => { binding.bindings[0].claimId = "ISRM-S01-U01-C03"; });
  invalidWith((binding) => { binding.bindings[0].claimId = "ISRM-S01-U01-C02"; });
  invalidWith((binding) => { binding.bindings[0].claimTextSha256 = binding.bindings[1].claimTextSha256; });
  invalidWith((binding) => { binding.scope.claimIds = ["ISRM-S01-U01-C01", "ISRM-S01-U01-C03"]; });
  invalidWith((binding) => {
    binding.bindings.push({ ...clone(binding.bindings[0]), claimId: "ISRM-S01-U01-C03" });
  });
});

test("C03/C04 remain unsupported and cannot be upgraded by binding metadata", () => {
  const claims = new Map(inputs.sourceClaims.claims.map((claim) => [claim.id, claim]));
  assert.equal(claims.get("ISRM-S01-U01-C03").sourceType, "INDEPENDENT_PEDAGOGICAL_SYNTHESIS");
  assert.equal(claims.get("ISRM-S01-U04-C04"), undefined);
  assert.equal(claims.get("ISRM-S01-U01-C04").sourceType, "INDEPENDENT_PEDAGOGICAL_SYNTHESIS");
  const result = invalidWith((binding) => { binding.bindings[1].claimId = "ISRM-S01-U01-C03"; });
  assert.ok(result.errors.some((error) => error.includes("CLAIM_NOT_IN_ALLOWED_SCOPE") || error.includes("UNSUPPORTED_CLAIM")));
});

test("rights/currentness/publication/runtime boundaries remain fail-closed", () => {
  const result = validateBindingFiles({ root: ROOT, mode: VALIDATION_MODES.BINDING_CONTRACT_VALIDATION });
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.equal(inputs.binding.boundaries.rights, "UNKNOWN_BLOCKED_REFERENCE_ONLY");
  assert.equal(inputs.binding.boundaries.currentness, "PARTIAL");
  assert.equal(inputs.binding.boundaries.publication, "NOT_AUTHORIZED");
  assert.equal(inputs.binding.boundaries.binaryPublicLanding, "NONE");
  assert.equal(inputs.binding.boundaries.runtimeRegistration, 0);
  invalidWith((binding) => { binding.boundaries.rights = "CLEARED"; });
  invalidWith((binding) => { binding.boundaries.currentness = "CURRENT"; });
  invalidWith((binding) => { binding.approved = true; });
});

test("binding remains portable and does not depend on binary landing", () => {
  const bindingText = fs.readFileSync(`${ROOT}/${BINDING_PATH}`, "utf8");
  assert.doesNotMatch(bindingText, /(?:^|["\s])[A-Za-z]:[\\/]/);
  assert.doesNotMatch(bindingText, /\\tmp\\|\/tmp\//i);
  assert.match(bindingText, /source-evidence-snapshots\/isrm-kca-identity-subject\/2026-09-21/);
  assert.match(fs.readFileSync(`${ROOT}/${SOURCE_CLAIMS_PATH}`, "utf8"), /ISRM-S01-U01-C01/);
});
