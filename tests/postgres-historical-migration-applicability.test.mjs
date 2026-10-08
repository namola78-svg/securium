import assert from "node:assert/strict";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import postgres from "postgres";
import { classifyMigrationApplicability } from "../scripts/postgres-migration-applicability.mjs";
import { validateHistoricalMigrationLedger } from "../scripts/postgres-historical-ledger.mjs";
import { expectedMigrationChecksum } from "../scripts/postgres-migration-guard.mjs";
import { validateBaselineFiles } from "../scripts/postgres-baseline.mjs";
import { HISTORICAL_SUPPLEMENTARY_RECEIPTS } from "../scripts/postgres-historical-supplementary-receipts.mjs";
import {
  cleanupOwnedPostgresContainer,
  createOwnedPostgresContainer,
  getPublishedPostgresPort,
} from "../scripts/owned-postgres-container.mjs";

const execFile = promisify(execFileCallback);
const baselineRlsId = "0058_app_schema_baseline_receipts_rls_hardening";
const sample = [{ id: "0057_before" }, { id: baselineRlsId }, { id: "0059_after" }];

async function foundationSecurity(sql) {
  const [relation] = await sql`
    SELECT c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS owner,
      (SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND tablename=c.relname) AS policies
    FROM pg_class c WHERE c.oid='public.foundation_question_bindings'::regclass
  `;
  assert.deepEqual(relation, { relrowsecurity: true, relforcerowsecurity: false, owner: "postgres", policies: 0 });
  const privileges = Array.from(await sql`
    SELECT role, privilege, has_table_privilege(role,'public.foundation_question_bindings',privilege) AS allowed
    FROM unnest(ARRAY['anon','authenticated','service_role','postgres']) AS r(role)
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) AS p(privilege)
    ORDER BY role, privilege
  `);
  for (const row of privileges) assert.equal(row.allowed, row.role === "service_role" || row.role === "postgres", `${row.role}:${row.privilege}`);
  const publicAcl = Array.from(await sql`
    SELECT privilege_type FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE c.oid='public.foundation_question_bindings'::regclass AND a.grantee=0
  `);
  assert.equal(publicAcl.length, 0);
  return { relation, privileges, publicAcl, serviceGrantAuthority: "SYNTHETIC_PRE_EXISTING_DEFAULT_ACL" };
}

async function proveFoundationRoleAccess(sql) {
  const rollback = new Error("ROLLBACK_SYNTHETIC_RLS_PROBE");
  await assert.rejects(sql.begin(async tx => {
    await tx.unsafe("INSERT INTO course_groups (id,code,name) VALUES ('synthetic-rls-group','SYNTHETIC_RLS','Synthetic RLS'); INSERT INTO courses (id,course_group_id,code,slug,name,short_name) VALUES ('synthetic-rls-course','synthetic-rls-group','SYNTHETIC_RLS','synthetic-rls','Synthetic RLS','RLS')");
    await tx`INSERT INTO foundation_question_bindings (id,course_id,foundation_binding_key,foundation_version,foundation_question_id,semantic_hash) VALUES ('synthetic-rls-binding','synthetic-rls-course','synthetic-rls','1','synthetic-question',${"d".repeat(64)})`;
    for (const role of ["postgres", "service_role"]) {
      await tx.unsafe(`SET LOCAL ROLE ${role}`);
      assert.equal((await tx`SELECT count(*)::int AS count FROM foundation_question_bindings WHERE id='synthetic-rls-binding'`)[0].count, 1);
      assert.equal((await tx`UPDATE foundation_question_bindings SET lifecycle_state='ACTIVE' WHERE id='synthetic-rls-binding' RETURNING id`).length, 1);
    }
    await tx.unsafe("SET LOCAL ROLE postgres");
    for (const role of ["anon", "authenticated"]) {
      await assert.rejects(tx.savepoint(async probe => {
        await probe.unsafe(`SET LOCAL ROLE ${role}`);
        await probe`SELECT * FROM foundation_question_bindings`;
      }), { code: "42501" });
      // With temporary SELECT privileges, enabled RLS still denies every row.
      await tx.unsafe(`GRANT SELECT ON foundation_question_bindings TO ${role}`);
      await tx.unsafe(`SET LOCAL ROLE ${role}`);
      assert.equal((await tx`SELECT count(*)::int AS count FROM foundation_question_bindings`)[0].count, 0);
      await tx.unsafe("SET LOCAL ROLE postgres");
    }
    throw rollback;
  }), error => error === rollback);
  return { postgresReadWrite: "PASS", serviceRoleReadWrite: "PASS", browserSelectSqlstate: "42501", browserRowsWithTemporarySelectGrant: 0, probeRolledBack: true };
}

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

test("historical ledger proof rejects missing evidence, duplicates, and missing checksums without mutating input", async () => {
  const names = (await readdir("db/postgres/migrations")).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort();
  const migrations = await Promise.all(names.map(async name => ({ id: name.slice(0, -4), sql: await readFile(`db/postgres/migrations/${name}`, "utf8") })));
  const rows = migrations.slice(0, 12).map(m => Object.freeze({ id: m.id, checksum: expectedMigrationChecksum(m) }));
  const validate = (migrationRows, baselineRelationExists = false) => validateHistoricalMigrationLedger(migrations, { migrationRows, baselineRelationExists });
  assert.equal(validate(Object.freeze(rows)), true);
  assert.equal(validate(Object.freeze([rows[0], rows[2], rows[1], ...rows.slice(3)])), true);
  for (const missing of [undefined, null, []]) {
    assert.throws(() => validate(missing), /MIGRATION_GUARD_MIGRATION_LEDGER_INVALID/);
  }
  for (const checksum of [undefined, null, "", "different-registered-identity"]) {
    assert.throws(() => validate([{ ...rows[0], checksum }, ...rows.slice(1)]), /MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH/);
  }
  assert.throws(() => validate([...rows, rows[0]]), /MIGRATION_GUARD_MIGRATION_LEDGER_DUPLICATE/);
  assert.throws(() => validate([{ id: "unregistered_supplementary_receipt", checksum: "unresolved" }, ...rows]), /POSTGRES_HISTORICAL_LEDGER_UNKNOWN_RECEIPT/);
  assert.throws(() => validate([rows[0], rows[3], rows[1], rows[2], ...rows.slice(4)]), /POSTGRES_HISTORICAL_LEDGER_PROGRESSION_ORDER_INVALID/);
  assert.throws(() => validate([rows[1], ...rows.slice(2)]), /POSTGRES_HISTORICAL_LEDGER_PROGRESSION_GAP/);
  const postBoundary = migrations.filter(m => m.id.slice(0, 4) > "0019").map(m => ({ id: m.id, checksum: expectedMigrationChecksum(m) }));
  assert.throws(() => validate(postBoundary, true), /POSTGRES_HISTORICAL_LEDGER_HISTORICAL_RECEIPT_REQUIRED/);
  const complete = migrations.map(m => ({ id: m.id, checksum: expectedMigrationChecksum(m) }));
  const without0058 = complete.filter(row => row.id !== baselineRlsId);
  assert.equal(validate(without0058), true);
  assert.equal(validate(complete, true), true);
  assert.throws(() => validate(without0058, true), /POSTGRES_HISTORICAL_LEDGER_PROGRESSION_GAP/);
  assert.throws(() => validate(complete), /POSTGRES_BASELINE_RLS_RECEIPT_WITHOUT_TABLE/);
  assert.deepEqual(rows.map(row => row.id), migrations.slice(0, 12).map(m => m.id));
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
  function runnerEnvironment(name, command = "deploy") {
    assert.match(name, /^preflight_[a-z_]+$/);
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (/^(DATABASE_URL|DIRECT_URL|POSTGRES_|PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|PGSERVICE|PGOPTIONS)/.test(key)) delete env[key];
    env.POSTGRES_MIGRATION_URL = `postgres://postgres:${password}@127.0.0.1:${port}/${name}`;
    env.POSTGRES_MIGRATION_DISPOSABLE_RECEIPT = owned.receiptPath;
    if (command === "deploy") env.POSTGRES_MIGRATION_APPROVED = "APPLY_REVIEWED_MIGRATIONS";
    return env;
  }
  async function run(name, command = "deploy") {
    const env = runnerEnvironment(name, command);
    try {
      const result = await execFile(process.execPath, ["scripts/postgres-migrations.mjs", command, ...(command === "deploy" ? ["--confirm"] : [])], { env, windowsHide: true, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
      return { code: 0, stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      return { code: typeof error.code === "number" ? error.code : 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
    }
  }
  const completeLedger = async sql => Array.from(await sql.unsafe("SELECT id, checksum, applied_at FROM app_schema_migrations ORDER BY applied_at, id"));
  async function productionLineageFixture(name) {
    const sql = await fixture(name);
    // Construct synthetic timestamps for the exact reviewed receipt order. This
    // is fixture initialization, not production evidence or a deployment repair.
    const numberedOrder = [0, 1, 2, 3, 4, 5, 8, 6, 7, 9, 10, 11].map(index => historical[index].id);
    const seeds = Object.entries(HISTORICAL_SUPPLEMENTARY_RECEIPTS);
    const expected = [];
    let sequence = 0;
    for (let index = 0; index < numberedOrder.length; index++) {
      const id = numberedOrder[index];
      const timestamp = new Date(Date.UTC(2026, 0, 1) + sequence++ * 1000);
      await sql.unsafe("UPDATE app_schema_migrations SET applied_at=$1 WHERE id=$2", [timestamp, id]);
      expected.push(id);
      if (index < seeds.length) {
        const [seedId, checksum] = seeds[index];
        await sql.unsafe("INSERT INTO app_schema_migrations(id,checksum,applied_at) VALUES ($1,$2,$3)", [seedId, checksum, new Date(Date.UTC(2026, 0, 1) + sequence++ * 1000)]);
        expected.push(seedId);
      }
    }
    assert.deepEqual((await completeLedger(sql)).map(row => row.id), expected);
    assert.equal(validateHistoricalMigrationLedger(migrations, { migrationRows: await completeLedger(sql), baselineRelationExists: false }), true);
    return sql;
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

    const invalidLedgers = [
      ["invalid_checksum", "MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH", async sql => {
        await sql`UPDATE app_schema_migrations SET checksum='synthetic-invalid-checksum' WHERE id=${historical[0].id}`;
      }],
      ["ledger_gap", "POSTGRES_HISTORICAL_LEDGER_PROGRESSION_GAP", async sql => {
        await sql`DELETE FROM app_schema_migrations WHERE id=${historical[5].id}`;
      }],
      ["unregistered_receipt", "POSTGRES_HISTORICAL_LEDGER_UNKNOWN_RECEIPT", async sql => {
        await sql`INSERT INTO app_schema_migrations (id,checksum) VALUES ('0000_unregistered_synthetic_receipt','synthetic-not-registered')`;
      }],
      ["gap_and_late_checksum", "MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH", async sql => {
        await sql`DELETE FROM app_schema_migrations WHERE id=${historical[5].id}`;
        await sql`UPDATE app_schema_migrations SET checksum='synthetic-invalid-late-checksum' WHERE id=${pending.find(m => m.id.startsWith("0057_")).id}`;
      }],
      ["duplicate_receipt", "MIGRATION_GUARD_MIGRATION_LEDGER_DUPLICATE", async sql => {
        await sql.unsafe("ALTER TABLE app_schema_migrations DROP CONSTRAINT app_schema_migrations_pkey");
        await sql`INSERT INTO app_schema_migrations (id,checksum,applied_at) SELECT id,checksum,applied_at FROM app_schema_migrations WHERE id=${historical[0].id}`;
      }],
      ["out_of_order", "POSTGRES_HISTORICAL_LEDGER_PROGRESSION_ORDER_INVALID", async sql => {
        await sql`UPDATE app_schema_migrations SET applied_at=(SELECT applied_at FROM app_schema_migrations WHERE id=${pending.find(m => m.id.startsWith("0056_")).id}) - interval '1 microsecond' WHERE id=${pending.find(m => m.id.startsWith("0057_")).id}`;
      }],
    ];
    for (const [name, error, invalidate] of invalidLedgers) {
      await t.test(`historical ledger ${name} rejects both commands before exemption or DDL`, async () => {
        const databaseName = `preflight_${name}`;
        const sql = await fixture(databaseName);
        for (const m of pending.filter(m => m.id.slice(0, 4) < "0058")) await sql.unsafe(m.sql);
        await invalidate(sql);
        const before = Array.from(await sql`SELECT id,checksum,applied_at FROM app_schema_migrations ORDER BY id`);
        const catalog = () => sql`SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v','m') ORDER BY c.relname`;
        const catalogBefore = Array.from(await catalog());
        const status = await run(databaseName, "status");
        const deploy = await run(databaseName);
        const after = Array.from(await sql`SELECT id,checksum,applied_at FROM app_schema_migrations ORDER BY id`);
        evidence.stages[name] = { status, deploy, ledgerBefore: before.length, ledgerAfter: after.length };
        for (const result of [status, deploy]) {
          assert.equal(result.code, 1, result.stdout);
          assert.match(result.stderr, new RegExp(error));
          assert.doesNotMatch(result.stdout, /POSTGRES_MIGRATION_NOT_APPLICABLE|action=EXECUTE/);
        }
        assert.equal(status.stderr.trim(), deploy.stderr.trim());
        assert.deepEqual(after, before, "invalid receipts must not be repaired or normalized");
        assert.deepEqual(Array.from(await catalog()), catalogBefore);
        assert.equal((await sql`SELECT to_regclass('public.app_schema_baseline_receipts') AS relation`)[0].relation, null);
        evidence.stages[name].ledgerAndCatalogUnchanged = true;
      });
    }

    await t.test("literal 0001-0012 replay records the pre-existing 0002 dependency defect", async () => {
      const sql = await database("preflight_literal");
      await sql.unsafe(historical[0].sql);
      await assert.rejects(sql.unsafe(historical[1].sql), { code: "42P01", message: 'relation "public.curriculum_trees" does not exist' });
      await sql.unsafe("ROLLBACK");
      verifyLedger(await ledger(sql), [historical[0]]);
      evidence.stages.literalReplay = { firstFailure: historical[1].id, code: "42P01", ledgerCount: 1 };
      const supported = await run("preflight_literal");
      assert.equal(supported.code, 1);
      assert.match(supported.stderr, /POSTGRES_MIGRATION_DEPLOY_FAILED:42P01/);
      assert.match(supported.stdout, /migration=0002_server_only_rls_lockdown .*action=EXECUTE/);
      verifyLedger(await ledger(sql), [historical[0]]);
      evidence.stages.ascendingBootstrapDisposition = {
        emptyDatabasePath: "VALIDATED_BASELINE_V1", acceptedHistorical0001Prefix: "REACHABLE_RUNNER_FAILURE_42P01",
        gate: "SEPARATE_RELEASE_GATE_HOLD", migrationSqlChanged: false,
      };
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
      const security = await foundationSecurity(sql);
      const roleAccess = await proveFoundationRoleAccess(sql);
      assert.deepEqual(await foundationSecurity(sql), security);
      verifyLedger(await ledger(sql), expected);
      evidence.stages.historicalUpgrade.foundationQuestionBindings = { ...security, roleAccess };
      await sql`UPDATE app_schema_migrations SET checksum='synthetic-invalid-checksum' WHERE id=${historical.at(-1).id}`;
      const mismatch = await run("preflight_historical");
      assert.equal(mismatch.code, 1);
      assert.match(mismatch.stderr, /MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH/);
      assert.doesNotMatch(mismatch.stdout, /action=EXECUTE/);
      evidence.stages.checksumMismatch = { code: mismatch.code, failure: mismatch.stderr.trim(), ddlExecuted: false };
    });

    await t.test("exact production receipt order and six supplementary receipts survive all 30 upgrades and an idempotent run", async () => {
      const sql = await productionLineageFixture("preflight_exact_lineage");
      const original = await completeLedger(sql);
      const status = await run("preflight_exact_lineage", "status");
      assert.equal(status.code, 0, status.stderr);
      assert.equal(status.stdout.match(/POSTGRES_MIGRATIONS_PENDING (.+)/)[1].split(",").length, 30);
      const deployed = await run("preflight_exact_lineage");
      assert.equal(deployed.code, 0, deployed.stderr);
      assert.equal((deployed.stdout.match(/action=EXECUTE/g) ?? []).length, 30);
      assert.deepEqual((await completeLedger(sql)).slice(0, 18), original);
      assert.equal((await completeLedger(sql)).length, 48);
      assert.equal((await sql`SELECT to_regclass('public.app_schema_baseline_receipts') AS relation`)[0].relation, null);
      assert.equal((await sql`SELECT id FROM app_schema_migrations WHERE id=${baselineRlsId}`).length, 0);
      const beforeRepeat = await completeLedger(sql);
      const repeat = await run("preflight_exact_lineage");
      assert.equal(repeat.code, 0, repeat.stderr);
      assert.doesNotMatch(repeat.stdout, /action=EXECUTE/);
      assert.deepEqual(await completeLedger(sql), beforeRepeat);
      evidence.stages.exactProductionLineage = { authority: "SYNTHETIC_SCHEMA_AND_RECEIPTS_IN_REVIEWED_PRODUCTION_ORDER", original, pending: 30, applied: 30, finalLedgerCount: 48, originalReceiptsUnchanged: true, secondRun: "IDEMPOTENT", no0058Receipt: true };
    });

    await t.test("real CLI backend interruption stops before 0014 and resumes only after a fresh ledger and catalog check", async () => {
      const name = "preflight_backend_loss";
      const sql = await productionLineageFixture(name);
      const original = await completeLedger(sql);
      const blocker = connect(name);
      let child;
      let output = "";
      let errors = "";
      let exit;
      try {
        await blocker.unsafe("BEGIN; LOCK TABLE public.question_versions IN ACCESS SHARE MODE");
        child = spawn(process.execPath, ["--unhandled-rejections=strict", "scripts/postgres-migrations.mjs", "deploy", "--confirm"], { env: runnerEnvironment(name), windowsHide: true });
        child.stdout.on("data", chunk => { output += chunk; });
        child.stderr.on("data", chunk => { errors += chunk; });
        const exited = new Promise((resolveExit, reject) => { child.once("error", reject); child.once("exit", (code, signal) => resolveExit({ code, signal })); });
        const timer = setTimeout(() => child.kill(), 20_000);
        try {
          let backend;
          for (let attempt = 0; attempt < 200; attempt++) {
            [backend] = await admin.unsafe("SELECT pid FROM pg_stat_activity WHERE datname=$1 AND application_name='securium-postgres-migrations' AND wait_event_type='Lock'", [name]);
            if (backend) break;
            await new Promise(resolve => setTimeout(resolve, 25));
          }
          assert.ok(backend, "the real 0013 ALTER must reach its deterministic lock barrier");
          assert.equal((await admin.unsafe("SELECT pg_terminate_backend($1,5000) AS terminated", [backend.pid]))[0].terminated, true);
          exit = await exited;
        } finally { clearTimeout(timer); }
      } finally {
        if (child?.exitCode === null) child.kill();
        await blocker.unsafe("ROLLBACK");
        await blocker.end({ timeout: 0 });
      }
      assert.deepEqual(exit, { code: 1, signal: null });
      assert.match(errors, /POSTGRES_MIGRATION_FAILURE reason=(57P01|CONNECTION_CLOSED) original=(57P01|CONNECTION_CLOSED) stage=DDL transaction=VERIFICATION_REQUIRED connection=INVALIDATED/);
      assert.match(errors, /POSTGRES_MIGRATION_VERIFICATION_REQUIRED/);
      assert.doesNotMatch(output + errors, /TypeError|UnhandledPromiseRejection|postgres:\/\/|POSTGRES_MIGRATIONS_DEPLOYED|migration=0014_.*action=EXECUTE/);
      assert.equal((output + errors).includes(password), false);
      const fresh = connect(name);
      assert.deepEqual(await completeLedger(fresh), original);
      assert.equal((await fresh.unsafe("SELECT count(*)::int AS count FROM pg_attribute WHERE attrelid='public.question_versions'::regclass AND attname='semantic_hash' AND NOT attisdropped"))[0].count, 0);
      assert.equal((await fresh`SELECT to_regclass('public.question_concepts') AS relation`)[0].relation, null);
      // Only this verified fresh snapshot authorizes the disposable resume.
      const resumed = await run(name);
      assert.equal(resumed.code, 0, resumed.stderr);
      assert.equal((resumed.stdout.match(/action=EXECUTE/g) ?? []).length, 30);
      assert.deepEqual((await completeLedger(fresh)).slice(0, 18), original);
      assert.equal((await completeLedger(fresh)).length, 48);
      assert.equal((await fresh`SELECT id FROM app_schema_migrations WHERE id=${baselineRlsId}`).length, 0);
      evidence.stages.backendLossResume = { authority: "SYNTHETIC_EXACT_LINEAGE_OWNED_DISPOSABLE", exit, failure: errors.trim(), freshLedgerUnchanged: true, interruptedDdlAbsent: true, subsequentMigrationStarted: false, resumed: "30/30", historicalAndSupplementaryReceiptsUnchanged: true };
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

    await t.test("historical 0058 receipt without its table rejects both commands without changing the ledger", async () => {
      const sql = await fixture("preflight_inconsistent");
      for (const m of pending.filter(m => m.id.slice(0, 4) < "0058")) await sql.unsafe(m.sql);
      // Deliberately inconsistent synthetic evidence; never a real receipt claim.
      await sql`INSERT INTO app_schema_migrations (id,checksum) VALUES (${baselineRlsId},${expectedMigrationChecksum(migrations.find(m => m.id === baselineRlsId))})`;
      const before = await ledger(sql);
      const status = await run("preflight_inconsistent", "status");
      const deploy = await run("preflight_inconsistent");
      for (const result of [status, deploy]) {
        assert.equal(result.code, 1);
        assert.match(result.stderr, /POSTGRES_BASELINE_RLS_RECEIPT_WITHOUT_TABLE/);
        assert.doesNotMatch(result.stdout, /POSTGRES_MIGRATION_NOT_APPLICABLE|action=EXECUTE/);
      }
      assert.equal(status.stderr.trim(), deploy.stderr.trim());
      assert.deepEqual(await ledger(sql), before);
      evidence.stages.inconsistentReceipt = { status, deploy, ledgerUnchanged: true };
    });

    await t.test("an existing historical baseline control table keeps 0058 applicable without any baseline receipt", async () => {
      const sql = await fixture("preflight_existing_table");
      for (const m of pending.filter(m => m.id.slice(0, 4) < "0058")) await sql.unsafe(m.sql);
      const { artifact } = await validateBaselineFiles();
      await sql.unsafe(artifact.match(/CREATE TABLE app_schema_baseline_receipts \([\s\S]+?\n\);/)[0]);
      const status = await run("preflight_existing_table", "status");
      const deploy = await run("preflight_existing_table");
      for (const result of [status, deploy]) {
        assert.equal(result.code, 0, result.stderr);
        assert.doesNotMatch(result.stdout, /POSTGRES_MIGRATION_NOT_APPLICABLE/);
      }
      assert.match(status.stdout, /POSTGRES_MIGRATIONS_PENDING 0058_/);
      assert.match(deploy.stdout, /migration=0058_app_schema_baseline_receipts_rls_hardening .*action=EXECUTE/);
      verifyLedger(await ledger(sql), migrations);
      assert.equal((await sql`SELECT count(*)::int AS count FROM app_schema_baseline_receipts`)[0].count, 0);
      assert.equal((await sql`SELECT relrowsecurity FROM pg_class WHERE oid='public.app_schema_baseline_receipts'::regclass`)[0].relrowsecurity, true);
      evidence.stages.existingBaselineTable = { status, deploy, migration0058Applied: true, baselineReceiptRows: 0 };
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
      const security = await foundationSecurity(sql);
      const roleAccess = await proveFoundationRoleAccess(sql);
      assert.deepEqual(await foundationSecurity(sql), security);
      assert.deepEqual(security, Object.fromEntries(Object.entries(evidence.stages.historicalUpgrade.foundationQuestionBindings).filter(([key]) => key !== "roleAccess")));
      verifyLedger(await ledger(sql), migrations.filter(m => m.id.slice(0, 4) > "0019"));
      evidence.stages.freshBaseline.foundationQuestionBindings = { ...security, roleAccess };
      evidence.stages.freshBaseline.ledger = await ledger(sql);
      evidence.stages.freshBaseline.baselineReceipts = Array.from(receipts);
      // Missing protection must make the live security proof fail; each
      // deliberate mutation rolls back without changing receipts or grants.
      for (const mutation of ["ALTER TABLE foundation_question_bindings DISABLE ROW LEVEL SECURITY", "GRANT SELECT ON foundation_question_bindings TO anon"]) {
        await assert.rejects(sql.begin(async tx => {
          await tx.unsafe(mutation);
          await foundationSecurity(tx);
        }), { name: "AssertionError" });
      }
      assert.deepEqual(await foundationSecurity(sql), security);
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
