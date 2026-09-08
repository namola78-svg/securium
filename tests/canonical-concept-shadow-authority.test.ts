import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createCanonicalOntologyAuthorityFromRepository,
  type CanonicalOntologyRepository,
  type CanonicalOntologyRow,
} from "../lib/services/server-knowledge-query-service.ts";

const canonicalOnly: CanonicalOntologyRow = row("canonical-only", "ontology:rereview:canonical-only", "Canonical Only", "canonical only");
const preferredOnly: CanonicalOntologyRow = row("preferred-only", "ontology:rereview:preferred-only", "Preferred Only", "preferred only");
const canonicalConflict: CanonicalOntologyRow = row("canonical-conflict", "ontology:rereview:conflict", "Canonical Conflict", "canonical conflict");
const ambiguousA: CanonicalOntologyRow = row("ambiguous-a", "ontology:rereview:ambiguous-a", "Ambiguous A", "ambiguous a");
const ambiguousB: CanonicalOntologyRow = row("ambiguous-b", "ontology:rereview:ambiguous-b", "Ambiguous B", "ambiguous b");
const canonicalAlias = { conceptId: canonicalOnly.id, normalizedAlias: "registered rereview alias" };
const ambiguousAliases = [
  { conceptId: ambiguousA.id, normalizedAlias: "ambiguous rereview alias" },
  { conceptId: ambiguousB.id, normalizedAlias: "ambiguous rereview alias" },
];

test("canonical Concept authority is isolated from legacy shadow rows", async () => {
  const source = await readFile(new URL("../lib/services/server-knowledge-query-service.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(concepts|conceptVersions|conceptLabels)\b/);
  assert.match(source, /ontologyConcepts/);
  assert.match(source, /ontologyAliases/);

  const legacyRows = [
    { id: "legacy-only", stableKey: "ontology:rereview:legacy-only", label: "Legacy Only Label", version: 99 },
    { id: "legacy-conflict", stableKey: canonicalConflict.conceptKey, label: "Legacy Override", version: 98 },
  ];
  const repository = fixtureRepository([canonicalOnly, preferredOnly, canonicalConflict, ambiguousA, ambiguousB]);
  const authority = createCanonicalOntologyAuthorityFromRepository(repository);

  assert.equal((await authority.resolveConcept({ id: canonicalOnly.id })).kind, "RESOLVED");
  assert.equal((await authority.resolveConcept({ key: canonicalOnly.conceptKey })).concept?.id, canonicalOnly.id);
  assert.equal((await authority.resolveConcept({ alias: "Registered Rereview Alias" })).concept?.id, canonicalOnly.id);
  assert.equal((await authority.resolveConcept({ id: "legacy-only" })).kind, "UNRESOLVED");
  assert.equal((await authority.resolveConcept({ key: "ontology:rereview:legacy-only" })).kind, "UNRESOLVED");
  assert.equal((await authority.resolveConcept({ alias: "Legacy Only Label" })).kind, "UNRESOLVED");
  assert.equal((await authority.resolveConcept({ alias: "Preferred Only" })).kind, "UNRESOLVED");
  assert.equal((await authority.resolveConcept({ alias: "Ambiguous Rereview Alias" })).kind, "AMBIGUOUS");

  const conflict = await authority.resolveConcept({ key: canonicalConflict.conceptKey });
  assert.equal(conflict.kind, "RESOLVED");
  assert.equal(conflict.concept?.id, canonicalConflict.id);
  assert.equal((await authority.resolveConcept({ alias: "Legacy Override" })).kind, "UNRESOLVED");

  const canonicalCandidates = await authority.searchCandidates({ query: "canonical only", limit: 20 });
  assert.ok(canonicalCandidates.some((candidate) => candidate.reference.stableKey === canonicalOnly.conceptKey));
  assert.equal((await authority.searchCandidates({ query: "legacy only", limit: 20 })).length, 0);
  const conflictCandidates = await authority.searchCandidates({ query: "conflict", limit: 20 });
  assert.deepEqual(conflictCandidates.map((candidate) => candidate.reference.stableKey), [canonicalConflict.conceptKey]);

  assert.equal(await authority.loadState({ entityType: "CONCEPT", canonicalId: "legacy-only" }), null);
  assert.deepEqual(await authority.loadState({ entityType: "CONCEPT", canonicalId: canonicalOnly.id }), {
    canonicalId: canonicalOnly.id,
    publication: "UNKNOWN",
    access: "UNKNOWN",
    mappingStatus: null,
    provenanceSourceType: "UNKNOWN",
    revision: "UNKNOWN",
  });
  assert.deepEqual(legacyRows, [
    { id: "legacy-only", stableKey: "ontology:rereview:legacy-only", label: "Legacy Only Label", version: 99 },
    { id: "legacy-conflict", stableKey: canonicalConflict.conceptKey, label: "Legacy Override", version: 98 },
  ]);
  assert.ok(repository.queriedSources.includes("ontology_concepts"));
  assert.ok(repository.queriedSources.includes("ontology_aliases"));
  assert.equal(repository.queriedSources.includes("concepts"), false);
  assert.equal(repository.queriedSources.includes("concept_versions"), false);
  assert.equal(repository.queriedSources.includes("concept_labels"), false);
});

function fixtureRepository(rows: CanonicalOntologyRow[]): CanonicalOntologyRepository & { queriedSources: string[] } {
  const queriedSources: string[] = [];
  return {
    queriedSources,
    async findByIdOrKey(input) {
      queriedSources.push("ontology_concepts");
      return rows.filter((row) => input.id ? row.id === input.id : row.conceptKey === input.key);
    },
    async findByAlias(alias) {
      queriedSources.push("ontology_aliases");
      const matches = [canonicalAlias, ...ambiguousAliases].filter((candidate) => candidate.normalizedAlias === alias);
      return matches.flatMap((candidate) => rows.filter((row) => row.id === candidate.conceptId));
    },
    async search(input) {
      queriedSources.push("ontology_concepts");
      const concepts = rows
        .filter((row) => row.status === "ACTIVE" && (row.normalizedLabel.includes(input.normalizedQuery) || row.conceptKey.includes(input.normalizedQuery)))
        .map((row) => ({ id: row.id, stableKey: row.conceptKey, text: row.normalizedLabel }));
      queriedSources.push("ontology_aliases");
      const aliases = [canonicalAlias, ...ambiguousAliases]
        .filter((alias) => alias.normalizedAlias.includes(input.normalizedQuery))
        .flatMap((alias) => rows.filter((row) => row.id === alias.conceptId).map((row) => ({ id: row.id, stableKey: row.conceptKey, text: alias.normalizedAlias })));
      return [...concepts, ...aliases].slice(0, input.limit);
    },
    async findActiveConcept(id) {
      queriedSources.push("ontology_concepts");
      return rows.find((row) => row.id === id && row.status === "ACTIVE") ? { id } : null;
    },
    async findPublishedContent() {
      return null;
    },
  };
}

function row(id: string, conceptKey: string, label: string, normalizedLabel: string): CanonicalOntologyRow {
  return { id, conceptKey, label, normalizedLabel, status: "ACTIVE" };
}
