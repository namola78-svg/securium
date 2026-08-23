import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { saveGovernedTheoryRevision } from "../db/content-revision-governance-repositories.ts";

const actor = "a0000000-0000-4000-8000-000000000101";
const reviewer = "a0000000-0000-4000-8000-000000000102";
const contentId = "content-swsec-governance-test";
let miniflare;
let database;
let provider;

before(async () => {
  miniflare = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-05-15", d1Databases: { DB: "theory-governance" } });
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

test("NEW_SUCCESS then EXACT_REPLAY, conflict, and new revision contract", async () => {
  const candidate = makeCandidate();
  const first = await saveGovernedTheoryRevision(candidate, actor, provider);
  assert.equal(first.outcome, "NEW_SUCCESS");
  assert.equal((await saveGovernedTheoryRevision(candidate, actor, provider)).outcome, "EXACT_REPLAY");
  await assert.rejects(saveGovernedTheoryRevision({ ...candidate, body: "changed" }, actor, provider), hasCode("THEORY_REVISION_CONFLICT"));
  await assert.rejects(saveGovernedTheoryRevision({ ...candidate, version: "2.0.0" }, actor, provider), hasCode("THEORY_NEW_REVISION_REQUIRED"));
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM content_revisions"), 1);
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM content_revision_concepts"), 1);
});

test("missing actor and duplicate mapping rollback leave no partial rows", async () => {
  const missingActor = makeCandidate("missing-actor");
  await assert.rejects(saveGovernedTheoryRevision(missingActor, "missing-actor", provider), hasCode("ACTOR_NOT_FOUND"));
  const duplicate = makeCandidate("rollback");
  duplicate.conceptMappings = [duplicate.conceptMappings[0], duplicate.conceptMappings[0]];
  await assert.rejects(saveGovernedTheoryRevision(duplicate, actor, provider));
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM content_revisions WHERE content_id = ?", [`${contentId}-primary`]), 1);
  const missingConcept = makeCandidate("missing-concept");
  missingConcept.conceptMappings = [{ ...missingConcept.conceptMappings[0], conceptId: "missing-concept" }];
  await assert.rejects(saveGovernedTheoryRevision(missingConcept, actor, provider), hasCode("CONCEPT_NOT_FOUND"));
});

test("concurrent identical writes converge to one success and one replay", async () => {
  const candidate = makeCandidate("concurrent");
  const results = await Promise.all([saveGovernedTheoryRevision(candidate, actor, provider), saveGovernedTheoryRevision(candidate, actor, provider)]);
  assert.deepEqual(results.map((result) => result.outcome).sort(), ["EXACT_REPLAY", "NEW_SUCCESS"]);
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM content_revisions WHERE content_id = ?", [`${contentId}-concurrent`]), 1);
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
function hasCode(code) { return (error) => error?.code === code; }
