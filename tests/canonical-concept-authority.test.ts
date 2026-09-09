import assert from "node:assert/strict";
import test from "node:test";
import {
  CONCEPT_AUTHORITY_CONTRACT,
  RELATION_AUTHORITY_CONTRACT,
  resolveCanonicalConceptRecords,
} from "../lib/services/canonical-concept-authority.ts";

const legacyConcept = {
  id: "legacy-sql-injection",
  stableKey: "ontology:security:sql-injection",
  label: "SQL Injection",
  normalizedLabel: "sql injection",
  aliases: ["SQLi"],
  status: "ACTIVE",
};

test("legacy ontology_concepts is the single canonical Concept authority", () => {
  assert.equal(CONCEPT_AUTHORITY_CONTRACT.canonicalStore, "ontology_concepts");
  assert.equal(CONCEPT_AUTHORITY_CONTRACT.semanticIdentity, "ontology_concepts.concept_key");
  assert.equal(CONCEPT_AUTHORITY_CONTRACT.cpaStoreRole, "STAGING_COMPATIBILITY_ALIAS_SOURCE");
  const result = resolveCanonicalConceptRecords({
    reference: { id: legacyConcept.id },
    canonical: [legacyConcept],
    staging: [{ id: "cpa-sql-injection", stableKey: legacyConcept.stableKey, status: "DRAFT" }],
  });
  assert.equal(result.kind, "RESOLVED");
  assert.equal(result.compatibilityPath, "CANONICAL");
  assert.equal(result.concept?.id, legacyConcept.id);
});

test("CP-A ID resolves only through an exact stable-key bridge", () => {
  const result = resolveCanonicalConceptRecords({
    reference: { id: "cpa-sql-injection" },
    canonical: [legacyConcept],
    staging: [{ id: "cpa-sql-injection", stableKey: legacyConcept.stableKey, status: "DRAFT" }],
  });
  assert.equal(result.kind, "RESOLVED");
  assert.equal(result.compatibilityPath, "CPA_STAGING_TO_CANONICAL");
  assert.equal(result.concept?.id, legacyConcept.id);
});

test("unknown legacy or staging references fail closed without fuzzy merging", () => {
  const result = resolveCanonicalConceptRecords({
    reference: { id: "cpa-similar-but-not-the-same" },
    canonical: [legacyConcept],
    staging: [{ id: "cpa-similar-but-not-the-same", stableKey: "ontology:security:command-injection", status: "DRAFT" }],
  });
  assert.equal(result.kind, "UNRESOLVED_LEGACY_REFERENCE");
});

test("ambiguous aliases do not auto-resolve", () => {
  const result = resolveCanonicalConceptRecords({
    reference: { alias: "Injection" },
    canonical: [
      { ...legacyConcept, id: "legacy-sql", stableKey: "ontology:security:sql-injection", aliases: ["Injection"] },
      { ...legacyConcept, id: "legacy-command", stableKey: "ontology:security:command-injection", label: "Command Injection", aliases: ["Injection"] },
    ],
  });
  assert.equal(result.kind, "AMBIGUOUS");
  assert.equal(result.candidates?.length, 2);
});

test("distinct concepts remain distinct even when related", () => {
  const result = resolveCanonicalConceptRecords({
    reference: { alias: "Command Injection" },
    canonical: [
      { ...legacyConcept, id: "legacy-command", stableKey: "ontology:security:command-injection", label: "Command Injection", normalizedLabel: "command injection" },
      { ...legacyConcept, id: "legacy-os-command", stableKey: "ontology:security:os-command-injection", label: "OS Command Injection", normalizedLabel: "os command injection" },
    ],
  });
  assert.equal(result.kind, "RESOLVED");
  assert.equal(result.concept?.id, "legacy-command");
});

test("relation authority is one canonical family per edge semantic", () => {
  assert.equal(RELATION_AUTHORITY_CONTRACT.questionConcepts, "CANONICAL_FOR_QUESTION_CONCEPT_MAPPING");
  assert.equal(RELATION_AUTHORITY_CONTRACT.contentRevisionConcepts, "CANONICAL_FOR_CONTENT_REVISION_CONCEPT_MAPPING");
  assert.equal(RELATION_AUTHORITY_CONTRACT.coreConceptsMetadata, "AUTHORING_HINT_ONLY");
  assert.equal(RELATION_AUTHORITY_CONTRACT.cpaRelations, "NONE");
  assert.equal(RELATION_AUTHORITY_CONTRACT.duplicateWritePolicy, "ONE_CANONICAL_FAMILY_PER_EDGE_SEMANTIC");
});
