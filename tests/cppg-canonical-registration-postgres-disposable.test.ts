import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import postgres from "postgres";
import type { PostgresExecutor, PostgresQueryValue, PostgresTransactionExecutor } from "../db/provider/postgres-database-provider.ts";
import { PostgresRuntimeAuthorityPersistence } from "../db/runtime-authority-postgres-persistence.ts";
import {
  buildCppgCourseTheoryDraftProjectionFromBundle,
  classifyCppgRuntimeCollision,
  evaluateCppgProjectionAuthorityForTesting,
  expectedCppgRuntimeState,
  persistCppgCourseTheoryDraftProjectionForTesting,
  type CppgFoundationBundle,
} from "../lib/services/cppg-runtime-course-registration.ts";
import { PostgresCppgDraftPersistenceAdapter } from "../db/cppg-runtime-postgres-registration.ts";
import { cleanupOwnedPostgresContainer, createOwnedPostgresContainer, getPublishedPostgresPort } from "../scripts/owned-postgres-container.mjs";

const password = "cppg-canonical-registration-test-password";
const ownerToken = randomUUID();
(process.env as unknown as { NODE_ENV?: string }).NODE_ENV = "test";
let container: Awaited<ReturnType<typeof createOwnedPostgresContainer>> | undefined;
let sql: ReturnType<typeof postgres> | undefined;
let executor: PostgresExecutor;
let owner: PostgresRuntimeAuthorityPersistence;

before(async () => {
  container = await createOwnedPostgresContainer({ name: `securium-cppg-registration-${ownerToken}`, ownerToken, password, receiptPath: null });
  const port = await getPublishedPostgresPort(container);
  sql = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 4, prepare: false, ssl: false });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await sql`SELECT 1`; break; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  await sql.unsafe(`CREATE ROLE anon`);
  await sql.unsafe(`CREATE ROLE authenticated`);
  await sql.unsafe(`CREATE TABLE app_schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  await applyMigration(requireSql(), await readFile("db/postgres/migrations/0053_runtime_authority_postgres_persistence.sql", "utf8"));
  await createProjectionTables(requireSql());
  await applyMigration(requireSql(), await readFile("db/postgres/migrations/0054_cppg_canonical_registration.sql", "utf8"));
  executor = createExecutor(requireSql());
  owner = new PostgresRuntimeAuthorityPersistence(executor);
});

after(async () => {
  await executor?.close?.().catch(() => {});
  await sql?.end({ timeout: 1 }).catch(() => {});
  if (container) await cleanupOwnedPostgresContainer(container);
});

test("PostgreSQL CPPG registration is authority-locked, canonical, unpublished, and idempotent", async () => {
  const bundle = await readBundle();
  const actorUserId = "cppg-registration-test-actor";
  await requireSql().unsafe(`INSERT INTO public.users(id) VALUES ($1)`, [actorUserId]);
  await requireSql().unsafe(`INSERT INTO public.course_groups(id) VALUES ('group-independent')`);
  const projection = await buildCppgCourseTheoryDraftProjectionFromBundle(bundle, { actorUserId });
  let authority = await evaluateCppgProjectionAuthorityForTesting(projection, owner);
  assert.equal(authority.state.state, "NOT_CURRENT");
  await authority.approve(`cppg-pg-approval-${ownerToken}`);

  // A published legacy course row is not a canonical CPPG registration.
  await requireSql().unsafe(`INSERT INTO public.courses(id,course_group_id,code,slug,name,short_name,active,published) VALUES ('course-cppg','group-independent','CPPG','cppg','legacy','CPPG',1,1)`);
  await assert.rejects(() => persistCppgCourseTheoryDraftProjectionForTesting(projection, actorUserId, owner), (error: unknown) => (error as { collisionState?: string }).collisionState === "REGISTERED_CONFLICTING");
  const legacy = await requireSql().unsafe(`SELECT active,published FROM public.courses WHERE id='course-cppg'`);
  assert.equal(legacy[0]?.active, 1);
  assert.equal(legacy[0]?.published, 1);
  assert.equal(Number((await requireSql().unsafe(`SELECT count(*)::int AS count FROM public.cppg_runtime_registrations`))[0]?.count), 0);
  await requireSql().unsafe(`DELETE FROM public.courses WHERE id='course-cppg'`);

  await authority.revoke(`cppg-pg-pre-registration-revoke-${ownerToken}`, "revoke before registration");
  await assert.rejects(() => persistCppgCourseTheoryDraftProjectionForTesting(projection, actorUserId, owner));
  assert.equal(Number((await requireSql().unsafe(`SELECT count(*)::int AS count FROM public.cppg_runtime_registrations`))[0]?.count), 0);

  await requireSql().unsafe(`TRUNCATE public.runtime_authority_events, public.runtime_authority_roots`);
  const predecessor = await evaluateCppgProjectionAuthorityForTesting(projection, owner);
  await predecessor.approve(`cppg-pg-predecessor-${ownerToken}`);
  const changedUnit = bundle.theory.units[0];
  assert.ok(changedUnit);
  const successorProjection = await buildCppgCourseTheoryDraftProjectionFromBundle({
    ...bundle,
    theory: { ...bundle.theory, units: [{ ...changedUnit, purpose: `${changedUnit.purpose} approved successor test` }, ...bundle.theory.units.slice(1)] },
  }, { actorUserId });
  const successor = await evaluateCppgProjectionAuthorityForTesting(successorProjection, owner);
  await successor.approve(`cppg-pg-successor-${ownerToken}`);
  await successor.supersede(predecessor.identity.authorityId, `cppg-pg-supersede-${ownerToken}`);
  await assert.rejects(() => persistCppgCourseTheoryDraftProjectionForTesting(projection, actorUserId, owner));
  assert.equal(Number((await requireSql().unsafe(`SELECT count(*)::int AS count FROM public.cppg_runtime_registrations`))[0]?.count), 0);

  await requireSql().unsafe(`TRUNCATE public.runtime_authority_events, public.runtime_authority_roots`);
  authority = await evaluateCppgProjectionAuthorityForTesting(projection, owner);
  await authority.approve(`cppg-pg-approval-current-${ownerToken}`);

  const first = await persistCppgCourseTheoryDraftProjectionForTesting(projection, actorUserId, owner);
  assert.equal(first.outcome, "NEW_SUCCESS");
  const exactReplay = await persistCppgCourseTheoryDraftProjectionForTesting(projection, actorUserId, owner);
  assert.equal(exactReplay.outcome, "EXACT_REPLAY");

  const changedUnitForConflict = bundle.theory.units[0];
  assert.ok(changedUnitForConflict);
  const conflictingProjection = await buildCppgCourseTheoryDraftProjectionFromBundle({
    ...bundle,
    theory: { ...bundle.theory, units: [{ ...changedUnitForConflict, purpose: `${changedUnitForConflict.purpose} conflicting replay` }, ...bundle.theory.units.slice(1)] },
  }, { actorUserId });
  const conflictingAuthority = await evaluateCppgProjectionAuthorityForTesting(conflictingProjection, owner);
  const conflictingAdapter = new PostgresCppgDraftPersistenceAdapter(executor, {
    identity: conflictingAuthority.identity,
    currentness: { state: "CURRENT", authorityId: conflictingAuthority.identity.authorityId, approvalSubjectHash: conflictingAuthority.identity.approvalSubjectHash, authoritySequence: 1 },
    projection: conflictingProjection,
    registeredBy: actorUserId,
  });
  const conflictingReadback = await conflictingAdapter.inspect({ courseId: conflictingProjection.courseId, recordIds: expectedCppgRuntimeState(conflictingProjection).recordIds });
  assert.equal(classifyCppgRuntimeCollision(expectedCppgRuntimeState(conflictingProjection), conflictingReadback), "REGISTERED_CONFLICTING");

  let releaseProjectionWrite!: () => void;
  let signalCurrentnessLock!: () => void;
  const waitToReleaseProjectionWrite = new Promise<void>((resolve) => { releaseProjectionWrite = resolve; });
  const currentnessLockHeld = new Promise<void>((resolve) => { signalCurrentnessLock = resolve; });
  const gatedOwner = new PostgresRuntimeAuthorityPersistence({
    query: (statement, parameters) => executor.query(statement, parameters),
    transaction: async <T>(callback: (connection: PostgresTransactionExecutor) => Promise<T>) => executor.transaction(async (connection) => callback({
      query: async <Row extends Record<string, unknown>>(statement: string, parameters: readonly PostgresQueryValue[]) => {
        if (statement.includes('FROM public."cppg_runtime_projection_records"')) {
          signalCurrentnessLock();
          await waitToReleaseProjectionWrite;
        }
        return connection.query<Row>(statement, parameters);
      },
    })),
  });
  const replayDuringRevocationAttempt = persistCppgCourseTheoryDraftProjectionForTesting(projection, actorUserId, gatedOwner);
  await currentnessLockHeld;
  let revocationSettled = false;
  const pendingRevocation = authority.revoke(`cppg-pg-revoke-${ownerToken}`, "racing registration").finally(() => { revocationSettled = true; });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(revocationSettled, false, "revocation must wait for the registration transaction's authority lock");
  releaseProjectionWrite();
  assert.equal((await replayDuringRevocationAttempt).outcome, "EXACT_REPLAY");
  await pendingRevocation;
  assert.equal(revocationSettled, true);
  await assert.rejects(() => persistCppgCourseTheoryDraftProjectionForTesting(projection, actorUserId, owner));
  const registration = await requireSql().unsafe(`SELECT course_id,course_slug,package_key,runtime_revision_id,content_revision_ids,source_manifest_id,source_package_hash,foundation_id,foundation_hash,approval_subject_hash,authority_id,authority_sequence,state,publication_authority FROM public.cppg_runtime_registrations`);
  assert.equal(registration.length, 1);
  assert.equal(registration[0]?.course_id, "course-cppg");
  assert.equal(registration[0]?.course_slug, "cppg");
  assert.equal(registration[0]?.package_key, "course-cppg:foundation:v1");
  const revisionIds = registration[0]?.content_revision_ids as string[];
  assert.equal(Array.isArray(revisionIds), true);
  assert.equal(revisionIds.length, 25);
  assert.equal(revisionIds.includes(`${"course-cppg"}:revision:S1-U01:v1`), true);
  assert.equal(registration[0]?.approval_subject_hash, authority.identity.approvalSubjectHash);
  assert.equal(registration[0]?.authority_id, authority.identity.authorityId);
  assert.equal(registration[0]?.authority_sequence, 1);
  assert.equal(registration[0]?.state, "REGISTERED_UNPUBLISHED");
  assert.equal(registration[0]?.publication_authority, "NOT_GRANTED");
  assert.equal(Number((await requireSql().unsafe(`SELECT count(*)::int AS count FROM public.cppg_runtime_projection_records`))[0]?.count), 187);
  const course = await requireSql().unsafe(`SELECT active,published FROM public.courses WHERE id='course-cppg'`);
  assert.equal(course[0]?.active, 0);
  assert.equal(course[0]?.published, 0);

  await assert.rejects(() => persistCppgCourseTheoryDraftProjectionForTesting(projection, actorUserId, owner));
  const historical = await requireSql().unsafe(`SELECT state,publication_authority FROM public.cppg_runtime_registrations`);
  assert.equal(historical[0]?.state, "REGISTERED_UNPUBLISHED");
  assert.equal(historical[0]?.publication_authority, "NOT_GRANTED");
});

async function readBundle(): Promise<CppgFoundationBundle> {
  const root = new URL("../content-drafts/securium-cppg-foundation/", import.meta.url);
  const read = async (name: string) => JSON.parse(await readFile(new URL(name, root), "utf8")) as unknown;
  return {
    curriculum: await read("curriculum-authority.json") as CppgFoundationBundle["curriculum"],
    theory: await read("theory-authority.json") as CppgFoundationBundle["theory"],
    objectives: await read("objective-authority.json") as CppgFoundationBundle["objectives"],
    assessment: await read("assessment-authority.json") as CppgFoundationBundle["assessment"],
    practical: await read("practical-spec-authority.json") as CppgFoundationBundle["practical"],
    dryRun: await read("ontology-concept-dry-run.json") as CppgFoundationBundle["dryRun"],
    provenanceRights: await read("provenance-rights-manifest.json") as CppgFoundationBundle["provenanceRights"],
  };
}

function requireSql(): NonNullable<typeof sql> { if (!sql) throw new Error("TEST_POSTGRES_CLIENT_UNAVAILABLE"); return sql; }

async function applyMigration(client: NonNullable<typeof sql>, source: string): Promise<void> {
  const statements = source.replace(/^\s*(?:--[^\r\n]*\r?\n\s*)*BEGIN\s*;/iu, "").replace(/COMMIT\s*;\s*$/iu, "");
  await client.begin(async (transaction) => { await transaction.unsafe(statements); });
}

async function createProjectionTables(client: NonNullable<typeof sql>) {
  const ddl = [
    `CREATE TABLE users(id text PRIMARY KEY)`,
    `CREATE TABLE course_groups(id text PRIMARY KEY)`,
    `CREATE TABLE courses(id text PRIMARY KEY,course_group_id text NOT NULL,code text NOT NULL,slug text NOT NULL,name text NOT NULL,short_name text NOT NULL,description text NOT NULL DEFAULT '',total_levels integer NOT NULL DEFAULT 1,passing_score integer NOT NULL DEFAULT 60,difficulty text NOT NULL DEFAULT 'BEGINNER',active integer NOT NULL DEFAULT 1,published integer NOT NULL DEFAULT 0,display_order integer NOT NULL DEFAULT 0,is_sample integer NOT NULL DEFAULT 0,UNIQUE(code),UNIQUE(slug))`,
    `CREATE TABLE curriculum_trees(id text PRIMARY KEY,course_id text NOT NULL,title text NOT NULL,version text NOT NULL,source_type text,source_document text,status text NOT NULL)`,
    `CREATE TABLE subjects(id text PRIMARY KEY,course_id text NOT NULL,code text NOT NULL,name text NOT NULL,description text NOT NULL,display_order integer NOT NULL,active integer NOT NULL,is_sample integer NOT NULL)`,
    `CREATE TABLE curriculum_nodes(id text PRIMARY KEY,curriculum_tree_id text NOT NULL,parent_id text,node_type text NOT NULL,title text NOT NULL,description text NOT NULL,official_code text,official_title text,sort_order integer NOT NULL,depth integer NOT NULL,path text,is_required integer NOT NULL,is_practical integer NOT NULL,metadata text,status text NOT NULL)`,
    `CREATE TABLE topics(id text PRIMARY KEY,subject_id text NOT NULL,code text NOT NULL,name text NOT NULL,description text NOT NULL,display_order integer NOT NULL,active integer NOT NULL,is_sample integer NOT NULL)`,
    `CREATE TABLE learning_units(id text PRIMARY KEY,course_id text NOT NULL,subject_id text NOT NULL,topic_id text,code text NOT NULL,title text NOT NULL,description text NOT NULL,display_order integer NOT NULL,active integer NOT NULL,published integer NOT NULL,completion_policy text NOT NULL,minimum_progress_percent integer NOT NULL,minimum_study_seconds integer NOT NULL,is_sample integer NOT NULL)`,
    `CREATE TABLE contents(id text PRIMARY KEY,slug text NOT NULL,canonical_key text NOT NULL,title text NOT NULL,summary text NOT NULL,body text NOT NULL,body_format text NOT NULL,learning_objectives_json text NOT NULL,core_concepts_json text NOT NULL,practical_examples_json text NOT NULL,diagrams_json text NOT NULL,media_json text NOT NULL,version text NOT NULL,status text NOT NULL,created_by text)`,
    `CREATE TABLE lessons(id text PRIMARY KEY,learning_unit_id text,course_id text NOT NULL,subject_id text NOT NULL,topic_id text NOT NULL,code text NOT NULL,title text NOT NULL,summary text NOT NULL,content text NOT NULL,content_format text NOT NULL,estimated_minutes integer NOT NULL,display_order integer NOT NULL,active integer NOT NULL,published integer NOT NULL,is_sample integer NOT NULL,version integer NOT NULL)`,
    `CREATE TABLE course_lessons(id text PRIMARY KEY,course_id text NOT NULL,curriculum_node_id text,content_id text NOT NULL,lesson_id text,display_title text NOT NULL,sort_order integer NOT NULL,estimated_minutes integer NOT NULL,is_required integer NOT NULL,completion_rule text NOT NULL,status text NOT NULL)`,
    `CREATE TABLE content_revisions(id text PRIMARY KEY,content_type text NOT NULL,content_id text NOT NULL,course_id text,title text NOT NULL,content_date text NOT NULL,version text NOT NULL,revision_status text NOT NULL,snapshot_json text NOT NULL,change_summary text NOT NULL,is_latest integer NOT NULL,created_by text NOT NULL,semantic_hash text)`,
  ];
  for (const statement of ddl) await client.unsafe(statement);
}

function createExecutor(client: NonNullable<typeof sql>): PostgresExecutor {
  const query = async <Row extends Record<string, unknown>>(connection: { unsafe: (statement: string, parameters?: readonly unknown[]) => PromiseLike<(Row[] & { count?: number | null })> }, statement: string, parameters: readonly PostgresQueryValue[]) => {
    const rows = await connection.unsafe(statement, parameters);
    return { rows: Array.from(rows), rowCount: rows.count ?? rows.length };
  };
  return {
    query: <Row extends Record<string, unknown>>(statement: string, parameters: readonly PostgresQueryValue[]) => query<Row>(client as never, statement, parameters),
    async transaction<T>(callback: (executor: PostgresTransactionExecutor) => Promise<T>) {
      let value!: T;
      await client.begin(async (transaction) => {
        value = await callback({ query: <Row extends Record<string, unknown>>(statement: string, parameters: readonly PostgresQueryValue[]) => query<Row>(transaction as never, statement, parameters) });
      });
      return value;
    },
  };
}
