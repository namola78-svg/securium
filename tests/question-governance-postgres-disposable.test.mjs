import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { saveGovernedQuestionCandidate } from "../db/question-governance-repository.ts";

const execFile = promisify(execFileCallback);
const actor = "b0000000-0000-4000-8000-000000000001";
const group = "pg-group-sw";
const course = "pg-course-sw";
const concept = "pg-concept-sw";
let container;
let client;

after(async () => {
  await client?.end({ timeout: 5 }).catch(() => {});
  if (container) await execFile("docker", ["rm", "--force", container]).catch(() => {});
});

test("disposable PostgreSQL 17 proves governed NEW_SUCCESS and EXACT_REPLAY", async () => {
  container = `securium-question-governance-${randomUUID()}`;
  const password = "question-governance-test-password";
  await execFile("docker", ["run", "--detach", "--rm", "--name", container, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
  const { stdout } = await execFile("docker", ["port", container, "5432/tcp"]);
  const port = stdout.trim().match(/:(\d+)$/)?.[1];
  assert.ok(port);
  const postgres = (await import("postgres")).default;
  client = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
  await waitForConnection();
  await client.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;");
  // Existing 0002 references later tables and 0009 validates seed taxonomy
  // data. The disposable question schema proof excludes those pre-existing
  // environment-dependent files; migration syntax/guards remain validated
  // separately.
  const migrations = (await readdir("db/postgres/migrations")).filter((name) => /^\d{4}_.+\.sql$/.test(name) && !["0002_server_only_rls_lockdown.sql", "0009_security_certification_taxonomy_cleanup.sql"].includes(name)).sort();
  for (const name of migrations) await client.unsafe(await readFile(`db/postgres/migrations/${name}`, "utf8"));
  await client.unsafe("INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3)", [actor, "pg-actor@example.invalid", "PG Actor"]);
  await client.unsafe("INSERT INTO course_groups (id, code, name, description) VALUES ($1, $2, $3, $4)", [group, "PG-SW", "PG SW", "PG SW"]);
  await client.unsafe("INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description) VALUES ($1, $2, $3, $4, $5, $6, $7)", [course, group, "PG-SW", "pg-sw", "PG SW", "PG SW", "PG SW"]);
  await client.unsafe("INSERT INTO ontology_concepts (id, concept_key, namespace, label, normalized_label, category) VALUES ($1, $2, 'securium', $3, $4, 'secure-coding')", [concept, "pg.swsec.test", "PG SW", "pg sw"]);
  const provider = makeProvider();
  const candidate = { id: "pg-swsec-question-001", version: 1, title: "PG governed question", content: "Which control applies?", type: "SINGLE_CHOICE", difficulty: "EASY", explanation: "The control is required.", wrongAnswerExplanation: "The alternative is insufficient.", answerConfigJson: "{}", source: "OFFICIAL_SOURCE_PROPOSITION", sourceDate: "2026-08-21", choices: [{ content: "Required control", displayOrder: 1, isCorrect: true, explanation: "" }, { content: "Insufficient control", displayOrder: 2, isCorrect: false, explanation: "" }], courseIds: [course], conceptMappings: [{ conceptId: concept, mappingStatus: "SUGGESTED", qualificationJson: JSON.stringify({ track: "SW" }), provenanceJson: JSON.stringify({ source: "OFFICIAL" }) }], governance: { blueprintId: "bp.pg.test", qualificationJson: JSON.stringify({ track: "SW" }), provenanceJson: JSON.stringify({ propositionIds: ["prop.pg.test"] }), governanceJson: JSON.stringify({ authoringOrigin: "ORIGINAL_AI_ASSISTED_AUTHORING", rightsStatus: "PASS", similarityStatus: "PASS_LOW_SIMILARITY" }) } };
  assert.equal((await saveGovernedQuestionCandidate(candidate, actor, provider)).outcome, "NEW_SUCCESS");
  assert.equal((await saveGovernedQuestionCandidate(candidate, actor, provider)).outcome, "EXACT_REPLAY");
  const counts = await client.unsafe("SELECT (SELECT count(*) FROM questions WHERE id = $1) AS questions, (SELECT count(*) FROM question_versions WHERE question_id = $1) AS versions, (SELECT count(*) FROM question_concepts qc JOIN question_versions qv ON qv.id = qc.question_version_id WHERE qv.question_id = $1) AS concepts", [candidate.id]);
  assert.equal(Number(counts[0].questions), 1);
  assert.equal(Number(counts[0].versions), 1);
  assert.equal(Number(counts[0].concepts), 1);

  const failureStages = [
    ["F2", 1], ["F3", 2], ["F4", 3], ["F5", 4], ["F6", 5], ["F7", 6], ["F8", 8],
  ];
  for (const [stage, failAt] of failureStages) {
    const failureCandidate = { ...candidate, id: `pg-failure-${stage}` };
    await assert.rejects(saveGovernedQuestionCandidate(failureCandidate, actor, makeProvider(failAt)));
    const rows = await client.unsafe("SELECT (SELECT count(*) FROM questions WHERE id = $1) AS questions, (SELECT count(*) FROM question_versions WHERE question_id = $1) AS versions, (SELECT count(*) FROM question_choices WHERE question_id = $1) AS choices, (SELECT count(*) FROM question_concepts qc JOIN question_versions qv ON qv.id = qc.question_version_id WHERE qv.question_id = $1) AS concepts", [failureCandidate.id]);
    assert.deepEqual(Object.values(rows[0]).map(Number), [0, 0, 0, 0], `${stage} left partial rows`);
  }
});

function makeProvider(failAt = null) {
  return new PostgresDatabaseProvider({
    query: async (query, parameters) => { const rows = await client.unsafe(query, parameters); return { rows, rowCount: rows.count ?? rows.length }; },
    transaction: async (callback) => client.begin(async (tx) => {
      let count = 0;
      const result = await callback({ query: async (query, parameters) => { count += 1; if (failAt === count) throw new Error(`failure injection ${failAt}`); const rows = await tx.unsafe(query, parameters); return { rows, rowCount: rows.count ?? rows.length }; } });
      if (failAt === 8) throw new Error("failure injection before commit");
      return result;
    }),
  });
}

async function waitForConnection() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { await client`SELECT 1`; return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}
