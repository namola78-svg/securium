import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import { createDatabaseSkillGraphRepository } from "../db/skill-graph-query-repository.ts";
import { createSkillGraphQueryService } from "../lib/services/skill-graph-query.ts";
import { DrizzleD1CompatibilityDatabase } from "../db/provider/drizzle-d1-compatibility.ts";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";

const exec = promisify(execFile);
const container = `securium-skill-graph-parity-${process.pid}-${Date.now()}`;

let miniflare;
let d1Database;
let postgresClient;

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "skill-graph-query-parity" },
  });
  d1Database = await miniflare.getD1Database("DB");
  await applyD1Fixture(d1Database);
});

after(async () => {
  await postgresClient?.end({ timeout: 5 }).catch(() => {});
  await exec("docker", ["rm", "--force", container]).catch(() => {});
  await miniflare?.dispose();
});

test("D1 and disposable PostgreSQL return identical normalized graph DTOs", async () => {
  const d1Result = await queryWithD1();
  const postgresResult = await queryWithPostgres();
  assert.deepEqual(postgresResult, d1Result);
  assert.equal(postgresResult.schemaVersion, "skill-graph.v1");
  assert.deepEqual(
    ["ROLE", "SKILL", "CONCEPT"].map((type) => postgresResult.nodes.filter((node) => node.type === type).length),
    [1, 102, 102],
  );
  assert.deepEqual(
    ["ROLE_REQUIRES_SKILL", "SKILL_REQUIRES_CONCEPT"].map((type) => postgresResult.edges.filter((edge) => edge.type === type).length),
    [102, 102],
  );
});

test("injected provider databases are used for root resolution", async () => {
  const db = drizzle(d1Database, { schema });
  const repository = createDatabaseSkillGraphRepository({ db });
  const service = createSkillGraphQueryService(repository);
  const roleResult = await service.getRoleSkills({ id: "role-1" }, { limit: 1 });
  const skillResult = await service.getSkillConcepts({ id: "skill-1" });
  const conceptResult = await service.getConceptSkills({ id: "concept-1" });
  assert.deepEqual(roleResult.root, { type: "ROLE", id: "role-1" });
  assert.equal(roleResult.nodes[1]?.id, "fanout-skill-001");
  assert.deepEqual(skillResult.root, { type: "SKILL", id: "skill-1" });
  assert.deepEqual(conceptResult.root, { type: "CONCEPT", id: "concept-1" });
});

test("exact alias candidate hard max fails closed on the injected D1 authority", async () => {
  const db = drizzle(d1Database, { schema });
  const service = createSkillGraphQueryService(createDatabaseSkillGraphRepository({ db }));
  await assert.rejects(
    service.getConceptSkills({ alias: "overflow alias" }),
    (error) => error?.code === "AMBIGUOUS_ALIAS",
  );
});

async function queryWithD1() {
  const db = drizzle(d1Database, { schema });
  const repository = createDatabaseSkillGraphRepository({ db });
  return createSkillGraphQueryService(repository).getRoleGraph({ id: "role-1" });
}

async function queryWithPostgres() {
  const port = await startPostgres();
  postgresClient = postgres(`postgres://postgres:skill-graph-parity@127.0.0.1:${port}/postgres`, {
    max: 1,
    prepare: false,
    ssl: false,
    onnotice: false,
  });
  await postgresClient.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;");
  const baseline = JSON.parse(await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.json", "utf8"));
  await postgresClient.unsafe(`SET securium.baseline_artifact_sha256 = '${baseline.artifactDigest}'`);
  await postgresClient.unsafe(`SET securium.baseline_schema_sha256 = '${baseline.schemaDigest}'`);
  await postgresClient.unsafe(`SET securium.baseline_security_sha256 = '${baseline.securityDigest}'`);
  await postgresClient.unsafe(await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.sql", "utf8"));
  await postgresClient.unsafe(await readFile("db/postgres/migrations/0048_typed_relations_wave_b_current_main.sql", "utf8"));
  await insertPostgresFixture(postgresClient);

  const provider = new PostgresDatabaseProvider({
    query: async (sql, parameters) => {
      const rows = await postgresClient.unsafe(sql, parameters);
      return { rows, rowCount: rows.length };
    },
    queryRaw: async (sql, parameters) => {
      const result = await postgresClient.unsafe(sql, parameters).values();
      const columns = result.columns?.map((column) => column.name) ?? [];
      return { rows: Array.from(result, (row) => Array.from(row)), columns, rowCount: result.length };
    },
    transaction: async (callback) => postgresClient.begin(async (transaction) => callback({
      query: async (sql, parameters) => {
        const rows = await transaction.unsafe(sql, parameters);
        return { rows, rowCount: rows.length };
      },
    })),
    close: () => postgresClient.end({ timeout: 5 }),
  });
  const db = drizzle(new DrizzleD1CompatibilityDatabase(async () => provider), { schema });
  const repository = createDatabaseSkillGraphRepository({ db });
  return createSkillGraphQueryService(repository).getRoleGraph({ id: "role-1" });
}

async function applyD1Fixture(database) {
  await executeD1(database, "PRAGMA foreign_keys = ON");
  await executeD1(database, "CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL)");
  await executeD1(database, "CREATE TABLE ontology_concepts (id TEXT PRIMARY KEY NOT NULL, concept_key TEXT NOT NULL, label TEXT NOT NULL, normalized_label TEXT NOT NULL, source_type TEXT, status TEXT NOT NULL)");
  const migration = (await readFile("drizzle/0041_typed_relations_wave_b_current_main.sql", "utf8"))
    .split(/--> statement-breakpoint\s*/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of migration) await executeD1(database, statement);
  await executeD1(database, "CREATE TABLE concepts (id TEXT PRIMARY KEY NOT NULL, stable_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT', created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)");
  await executeD1(database, "CREATE TABLE concept_labels (id TEXT PRIMARY KEY NOT NULL, concept_id TEXT NOT NULL, language TEXT NOT NULL, label TEXT NOT NULL, normalized_label TEXT NOT NULL, label_type TEXT NOT NULL DEFAULT 'PREF', status TEXT NOT NULL DEFAULT 'DRAFT', created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)");
  await executeD1(database, "CREATE TABLE ontology_aliases (id TEXT PRIMARY KEY NOT NULL, concept_id TEXT NOT NULL, alias TEXT NOT NULL, normalized_alias TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'und', source TEXT NOT NULL DEFAULT 'fixture')");
  await executeD1(database, "INSERT INTO users (id) VALUES ('reviewer-1')");
  await executeD1(database, "INSERT INTO occupational_roles (id, role_key, label, status, reviewed_by, reviewed_at, review_evidence_json) VALUES ('role-1', 'role:security:engineer', 'Security Engineer', 'ACTIVE', 'reviewer-1', '2026-09-10', '[{\"fixture\":true}]')");
  await executeD1(database, "INSERT INTO skills (id, skill_key, label, status, source_type, provenance_json, reviewed_by, reviewed_at, review_evidence_json) VALUES ('skill-1', 'skill:security:secure-code-review', 'Secure Code Review', 'ACTIVE', 'FIXTURE', '{\"fixture\":true}', 'reviewer-1', '2026-09-10', '[{\"fixture\":true}]')");
  await executeD1(database, "INSERT INTO ontology_concepts (id, concept_key, label, normalized_label, source_type, status) VALUES ('concept-1', 'concept:security:secure-coding', 'Secure Coding', 'secure coding', 'FIXTURE', 'ACTIVE')");
  await executeD1(database, "INSERT INTO occupational_role_aliases (id, role_id, alias, normalized_alias) VALUES ('role-alias-1', 'role-1', 'security engineer', 'security engineer')");
  await executeD1(database, "INSERT INTO skill_aliases (id, skill_id, alias, normalized_alias) VALUES ('skill-alias-1', 'skill-1', 'secure code review', 'secure code review')");
  await executeD1(database, "INSERT INTO ontology_aliases (id, concept_id, alias, normalized_alias) VALUES ('concept-alias-1', 'concept-1', 'secure coding', 'secure coding')");
  await executeD1(database, "INSERT INTO role_skill_relations (id, role_id, skill_id, status, source_type, provenance_json, reviewed_by, reviewed_at, review_evidence_json) VALUES ('role-skill-1', 'role-1', 'skill-1', 'ACTIVE', 'FIXTURE', '{\"fixture\":true}', 'reviewer-1', '2026-09-10', '[{\"fixture\":true}]')");
  await executeD1(database, "INSERT INTO skill_concept_relations (id, skill_id, concept_id, status, source_type, provenance_json, reviewed_by, reviewed_at, review_evidence_json) VALUES ('skill-concept-1', 'skill-1', 'concept-1', 'ACTIVE', 'FIXTURE', '{\"fixture\":true}', 'reviewer-1', '2026-09-10', '[{\"fixture\":true}]')");
  for (let index = 1; index <= 101; index += 1) {
    const suffix = String(index).padStart(3, "0");
    await executeD1(database, `INSERT INTO skills (id, skill_key, label, status, source_type, provenance_json, reviewed_by, reviewed_at, review_evidence_json) VALUES ('fanout-skill-${suffix}', 'skill:security:fanout-${suffix}', 'Fanout Skill ${suffix}', 'ACTIVE', 'FIXTURE', '{"fixture":true}', 'reviewer-1', '2026-09-10', '[{"fixture":true}]')`);
    await executeD1(database, `INSERT INTO ontology_concepts (id, concept_key, label, normalized_label, source_type, status) VALUES ('fanout-concept-${suffix}', 'concept:security:fanout-${suffix}', 'Fanout Concept ${suffix}', 'fanout concept ${suffix}', 'FIXTURE', 'ACTIVE')`);
    await executeD1(database, `INSERT INTO role_skill_relations (id, role_id, skill_id, status, source_type, provenance_json, reviewed_by, reviewed_at, review_evidence_json) VALUES ('fanout-role-skill-${suffix}', 'role-1', 'fanout-skill-${suffix}', 'ACTIVE', 'FIXTURE', '{"fixture":true}', 'reviewer-1', '2026-09-10', '[{"fixture":true}]')`);
    await executeD1(database, `INSERT INTO skill_concept_relations (id, skill_id, concept_id, status, source_type, provenance_json, reviewed_by, reviewed_at, review_evidence_json) VALUES ('fanout-skill-concept-${suffix}', 'fanout-skill-${suffix}', 'fanout-concept-${suffix}', 'ACTIVE', 'FIXTURE', '{"fixture":true}', 'reviewer-1', '2026-09-10', '[{"fixture":true}]')`);
  }
  for (let index = 1; index <= 21; index += 1) {
    const suffix = String(index).padStart(2, "0");
    await executeD1(database, `INSERT INTO ontology_concepts (id, concept_key, label, normalized_label, source_type, status) VALUES ('overflow-concept-${suffix}', 'concept:security:overflow-${suffix}', 'Overflow Concept ${suffix}', 'overflow concept ${suffix}', 'FIXTURE', 'ACTIVE')`);
    await executeD1(database, `INSERT INTO ontology_aliases (id, concept_id, alias, normalized_alias) VALUES ('overflow-alias-${suffix}', 'overflow-concept-${suffix}', 'overflow alias', 'overflow alias')`);
  }
}

async function insertPostgresFixture(client) {
  await client`INSERT INTO public."users" ("id", "email", "display_name") VALUES ('reviewer-1', 'reviewer-1@example.invalid', 'Fixture Reviewer') ON CONFLICT DO NOTHING`;
  await client`INSERT INTO public."occupational_roles" ("id", "role_key", "label", "status", "reviewed_by", "reviewed_at", "review_evidence_json") VALUES ('role-1', 'role:security:engineer', 'Security Engineer', 'ACTIVE', 'reviewer-1', '2026-09-10', '[{"fixture":true}]')`;
  await client`INSERT INTO public."skills" ("id", "skill_key", "label", "status", "source_type", "provenance_json", "reviewed_by", "reviewed_at", "review_evidence_json") VALUES ('skill-1', 'skill:security:secure-code-review', 'Secure Code Review', 'ACTIVE', 'FIXTURE', '{"fixture":true}', 'reviewer-1', '2026-09-10', '[{"fixture":true}]')`;
  await client`INSERT INTO public."ontology_concepts" ("id", "concept_key", "label", "normalized_label", "source_type", "status") VALUES ('concept-1', 'concept:security:secure-coding', 'Secure Coding', 'secure coding', 'FIXTURE', 'ACTIVE')`;
  await client`INSERT INTO public."occupational_role_aliases" ("id", "role_id", "alias", "normalized_alias") VALUES ('role-alias-1', 'role-1', 'security engineer', 'security engineer')`;
  await client`INSERT INTO public."skill_aliases" ("id", "skill_id", "alias", "normalized_alias") VALUES ('skill-alias-1', 'skill-1', 'secure code review', 'secure code review')`;
  await client`INSERT INTO public."ontology_aliases" ("id", "concept_id", "alias", "normalized_alias") VALUES ('concept-alias-1', 'concept-1', 'secure coding', 'secure coding')`;
  await client`INSERT INTO public."role_skill_relations" ("id", "role_id", "skill_id", "status", "source_type", "provenance_json", "reviewed_by", "reviewed_at", "review_evidence_json") VALUES ('role-skill-1', 'role-1', 'skill-1', 'ACTIVE', 'FIXTURE', '{"fixture":true}', 'reviewer-1', '2026-09-10', '[{"fixture":true}]')`;
  await client`INSERT INTO public."skill_concept_relations" ("id", "skill_id", "concept_id", "status", "source_type", "provenance_json", "reviewed_by", "reviewed_at", "review_evidence_json") VALUES ('skill-concept-1', 'skill-1', 'concept-1', 'ACTIVE', 'FIXTURE', '{"fixture":true}', 'reviewer-1', '2026-09-10', '[{"fixture":true}]')`;
  for (let index = 1; index <= 101; index += 1) {
    const suffix = String(index).padStart(3, "0");
    await client`INSERT INTO public."skills" ("id", "skill_key", "label", "status", "source_type", "provenance_json", "reviewed_by", "reviewed_at", "review_evidence_json") VALUES (${`fanout-skill-${suffix}`}, ${`skill:security:fanout-${suffix}`}, ${`Fanout Skill ${suffix}`}, 'ACTIVE', 'FIXTURE', '{"fixture":true}', 'reviewer-1', '2026-09-10', '[{"fixture":true}]')`;
    await client`INSERT INTO public."ontology_concepts" ("id", "concept_key", "label", "normalized_label", "source_type", "status") VALUES (${`fanout-concept-${suffix}`}, ${`concept:security:fanout-${suffix}`}, ${`Fanout Concept ${suffix}`}, ${`fanout concept ${suffix}`}, 'FIXTURE', 'ACTIVE')`;
    await client`INSERT INTO public."role_skill_relations" ("id", "role_id", "skill_id", "status", "source_type", "provenance_json", "reviewed_by", "reviewed_at", "review_evidence_json") VALUES (${`fanout-role-skill-${suffix}`}, 'role-1', ${`fanout-skill-${suffix}`}, 'ACTIVE', 'FIXTURE', '{"fixture":true}', 'reviewer-1', '2026-09-10', '[{"fixture":true}]')`;
    await client`INSERT INTO public."skill_concept_relations" ("id", "skill_id", "concept_id", "status", "source_type", "provenance_json", "reviewed_by", "reviewed_at", "review_evidence_json") VALUES (${`fanout-skill-concept-${suffix}`}, ${`fanout-skill-${suffix}`}, ${`fanout-concept-${suffix}`}, 'ACTIVE', 'FIXTURE', '{"fixture":true}', 'reviewer-1', '2026-09-10', '[{"fixture":true}]')`;
  }
  for (let index = 1; index <= 21; index += 1) {
    const suffix = String(index).padStart(2, "0");
    await client`INSERT INTO public."ontology_concepts" ("id", "concept_key", "label", "normalized_label", "source_type", "status") VALUES (${`overflow-concept-${suffix}`}, ${`concept:security:overflow-${suffix}`}, ${`Overflow Concept ${suffix}`}, ${`overflow concept ${suffix}`}, 'FIXTURE', 'ACTIVE')`;
    await client`INSERT INTO public."ontology_aliases" ("id", "concept_id", "alias", "normalized_alias") VALUES (${`overflow-alias-${suffix}`}, ${`overflow-concept-${suffix}`}, 'overflow alias', 'overflow alias')`;
  }
}

async function executeD1(database, sql) {
  await database.prepare(sql).run();
}

async function startPostgres() {
  await exec("docker", ["run", "--detach", "--rm", "--name", container, "--env", "POSTGRES_PASSWORD=skill-graph-parity", "--publish", "127.0.0.1::5432", "postgres:17.6"]);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const port = (await exec("docker", ["port", container, "5432/tcp"])).stdout.trim().match(/:(\d+)$/)?.[1];
      if (port) {
        const client = postgres(`postgres://postgres:skill-graph-parity@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
        await client`SELECT 1`;
        await client.end({ timeout: 5 });
        return port;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}
