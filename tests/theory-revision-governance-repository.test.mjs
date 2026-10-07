import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { createMiniflareD1Fixture } from "./helpers/miniflare-d1-fixture.mjs";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { saveGovernedTheoryRevision } from "../db/content-revision-governance-repositories.ts";
import { computeTheoryRevisionSemanticHash, stableJson } from "../lib/services/content-revision-service.ts";

const actor = "a0000000-0000-4000-8000-000000000101";
const reviewer = "a0000000-0000-4000-8000-000000000102";
const contentId = "content-swsec-governance-test";
let miniflare;
let database;
let provider;

before(async () => {
  miniflare = createMiniflareD1Fixture({ databaseId: "theory-governance" });
  database = await miniflare.getD1Database("DB");
  const migrations = (await readdir("drizzle")).filter((name) => /^\d{4}_.+\.sql$/.test(name) && Number(name.slice(0, 4)) <= 25).sort();
  for (const name of migrations) await applyMigration(await readFile(`drizzle/${name}`, "utf8"));
  await applyMigration(await readFile("drizzle/0028_theory_revision_governance.sql", "utf8"));
  await database.prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?), (?, ?, ?)").bind(actor, "actor@example.invalid", "Actor", reviewer, "reviewer@example.invalid", "Reviewer").run();
  for (const suffix of ["primary", "missing-actor", "rollback", "concurrent", "missing-concept"]) {
    await database.prepare("INSERT INTO contents (id, slug, canonical_key, title, body) VALUES (?, ?, ?, ?, ?)").bind(`${contentId}-${suffix}`, `swsec-governance-test-${suffix}`, `theory.swsec.governance-${suffix}`, "Governed Theory", "Existing identity").run();
  }
  await database.prepare("INSERT INTO ontology_concepts (id, concept_key, namespace, label, normalized_label, category) VALUES (?, ?, 'securium', ?, ?, 'secure-coding')").bind("concept-swsec-test", "swsec.governance.test", "Governance test", "governance test").run();
  provider = new D1DatabaseProvider(database);
});

after(async () => { await miniflare?.dispose(); });

test("caller review claims are denied before any database access, including retry or changed semantics", async () => {
  const candidate = makeCandidate();
  const before = await canonicalState();
  let databaseCalls = 0;
  const inaccessibleDatabase = new Proxy(provider, { get() { databaseCalls += 1; throw new Error("Review rejection must precede database access"); } });
  for (const input of [candidate, candidate, { ...candidate, body: "changed" }, { ...candidate, version: "2.0.0" }]) {
    await assert.rejects(saveGovernedTheoryRevision(input, actor, inaccessibleDatabase), hasCode("THEORY_SERVER_REVIEW_AUTHORITY_REQUIRED"));
  }
  assert.equal(databaseCalls, 0);
  assert.deepEqual(await canonicalState(), before);
});

test("APPROVED mapping claims, duplicate mappings, and missing parents leave no partial rows", async () => {
  const before = await canonicalState();
  const approved = makeCandidate();
  approved.conceptMappings = [{ ...approved.conceptMappings[0], mappingStatus: "APPROVED", reviewedBy: actor, reviewedAt: approved.governance.humanReviewedAt }];
  approved.governance.humanReviewedBy = actor;
  await assert.rejects(saveGovernedTheoryRevision(approved, actor, provider), hasCode("THEORY_SERVER_REVIEW_AUTHORITY_REQUIRED"));
  await assert.rejects(saveGovernedTheoryRevision(makeCandidate("missing-actor"), "missing-actor", provider), hasCode("THEORY_SERVER_REVIEW_AUTHORITY_REQUIRED"));
  const duplicate = makeCandidate("rollback");
  duplicate.conceptMappings = [duplicate.conceptMappings[0], duplicate.conceptMappings[0]];
  await assert.rejects(saveGovernedTheoryRevision(duplicate, actor, provider), hasCode("THEORY_SERVER_REVIEW_AUTHORITY_REQUIRED"));
  const missingConcept = makeCandidate("missing-concept");
  missingConcept.conceptMappings = [{ ...missingConcept.conceptMappings[0], conceptId: "missing-concept" }];
  await assert.rejects(saveGovernedTheoryRevision(missingConcept, actor, provider), hasCode("THEORY_SERVER_REVIEW_AUTHORITY_REQUIRED"));
  assert.deepEqual(await canonicalState(), before);
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM content_revisions"), 0);
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM content_revision_concepts"), 0);
});

test("concurrent unverified claims are all denied with zero canonical delta", async () => {
  const candidate = makeCandidate("concurrent");
  const before = await canonicalState();
  const results = await Promise.allSettled([saveGovernedTheoryRevision(candidate, actor, provider), saveGovernedTheoryRevision(candidate, actor, provider)]);
  assert.ok(results.every((result) => result.status === "rejected" && result.reason.code === "THEORY_SERVER_REVIEW_AUTHORITY_REQUIRED"));
  assert.deepEqual(await canonicalState(), before);
});

test("a preexisting legacy review claim cannot be blessed by EXACT_REPLAY", async () => {
  const candidate = makeCandidate();
  const { contentId, ...projection } = candidate;
  const semanticHash = await computeTheoryRevisionSemanticHash(projection);
  const snapshot = stableJson({ title: candidate.title, body: candidate.body, bodyFormat: candidate.bodyFormat, learningObjectives: candidate.learningObjectives, examples: candidate.examples, selfChecks: candidate.selfChecks, governance: candidate.governance });
  await database.prepare("INSERT INTO content_revisions (id, content_type, content_id, title, content_date, version, revision_status, snapshot_json, reviewed_at, reviewed_by, created_by, semantic_hash, human_review_hash) VALUES ('synthetic-existing-review', 'LEARNING_UNIT', ?, ?, '2026-10-01', ?, 'review', ?, ?, ?, ?, ?, ?)")
    .bind(contentId, candidate.title, candidate.version, snapshot, candidate.governance.humanReviewedAt, reviewer, actor, semanticHash, candidate.governance.humanReviewHash).run();
  const mapping = candidate.conceptMappings[0];
  await database.prepare("INSERT INTO content_revision_concepts (id, revision_id, concept_id, created_by, qualification_json, provenance_json, mapping_status) VALUES ('synthetic-existing-mapping', 'synthetic-existing-review', ?, ?, ?, ?, 'SUGGESTED')")
    .bind(mapping.conceptId, actor, mapping.qualificationJson, mapping.provenanceJson).run();
  const before = await canonicalState();
  await assert.rejects(saveGovernedTheoryRevision(candidate, actor, provider), hasCode("THEORY_SERVER_REVIEW_AUTHORITY_REQUIRED"));
  assert.deepEqual(await canonicalState(), before);
});

function makeCandidate(suffix = "primary") {
  return {
    canonicalKey: `theory.swsec.governance-${suffix}`,
    contentId: `${contentId}-${suffix}`,
    version: "1.0.0",
    title: "Governed Theory",
    body: `독립적으로 작성된 본문 ${suffix}`,
    bodyFormat: "MARKDOWN",
    learningObjectives: ["경계를 설명한다."],
    examples: [{ safe: true, suffix }],
    selfChecks: ["어떤 경계를 검토해야 하는가?"],
    conceptMappings: [{ conceptId: "concept-swsec-test", conceptKey: "ontology:swsec:test", qualificationJson: JSON.stringify({ scope: "test" }), provenanceJson: JSON.stringify({ source: "official" }), mappingStatus: "SUGGESTED" }],
    governance: { blueprintId: "bp.swsec.test", humanReviewHash: "b".repeat(64), humanReviewedBy: reviewer, humanReviewedAt: "2026-08-21T00:00:00.000Z", rightsStatus: "PASS_ORIGINAL", authoringOrigin: "SECURIUM_ORIGINAL", copyrightStatus: "PASS_ORIGINAL", restrictedPdfGenerationInput: false, qualificationJson: JSON.stringify({ scope: "test" }), provenanceJson: JSON.stringify({ propositionIds: ["prop.test"] }), lifecycle: "CANONICAL_UNPUBLISHED" },
  };
}

async function applyMigration(sql) { const statements = sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean); for (const statement of statements) await database.prepare(statement).run(); }
async function scalar(sql, parameters = []) { const row = await database.prepare(sql).bind(...parameters).first(); return Number(row?.count ?? 0); }
async function canonicalState() {
  const rows = await Promise.all(["contents", "content_revisions", "content_revision_concepts"].map((table) => database.prepare(`SELECT * FROM ${table} ORDER BY id`).all()));
  return rows.map((result) => result.results);
}
function hasCode(code) { return (error) => error?.code === code; }
