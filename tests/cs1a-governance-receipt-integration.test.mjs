import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { Miniflare } from "miniflare";
import { after, before, test } from "node:test";
import { drizzle } from "drizzle-orm/d1";
import postgres from "postgres";
import { appendGovernanceReceipt, readGovernanceReceipt } from "../db/policy-receipt-repositories.ts";
import { classifyCs1aReceiptReplay, computeCs1aReceiptIdentity } from "../lib/policy/cs1a-receipt.ts";

const hash = "a".repeat(64);
const input = {
  resourceType: "CONTENT_REVISION",
  resourceId: "d1-resource",
  resourceRevisionId: "d1-revision-1",
  parentRevisionId: null,
  sourceSetHash: hash,
  revisionHash: "b".repeat(64),
  policyVersion: "CS1A_POLICY_V1",
  humanDecisionHash: "c".repeat(64),
  humanDecisionRef: "d1-human-decision",
  humanDecisionAt: "2026-08-26T00:00:00.000Z",
  decision: "ALLOW_CANONICAL",
  reasonCode: "AUTHORIZED_PROSPECTIVE_ORIGINAL",
  rightsDisposition: "ORIGINAL_INTERNAL",
  currentnessDisposition: "CURRENT",
  publicationAuthority: "NOT_GRANTED",
  contentClass: "PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED",
  authoringOrigin: "SECURIUM_ADMIN_CMS",
  sourceOrigin: "NONE_NOT_APPLICABLE",
  sourceManifestRef: null,
  sourceAuthority: null,
  actorAuditLogId: "d1-audit-log",
};

let miniflare;
let database;
let db;
const execFile = promisify(execFileCallback);

async function insertD1Receipt(row) {
  await database.prepare(`INSERT INTO cs1a_governance_receipts (
    receipt_id, resource_type, resource_id, resource_revision_id, revision_hash,
    source_set_hash, policy_version, rights_disposition, currentness_disposition,
    content_class, authoring_origin, source_origin, publication_authority, decision,
    reason_code, human_decision_hash, human_decision_ref, human_decision_at,
    semantic_decision_hash, idempotency_key, supersedes_receipt_id, actor_audit_log_id,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      row.receipt_id, row.resource_type, row.resource_id, row.resource_revision_id,
      row.revision_hash, row.source_set_hash, row.policy_version, row.rights_disposition,
      row.currentness_disposition, row.content_class, row.authoring_origin, row.source_origin,
      row.publication_authority, row.decision, row.reason_code, row.human_decision_hash,
      row.human_decision_ref, row.human_decision_at, row.semantic_decision_hash,
      row.idempotency_key, row.supersedes_receipt_id ?? null, row.actor_audit_log_id,
      row.created_at,
    )
    .run();
}

before(async () => {
  miniflare = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-05-15", d1Databases: { DB: "cs1a-r3" } });
  database = await miniflare.getD1Database("DB");
  for (const path of ["drizzle/0032_concept_persistence_cp_a.sql", "drizzle/0033_cs1a_governance_receipts.sql"]) {
    const sql = await readFile(path, "utf8");
    for (const statement of sql.split(/--> statement-breakpoint/).map((value) => value.trim()).filter(Boolean)) await database.prepare(statement).run();
  }
  db = drizzle(database);
});

after(async () => miniflare?.dispose());

test("D1 R3 creates one generic receipt table with no domain-specific branches", async () => {
  const rows = await database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%receipt%'").all();
  assert.deepEqual(rows.results.map((row) => row.name), ["cs1a_governance_receipts"]);
});

test("D1 append, exact replay, read-back, and deterministic identities", async () => {
  const first = await appendGovernanceReceipt(input, db);
  assert.equal(first.outcome, "CREATED");
  const replay = await appendGovernanceReceipt(input, db);
  assert.equal(replay.outcome, "IDEMPOTENT_EXISTING");
  assert.equal(replay.receipt.receiptId, first.receipt.receiptId);
  assert.deepEqual(computeCs1aReceiptIdentity(input), {
    semanticDecisionHash: first.receipt.semanticDecisionHash,
    idempotencyKey: first.receipt.idempotencyKey,
  });
  assert.equal((await readGovernanceReceipt(first.receipt.receiptId, db)).humanDecisionHash, "c".repeat(64));
  assert.equal((await database.prepare("SELECT count(*) AS count FROM cs1a_governance_receipts").first()).count, 1);
  assert.equal((await appendGovernanceReceipt({ ...input, decision: "NOT_A_DECISION" }, db)).outcome, "VALIDATION_DENIED");
});

test("D1 returns CONFLICT for an incompatible replay without mutating the canonical row", async () => {
  const conflictInput = { ...input, resourceId: "d1-conflict-resource", resourceRevisionId: "d1-conflict-revision" };
  const identity = computeCs1aReceiptIdentity(conflictInput);
  const original = {
    receipt_id: "d1-conflict-original",
    resource_type: conflictInput.resourceType,
    resource_id: conflictInput.resourceId,
    resource_revision_id: conflictInput.resourceRevisionId,
    revision_hash: conflictInput.revisionHash,
    source_set_hash: conflictInput.sourceSetHash,
    policy_version: conflictInput.policyVersion,
    rights_disposition: conflictInput.rightsDisposition,
    currentness_disposition: conflictInput.currentnessDisposition,
    content_class: conflictInput.contentClass,
    authoring_origin: conflictInput.authoringOrigin,
    source_origin: conflictInput.sourceOrigin,
    publication_authority: conflictInput.publicationAuthority,
    decision: conflictInput.decision,
    reason_code: conflictInput.reasonCode,
    human_decision_hash: conflictInput.humanDecisionHash,
    human_decision_ref: conflictInput.humanDecisionRef,
    human_decision_at: conflictInput.humanDecisionAt,
    semantic_decision_hash: "f".repeat(64),
    idempotency_key: identity.idempotencyKey,
    actor_audit_log_id: conflictInput.actorAuditLogId,
    created_at: "2026-08-26T00:00:01.000Z",
  };
  await insertD1Receipt(original);
  const result = await appendGovernanceReceipt(conflictInput, db);
  assert.deepEqual(result, { outcome: "CONFLICT", reason: "SEMANTIC_IDENTITY_MISMATCH" });
  assert.equal((await database.prepare("SELECT count(*) AS count FROM cs1a_governance_receipts WHERE resource_id = ?").bind(conflictInput.resourceId).first()).count, 1);
  assert.deepEqual(await database.prepare("SELECT receipt_id, semantic_decision_hash, idempotency_key FROM cs1a_governance_receipts WHERE receipt_id = ?").bind(original.receipt_id).first(), {
    receipt_id: original.receipt_id,
    semantic_decision_hash: original.semantic_decision_hash,
    idempotency_key: original.idempotency_key,
  });
});

test("D1 creates and reads back a valid supersession without mutating its predecessor", async () => {
  const predecessorInput = { ...input, resourceId: "d1-lineage-resource", resourceRevisionId: "d1-lineage-revision-1", revisionHash: "1".repeat(64) };
  const predecessor = await appendGovernanceReceipt(predecessorInput, db);
  assert.equal(predecessor.outcome, "CREATED");
  const successorInput = { ...predecessorInput, resourceRevisionId: "d1-lineage-revision-2", revisionHash: "2".repeat(64), supersedesReceiptId: predecessor.receipt.receiptId };
  const successor = await appendGovernanceReceipt(successorInput, db);
  assert.equal(successor.outcome, "CREATED");
  const predecessorRead = await readGovernanceReceipt(predecessor.receipt.receiptId, db);
  const successorRead = await readGovernanceReceipt(successor.receipt.receiptId, db);
  assert.equal(predecessorRead.supersedesReceiptId, null);
  assert.equal(successorRead.supersedesReceiptId, predecessor.receipt.receiptId);
  assert.equal(successorRead.resourceId, predecessorRead.resourceId);
  assert.notEqual(successorRead.resourceRevisionId, predecessorRead.resourceRevisionId);
});

test("D1 rejects update, delete, self-supersession, and cross-resource supersession", async () => {
  const row = await database.prepare("SELECT receipt_id FROM cs1a_governance_receipts LIMIT 1").first();
  await assert.rejects(database.prepare("UPDATE cs1a_governance_receipts SET decision = 'DENY' WHERE receipt_id = ?").bind(row.receipt_id).run());
  await assert.rejects(database.prepare("DELETE FROM cs1a_governance_receipts WHERE receipt_id = ?").bind(row.receipt_id).run());
  await assert.rejects(database.prepare("INSERT INTO cs1a_governance_receipts (receipt_id, resource_type, resource_id, resource_revision_id, revision_hash, source_set_hash, policy_version, rights_disposition, currentness_disposition, content_class, authoring_origin, source_origin, publication_authority, decision, reason_code, human_decision_hash, human_decision_ref, human_decision_at, semantic_decision_hash, idempotency_key, supersedes_receipt_id, actor_audit_log_id, created_at) SELECT 'self', resource_type, resource_id, resource_revision_id, revision_hash, source_set_hash, policy_version, rights_disposition, currentness_disposition, content_class, authoring_origin, source_origin, publication_authority, decision, reason_code, human_decision_hash, human_decision_ref, human_decision_at, semantic_decision_hash, idempotency_key, 'self', actor_audit_log_id, created_at FROM cs1a_governance_receipts LIMIT 1").run());
  await assert.rejects(database.prepare(`INSERT INTO cs1a_governance_receipts (receipt_id, resource_type, resource_id, resource_revision_id, revision_hash, source_set_hash, policy_version, rights_disposition, currentness_disposition, content_class, authoring_origin, source_origin, publication_authority, decision, reason_code, human_decision_hash, human_decision_ref, human_decision_at, semantic_decision_hash, idempotency_key, supersedes_receipt_id, actor_audit_log_id, created_at) SELECT 'cross', 'QUESTION', 'other', resource_revision_id, revision_hash, source_set_hash, policy_version, rights_disposition, currentness_disposition, content_class, authoring_origin, source_origin, publication_authority, decision, reason_code, human_decision_hash, human_decision_ref, human_decision_at, '${"d".repeat(64)}', '${"e".repeat(64)}', receipt_id, actor_audit_log_id, created_at FROM cs1a_governance_receipts LIMIT 1`).run());
});

test("PostgreSQL R2 applies after 0019 without baseline rewrite and enforces append-only receipt semantics", async () => {
  const container = `securium-cs1a-r2-${Date.now()}`;
  const password = "cs1a-disposable-password-2026";
  let client;
  let started = false;
  try {
    await execFile("docker", ["run", "--detach", "--rm", "--name", container, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
    started = true;
    let port;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        port = (await execFile("docker", ["port", container, "5432/tcp"])).stdout.trim().match(/:(\d+)$/)?.[1];
        if (port) {
          client = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
          await client`SELECT 1`;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(client, "disposable PostgreSQL must become ready");
    for (const role of ["anon", "authenticated", "service_role"]) await client.unsafe(`CREATE ROLE ${role}`);
    const baseline = await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.sql", "utf8");
    const manifest = JSON.parse(await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.json", "utf8"));
    await client.unsafe(`SET securium.baseline_artifact_sha256 = '${manifest.artifactDigest}'`);
    await client.unsafe(`SET securium.baseline_schema_sha256 = '${manifest.schemaDigest}'`);
    await client.unsafe(`SET securium.baseline_security_sha256 = '${manifest.securityDigest}'`);
    await client.unsafe(baseline);
    const before = await client`SELECT count(*)::int AS count FROM pg_class WHERE relkind = 'r' AND relname NOT IN ('app_schema_migrations', 'app_schema_baseline_receipts')`;
    await client.unsafe(await readFile("db/postgres/migrations/0020_concept_persistence_cp_a.sql", "utf8"));
    await client.unsafe(await readFile("db/postgres/migrations/0021_cs1a_governance_receipts.sql", "utf8"));
    const afterMigrations = await client`SELECT count(*)::int AS count FROM pg_class WHERE relkind = 'r' AND relname NOT IN ('app_schema_migrations', 'app_schema_baseline_receipts')`;
    assert.equal(Number(afterMigrations[0].count), Number(before[0].count) + 4);
    const receipt = { receipt_id: "pg-receipt-1", ...input, created_at: "2026-08-26T00:00:00.000Z", semantic_decision_hash: "d".repeat(64), idempotency_key: "e".repeat(64) };
    const pgRow = {
      receipt_id: receipt.receipt_id,
      resource_type: receipt.resourceType,
      resource_id: receipt.resourceId,
      resource_revision_id: receipt.resourceRevisionId,
      parent_revision_id: null,
      revision_hash: receipt.revisionHash,
      source_set_hash: receipt.sourceSetHash,
      policy_version: receipt.policyVersion,
      rights_disposition: receipt.rightsDisposition,
      currentness_disposition: receipt.currentnessDisposition,
      content_class: receipt.contentClass,
      authoring_origin: receipt.authoringOrigin,
      source_origin: receipt.sourceOrigin,
      publication_authority: receipt.publicationAuthority,
      decision: receipt.decision,
      reason_code: receipt.reasonCode,
      human_decision_hash: receipt.humanDecisionHash,
      human_decision_ref: receipt.humanDecisionRef,
      human_decision_at: receipt.humanDecisionAt,
      semantic_decision_hash: receipt.semantic_decision_hash,
      idempotency_key: receipt.idempotency_key,
      supersedes_receipt_id: null,
      source_manifest_ref: null,
      source_authority: null,
      actor_audit_log_id: receipt.actorAuditLogId,
      git_sha: null,
      execution_id: null,
      created_at: receipt.created_at,
    };
    await client`INSERT INTO cs1a_governance_receipts ${client(pgRow)}`;
    const pgExisting = await client`SELECT receipt_id, semantic_decision_hash, idempotency_key FROM cs1a_governance_receipts WHERE receipt_id = ${receipt.receipt_id}`;
    const pgConflict = classifyCs1aReceiptReplay(
      { receiptId: pgExisting[0].receipt_id, semanticDecisionHash: pgExisting[0].semantic_decision_hash, idempotencyKey: pgExisting[0].idempotency_key },
      { semanticDecisionHash: "f".repeat(64), idempotencyKey: pgExisting[0].idempotency_key },
    );
    assert.deepEqual(pgConflict, { outcome: "CONFLICT", reason: "SEMANTIC_IDENTITY_MISMATCH" });
    const pgConflictState = await client`SELECT count(*)::int AS count, receipt_id, semantic_decision_hash, idempotency_key FROM cs1a_governance_receipts WHERE receipt_id = ${receipt.receipt_id} GROUP BY receipt_id, semantic_decision_hash, idempotency_key`;
    assert.deepEqual(Array.from(pgConflictState).map((row) => ({ count: Number(row.count), receipt_id: row.receipt_id, semantic_decision_hash: row.semantic_decision_hash, idempotency_key: row.idempotency_key })), [{ count: 1, receipt_id: receipt.receipt_id, semantic_decision_hash: receipt.semantic_decision_hash, idempotency_key: receipt.idempotency_key }]);
    const successorRow = { ...pgRow, receipt_id: "pg-receipt-2", resource_revision_id: "pg-revision-2", revision_hash: "f".repeat(64), semantic_decision_hash: "1".repeat(64), idempotency_key: "2".repeat(64), supersedes_receipt_id: receipt.receipt_id };
    await client`INSERT INTO cs1a_governance_receipts ${client(successorRow)}`;
    const lineage = await client`SELECT receipt_id, resource_revision_id, supersedes_receipt_id FROM cs1a_governance_receipts WHERE resource_id = ${receipt.resourceId} ORDER BY receipt_id`;
    assert.deepEqual(Array.from(lineage).map((row) => ({ receipt_id: row.receipt_id, resource_revision_id: row.resource_revision_id, supersedes_receipt_id: row.supersedes_receipt_id })), [
      { receipt_id: "pg-receipt-1", resource_revision_id: receipt.resourceRevisionId, supersedes_receipt_id: null },
      { receipt_id: "pg-receipt-2", resource_revision_id: "pg-revision-2", supersedes_receipt_id: receipt.receipt_id },
    ]);
    await assert.rejects(client`UPDATE cs1a_governance_receipts SET decision = 'DENY' WHERE receipt_id = ${receipt.receipt_id}`);
    await assert.rejects(client`DELETE FROM cs1a_governance_receipts WHERE receipt_id = ${receipt.receipt_id}`);
    await assert.rejects(client.begin(async (tx) => { await tx`CREATE TABLE cs1a_rollback_probe (id integer)`; throw new Error("rollback probe"); }));
    const rollback = await client`SELECT to_regclass('public.cs1a_rollback_probe') AS relation`;
    assert.equal(rollback[0].relation, null);
    const registrations = await client`SELECT id FROM app_schema_migrations WHERE id IN ('0020_concept_persistence_cp_a', '0021_cs1a_governance_receipts') ORDER BY id`;
    assert.deepEqual(Array.from(registrations).map((row) => row.id), ["0020_concept_persistence_cp_a", "0021_cs1a_governance_receipts"]);
  } finally {
    if (client) await client.end({ timeout: 5 });
    if (started) await execFile("docker", ["rm", "--force", container]).catch(() => {});
  }
});
