import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  canonicalize,
  compareCanonicalStrings,
  authorityMetadata,
  authorityStalenessReasons,
  loadGeneratorInputAuthority,
  normalizeProjection,
  projectionSemanticSha256,
  projectionByteSha256,
  semanticPayload,
  serializeCanonical,
  validateGeneratorInputAuthority,
} from "../scripts/security-content-v3-generator-input.mjs";

const rootDir = resolve(".");
const authority = await loadGeneratorInputAuthority({ rootDir });

test("canonical input authority validates offline and owns exactly twelve outputs", async () => {
  const result = await validateGeneratorInputAuthority(authority);
  assert.equal(result.ok, true);
  assert.equal(authority.manifest.outputOwnership.length, 12);
  assert.equal(authority.manifest.provider.d1Authority, "D1_GENERATOR_FIXTURE_ONLY");
  assert.equal(authority.manifest.authority.runtimeAuthority, false);
  assert.equal(authority.projection.privacy.personalData, 0);
  assert.equal(authority.projection.privacy.learnerEvidence, 0);
});

test("object key order is non-semantic while canonical bytes remain stable", () => {
  const left = { z: 1, nested: { b: 2, a: 3 }, a: 4 };
  const right = { a: 4, nested: { a: 3, b: 2 }, z: 1 };
  assert.equal(projectionSemanticSha256(left), projectionSemanticSha256(right));
  assert.equal(serializeCanonical(left), serializeCanonical(right));
});

test("timestamp-only changes do not change semantic hash", () => {
  const left = { ...authority.projection, generatedAt: "2026-09-10T00:00:00.000Z" };
  const right = { ...authority.projection, generatedAt: "2030-01-01T00:00:00.000Z" };
  assert.equal(projectionSemanticSha256(left), projectionSemanticSha256(right));
});

test("semantic source mutation changes the semantic hash", () => {
  const mutated = structuredClone(authority.projection);
  mutated.questionRows[0].content = `${mutated.questionRows[0].content} mutation`;
  assert.notEqual(projectionSemanticSha256(mutated), authority.manifest.fixture.semanticSha256);
});

test("fixture byte serialization is UTF-8 LF with one terminal newline", async () => {
  const bytes = await readFile(resolve(rootDir, "content-inputs/security-content-v3/database-projection.json"));
  const text = bytes.toString("utf8");
  assert.equal(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf, false);
  assert.equal(text.includes("\r"), false);
  assert.equal(text.endsWith("\n"), true);
  assert.equal(text.endsWith("\n\n"), false);
  assert.equal(projectionByteSha256(JSON.parse(text)), authority.manifest.fixture.byteSha256);
});

test("normalization sorts unordered question and ontology collections", () => {
  const value = {
    questionRows: [{ course_id: "b", id: "2" }, { course_id: "a", id: "3" }, { course_id: "a", id: "1" }],
    ontologyConcepts: [{ concept_key: "b", aliases: ["z", "a"] }, { concept_key: "a", aliases: ["b", "a"] }],
  };
  const normalized = normalizeProjection(value);
  assert.deepEqual(normalized.questionRows.map((row) => row.id), ["1", "3", "2"]);
  assert.deepEqual(normalized.ontologyConcepts.map((row) => row.concept_key), ["a", "b"]);
  assert.deepEqual(normalized.ontologyConcepts[0].aliases, ["a", "b"]);
});

test("hash binding mismatch fails closed", async () => {
  const manifest = structuredClone(authority.manifest);
  manifest.generatorHashes[0].sha256 = "0".repeat(64);
  await assert.rejects(
    validateGeneratorInputAuthority({ ...authority, manifest }),
    /SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID/,
  );
});

test("source binding and provider mismatch fail closed", async () => {
  const sourceManifest = structuredClone(authority.manifest);
  sourceManifest.sourceHashes[0].sha256 = "0".repeat(64);
  await assert.rejects(
    validateGeneratorInputAuthority({ ...authority, manifest: sourceManifest }),
    /SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID/,
  );
  const providerManifest = structuredClone(authority.manifest);
  providerManifest.provider.providerMode = "LIVE_D1";
  await assert.rejects(
    validateGeneratorInputAuthority({ ...authority, manifest: providerManifest }),
    /SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID/,
  );
});

test("authority escalation and unknown inputs fail closed", async () => {
  const manifest = structuredClone(authority.manifest);
  const projection = structuredClone(authority.projection);
  manifest.authority.questionAuthority = true;
  manifest.inputPolicy.unknownInputs = 1;
  projection.privacy.personalData = 1;
  await assert.rejects(
    validateGeneratorInputAuthority({ ...authority, manifest, projection }),
    /SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID/,
  );
});

test("synthetic learner or personal fields are rejected", async () => {
  const projection = structuredClone(authority.projection);
  projection.questionRows[0].email = "synthetic@example.invalid";
  await assert.rejects(
    validateGeneratorInputAuthority({ ...authority, projection }),
    /SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID/,
  );
});

test("output authority metadata detects source, fixture, generator, and environment drift", () => {
  const metadata = authorityMetadata(authority, "scripts/build-security-content-v3-analysis.mjs");
  assert.deepEqual(
    authorityStalenessReasons(metadata, authority, "scripts/build-security-content-v3-analysis.mjs"),
    { stale: false, reasons: [] },
  );
  const drifted = { ...metadata, inputAuthorityHash: "0".repeat(64), environmentPolicyHash: "1".repeat(64) };
  const result = authorityStalenessReasons(drifted, authority, "scripts/build-security-content-v3-analysis.mjs");
  assert.equal(result.stale, true);
  assert.deepEqual(result.reasons, ["INPUT_AUTHORITY_SEMANTIC_HASH_CHANGED", "ENVIRONMENT_POLICY_CHANGED"]);
});

test("semantic payload strips only non-semantic timestamps", () => {
  const payload = semanticPayload({ value: 1, updatedAt: "now", nested: { timestamp: "later", value: 2 } });
  assert.deepEqual(payload, { nested: { value: 2 }, value: 1 });
  assert.deepEqual(canonicalize({ b: 1, a: 2 }), { a: 2, b: 1 });
});

test("duplicate output ownership fails closed", async () => {
  const manifest = structuredClone(authority.manifest);
  manifest.outputOwnership[1] = structuredClone(manifest.outputOwnership[0]);
  await assert.rejects(
    validateGeneratorInputAuthority({ ...authority, manifest }),
    /SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID/,
  );
});

test("unknown output ownership fails closed", async () => {
  const manifest = structuredClone(authority.manifest);
  manifest.outputOwnership[0].path = "reports/content-v3/unknown.json";
  await assert.rejects(
    validateGeneratorInputAuthority({ ...authority, manifest }),
    /SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID/,
  );
});

test("missing source binding fails closed", async () => {
  const manifest = structuredClone(authority.manifest);
  manifest.sourceHashes.pop();
  await assert.rejects(
    validateGeneratorInputAuthority({ ...authority, manifest }),
    /SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID/,
  );
});

test("source and generator path escape fails closed", async () => {
  const sourceManifest = structuredClone(authority.manifest);
  sourceManifest.sourceHashes[0].path = "../package.json";
  await assert.rejects(
    validateGeneratorInputAuthority({ ...authority, manifest: sourceManifest }),
    /SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID/,
  );
  const generatorManifest = structuredClone(authority.manifest);
  generatorManifest.generatorHashes[0].path = "../package.json";
  await assert.rejects(
    validateGeneratorInputAuthority({ ...authority, manifest: generatorManifest }),
    /SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID/,
  );
});

test("unordered database course rows do not change semantic hash", () => {
  const reordered = structuredClone(authority.projection);
  reordered.databaseProjection.courseRows.reverse();
  assert.equal(projectionSemanticSha256(reordered), authority.manifest.fixture.semanticSha256);
});

test("duplicate semantic rows fail closed", async () => {
  const projection = structuredClone(authority.projection);
  projection.databaseProjection.courseRows.push(structuredClone(projection.databaseProjection.courseRows[0]));
  await assert.rejects(
    validateGeneratorInputAuthority({ ...authority, projection }),
    /SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID/,
  );
});

test("canonical sorting is locale-independent and Node policy is pinned", () => {
  assert.deepEqual(["é", "a", "Z"].sort(compareCanonicalStrings), ["Z", "a", "é"]);
  assert.equal(authority.manifest.environment.node, "22.13.0");
  assert.equal(authority.manifest.environment.nodeAuthority, ".github/workflows/ci.yml:actions/setup-node@v7/node-version");
});
