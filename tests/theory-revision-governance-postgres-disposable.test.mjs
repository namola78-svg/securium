import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { saveGovernedTheoryRevision } from "../db/content-revision-governance-repositories.ts";

const execFile = promisify(execFileCallback);
const actor = "c0000000-0000-4000-8000-000000000101";
const reviewer = "c0000000-0000-4000-8000-000000000102";
let container;
let client;

after(async () => {
  await client?.end({ timeout: 5 }).catch(() => {});
  if (container) await execFile("docker", ["rm", "--force", container]).catch(() => {});
});

test("disposable PostgreSQL proves Theory NEW_SUCCESS, EXACT_REPLAY, and conflict", async () => {
  container = `securium-theory-governance-${randomUUID()}`;
  const password = "theory-governance-test-password";
  await execFile("docker", ["run", "--detach", "--rm", "--name", container, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
  const { stdout } = await execFile("docker", ["port", container, "5432/tcp"]);
  const port = stdout.trim().match(/:(\d+)$/)?.[1];
  assert.ok(port);
  const postgres = (await import("postgres")).default;
  client = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
  await waitForConnection();
  await client.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;");
  const migrations = (await readdir("db/postgres/migrations")).filter((name) => /^\d{4}_.+\.sql$/.test(name) && !["0002_server_only_rls_lockdown.sql", "0009_security_certification_taxonomy_cleanup.sql"].includes(name)).sort();
  for (const name of migrations) await client.unsafe(await readFile(`db/postgres/migrations/${name}`, "utf8"));
  await client.unsafe("INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3), ($4, $5, $6)", [actor, "pg-actor@example.invalid", "Actor", reviewer, "pg-reviewer@example.invalid", "Reviewer"]);
  await client.unsafe("INSERT INTO contents (id, slug, canonical_key, title, body) VALUES ($1, $2, $3, $4, $5)", ["pg-theory-content", "pg-theory-content", "theory.swsec.pg-test", "PG Theory", "Existing identity"]);
  await client.unsafe("INSERT INTO ontology_concepts (id, concept_key, namespace, label, normalized_label, category) VALUES ($1, $2, 'securium', $3, $4, 'secure-coding')", ["pg-theory-concept", "swsec.pg.test", "PG Theory", "pg theory"]);
  const provider = new PostgresDatabaseProvider({
    query: async (sql, parameters) => { const rows = await client.unsafe(sql, parameters); return { rows, rowCount: rows.length }; },
    transaction: async (callback) => client.begin(async (tx) => callback({ query: async (sql, parameters) => { const rows = await tx.unsafe(sql, parameters); return { rows, rowCount: rows.length }; } })),
  });
  const candidate = makeCandidate();
  assert.equal((await saveGovernedTheoryRevision(candidate, actor, provider)).outcome, "NEW_SUCCESS");
  assert.equal((await saveGovernedTheoryRevision(candidate, actor, provider)).outcome, "EXACT_REPLAY");
  await assert.rejects(saveGovernedTheoryRevision({ ...candidate, body: "changed" }, actor, provider), (error) => error?.code === "THEORY_REVISION_CONFLICT");
  const rows = await client.unsafe("SELECT count(*)::int AS revisions, (SELECT count(*)::int FROM content_revision_concepts) AS concepts FROM content_revisions");
  assert.equal(Number(rows[0].revisions), 1);
  assert.equal(Number(rows[0].concepts), 1);
});

function makeCandidate() {
  return {
    canonicalKey: "theory.swsec.pg-test", contentId: "pg-theory-content", version: "1.0.0", title: "PG Theory", body: "독립적으로 작성된 PostgreSQL 증명 본문", bodyFormat: "MARKDOWN", learningObjectives: ["경계를 설명한다."], examples: [{ safe: true }], selfChecks: ["경계를 확인했는가?"], conceptMappings: [{ conceptId: "pg-theory-concept", conceptKey: "ontology:swsec:pg-test", qualificationJson: "{}", provenanceJson: "{}", mappingStatus: "SUGGESTED" }], governance: { blueprintId: "bp.swsec.pg-test", humanReviewHash: "d".repeat(64), humanReviewedBy: reviewer, humanReviewedAt: "2026-08-21T00:00:00.000Z", rightsStatus: "PASS_ORIGINAL", authoringOrigin: "SECURIUM_ORIGINAL", copyrightStatus: "PASS_ORIGINAL", restrictedPdfGenerationInput: false, qualificationJson: "{}", provenanceJson: "{}", lifecycle: "CANONICAL_UNPUBLISHED" },
  };
}

async function waitForConnection() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await client`SELECT 1`; return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}
