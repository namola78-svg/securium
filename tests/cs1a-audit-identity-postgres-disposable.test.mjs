import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test, { after } from "node:test";
import postgres from "postgres";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { persistCs1aGovernanceDecision, readCs1aGovernanceDecision } from "../db/cs1a-governance-identity-repository.ts";

const exec = promisify(execFile);
const password = "pia-identity-disposable-password";
const container = `securium-pia-identity-${Date.now()}`;
let admin;
let port;
let started = false;

after(async () => {
  await admin?.end({ timeout: 5 }).catch(() => {});
  if (started) await exec("docker", ["rm", "--force", container]).catch(() => {});
});

test("G1 PostgreSQL identity, transaction, rollback, and global concurrency proof", async () => {
  await exec("docker", ["run", "--detach", "--rm", "--name", container, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
  started = true;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      port = (await exec("docker", ["port", container, "5432/tcp"])).stdout.trim().match(/:(\d+)$/)?.[1];
      if (port) {
        admin = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
        await admin`SELECT 1`;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(admin);
  await admin.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;");
  const baselineDigest = JSON.parse(await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.json", "utf8"));
  await admin.unsafe(`SET securium.baseline_artifact_sha256 = '${baselineDigest.artifactDigest}'`);
  await admin.unsafe(`SET securium.baseline_schema_sha256 = '${baselineDigest.schemaDigest}'`);
  await admin.unsafe(`SET securium.baseline_security_sha256 = '${baselineDigest.securityDigest}'`);
  await admin.unsafe(await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.sql", "utf8"));
  await admin.unsafe(await readFile("db/postgres/migrations/0022_cs1a_audit_identity.sql", "utf8"));
  await seedFixtures();

  const subjects = Array.from({ length: 8 }, (_, index) => subject(index));
  const base = { contractVersion: "CS1A_HUMAN_DECISION_HASH_V1", humanDecisionHash: "a".repeat(64), subjects, decision: "ALLOW_CANONICAL", reasonCode: "LEGACY_REVIEW_REQUIRED", publicationAuthority: "NOT_GRANTED" };
  const differentActorBarrier = overlapBarrier(2);
  const [first, second] = await Promise.all([
    persistCs1aGovernanceDecision({ database: provider(false, differentActorBarrier.wait), actor: { id: "pia-actor-a", roles: ["CONTENT_REVIEWER"] }, ...base }),
    persistCs1aGovernanceDecision({ database: provider(false, differentActorBarrier.wait), actor: { id: "pia-actor-b", roles: ["ADMIN"] }, ...base }),
  ].map(async (operation) => {
    try { return { kind: "success", value: await operation }; }
    catch (error) { return { kind: "error", error }; }
  }));
  assert.equal([first, second].filter((result) => result.kind === "success").length, 1, JSON.stringify([first, second], (_, value) => value instanceof Error ? { name: value.name, code: value.code, message: value.message } : value));
  const duplicate = [first, second].find((result) => result.kind === "error");
  assert.equal(duplicate.error.code, "DUPLICATE_EXACT_GOVERNANCE_DECISION");
  assert.equal((await admin`SELECT count(*)::int AS count FROM cs1a_governance_decisions`)[0].count, 1);
  assert.equal((await admin`SELECT count(*)::int AS count FROM cs1a_governance_decision_subjects`)[0].count, 8);
  assert.equal((await admin`SELECT count(*)::int AS count FROM cs1a_governance_decision_audits`)[0].count, 1);
  assert.equal((await admin`SELECT count(*)::int AS count FROM admin_audit_logs WHERE action = 'CS1A_GOVERNANCE_DECISION_CONFIRMED'`)[0].count, 1);

  const read = await readCs1aGovernanceDecision(provider(), base.contractVersion, base.humanDecisionHash);
  assert.deepEqual(read.subjects.map((row) => row.canonicalSubjectIdentity), subjects.map((row) => row.resourceRevisionId).sort());
  assert.equal(read.audit.actorUserId === "pia-actor-a" || read.audit.actorUserId === "pia-actor-b", true);

  const sameActorBarrier = overlapBarrier(2);
  const sameActorBase = { ...base, humanDecisionHash: "c".repeat(64) };
  const sameActor = await Promise.all([
    persistCs1aGovernanceDecision({ database: provider(false, sameActorBarrier.wait), actor: { id: "pia-actor-a", roles: ["CONTENT_REVIEWER"] }, ...sameActorBase }),
    persistCs1aGovernanceDecision({ database: provider(false, sameActorBarrier.wait), actor: { id: "pia-actor-a", roles: ["CONTENT_REVIEWER"] }, ...sameActorBase }),
  ].map(async (operation) => {
    try { return { kind: "success", value: await operation }; }
    catch (error) { return { kind: "error", error }; }
  }));
  assert.equal(sameActor.filter((result) => result.kind === "success").length, 1);
  assert.equal(sameActor.filter((result) => result.kind === "error")[0].error.code, "DUPLICATE_EXACT_GOVERNANCE_DECISION");

  const distinctBarrier = overlapBarrier(2);
  const distinct = await Promise.all([
    persistCs1aGovernanceDecision({ database: provider(false, distinctBarrier.wait), actor: { id: "pia-actor-a", roles: ["CONTENT_REVIEWER"] }, ...base, humanDecisionHash: "d".repeat(64) }),
    persistCs1aGovernanceDecision({ database: provider(false, distinctBarrier.wait), actor: { id: "pia-actor-b", roles: ["ADMIN"] }, ...base, humanDecisionHash: "e".repeat(64) }),
  ]);
  assert.equal(distinct.length, 2);

  const rollbackRequestId = "pia-identity-rollback-request";
  const rollbackProvider = provider(true);
  await assert.rejects(persistCs1aGovernanceDecision({ database: rollbackProvider, actor: { id: "pia-actor-a", roles: ["CONTENT_REVIEWER"] }, ...base, requestId: rollbackRequestId, humanDecisionHash: "b".repeat(64) }));
  assert.equal((await admin`SELECT count(*)::int AS count FROM cs1a_governance_decisions WHERE human_decision_hash = ${"b".repeat(64)}`)[0].count, 0);
  assert.equal((await admin`SELECT count(*)::int AS count FROM cs1a_governance_decision_subjects WHERE decision_id NOT IN (SELECT id FROM cs1a_governance_decisions)`)[0].count, 0);
  assert.equal((await admin`SELECT count(*)::int AS count FROM admin_audit_logs WHERE request_id = ${rollbackRequestId}`)[0].count, 0);
  assert.equal((await admin`SELECT count(*)::int AS count FROM cs1a_governance_decision_audits WHERE decision_id NOT IN (SELECT id FROM cs1a_governance_decisions)`)[0].count, 0);
});

function overlapBarrier(expected) {
  let arrivals = 0;
  let release;
  const released = new Promise((resolve) => { release = resolve; });
  return {
    wait: async () => {
      arrivals += 1;
      if (arrivals === expected) release();
      await released;
    },
  };
}

function provider(failLate = false, onTransactionStart = async () => {}) {
  const client = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
  return new PostgresDatabaseProvider({
    query: async (sql, parameters) => {
      const rows = await client.unsafe(sql, parameters);
      return { rows, rowCount: rows.count ?? rows.length };
    },
    transaction: async (callback) => client.begin(async (tx) => { await onTransactionStart(); return callback({ query: async (sql, parameters) => {
      if (failLate && sql.includes("cs1a_governance_decision_audits")) throw new Error("forced late failure");
      const rows = await tx.unsafe(sql, parameters);
      return { rows, rowCount: rows.count ?? rows.length };
    } }); }),
    close: () => client.end({ timeout: 5 }),
  });
}

function subject(index) {
  const id = `pia-revision-${index + 1}`;
  return { governanceScope: "PIA", resourceType: "CONTENT_REVISION", resourceId: `pia-resource-${index + 1}`, resourceRevisionId: id, contentHash: "c".repeat(64), revisionHash: "d".repeat(64), policyVersion: "CS1A_POLICY_V1", decision: "ALLOW_CANONICAL", reasonCode: "LEGACY_REVIEW_REQUIRED", rightsDisposition: "REVIEW_REQUIRED", currentnessDisposition: "CURRENT", authoringOrigin: "LEGACY", contentClass: "LEGACY_REVIEW_REQUIRED", sourceOrigin: "NONE_NOT_APPLICABLE", publicationAuthority: "NOT_GRANTED", sourceAuthority: null, sourceManifestRef: null, sourceSetHash: "e".repeat(64), parentRevisionId: null, immutableProvenanceIdentity: null };
}

async function seedFixtures() {
  await admin.unsafe("INSERT INTO users (id, email, display_name) VALUES ('pia-owner', 'pia-owner@example.invalid', 'PIA Owner'), ('pia-actor-a', 'pia-a@example.invalid', 'PIA A'), ('pia-actor-b', 'pia-b@example.invalid', 'PIA B')");
  for (let index = 0; index < 8; index += 1) {
    await admin.unsafe(`INSERT INTO content_revisions (id, content_type, content_id, title, content_date, version, revision_status, snapshot_json, created_by) VALUES ('pia-revision-${index + 1}', 'PRIVACY_IMPACT_ITEM', 'pia-resource-${index + 1}', 'PIA ${index + 1}', '2026-08-28', '1', 'review', '{}', 'pia-owner')`);
  }
}
