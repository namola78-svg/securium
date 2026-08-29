import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalIdFromPublicKnowledgeId,
  publicKnowledgeId,
} from "../lib/services/knowledge-query-service.ts";
import {
  createKnowledgeQueryService,
  type CanonicalResolution,
  type KnowledgeAuthority,
} from "./support/knowledge-query-test-harness.ts";
import { readFile } from "node:fs/promises";

const active = { id: "c-1", stableKey: "concept:access-control", lifecycle: "ACTIVE" as const, versionId: "cv-1", version: 1 };
const deprecated = { id: "c-2", stableKey: "concept:old", lifecycle: "DEPRECATED" as const, replacementId: "c-1" };
type ServerState = NonNullable<Awaited<ReturnType<KnowledgeAuthority["loadState"]>>>;
const publicState: ServerState = { canonicalId: "c-1", publication: "PUBLISHED", access: "PUBLIC", mappingStatus: "APPROVED", provenanceSourceType: "OFFICIAL", sourceReference: "source-1", revision: "CURRENT", revisionReference: "revision-1" };

function authority(overrides: Partial<KnowledgeAuthority> = {}): KnowledgeAuthority {
  return {
    resolveConcept: async (reference): Promise<CanonicalResolution> => {
      if (reference.id === active.id || reference.key === active.stableKey || reference.stableKey === active.stableKey) return { kind: "RESOLVED", concept: active };
      if (reference.id === deprecated.id || reference.key === deprecated.stableKey) return { kind: "DEPRECATED", concept: deprecated, replacement: active };
      if (reference.alias === "shared") return { kind: "AMBIGUOUS" };
      return { kind: reference.key ? "UNRESOLVED_LEGACY_REFERENCE" : "NOT_FOUND" };
    },
    loadState: async ({ canonicalId }) => canonicalId === "c-1" ? publicState : null,
    searchCandidates: async () => [{ reference: { key: active.stableKey }, score: 0.99 }, { reference: { key: "ontology:unresolved" }, score: 1 }],
    ...overrides,
  };
}

test("canonical resolution is server-owned and lifecycle-preserving", async () => {
  const service = createKnowledgeQueryService(authority());
  assert.equal((await service.resolveConcept({ id: "c-1" })).kind, "RESOLVED");
  assert.equal((await service.resolveConcept({ key: "concept:old" })).kind, "DEPRECATED");
  assert.equal((await service.resolveConcept({ key: "ontology:missing" })).kind, "UNRESOLVED_LEGACY_REFERENCE");
  assert.equal((await service.resolveConcept({ alias: "shared" })).kind, "AMBIGUOUS");
  assert.equal((await service.resolveConcept({})).kind, "NOT_FOUND");
});

test("same caller input follows changing server authority", async () => {
  let state = publicState;
  const service = createKnowledgeQueryService(authority({ loadState: async () => state }));
  const request = { entityType: "CONCEPT" as const, publicId: "concept:c-1" };
  assert.equal((await service.getPublicEntity(request)).kind, "PUBLIC");
  state = { ...publicState, publication: "NOT_PUBLIC", access: "RESTRICTED", mappingStatus: "SUGGESTED", revision: "STALE" };
  assert.equal((await service.getPublicEntity(request)).kind, "NOT_FOUND");
});

test("caller trust fields are not accepted by the public query boundary", async () => {
  const service = createKnowledgeQueryService(authority({ loadState: async () => ({ ...publicState, publication: "UNKNOWN", access: "UNKNOWN", mappingStatus: null, provenanceSourceType: "UNKNOWN", revision: "UNKNOWN" }) }));
  const request = { entityType: "CONCEPT" as const, publicId: "concept:c-1", published: true, approved: true, official: true, fresh: true, current: true, restricted: false, mappingStatus: "APPROVED" };
  assert.equal((await service.getPublicEntity(request)).kind, "NOT_FOUND");
});

test("public IDs are stable and parsing alone cannot disclose an entity", async () => {
  assert.equal(publicKnowledgeId("concept", "c-1"), "concept:c-1");
  assert.equal(canonicalIdFromPublicKnowledgeId("concept:c-1", "concept"), "c-1");
  assert.equal(canonicalIdFromPublicKnowledgeId("certification:c-1", "concept"), undefined);
  assert.equal(publicKnowledgeId("concept", "id with spaces"), undefined);
  const service = createKnowledgeQueryService(authority({ loadState: async () => null }));
  assert.equal((await service.getPublicEntity({ entityType: "CONCEPT", publicId: "concept:c-1" })).kind, "NOT_FOUND");
});

test("Certification and Learning Content use separate stable identity namespaces", async () => {
  const service = createKnowledgeQueryService(authority({ loadState: async ({ canonicalId }) => ({ ...publicState, canonicalId }) }));
  assert.equal((await service.getPublicEntity({ entityType: "CERTIFICATION", publicId: "certification:cert-1" })).kind, "PUBLIC");
  const contentService = createKnowledgeQueryService(authority({ loadState: async ({ canonicalId }) => ({ ...publicState, canonicalId }) }));
  assert.equal((await contentService.getPublicEntity({ entityType: "LEARNING_CONTENT", publicId: "learning-content:content-1" })).kind, "PUBLIC");
});

test("server-derived projection includes approved provenance and current freshness only", async () => {
  const service = createKnowledgeQueryService(authority());
  const result = await service.getPublicEntity({ entityType: "CONCEPT", publicId: "concept:c-1" });
  assert.equal(result.kind, "PUBLIC");
  if (result.kind !== "PUBLIC") return;
  assert.deepEqual(result.projection.provenance, { sourceType: "OFFICIAL", sourceReference: "source-1", mappingStatus: "APPROVED", publication: "PUBLISHED" });
  assert.equal(result.projection.freshness, "CURRENT_PUBLISHED");
  assert.equal("actorId" in result.projection.provenance, false);
});

test("mapping, provenance, freshness, and restricted states fail closed", async () => {
  for (const state of [
    { ...publicState, mappingStatus: "SUGGESTED" as const },
    { ...publicState, provenanceSourceType: "UNKNOWN" as const },
    { ...publicState, revision: "UNKNOWN" as const },
    { ...publicState, access: "RESTRICTED" as const },
  ]) {
    const service = createKnowledgeQueryService(authority({ loadState: async () => state }));
    assert.equal((await service.getPublicEntity({ entityType: "CONCEPT", publicId: "concept:c-1" })).kind, "NOT_FOUND");
  }
});

test("high-scoring unresolved search candidates never become canonical output", async () => {
  const service = createKnowledgeQueryService(authority());
  const results = await service.search({ query: "access control", limit: 10 });
  assert.equal(results.length, 1);
  assert.equal(results[0].projection.canonicalId, "c-1");
  assert.equal(results[0].score, 0.99);
});

test("Question public retrieval is not part of the query service", () => {
  const service = createKnowledgeQueryService(authority());
  assert.deepEqual(Object.keys(service).sort(), ["getPublicEntity", "resolveConcept", "search"]);
  assert.equal("QUESTION" in service, false);
});

test("fake authority cannot reach the production public boundary", async () => {
  const publicModule = await readFile(new URL("../lib/services/knowledge-query-service.ts", import.meta.url), "utf8");
  assert.doesNotMatch(publicModule, /createKnowledgeQueryService/);
  assert.doesNotMatch(publicModule, /KnowledgeAuthority/);
  assert.match(publicModule, /resolvePublicKnowledge/);
  assert.match(publicModule, /searchPublicKnowledge/);
  const serverModule = await readFile(new URL("../lib/services/server-knowledge-query-service.ts", import.meta.url), "utf8");
  assert.doesNotMatch(serverModule, /export function createKnowledgeQueryService/);
  assert.doesNotMatch(serverModule, /export type KnowledgeAuthority/);
  assert.match(serverModule, /function serverAuthority/);
  await assert.rejects(() => readFile(new URL("../lib/services/knowledge-query-service-core.ts", import.meta.url)));
  await assert.rejects(() => readFile(new URL("../lib/services/knowledge-query-service-test-only.ts", import.meta.url)));
  const productionSource = await readFile(new URL("../lib/services/knowledge-query-service.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionSource, /tests[\\/]support|test-only|core/);
});
