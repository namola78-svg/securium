import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import postgres from "postgres";
import { classifyMigrationApplicability } from "../scripts/postgres-migration-applicability.mjs";
import { expectedMigrationChecksum } from "../scripts/postgres-migration-guard.mjs";
import { validateBaselineFiles } from "../scripts/postgres-baseline.mjs";
import {
  cleanupOwnedPostgresContainer,
  createOwnedPostgresContainer,
  getPublishedPostgresPort,
} from "../scripts/owned-postgres-container.mjs";

const execFile = promisify(execFileCallback);
const baselineRlsId = "0058_app_schema_baseline_receipts_rls_hardening";
const sample = [{ id: "0057_before" }, { id: baselineRlsId }, { id: "0059_after" }];

test("only the absent baseline control table on a historical lineage is not applicable", () => {
  const plan = classifyMigrationApplicability(sample, {
    databaseState: "HISTORICAL_DATABASE", baselineRelationExists: false, appliedMigrationIds: [],
  });
  assert.deepEqual(plan.applicable, [sample[0], sample[2]]);
  assert.deepEqual(plan.notApplicable, [sample[1]]);
});

test("fresh, baseline, present-table, and unresolved states never receive an exemption", () => {
  for (const databaseState of ["TRUE_EMPTY", "BASELINE_DATABASE", "POST_BOUNDARY_DATABASE", "UNKNOWN", "AMBIGUOUS_NONEMPTY", "PARTIAL_BASELINE"]) {
    assert.deepEqual(classifyMigrationApplicability(sample, { databaseState, baselineRelationExists: false }).applicable, sample);
  }
  for (const baselineRelationExists of [true, null, undefined]) {
    assert.deepEqual(classifyMigrationApplicability(sample, { databaseState: "HISTORICAL_DATABASE", baselineRelationExists }).applicable, sample);
  }
});

test("missing ledger evidence and a receipt without its table fail closed", () => {
  assert.throws(() => classifyMigrationApplicability(sample, {
    databaseState: "HISTORICAL_DATABASE", baselineRelationExists: false,
  }), /POSTGRES_MIGRATION_APPLICABILITY_LEDGER_REQUIRED/);
  assert.throws(() => classifyMigrationApplicability(sample, {
    databaseState: "HISTORICAL_DATABASE", baselineRelationExists: false, appliedMigrationIds: [baselineRlsId],
  }), /POSTGRES_BASELINE_RLS_RECEIPT_WITHOUT_TABLE/);
});

test("applicability never exempts other migrations or migration-number lookalikes", () => {
  const others = [{ id: "0058_other_migration" }, { id: "0017_evidence_e1_core_remediation" }];
  assert.deepEqual(classifyMigrationApplicability(others, {
    databaseState: "HISTORICAL_DATABASE", baselineRelationExists: false, appliedMigrationIds: [],
  }), { applicable: others, notApplicable: [] });
});

test("owned PostgreSQL proves historical upgrade, resume, fresh RLS, and fail-closed invariants", async (t) => {
  const names = (await readdir("db/postgres/migrations")).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort();
  const migrations = await Promise.all(names.map(async name => ({ id: name.slice(0, -4), sql: await readFile(`db/postgres/migrations/${name}`, "utf8") })));
  const historical = migrations.filter(m => m.id.slice(0, 4) <= "0012");
  const pending = migrations.filter(m => m.id.slice(0, 4) > "0012");
  const password = randomBytes(32).toString("hex");
  const evidence = { authority: "SYNTHETIC_DISPOSABLE_ONLY", exactAscendingReplay: false, productionConnectionAttempted: false, stages: {} };
  const clients = [];
  let owned;
  let port;
  let admin;
  const connect = database => {
    assert.match(database, /^(postgres|preflight_[a-z_]+)$/);
    const sql = postgres({ host: "127.0.0.1", port, username: "postgres", password, database, ssl: false, max: 1, prepare: false, connect_timeout: 2, onnotice: () => {} });
    clients.push(sql);
    return sql;
  };
  const ledger = async sql => Array.from(await sql`SELECT id, checksum FROM app_schema_migrations ORDER BY id`);
  const verifyLedger = (rows, expected) => assert.deepEqual(rows, expected.map(m => ({ id: m.id, checksum: expectedMigrationChecksum(m) })).sort((a, b) => a.id.localeCompare(b.id)));
  async function database(name) {
    assert.match(name, /^preflight_[a-z_]+$/);
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    const sql = connect(name);
    // Synthetic Supabase-like grants test that 0002 closes future browser access.
    await sql.unsafe("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role");
    return sql;
  }
  async function fixture(name) {
    const sql = await database(name);
    // Literal ascending replay is tested separately. The repository's historical
    // reference also needs 0003 before 0002; no forward migration is reordered.
    const order = [historical[0], historical[2], historical[1], ...historical.slice(3)];
    for (const m of order) {
      if (m.id.startsWith("0009_")) {
        await sql.unsafe("INSERT INTO course_groups (id,code,name) VALUES ('synthetic-group','SYNTHETIC','Synthetic'); INSERT INTO courses (id,course_group_id,code,slug,name,short_name) VALUES ('course-ise','synthetic-group','SYNTHETIC_ISE','synthetic-ise','Synthetic ISE','ISE'),('course-isie','synthetic-group','SYNTHETIC_ISIE','synthetic-isie','Synthetic ISIE','ISIE');");
      }
      await sql.unsafe(m.sql);
    }
    verifyLedger(await ledger(sql), historical);
    await sql.unsafe("INSERT INTO users (id,email,display_name) VALUES ('synthetic-user','synthetic@example.invalid','Synthetic'); INSERT INTO questions (id,title,content,type,created_by) VALUES ('synthetic-question','Synthetic','Synthetic','TRUE_FALSE','synthetic-user'); INSERT INTO question_versions (id,question_id,version,snapshot_json,created_by) VALUES ('synthetic-version','synthetic-question',1,'{}','synthetic-user'); INSERT INTO question_attempts (id,idempotency_key,user_id,question_id,course_id,selected_answer,is_correct) VALUES ('synthetic-attempt','synthetic-key','synthetic-user','synthetic-question','course-ise','true',1);");
    return sql;
  }
  async function run(name, command = "deploy") {
    assert.match(name, /^preflight_[a-z_]+$/);
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (/^(DATABASE_URL|DIRECT_URL|POSTGRES_|PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|PGSERVICE|PGOPTIONS)/.test(key)) delete env[key];
    env.POSTGRES_MIGRATION_URL = `postgres://postgres:${password}@127.0.0.1:${port}/${name}`;
    if (command === "deploy") env.POSTGRES_MIGRATION_APPROVED = "APPLY_REVIEWED_MIGRATIONS";
    try {
      const result = await execFile(process.execPath, ["scripts/postgres-migrations.mjs", command, ...(command === "deploy" ? ["--confirm"] : [])], { env, windowsHide: true, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
      return { code: 0, stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      return { code: typeof error.code === "number" ? error.code : 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
    }
  }
  const legacyAttempt = sql => sql`SELECT id,user_id,question_id,course_id,selected_answer,is_correct,score,attempted_at FROM question_attempts ORDER BY id`;
  try {
    await mkdir("tmp", { recursive: true });
    owned = await createOwnedPostgresContainer({ name: `securium-historical-repair-${randomUUID()}`, ownerToken: randomUUID(), password, receiptPath: resolve("tmp/historical-preflight-repaired-owner.json"), image: "postgres:17.6" });
    port = Number(await getPublishedPostgresPort(owned));
    admin = connect("postgres");
    for (let attempt = 0; ; attempt++) {
      try { await admin`SELECT 1`; break; }
      catch { if (attempt >= 60) throw new Error("DISPOSABLE_NOT_READY"); await new Promise(r => setTimeout(r, 250)); }
    }
    evidence.server = (await admin`SELECT version() AS version`)[0].version;
    await admin.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;");
    await execFile("docker", ["exec", "--user", "postgres", owned.containerId, "openssl", "req", "-new", "-x509", "-days", "1", "-nodes", "-subj", "/CN=localhost", "-keyout", "/var/lib/postgresql/data/server.key", "-out", "/var/lib/postgresql/data/server.crt"], { windowsHide: true });
    await admin.unsafe("ALTER SYSTEM SET ssl = 'on'");
    await admin`SELECT pg_reload_conf()`;
    await new Promise(r => setTimeout(r, 500));

    await t.test("literal 0001-0012 replay records the pre-existing 0002 dependency defect", async () => {
      const sql = await database("preflight_literal");
      await sql.unsafe(historical[0].sql);
      await assert.rejects(sql.unsafe(historical[1].sql), { code: "42P01", message: 'relation "public.curriculum_trees" does not exist' });
      await sql.unsafe("ROLLBACK");
      verifyLedger(await ledger(sql), [historical[0]]);
      evidence.stages.literalReplay = { firstFailure: historical[1].id, code: "42P01", ledgerCount: 1 };
    });

    await t.test("0012 advances through all 30 applicable migrations without baseline fabrication", async () => {
      const sql = await fixture("preflight_historical");
      const before = Array.from(await legacyAttempt(sql));
      const status = await run("preflight_historical", "status");
      assert.equal(status.code, 0, status.stderr);
      assert.match(status.stdout, /POSTGRES_MIGRATION_NOT_APPLICABLE .*receipt=NONE/);
      assert.equal(status.stdout.match(/POSTGRES_MIGRATIONS_PENDING (.+)/)[1].split(",").length, 30);
      const result = await run("preflight_historical");
      assert.equal(result.code, 0, result.stderr);
      const expected = migrations.filter(m => m.id !== baselineRlsId);
      verifyLedger(await ledger(sql), expected);
      assert.equal((await sql`SELECT to_regclass('public.app_schema_baseline_receipts') AS relation`)[0].relation, null);
      assert.deepEqual(Array.from(await legacyAttempt(sql)), before);
      const [bindings] = await sql`SELECT question_version_id, concept_mapping_set_hash, attempt_sequence, foundation_question_binding_id FROM question_attempts`;
      assert.deepEqual(bindings, { question_version_id: null, concept_mapping_set_hash: null, attempt_sequence: null, foundation_question_binding_id: null });
      for (const table of ["runtime_authority_roots", "runtime_authority_events", "cppg_runtime_registrations", "cppg_runtime_projection_records", "cppg_publication_receipts", "cppg_publication_revocations", "secure_coding_8h_runtime_registrations", "user_auth_identity_bindings", "isms_profiles", "isms_profile_requirement_mappings", "cs1a_governance_receipts", "evidence_projections"]) {
        assert.equal(Number((await sql.unsafe(`SELECT count(*) AS count FROM public."${table}"`))[0].count), 0, table);
      }
      const openTables = await sql`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))`;
      assert.equal(openTables.length, 0, JSON.stringify(openTables));
      const replay = await run("preflight_historical");
      assert.equal(replay.code, 0, replay.stderr);
      verifyLedger(await ledger(sql), expected);
      const afterStatus = await run("preflight_historical", "status");
      assert.match(afterStatus.stdout, /POSTGRES_MIGRATIONS_APPLIED/);
      evidence.stages.historicalUpgrade = { code: result.code, applicablePendingBefore: 30, ledgerCount: expected.length, ledger: await ledger(sql), baselineRelationAbsent: true, no0058Receipt: true, legacyAttemptPreserved: true, authorityRegistrationPublicationAndBindingRows: 0, browserAccessibleTables: 0, repeatDeploy: "PASS", statusAfter: afterStatus.stdout.trim() };
      await sql`UPDATE app_schema_migrations SET checksum='synthetic-invalid-checksum' WHERE id=${historical.at(-1).id}`;
      const mismatch = await run("preflight_historical");
      assert.equal(mismatch.code, 1);
      assert.match(mismatch.stderr, /MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH/);
      assert.doesNotMatch(mismatch.stdout, /action=EXECUTE/);
      evidence.stages.checksumMismatch = { code: mismatch.code, failure: mismatch.stderr.trim(), ddlExecuted: false };
    });

    await t.test("resume at 0057 uses guards and does not manufacture a 0058 receipt", async () => {
      const sql = await fixture("preflight_resume");
      for (const m of pending.filter(m => m.id.slice(0, 4) < "0058")) await sql.unsafe(m.sql);
      assert.equal((await ledger(sql)).length, 40);
      const result = await run("preflight_resume");
      assert.equal(result.code, 0, result.stderr);
      verifyLedger(await ledger(sql), migrations.filter(m => m.id !== baselineRlsId));
      assert.equal((await sql`SELECT to_regclass('public.app_schema_baseline_receipts') AS relation`)[0].relation, null);
      evidence.stages.partialUpgradeResume = { code: result.code, ledgerBefore: 40, ledgerAfter: 42, baselineRelationAbsent: true, no0058Receipt: true };
    });

    await t.test("fresh baseline still receives 0058 and preserves its real receipt digests", async () => {
      const sql = await database("preflight_fresh");
      const result = await run("preflight_fresh");
      assert.equal(result.code, 0, result.stderr);
      assert.doesNotMatch(result.stdout, /POSTGRES_MIGRATION_NOT_APPLICABLE/);
      verifyLedger(await ledger(sql), migrations.filter(m => m.id.slice(0, 4) > "0019"));
      const { manifest } = await validateBaselineFiles();
      const receipts = await sql`SELECT baseline_id, artifact_sha256, schema_sha256, security_sha256 FROM app_schema_baseline_receipts`;
      assert.deepEqual(Array.from(receipts), [{ baseline_id: manifest.baselineId, artifact_sha256: manifest.artifactDigest, schema_sha256: manifest.schemaDigest, security_sha256: manifest.securityDigest }]);
      assert.equal((await sql`SELECT relrowsecurity FROM pg_class WHERE oid='public.app_schema_baseline_receipts'::regclass`)[0].relrowsecurity, true);
      const replay = await run("preflight_fresh");
      assert.equal(replay.code, 0, replay.stderr);
      evidence.stages.freshBaseline = { code: result.code, ledgerCount: 24, baselineReceiptCount: 1, genuineBaselineExecution: true, baselineDigestsPreserved: true, migration0058Applied: true, baselineReceiptRlsEnabled: true, repeatDeploy: "PASS" };
    });

    await t.test("existing Evidence rows still stop 0017 and roll back its NOT NULL addition", async () => {
      const sql = await fixture("preflight_evidence");
      for (const m of pending.filter(m => m.id.slice(0, 4) < "0017")) await sql.unsafe(m.sql);
      await sql.unsafe("INSERT INTO ontology_concepts (id,concept_key,namespace,label,normalized_label,category) VALUES ('synthetic-concept','synthetic.key','synthetic','Synthetic','synthetic','synthetic')");
      const hash = "a".repeat(64);
      await sql`INSERT INTO evidence_projections (id,user_id,source_type,source_event_id,source_revision_identity,evidence_type,concept_id,concept_mapping_set_hash,projection_version,source_semantic_hash,semantic_hash,quality,occurred_at) VALUES ('synthetic-evidence','synthetic-user','QUESTION_ATTEMPT','synthetic-attempt','synthetic-revision','PERFORMANCE_RESULT','synthetic-concept',${hash},'SYNTHETIC_V1',${hash},${hash},'DIRECT_PERFORMANCE','2026-10-07')`;
      const result = await run("preflight_evidence");
      assert.equal(result.code, 1);
      assert.match(result.stderr, /POSTGRES_MIGRATION_DEPLOY_FAILED:P0001/);
      assert.match(result.stdout, /migration=0017_evidence_e1_core_remediation .*action=EXECUTE/);
      assert.equal((await ledger(sql)).length, 16);
      assert.equal((await sql`SELECT count(*)::int AS count FROM evidence_projections`)[0].count, 1);
      assert.equal((await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='evidence_projections' AND column_name='source_lineage_identity'`).length, 0);
      evidence.stages.existingEvidence = { code: result.code, firstFailure: "0017_evidence_e1_core_remediation", sqlstate: "P0001", ledgerCount: 16, evidenceRowPreserved: true, notNullAdditionRolledBack: true };
    });

    await t.test("an ambiguous nonempty database still fails before any migration DDL", async () => {
      const sql = await database("preflight_unknown");
      await sql.unsafe("CREATE TABLE synthetic_unknown (id integer)");
      const result = await run("preflight_unknown");
      assert.equal(result.code, 1);
      assert.match(result.stderr, /POSTGRES_BASELINE_STATE_AMBIGUOUS_NONEMPTY/);
      assert.equal((await sql`SELECT to_regclass('public.app_schema_migrations') AS relation`)[0].relation, null);
      evidence.stages.ambiguousNonempty = { code: result.code, ddlExecuted: false };
    });
  } finally {
    for (const sql of clients) await sql.end({ timeout: 2 }).catch(() => {});
    evidence.cleanup = owned ? await cleanupOwnedPostgresContainer(owned) : "NO_CONTAINER_CREATED";
    await mkdir("tmp", { recursive: true });
    await writeFile("tmp/historical-preflight-repaired-evidence.json", `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`HISTORICAL_PREFLIGHT_OWNED_CLEANUP ${evidence.cleanup}`);
  }
});
