import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { createMiniflareD1Fixture } from "./helpers/miniflare-d1-fixture.mjs";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { FactRepository } from "../db/fact-repositories.ts";
import { createFactIdentity } from "../lib/facts/fact-domain.ts";

const actor = "a0000000-0000-4000-8000-000000000001";
const reviewer = "a0000000-0000-4000-8000-000000000002";
const now = "2026-08-21T00:00:00.000Z";
let miniflare;
let database;
let repository;

before(async () => {
  miniflare = createMiniflareD1Fixture({ databaseId: "concept-governance" });
  database = await miniflare.getD1Database("DB");
  const migrations = (await readdir("drizzle"))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name) && Number(name.slice(0, 4)) <= 24)
    .sort();
  for (const name of migrations) await applyMigration(await readFile(`drizzle/${name}`, "utf8"));
  await database.prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?), (?, ?, ?)")
    .bind(actor, "concept-actor@example.invalid", "Concept Actor", reviewer, "concept-reviewer@example.invalid", "Concept Reviewer")
    .run();
  repository = new FactRepository(new D1DatabaseProvider(database));
});

after(async () => {
  await miniflare?.dispose();
});

test("Concept persistence guards and deterministic mappings", async () => {
  const factA = await createFact("fact:concept:a", "track-a");
  const factB = await createFact("fact:concept:b", "track-b");
  const concept = candidate("concept-a", "audit.methodology", "Audit methodology");

  const first = await repository.createGovernedConceptMapping(mapping(concept, factA.id, "track-a"));
  assert.equal(first.outcome, "NEW_SUCCESS");
  assert.equal(await scalar("SELECT count(*) FROM ontology_concepts"), 1);
  const replay = await repository.createGovernedConceptMapping(mapping(concept, factA.id, "track-a"));
  assert.equal(replay.outcome, "EXACT_REPLAY");
  assert.equal(await scalar("SELECT count(*) FROM fact_concept_bindings"), 1);

  const crossTrack = await repository.createGovernedConceptMapping(mapping(concept, factB.id, "track-b"));
  assert.equal(crossTrack.outcome, "MAP_TO_EXISTING");
  assert.equal(await scalar("SELECT count(*) FROM ontology_concepts"), 1);
  assert.equal(await scalar("SELECT count(*) FROM fact_concept_bindings"), 2);

  await assert.rejects(
    repository.createGovernedConceptMapping(mapping(candidate("missing-fact", "audit.missing", "Missing"), "missing-fact", "track-a")),
    hasCode("PARENT_FACT_NOT_FOUND"),
  );
  await assert.rejects(
    repository.createGovernedConceptMapping({ ...mapping(candidate("missing-actor", "audit.actor", "Actor"), factA.id, "track-a"), binding: { ...mapping(candidate("missing-actor", "audit.actor", "Actor"), factA.id, "track-a").binding, createdBy: "missing-actor" } }),
    hasCode("ACTOR_NOT_FOUND"),
  );
  await assert.rejects(
    repository.createGovernedConceptMapping({ ...mapping(candidate("missing-provenance", "audit.provenance", "Provenance"), factA.id, "track-a"), binding: { ...mapping(candidate("missing-provenance", "audit.provenance", "Provenance"), factA.id, "track-a").binding, provenanceJson: null } }),
    hasCode("PROVENANCE_REQUIRED"),
  );
  await assert.rejects(
    repository.createGovernedConceptMapping(mapping(candidate("broad", "audit.broad", "Broad"), factA.id, "track-b")),
    hasCode("QUALIFICATION_LOSS_BLOCKED"),
  );

  const suggestion = await repository.createGovernedConceptMapping(mapping(candidate("ai", "audit.ai", "AI suggestion"), factA.id, "track-a", { mappingBasis: "AI_SUGGESTED", mappingStatus: "SUGGESTED" }));
  assert.equal(suggestion.outcome, "NEW_SUCCESS");
  await assert.rejects(
    repository.createGovernedConceptMapping(mapping(candidate("ai-approved", "audit.ai-approved", "AI approved"), factA.id, "track-a", { mappingBasis: "AI_SUGGESTED", mappingStatus: "APPROVED" })),
    hasCode("REVIEW_REQUIRED"),
  );

  await database.prepare("INSERT INTO ontology_aliases (id, concept_id, alias, normalized_alias) VALUES (?, ?, ?, ?)")
    .bind("alias-collision", concept.id, "Audit procedure", "audit procedure").run();
  await assert.rejects(
    repository.createGovernedConceptMapping(mapping(candidate("collision", "audit.procedure", "Audit procedure"), factA.id, "track-a")),
    hasCode("REVIEW_REQUIRED"),
  );

  await assert.rejects(
    repository.createGovernedConceptMapping({ ...mapping(candidate("conflict", "audit.methodology", "Changed semantics"), factA.id, "track-a"), concept: candidate("conflict", "audit.methodology", "Changed semantics") }),
    hasCode("CONFLICT"),
  );
  const replaced = await repository.replaceWithGovernedVersion(mapping(concept, factA.id, "track-a", { id: "binding-replacement", mappingVersion: 2 }));
  assert.equal(replaced.binding.mappingVersion, 2);
  assert.equal(await scalar("SELECT count(*) FROM fact_concept_bindings WHERE mapping_status = 'SUPERSEDED'"), 1);
  // Dataset-wide P0 replay checks were non-reproducible: their rows came only
  // from the absent audit CSV, with no repository-owned source or generator.
  await assert.rejects(
    repository.createGovernedConceptMapping(mapping(candidate("fixture", "fixture:leaked", "Leaked"), factA.id, "track-a", { provenanceJson: JSON.stringify({ source: "fixture", basis: "test", package_id: "fixture:production" }) })),
    hasCode("FIXTURE_IDENTITY_LEAKAGE"),
  );
});

function candidate(id, conceptKey, label) {
  return { id, conceptKey, label, normalizedLabel: label.toLowerCase(), namespace: "securium", category: "general", description: "" };
}

function mapping(concept, factIdentityId, scope, overrides = {}) {
  return {
    concept,
    binding: {
      id: overrides.id ?? `binding-${concept.id}-${factIdentityId}`,
      factIdentityId,
      createdBy: actor,
      createdAt: now,
      qualificationJson: JSON.stringify({ scope }),
      mappingBasis: overrides.mappingBasis ?? "CANONICAL_PACKAGE",
      provenanceJson: overrides.provenanceJson ?? JSON.stringify({ source: "p0-disposable", basis: "synthetic review" }),
      mappingStatus: overrides.mappingStatus ?? "APPROVED",
      mappingVersion: overrides.mappingVersion,
      reviewedBy: actor,
      reviewedAt: now,
    },
  };
}

async function createFact(canonicalKey, scope) {
  const factId = scope === "track-a"
    ? "b0000000-0000-4000-8000-000000000001"
    : "b0000000-0000-4000-8000-000000000002";
  return repository.createFactIdentity(createFactIdentity({
    id: factId,
    canonicalKey,
    domain: "security",
    canonicalLabel: canonicalKey,
    normalizedSemanticIdentity: canonicalKey,
    scopeDiscriminator: scope,
    createdBy: actor,
    createdAt: now,
  }));
}

async function applyMigration(sql) {
  return applyMigrationTo(database, sql);
}

async function applyMigrationTo(targetDatabase, sql) {
  const statements = sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
  for (let index = 0; index < statements.length; index += 40) {
    await targetDatabase.batch(statements.slice(index, index + 40).map((statement) => targetDatabase.prepare(statement)));
  }
}

async function scalar(sql) {
  const row = await database.prepare(sql).first();
  return Number(row?.["count(*)"] ?? 0);
}

function hasCode(code) {
  return (error) => error?.code === code;
}
