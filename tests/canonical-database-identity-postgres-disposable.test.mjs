import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";
import postgres from "postgres";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { readCanonicalDatabaseIdentity } from "../lib/services/canonical-database-identity.ts";

const exec = promisify(execFile);
const password = "canonical-identity-disposable-password";
const container = `securium-canonical-identity-${Date.now()}`;
const migrations = [
  "0020_concept_persistence_cp_a.sql",
  "0021_cs1a_governance_receipts.sql",
  "0022_cs1a_audit_identity.sql",
  "0023_content_final_review_authority.sql",
  "0024_content_review_judgment_infrastructure.sql",
  "0025_content_reviewer_separation_policy.sql",
  "0026_content_reviewer_separation_enforcement.sql",
  "0028_generic_content_revision_registration_v1.sql",
  "0029_generic_review_currentness_domain.sql",
];

test("canonical identity requires the approved disposable PostgreSQL identity, not matching tables alone", async () => {
  let client;
  try {
    await exec("docker", ["run", "--detach", "--rm", "--name", container, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
    let port;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        port = (await exec("docker", ["port", container, "5432/tcp"])).stdout.trim().match(/:(\d+)$/)?.[1];
        if (port) {
          client = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
          await client`SELECT 1`;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(client, "disposable PostgreSQL must become ready");
    await client.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;");
    const baseline = JSON.parse(await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.json", "utf8"));
    await client.unsafe(`SET securium.baseline_artifact_sha256 = '${baseline.artifactDigest}'`);
    await client.unsafe(`SET securium.baseline_schema_sha256 = '${baseline.schemaDigest}'`);
    await client.unsafe(`SET securium.baseline_security_sha256 = '${baseline.securityDigest}'`);
    await client.unsafe(await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.sql", "utf8"));
    for (const migration of migrations) await client.unsafe(await readFile(`db/postgres/migrations/${migration}`, "utf8"));

    const provider = new PostgresDatabaseProvider({
      query: async (sql, parameters) => { const rows = await client.unsafe(sql, parameters); return { rows, rowCount: rows.length }; },
      transaction: async (callback) => client.begin(async (tx) => callback({ query: async (sql, parameters) => { const rows = await tx.unsafe(sql, parameters); return { rows, rowCount: rows.length }; } })),
      close: () => client.end({ timeout: 5 }),
    });
    const valid = await readCanonicalDatabaseIdentity(provider);
    assert.equal(valid.state, "CANONICAL_VERIFIED");

    await client`DELETE FROM app_schema_migrations WHERE id = '0029_generic_review_currentness_domain'`;
    await client`UPDATE app_schema_baseline_receipts SET artifact_sha256 = 'wrong-database-receipt'`;
    const matchingTablesOnly = await readCanonicalDatabaseIdentity(provider);
    assert.equal(matchingTablesOnly.state, "CANONICAL_NOT_VERIFIED");
  } finally {
    await client?.end({ timeout: 5 }).catch(() => {});
    await exec("docker", ["rm", "--force", container]).catch(() => {});
  }
});
