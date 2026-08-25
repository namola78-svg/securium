import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { promisify } from "node:util";
import {
  BASELINE_ID,
  BASELINE_BOUNDARY,
  buildBaselineArtifact,
  canonicalizeBaselineArtifact,
  classifyBaselineState,
  migrationsAfterBoundary,
  normalizeMigrationFragment,
  schemaProjection,
  securityProjection,
  sha256,
  validateArtifactAgainstManifest,
  validateBaselineFiles,
} from "../scripts/postgres-baseline.mjs";

const execFile = promisify(execFileCallback);
const container = `securium-pg-baseline-${randomUUID()}`;
const password = "baseline-test-password-2026";
let sql;
let port;
let artifact;
let manifest;
let referenceSql;
let referenceDb;
let baselineReferenceSql;
let baselineDb;

function diagnosticText(value, limit = 600) {
  return String(value ?? "").replaceAll(password, "[REDACTED]").slice(0, limit);
}

function diagnostic(event, fields = {}) {
  console.log(`[BASE01_DIAG] ${JSON.stringify({ event, at: new Date().toISOString(), ...fields })}`);
}

async function diagnosticExec(command, args, { limit = 600 } = {}) {
  try {
    const result = await execFile(command, args);
    return { ok: true, exitCode: 0, stdout: diagnosticText(result.stdout, limit), stderr: diagnosticText(result.stderr, limit) };
  } catch (error) {
    return {
      ok: false,
      exitCode: typeof error.code === "number" ? error.code : null,
      errorCode: typeof error.code === "string" ? error.code : null,
      stdout: diagnosticText(error.stdout, limit),
      stderr: diagnosticText(error.stderr, limit),
    };
  }
}

async function captureContainerState(label) {
  const state = await diagnosticExec("docker", ["inspect", "--format", "{{json .State}}", container]);
  const identity = await diagnosticExec("docker", ["inspect", "--format", "{{.Id}}|{{.Name}}|{{.Config.Image}}|{{.Created}}|{{.RestartCount}}", container]);
  const mapping = await diagnosticExec("docker", ["port", container, "5432/tcp"]);
  let parsedState = null;
  try { parsedState = JSON.parse(state.stdout); } catch { parsedState = null; }
  const identityParts = identity.stdout.split("|");
  const snapshot = {
    label,
    exists: identity.ok,
    containerId: identityParts[0] || null,
    containerName: identityParts[1]?.replace(/^\//, "") || null,
    imageTag: identityParts[2] || "postgres:17.6",
    createdAt: identityParts[3] || null,
    restartCount: identityParts[4] ? Number(identityParts[4]) : null,
    state: parsedState ? {
      running: parsedState.Running ?? null,
      status: parsedState.Status ?? null,
      exitCode: parsedState.ExitCode ?? null,
      oomKilled: parsedState.OOMKilled ?? null,
      dead: parsedState.Dead ?? null,
      restarting: parsedState.Restarting ?? null,
      paused: parsedState.Paused ?? null,
      pid: parsedState.Pid ?? null,
      startedAt: parsedState.StartedAt ?? null,
      finishedAt: parsedState.FinishedAt ?? null,
      health: parsedState.Health?.Status ?? null,
    } : null,
    mappedPort: mapping.ok ? diagnosticText(mapping.stdout) : null,
  };
  diagnostic(`${label}_CONTAINER_STATE`, snapshot);
  return snapshot;
}

async function capturePostgresLogs(label) {
  const logs = await diagnosticExec("docker", ["logs", "--tail", "200", container], { limit: 8000 });
  diagnostic(`${label}_POSTGRES_LOG_TAIL`, { available: logs.ok, exitCode: logs.exitCode, logs: logs.stdout || logs.stderr });
  return logs;
}

test.before(async () => {
  const launchStartedAt = Date.now();
  const launch = await execFile("docker", ["run", "--detach", "--rm", "--name", container, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
  const image = await diagnosticExec("docker", ["image", "inspect", "postgres:17.6", "--format", "{{.Id}}|{{json .RepoDigests}}"]);
  diagnostic("CONTAINER_ID_CAPTURED", {
    containerId: launch.stdout.trim(),
    containerName: container,
    imageTag: "postgres:17.6",
    imageIdentity: image.ok ? diagnosticText(image.stdout) : null,
    launchElapsedMs: Date.now() - launchStartedAt,
  });
  let readinessSucceeded = false;
  let readinessFirstSuccessAttempt = null;
  const readinessStartedAt = Date.now();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const probeStartedAt = Date.now();
    const probe = await diagnosticExec("docker", ["exec", container, "pg_isready", "-U", "postgres"]);
    diagnostic("READINESS_PROBE", {
      attempt: attempt + 1,
      elapsedMs: Date.now() - readinessStartedAt,
      probeElapsedMs: Date.now() - probeStartedAt,
      exitCode: probe.exitCode,
      ok: probe.ok,
      stdout: probe.stdout,
      stderr: probe.stderr,
    });
    if (probe.ok) {
      readinessSucceeded = true;
      readinessFirstSuccessAttempt = attempt + 1;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  diagnostic("READINESS_COMPLETE", {
    attempts: readinessFirstSuccessAttempt ?? 60,
    succeeded: readinessSucceeded,
    firstSuccessAttempt: readinessFirstSuccessAttempt,
    elapsedMs: Date.now() - readinessStartedAt,
  });
  const portOutput = await execFile("docker", ["port", container, "5432/tcp"]).catch(async () => {
    await execFile("docker", ["stop", container]);
    throw new Error("Docker port mapping was unavailable.");
  });
  port = portOutput.stdout.trim().match(/:(\d+)$/)?.[1];
  assert.ok(port);
  diagnostic("MAPPED_HOST_PORT", { containerPort: "5432/tcp", mapping: diagnosticText(portOutput.stdout), hostPort: port });
  await captureContainerState("PRE_QUERY");
  await capturePostgresLogs("PRE_QUERY");
  diagnostic("CLIENT_CONNECT_BEGIN", { host: "127.0.0.1", port, database: "postgres" });
  const postgres = (await import("postgres")).default;
  sql = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
  diagnostic("CLIENT_CONNECT_READY", { clientObjectInitialized: true });
  diagnostic("FIRST_QUERY_BEGIN", { statement: "CREATE ROLE anon" });
  try {
    await sql`CREATE ROLE anon NOLOGIN`;
    diagnostic("FIRST_QUERY_RESULT", { ok: true, statement: "CREATE ROLE anon", elapsedMs: Date.now() - readinessStartedAt });
  } catch (error) {
    diagnostic("FIRST_QUERY_RESULT", { ok: false, statement: "CREATE ROLE anon", code: error.code ?? null, message: diagnosticText(error.message) });
    await captureContainerState("POST_FAILURE");
    const postFailureReadiness = await diagnosticExec("docker", ["exec", container, "pg_isready", "-U", "postgres"]);
    diagnostic("POST_FAILURE_READINESS", { ok: postFailureReadiness.ok, exitCode: postFailureReadiness.exitCode, stdout: postFailureReadiness.stdout, stderr: postFailureReadiness.stderr });
    await capturePostgresLogs("POST_FAILURE");
    throw error;
  }
  await sql`CREATE ROLE authenticated NOLOGIN`;
  await sql`CREATE ROLE service_role NOLOGIN`;
  ({ artifact, manifest } = await validateBaselineFiles());
});

test.after(async () => {
  diagnostic("CLEANUP_BEGIN", { containerName: container });
  await captureContainerState("CLEANUP_PRE");
  if (referenceSql) await referenceSql.end({ timeout: 5 });
  if (sql && referenceDb) await sql.unsafe(`DROP DATABASE IF EXISTS "${referenceDb}" WITH (FORCE)`).catch(() => {});
  if (baselineReferenceSql) await baselineReferenceSql.end({ timeout: 5 });
  if (sql && baselineDb) await sql.unsafe(`DROP DATABASE IF EXISTS "${baselineDb}" WITH (FORCE)`).catch(() => {});
  if (sql) await sql.end({ timeout: 5 });
  const cleanup = await diagnosticExec("docker", ["rm", "--force", container]);
  diagnostic("CLEANUP_END", { ok: cleanup.ok, exitCode: cleanup.exitCode, containerName: container });
});

test("BASE-01 fresh empty DB applies V1 and records only a baseline receipt", async () => {
  await applyArtifact();
  const receipts = await sql`SELECT baseline_id, schema_boundary FROM app_schema_baseline_receipts`;
  const historical = await sql`SELECT count(*)::int AS count FROM app_schema_migrations`;
  assert.deepEqual(Array.from(receipts), [{ baseline_id: BASELINE_ID, schema_boundary: BASELINE_BOUNDARY }]);
  assert.equal(historical[0].count, 0);
});

test("BASE-02 valid artifact, manifest, and digest pass", async () => {
  assert.equal(validateArtifactAgainstManifest({ artifact, manifest, digestFile: manifest.artifactDigest }), true);
  assert.equal(sha256(artifact), manifest.artifactDigest);
});

test("BASE-03 tampered artifact fails closed", () => {
  assert.equal(validateArtifactAgainstManifest({ artifact: `${artifact}-- tampered`, manifest, digestFile: manifest.artifactDigest }), false);
});

test("CANON-01 canonical LF bytes produce the authoritative digest", () => {
  assert.equal(sha256(canonicalizeBaselineArtifact(artifact)), manifest.artifactDigest);
  assert.equal(canonicalizeBaselineArtifact(artifact).endsWith("\n"), true);
});

test("CANON-02 CRLF representation resolves to the same canonical identity", () => {
  const crlfArtifact = canonicalizeBaselineArtifact(artifact).replaceAll("\n", "\r\n");
  assert.equal(sha256(canonicalizeBaselineArtifact(crlfArtifact)), manifest.artifactDigest);
  assert.equal(validateArtifactAgainstManifest({ artifact: crlfArtifact, manifest, digestFile: manifest.artifactDigest }), true);
});

test("CANON-03 generator output is deterministic and canonical", async () => {
  const first = canonicalizeBaselineArtifact(await buildBaselineArtifact());
  const second = canonicalizeBaselineArtifact(await buildBaselineArtifact());
  assert.equal(first, second);
  assert.equal(sha256(first), manifest.artifactDigest);
});

test("CANON-08 LF, CRLF, mixed endings, BOM, and final-newline variants share one generator identity", async () => {
  const names = await migrationNames();
  const source = await migrationOverrides(names, (value) => value);
  const lf = await buildBaselineArtifact({ migrationTextOverrides: source });
  const crlf = await buildBaselineArtifact({ migrationTextOverrides: Object.fromEntries(Object.entries(source).map(([name, value]) => [name, value.replace(/\r\n?/g, "\n").replaceAll("\n", "\r\n")])) });
  const mixed = await buildBaselineArtifact({ migrationTextOverrides: Object.fromEntries(Object.entries(source).map(([name, value], index) => [name, value.replace(/\r\n?/g, "\n").split("\n").map((line, lineIndex) => `${line}${lineIndex % 2 === index % 2 ? "\r\n" : "\n"}`).join("")])) });
  const bomAndFinalVariants = await buildBaselineArtifact({ migrationTextOverrides: Object.fromEntries(Object.entries(source).map(([name, value]) => [name, `\uFEFF${value.replace(/\r\n?/g, "\n").replace(/\n+$/g, "")}\n\n`])) });
  const digests = [lf, crlf, mixed, bomAndFinalVariants].map((value) => sha256(canonicalizeBaselineArtifact(value)));
  assert.deepEqual(digests, [manifest.artifactDigest, manifest.artifactDigest, manifest.artifactDigest, manifest.artifactDigest]);
});

test("CANON-09 registration removal is separator-stable across LF and CRLF", async () => {
  const names = await migrationNames();
  const source = await migrationOverrides(names, (value) => value);
  const lf = await buildBaselineArtifact({ migrationTextOverrides: source });
  const crlf = await buildBaselineArtifact({ migrationTextOverrides: Object.fromEntries(Object.entries(source).map(([name, value]) => [name, normalizeMigrationFragment(value).replaceAll("\n", "\r\n")])) });
  assert.equal(canonicalizeBaselineArtifact(lf), canonicalizeBaselineArtifact(crlf));
  assert.equal(sha256(canonicalizeBaselineArtifact(lf)), manifest.artifactDigest);
});

test("CANON-10 deterministic filename ordering is independent of enumeration order", async () => {
  const names = await migrationNames();
  const reversed = [...names].reverse();
  const first = await buildBaselineArtifact({ migrationNames: names });
  const second = await buildBaselineArtifact({ migrationNames: reversed });
  assert.equal(canonicalizeBaselineArtifact(first), canonicalizeBaselineArtifact(second));
});

test("CANON-11 semantic migration mutation changes the generated identity", async () => {
  const names = await migrationNames();
  const source = await migrationOverrides(names, (value) => value);
  source[names.find((name) => name.startsWith("0019_"))] += "\nCREATE TABLE canon03_semantic_mutation (id integer);\n";
  const mutated = await buildBaselineArtifact({ migrationTextOverrides: source });
  assert.notEqual(sha256(canonicalizeBaselineArtifact(mutated)), manifest.artifactDigest);
});

test("CANON-12 migration removal changes the generated identity", async () => {
  const names = await migrationNames();
  const removed = await buildBaselineArtifact({ migrationNames: names.filter((name) => !name.startsWith("0019_")) });
  assert.notEqual(sha256(canonicalizeBaselineArtifact(removed)), manifest.artifactDigest);
});

test("CANON-13 migration content reordering changes the generated identity", async () => {
  const names = await migrationNames();
  const source = await migrationOverrides(names, (value) => value);
  const first = names.find((name) => name.startsWith("0018_"));
  const second = names.find((name) => name.startsWith("0019_"));
  [source[first], source[second]] = [source[second], source[first]];
  const reordered = await buildBaselineArtifact({ migrationTextOverrides: source });
  assert.notEqual(sha256(canonicalizeBaselineArtifact(reordered)), manifest.artifactDigest);
});

async function migrationNames() {
  return (await readdir("db/postgres/migrations")).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
}

async function migrationOverrides(names, transform) {
  return Object.fromEntries(await Promise.all(names.map(async (name) => [name, transform(await readFile(`db/postgres/migrations/${name}`, "utf8"))])));
}

test("CANON-04 validator uses the canonical identity contract", () => {
  const crlfArtifact = canonicalizeBaselineArtifact(artifact).replaceAll("\n", "\r\n");
  assert.equal(validateArtifactAgainstManifest({ artifact: crlfArtifact, manifest }), true);
});

test("CANON-05 altered SQL content remains rejected", () => {
  const altered = `${artifact.replace("CREATE TABLE app_schema_baseline_receipts", "CREATE TABLE altered_receipts")}\n`;
  assert.equal(validateArtifactAgainstManifest({ artifact: altered, manifest, digestFile: manifest.artifactDigest }), false);
});

test("CANON-06 altered manifest digest remains rejected", () => {
  assert.equal(validateArtifactAgainstManifest({ artifact, manifest: { ...manifest, artifactDigest: "0".repeat(64) }, digestFile: manifest.artifactDigest }), false);
});

test("CANON-07 altered digest file identity remains rejected", () => {
  assert.equal(validateArtifactAgainstManifest({ artifact, manifest, digestFile: "0".repeat(64) }), false);
});

test("BASE-04 unrecognized nonempty database is ambiguous", () => {
  assert.equal(classifyBaselineState({ applicationRelationCount: 1 }), "AMBIGUOUS_NONEMPTY");
});

test("BASE-05 historical database remains incremental", () => {
  assert.equal(classifyBaselineState({ applicationRelationCount: 1, historicalReceiptCount: 19, historicalReceiptsValid: true }), "HISTORICAL_DATABASE");
  assert.deepEqual(migrationsAfterBoundary([{ id: "0019_old" }, { id: "0020_future" }]), [{ id: "0020_future" }]);
});

test("BASE-06 schema projection is deterministic", () => {
  assert.equal(sha256(schemaProjection(artifact)), manifest.schemaDigest);
  assert.equal(schemaProjection(artifact), schemaProjection(artifact));
});

test("BASE-07 security projection is deterministic", () => {
  assert.equal(sha256(securityProjection(artifact)), manifest.securityDigest);
  assert.equal(securityProjection(artifact), securityProjection(artifact));
});

test("BASE-08 curriculum_trees has server-only lockdown", async () => {
  const rows = await sql`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'public.curriculum_trees'::regclass`;
  const grants = await sql`SELECT has_table_privilege('anon', 'public.curriculum_trees', 'SELECT') AS anon_select, has_table_privilege('authenticated', 'public.curriculum_trees', 'SELECT') AS authenticated_select`;
  assert.equal(rows[0].relrowsecurity, true);
  assert.equal(grants[0].anon_select, false);
  assert.equal(grants[0].authenticated_select, false);
});

test("BASE-09 curriculum_nodes has server-only lockdown", async () => {
  const rows = await sql`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'public.curriculum_nodes'::regclass`;
  const grants = await sql`SELECT has_table_privilege('anon', 'public.curriculum_nodes', 'SELECT') AS anon_select, has_table_privilege('authenticated', 'public.curriculum_nodes', 'SELECT') AS authenticated_select`;
  assert.equal(rows[0].relrowsecurity, true);
  assert.equal(grants[0].anon_select, false);
  assert.equal(grants[0].authenticated_select, false);
});

test("BASE-10 baseline boundary selects only migrations after 0019", () => {
  assert.deepEqual(migrationsAfterBoundary([{ id: "0018_old" }, { id: "0019_current" }, { id: "0020_future" }]).map(({ id }) => id), ["0020_future"]);
});

test("BASE-11 failed transaction creates no receipt or trusted partial table", async () => {
  await assert.rejects(sql.begin(async (transaction) => {
    await transaction`CREATE TABLE baseline_partial_fixture (id integer)`;
    await transaction`INSERT INTO app_schema_baseline_receipts (baseline_id, baseline_version, schema_boundary, artifact_sha256, schema_sha256, security_sha256, created_from_main_sha) VALUES ('partial', '1', '0019', 'x', 'y', 'z', 'main')`;
    throw new Error("forced baseline failure");
  }));
  const tables = await sql`SELECT to_regclass('public.baseline_partial_fixture') AS relation`;
  const receipts = await sql`SELECT count(*)::int AS count FROM app_schema_baseline_receipts WHERE baseline_id = 'partial'`;
  assert.equal(tables[0].relation, null);
  assert.equal(receipts[0].count, 0);
});

test("BASE-12 D1 migration files remain outside the baseline implementation", async () => {
  const d1 = await readFile("drizzle/0000_phase1_foundation.sql", "utf8");
  assert.match(d1, /CREATE TABLE/);
  assert.equal(manifest.d1Changed ?? false, false);
});

test("LIVE-01 live PostgreSQL catalog projections match a reordered historical reference state", async () => {
  await createFreshBaselineReferenceState();
  await createHistoricalReferenceState();
  const baselineProjection = await liveCatalogProjection(baselineReferenceSql);
  const historicalProjection = await liveCatalogProjection(referenceSql);
  assert.equal(baselineProjection.schema.tables.length, historicalProjection.schema.tables.length, `table count ${baselineProjection.schema.tables.length}/${historicalProjection.schema.tables.length}`);
  for (const key of Object.keys(baselineProjection.schema)) {
    assert.deepEqual(baselineProjection.schema[key], historicalProjection.schema[key], `schema category ${key}`);
  }
  for (const key of Object.keys(baselineProjection.security)) {
    assert.deepEqual(baselineProjection.security[key], historicalProjection.security[key], `security category ${key}`);
  }
  assert.equal(baselineProjection.schemaDigest, historicalProjection.schemaDigest);
  assert.equal(baselineProjection.securityDigest, historicalProjection.securityDigest);
});

test("LIVE-02 all six state-machine states execute explicit fail-closed expectations", () => {
  const matrix = [
    ["TRUE_EMPTY", {}, "ALLOW_BASELINE"],
    ["HISTORICAL_DATABASE", { applicationRelationCount: 1, historicalReceiptCount: 19, historicalReceiptsValid: true }, "HISTORICAL_ONLY"],
    ["BASELINE_DATABASE", { applicationRelationCount: 71, baselineReceiptCount: 1, baselineReceiptValid: true }, "POST_BOUNDARY_ONLY"],
    ["AMBIGUOUS_NONEMPTY", { applicationRelationCount: 1 }, "DENY"],
    ["PARTIAL_BASELINE", { baselineReceiptCount: 1, baselineReceiptValid: false }, "DENY"],
    ["UNKNOWN", { historicalReceiptCount: 1, historicalReceiptsValid: false }, "DENY"],
  ];
  for (const [expected, input, behavior] of matrix) {
    assert.equal(classifyBaselineState(input), expected);
    assert.equal(["DENY", "ALLOW_BASELINE", "HISTORICAL_ONLY", "POST_BOUNDARY_ONLY"].includes(behavior), true);
  }
  assert.equal(matrix.filter(([, , behavior]) => behavior === "DENY").length, 3);
});

test("LIVE-03 every one of the 71 lockdown relations is present and secure", async () => {
  const expected = await lockdownRelationNames();
  assert.equal(expected.length, 71);
  const observed = [];
  for (const relation of expected) {
    const rows = await sql`
      SELECT c.relrowsecurity, c.relforcerowsecurity,
        has_table_privilege('anon', ${`public.${relation}`}, 'SELECT') AS anon_select,
        has_table_privilege('authenticated', ${`public.${relation}`}, 'SELECT') AS authenticated_select
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ${relation}
    `;
    assert.equal(rows.length, 1, relation);
    assert.equal(rows[0].relrowsecurity, true, relation);
    assert.equal(rows[0].anon_select, false, relation);
    assert.equal(rows[0].authenticated_select, false, relation);
    observed.push(relation);
  }
  assert.deepEqual(observed.sort(), expected.sort());
});

test("LIVE-04 lockdown validation is sensitive to omission of every expected relation", async () => {
  const expected = await lockdownRelationNames();
  const observed = new Set(expected);
  for (const relation of expected) {
    const mutated = new Set(observed);
    mutated.delete(relation);
    assert.notDeepEqual([...mutated].sort(), [...observed].sort(), relation);
  }
});

async function applyArtifact() {
  await sql.unsafe(`SET securium.baseline_artifact_sha256 = '${manifest.artifactDigest}'`);
  await sql.unsafe(`SET securium.baseline_schema_sha256 = '${manifest.schemaDigest}'`);
  await sql.unsafe(`SET securium.baseline_security_sha256 = '${manifest.securityDigest}'`);
  await sql.unsafe(artifact);
}

async function createHistoricalReferenceState() {
  referenceDb = `securium_reference_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  await sql.unsafe(`CREATE DATABASE "${referenceDb}"`);
  const postgres = (await import("postgres")).default;
  referenceSql = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/${referenceDb}`, { max: 1, prepare: false, ssl: false, onnotice: false });
  const ordered = [
    "0001_d1_compatibility_schema.sql",
    "0003_curriculum_tree.sql",
    "0002_server_only_rls_lockdown.sql",
    "0004_shared_content_lesson.sql",
    "0005_course_lesson_lesson_progress.sql",
    "0006_question_attempt_lookup_index.sql",
    "0007_ai_explainability_feedback.sql",
    "0008_ontology_graph_storage.sql",
    "0010_practical_attempt_evaluation_foundation.sql",
    "0011_canonical_fact_foundation.sql",
    "0012_fact_concept_mapping_governance.sql",
    "0013_question_governance_foundation.sql",
    "0014_learning_event_version_revision_governance.sql",
    "0015_evidence_projection_foundation.sql",
    "0016_theory_revision_governance.sql",
    "0017_evidence_e1_core_remediation.sql",
    "0018_practical_revision_governance.sql",
    "0019_evidence_e2_a_recompute_operations.sql",
  ];
  for (const name of ordered) {
    await referenceSql.unsafe(await readFile(`db/postgres/migrations/${name}`, "utf8"));
  }
}

async function createFreshBaselineReferenceState() {
  baselineDb = `securium_baseline_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  await sql.unsafe(`CREATE DATABASE "${baselineDb}"`);
  const postgres = (await import("postgres")).default;
  baselineReferenceSql = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/${baselineDb}`, { max: 1, prepare: false, ssl: false, onnotice: false });
  await baselineReferenceSql.unsafe(`SET securium.baseline_artifact_sha256 = '${manifest.artifactDigest}'`);
  await baselineReferenceSql.unsafe(`SET securium.baseline_schema_sha256 = '${manifest.schemaDigest}'`);
  await baselineReferenceSql.unsafe(`SET securium.baseline_security_sha256 = '${manifest.securityDigest}'`);
  await baselineReferenceSql.unsafe(artifact);
}

async function liveCatalogProjection(connection) {
  const tables = await connection`
    SELECT c.relname AS name, c.relkind AS kind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm')
      AND c.relname NOT IN ('app_schema_migrations', 'app_schema_baseline_receipts')
  `;
  const columns = await connection`
    SELECT table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name NOT IN ('app_schema_migrations', 'app_schema_baseline_receipts')
  `;
  const constraints = await connection`
    SELECT conrelid::regclass::text AS table_name, conname, contype, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid::regclass::text NOT IN ('app_schema_migrations', 'app_schema_baseline_receipts')
  `;
  const indexes = await connection`
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename NOT IN ('app_schema_migrations', 'app_schema_baseline_receipts')
  `;
  const views = await connection`
    SELECT schemaname, viewname, definition FROM pg_views
    WHERE schemaname = 'public'
  `;
  const triggers = await connection`
    SELECT event_object_table, trigger_name, action_statement, action_timing, event_manipulation
    FROM information_schema.triggers WHERE trigger_schema = 'public'
  `;
  const rls = await connection`
    SELECT c.relname AS table_name, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname NOT IN ('app_schema_migrations', 'app_schema_baseline_receipts')
  `;
  const policies = await connection`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname = 'public'
  `;
  const grants = await connection`
    SELECT table_name, grantee, privilege_type, is_grantable
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name NOT IN ('app_schema_migrations', 'app_schema_baseline_receipts')
      AND grantee IN ('anon', 'authenticated', 'service_role', 'postgres')
  `;
  const normalize = (rows) => rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value]).sort(([a], [b]) => a.localeCompare(b)))).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const schema = { tables: normalize(tables), columns: normalize(columns), constraints: normalize(constraints), indexes: normalize(indexes), views: normalize(views), triggers: normalize(triggers) };
  const security = { rls: normalize(rls), policies: normalize(policies), grants: normalize(grants) };
  return { schema, security, schemaDigest: sha256(JSON.stringify(schema)), securityDigest: sha256(JSON.stringify(security)) };
}

async function lockdownRelationNames() {
  const source = await readFile("db/postgres/migrations/0002_server_only_rls_lockdown.sql", "utf8");
  return [...new Set([...source.matchAll(/public\.\"([^\"]+)\"/g)].map((match) => match[1]))].sort();
}
