import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { saveGovernedQuestionCandidate } from "../db/question-governance-repository.ts";

const actor = "a0000000-0000-4000-8000-000000000001";
const reviewer = "a0000000-0000-4000-8000-000000000002";
const group = "group-sw";
const course = "course-sw-vuln";
const conceptIds = [
  "concept-sql",
  "concept-xss",
  "concept-auth",
  "concept-error",
  "concept-session",
];
let miniflare;
let database;
let provider;

before(async () => {
  miniflare = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-05-15", d1Databases: { DB: "question-governance" } });
  database = await miniflare.getD1Database("DB");
  const migrations = (await readdir("drizzle")).filter((name) => /^\d{4}_.+\.sql$/.test(name) && Number(name.slice(0, 4)) <= 25).sort();
  for (const name of migrations) await applyMigration(await readFile(`drizzle/${name}`, "utf8"));
  await database.prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?), (?, ?, ?)").bind(actor, "actor@example.invalid", "Actor", reviewer, "reviewer@example.invalid", "Reviewer").run();
  await database.prepare("INSERT INTO course_groups (id, code, name, description) VALUES (?, ?, ?, ?)").bind(group, "SW", "SW", "SW").run();
  await database.prepare("INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(course, group, "SW-VULN", "sw-vulnerability-diagnostician", "SW", "SW", "SW").run();
  for (const [index, id] of conceptIds.entries()) await database.prepare("INSERT INTO ontology_concepts (id, concept_key, namespace, label, normalized_label, category) VALUES (?, ?, 'securium', ?, ?, 'secure-coding')").bind(id, `swsec.test.${index}`, `Concept ${index}`, `concept ${index}`).run();
  provider = new D1DatabaseProvider(database);
});

after(async () => { await miniflare?.dispose(); });

test("governed candidate is NEW_SUCCESS then EXACT_REPLAY with zero delta", async () => {
  const candidate = makeCandidate("swsec-question-replay", "bp.swsec.input.sql-injection", "concept-sql");
  const first = await saveGovernedQuestionCandidate(candidate, actor, provider);
  assert.equal(first.outcome, "NEW_SUCCESS");
  const replay = await saveGovernedQuestionCandidate(candidate, actor, provider);
  assert.equal(replay.outcome, "EXACT_REPLAY");
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM questions"), 1);
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM question_versions"), 1);
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM question_choices"), 2);
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM question_concepts"), 1);
});

test("changed semantics conflict and changed version requires explicit version", async () => {
  const candidate = makeCandidate("swsec-question-conflict", "bp.swsec.web.xss", "concept-xss");
  await saveGovernedQuestionCandidate(candidate, actor, provider);
  await assert.rejects(saveGovernedQuestionCandidate({ ...candidate, content: "Changed content" }, actor, provider), hasCode("QUESTION_SEMANTIC_CONFLICT"));
  await assert.rejects(saveGovernedQuestionCandidate({ ...candidate, version: 2 }, actor, provider), hasCode("QUESTION_NEW_VERSION_REQUIRED"));
});

test("missing actor and missing Concept fail before candidate mutation", async () => {
  const missingActor = makeCandidate("swsec-question-missing-actor", "bp.swsec.auth.authentication", "concept-auth");
  await assert.rejects(saveGovernedQuestionCandidate(missingActor, "missing-actor", provider), hasCode("ACTOR_NOT_FOUND"));
  const missingConcept = makeCandidate("swsec-question-missing-concept", "bp.swsec.error.information-disclosure", "missing-concept");
  await assert.rejects(saveGovernedQuestionCandidate(missingConcept, actor, provider), hasCode("CONCEPT_NOT_FOUND"));
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM questions WHERE id IN ('swsec-question-missing-actor', 'swsec-question-missing-concept')"), 0);
});

test("mid-candidate Concept duplicate rolls back all rows", async () => {
  const candidate = makeCandidate("swsec-question-rollback", "bp.swsec.session.control", "concept-session");
  const duplicate = { ...candidate, conceptMappings: [...candidate.conceptMappings, ...candidate.conceptMappings] };
  await assert.rejects(saveGovernedQuestionCandidate(duplicate, actor, provider));
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM questions WHERE id = 'swsec-question-rollback'"), 0);
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM question_versions WHERE question_id = 'swsec-question-rollback'"), 0);
});

test("five-candidate mechanical package creates five then replays five", async () => {
  const definitions = [
    ["swsec-original-pilot-sql-injection-001", "bp.swsec.input.sql-injection", "concept-sql"],
    ["swsec-original-pilot-xss-001", "bp.swsec.web.xss", "concept-xss"],
    ["swsec-original-pilot-authentication-001", "bp.swsec.auth.authentication", "concept-auth"],
    ["swsec-original-pilot-error-disclosure-001", "bp.swsec.error.information-disclosure", "concept-error"],
    ["swsec-original-pilot-session-control-001", "bp.swsec.session.control", "concept-session"],
  ];
  for (const [id, blueprint, concept] of definitions) assert.equal((await saveGovernedQuestionCandidate(makeCandidate(id, blueprint, concept), actor, provider)).outcome, "NEW_SUCCESS");
  for (const [id, blueprint, concept] of definitions) assert.equal((await saveGovernedQuestionCandidate(makeCandidate(id, blueprint, concept), actor, provider)).outcome, "EXACT_REPLAY");
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM questions WHERE id LIKE 'swsec-original-pilot-%'"), 5);
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM question_versions WHERE question_id LIKE 'swsec-original-pilot-%'"), 5);
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM question_concepts qc INNER JOIN question_versions qv ON qv.id = qc.question_version_id WHERE qv.question_id LIKE 'swsec-original-pilot-%'"), 5);
});

function makeCandidate(id, blueprintId, conceptId) {
  return {
    id, version: 1, title: "Governed SW question", content: `Independent diagnostic prompt ${id}`,
    type: "SINGLE_CHOICE", difficulty: "EASY", explanation: "The official control is required.", wrongAnswerExplanation: "The alternatives do not satisfy the control.", answerConfigJson: "{}", source: "OFFICIAL_SOURCE_PROPOSITION", sourceDate: "2026-08-21",
    choices: [{ content: "Correct control", displayOrder: 1, isCorrect: true, explanation: "" }, { content: "Insufficient control", displayOrder: 2, isCorrect: false, explanation: "" }], courseIds: [course], conceptMappings: [{ conceptId, qualificationJson: JSON.stringify({ track: "SW보안약점진단원" }), provenanceJson: JSON.stringify({ source: "OFFICIAL_SOURCE_PROPOSITION" }), mappingStatus: "SUGGESTED" }],
    governance: { blueprintId, qualificationJson: JSON.stringify({ track: "SW보안약점진단원" }), provenanceJson: JSON.stringify({ propositionIds: ["prop.test"] }), governanceJson: JSON.stringify({ authoringOrigin: "ORIGINAL_AI_ASSISTED_AUTHORING", rightsStatus: "PASS", similarityStatus: "PASS_LOW_SIMILARITY" }) },
  };
}

async function applyMigration(sql) { const statements = sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean); for (let index = 0; index < statements.length; index += 40) await database.batch(statements.slice(index, index + 40).map((statement) => database.prepare(statement))); }
async function scalar(sql) { const row = await database.prepare(sql).first(); return Number(row?.count ?? 0); }
function hasCode(code) { return (error) => error?.code === code; }
