import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import {
  SECURIUM_CANONICAL_CONCEPT_SEED,
  SECURIUM_CANONICAL_CONCEPT_SEED_METADATA,
  SECURIUM_CANONICAL_CONCEPT_SEED_PROVENANCE_BINDING,
  renderSecuriumCanonicalConceptSeedSql,
  validateSecuriumCanonicalConceptSeed,
} from "../lib/data/securium-canonical-concept-dataset-seed.mjs";
import {
  assertSecuriumCanonicalConceptDatasetHistoricalTarget,
  SECURIUM_CANONICAL_CONCEPT_DATASET_CLASSIFICATION,
  SECURIUM_CANONICAL_CONCEPT_DATASET_MANIFEST_CLASSIFICATION,
  SECURIUM_CANONICAL_CONCEPT_DATASET_WRITER_AUTHORITY,
  SECURIUM_CANONICAL_CONCEPT_DATASET_SHARED_NONPROD_WRITE_AUTHORITY,
} from "../lib/data/securium-canonical-concept-dataset-archival-guard.mjs";

test("bounded canonical Concept seed has stable DRAFT identities and exact aliases", () => {
  const result = validateSecuriumCanonicalConceptSeed();
  assert.equal(result.conceptCount, 29);
  assert.equal(result.aliasCount, 10);
  assert.equal(result.edgeCount, 0);
  assert.equal(result.mappingCount, 0);
  assert.equal(SECURIUM_CANONICAL_CONCEPT_SEED_METADATA.status, "DRAFT");
  assert.equal(SECURIUM_CANONICAL_CONCEPT_SEED_METADATA.productionMutation, 0);
  assert.equal(SECURIUM_CANONICAL_CONCEPT_SEED_METADATA.classification, SECURIUM_CANONICAL_CONCEPT_DATASET_CLASSIFICATION);
  assert.equal(SECURIUM_CANONICAL_CONCEPT_SEED_METADATA.manifestClassification, SECURIUM_CANONICAL_CONCEPT_DATASET_MANIFEST_CLASSIFICATION);
  assert.equal(SECURIUM_CANONICAL_CONCEPT_SEED_METADATA.writerAuthority, SECURIUM_CANONICAL_CONCEPT_DATASET_WRITER_AUTHORITY);
  assert.equal(SECURIUM_CANONICAL_CONCEPT_SEED_METADATA.sharedNonprodWriteAuthority, SECURIUM_CANONICAL_CONCEPT_DATASET_SHARED_NONPROD_WRITE_AUTHORITY);
});

test("Dataset A local historical fixture fails closed for shared nonprod and production", () => {
  assert.throws(
    () => assertSecuriumCanonicalConceptDatasetHistoricalTarget({ target: "NONPROD" }),
    /SECURIUM_DATASET_A_WRITER_AUTHORITY_NONE_TARGET_REJECTED/,
  );
  assert.throws(
    () => assertSecuriumCanonicalConceptDatasetHistoricalTarget({ target: "PRODUCTION" }),
    /SECURIUM_DATASET_A_WRITER_AUTHORITY_NONE_TARGET_REJECTED/,
  );
  assert.throws(
    () => renderSecuriumCanonicalConceptSeedSql({ target: "SHARED_NONPROD" }),
    /SECURIUM_DATASET_A_WRITER_AUTHORITY_NONE_TARGET_REJECTED/,
  );
  assert.throws(
    () => renderSecuriumCanonicalConceptSeedSql({ target: "LOCAL_HISTORICAL_TEST" }),
    /SECURIUM_DATASET_A_LOCAL_FIXTURE_CONFIRM_REQUIRED/,
  );
  assert.match(renderSecuriumCanonicalConceptSeedSql({ target: "LOCAL_HISTORICAL_TEST", allowHistoricalFixture: true }), /BEGIN;/);
});

test("Dataset A cannot downgrade Dataset B-owned state", () => {
  assert.throws(
    () => renderSecuriumCanonicalConceptSeedSql({
      target: "LOCAL_HISTORICAL_TEST",
      existingState: {
        owner: "securium-canonical-ontology-dataset-foundation",
        manifestMarker: "cf8b59d94e55328c5a074ecf1d4e8368bcab94e0570edff554a88084b671dc96",
        counts: { concepts: 54, aliases: 56, edges: 4 },
      },
      allowHistoricalFixture: true,
    }),
    /SECURIUM_DATASET_A_DOWNGRADE_REJECTED/,
  );
});

test("canonical seed is bound to the target repository evidence", () => {
  assert.deepEqual(SECURIUM_CANONICAL_CONCEPT_SEED_PROVENANCE_BINDING, {
    bindingVersion: "TARGET_BRANCH_BOUND_V1",
    repository: "securium-canonical-ontology-dataset",
    branch: "architecture/canonical-ontology-dataset",
    targetHead: "980ef6adb94d87a923d7a973edaf4419f03fff9d",
    manifestPath: "reports/content-audit/securium-canonical-ontology-concept-dataset-manifest-2026-09-08.json",
    manifestSha256: "16B6BA243E587FD1BE021FD950DEAB56B82D670078BE26B2C16C1BEF18BF91D8",
    liveCanonicalDatasetSha256: "fcb12b48b66b69b377c9d693baf35334ba711329a625f24b53ec075156a9d009",
    seedModulePath: "lib/data/securium-canonical-concept-dataset-seed.mjs",
    seedTestPath: "tests/securium-canonical-concept-dataset-seed.test.mjs",
  });
  assert.deepEqual(SECURIUM_CANONICAL_CONCEPT_SEED_METADATA.provenanceBinding, SECURIUM_CANONICAL_CONCEPT_SEED_PROVENANCE_BINDING);
  const sql = renderSecuriumCanonicalConceptSeedSql({ allowHistoricalFixture: true });
  assert.match(sql, /TARGET_BRANCH_BOUND_V1/);
  assert.match(sql, /980ef6adb94d87a923d7a973edaf4419f03fff9d/);
  assert.match(sql, /16B6BA243E587FD1BE021FD950DEAB56B82D670078BE26B2C16C1BEF18BF91D8/);
  assert.match(sql, /fcb12b48b66b69b377c9d693baf35334ba711329a625f24b53ec075156a9d009/);
});

test("canonical manifest is repository-controlled and live-dataset bound", () => {
  const manifestPath = new URL(
    "../reports/content-audit/securium-canonical-ontology-concept-dataset-manifest-2026-09-08.json",
    import.meta.url,
  );
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  const manifestSha256 = crypto.createHash("sha256").update(manifestBytes).digest("hex").toUpperCase();
  assert.equal(manifestSha256, SECURIUM_CANONICAL_CONCEPT_SEED_PROVENANCE_BINDING.manifestSha256);
  assert.equal(manifest.conceptCount, 29);
  assert.equal(manifest.aliasCount, 10);
  assert.equal(manifest.concepts.length, 29);
  assert.equal(manifest.concepts.reduce((count, item) => count + item.aliases.length, 0), 10);
  assert.equal(manifest.relations.length, 0);
  assert.equal(manifest.liveCanonicalDatasetSha256, SECURIUM_CANONICAL_CONCEPT_SEED_PROVENANCE_BINDING.liveCanonicalDatasetSha256);
  assert.ok(manifest.concepts.every((item) => item.lifecycle === "DRAFT" && item.provenance?.sourceRole === "REFERENCE_ONLY"));
});

test("canonical Concept seed does not create a second authority or learner state", () => {
  const sql = renderSecuriumCanonicalConceptSeedSql({ allowHistoricalFixture: true });
  assert.match(sql, /ontology_concepts/);
  assert.match(sql, /ontology_aliases/);
  assert.doesNotMatch(sql, /question_concepts|content_revision_concepts|user_skill_state|mastery|competency/i);
  assert.doesNotMatch(sql, /INSERT INTO concepts|INSERT INTO concept_versions|INSERT INTO concept_labels/i);
  assert.doesNotMatch(sql, /'ACTIVE'/);
  assert.match(sql, /SECURIUM_CANONICAL_CONCEPT_SEED_CONFLICT/);
  assert.match(sql, /SECURIUM_CANONICAL_ALIAS_CONFLICT/);
});

test("canonical Concept seed SQL is deterministic and aliases remain exact", () => {
  const first = renderSecuriumCanonicalConceptSeedSql({ allowHistoricalFixture: true });
  assert.equal(first, renderSecuriumCanonicalConceptSeedSql({ allowHistoricalFixture: true }));
  assert.match(first, /ON CONFLICT/);
  assert.match(first, /DO NOTHING/);
  assert.doesNotMatch(first, /Allowlist Validation/);
});

test("current SW topics have exact canonical identities without course-local keys", () => {
  const keys = new Set(SECURIUM_CANONICAL_CONCEPT_SEED.map((item) => item.conceptKey));
  for (const slug of [
    "code-injection",
    "os-command-injection",
    "sql-injection",
    "path-traversal",
    "cross-site-scripting",
    "file-upload-security",
    "http-response-splitting",
    "error-information-exposure",
  ]) {
    assert.ok(keys.has(`ontology:securium:${slug}`));
  }
  assert.ok([...keys].every((key) => !key.includes("course-sw-vuln") && !key.includes("q18")));
});
