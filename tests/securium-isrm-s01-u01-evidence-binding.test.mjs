import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  ROOT,
  BINDING_PATH,
  SOURCE_CLAIMS_PATH,
  SNAPSHOT_MANIFEST_PATH,
  loadBindingInputs,
  validateBindingFiles,
  validateEvidenceBinding,
} from "../scripts/validate-securium-isrm-s01-u01-evidence-binding.mjs";

const inputs = loadBindingInputs(ROOT);

function clone(value) {
  return structuredClone(value);
}

function invalidWith(mutator) {
  const mutated = clone(inputs.binding);
  mutator(mutated);
  const result = validateEvidenceBinding({
    binding: mutated,
    sourceClaims: inputs.sourceClaims,
    snapshotManifest: inputs.snapshotManifest,
    root: ROOT,
  });
  assert.equal(result.valid, false, `expected invalid binding, got ${JSON.stringify(result)}`);
  return result;
}

test("C01/C02 frozen evidence binding passes without reading local binary", () => {
  const result = validateEvidenceBinding({
    binding: inputs.binding,
    sourceClaims: inputs.sourceClaims,
    snapshotManifest: inputs.snapshotManifest,
    root: "C:/reviewer-independent-contract-only",
  });
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.deepEqual(result.boundClaimIds, ["ISRM-S01-U01-C01", "ISRM-S01-U01-C02"]);
  assert.equal(result.mode, "BINDING_CONTRACT_VALIDATION");
});

test("optional local evidence validation recomputes both frozen artifact hashes", () => {
  const result = validateBindingFiles({ root: ROOT, readLocalArtifacts: true });
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.equal(result.mode, "LOCAL_EVIDENCE_VALIDATION");
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
  const result = validateBindingFiles({ root: ROOT });
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
  assert.match(fs.readFileSync(`${ROOT}/${SNAPSHOT_MANIFEST_PATH}`, "utf8"), /B5E1FAE5/);
  assert.match(fs.readFileSync(`${ROOT}/${SOURCE_CLAIMS_PATH}`, "utf8"), /ISRM-S01-U01-C01/);
});
