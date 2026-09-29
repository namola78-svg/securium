import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import postgres from "postgres";
import type { PostgresExecutor, PostgresQueryValue, PostgresTransactionExecutor } from "../db/provider/postgres-database-provider.ts";
import { PostgresRuntimeAuthorityPersistence } from "../db/runtime-authority-postgres-persistence.ts";
import {
  buildCppgCourseTheoryDraftProjectionFromBundle,
  evaluateCppgProjectionAuthorityForTesting,
  persistCppgCourseTheoryDraftProjectionForTesting,
  type CppgFoundationBundle,
  type CppgCourseTheoryDraftProjection,
} from "../lib/services/cppg-runtime-course-registration.ts";
import { authorizeAndPublishCppgRegistrationForTesting } from "../lib/services/cppg-runtime-publication.ts";
import { getCppgPublicationEffectiveState, type CppgPublicationRevocationInput } from "../lib/services/cppg-runtime-publication-revocation.ts";
import { revokeCppgPublicationForTesting } from "./cppg-publication-revocation-test-support.ts";
import { cleanupOwnedPostgresContainer, createOwnedPostgresContainer, getPublishedPostgresPort } from "../scripts/owned-postgres-container.mjs";

const ownerToken = randomUUID();
const password = "cppg-atomic-publication-disposable-test-password";
const actorId = "cppg-publication-test-actor";
const actor = { id: actorId, roles: ["COURSE_MANAGER"] } as const;
(process.env as unknown as { NODE_ENV?: string }).NODE_ENV = "test";
type Scenario = { databaseName: string; sql: ReturnType<typeof postgres>; executor: PostgresExecutor; owner: PostgresRuntimeAuthorityPersistence };
let container: Awaited<ReturnType<typeof createOwnedPostgresContainer>> | undefined;
let port: number | string;
let adminSql: ReturnType<typeof postgres> | undefined;
let scenarioIndex = 0;
const scenarios: Scenario[] = [];
const bundlesByProjection = new WeakMap<object, CppgFoundationBundle>();

before(async () => {
  container = await createOwnedPostgresContainer({ name: `securium-cppg-publication-${ownerToken}`, ownerToken, password, receiptPath: null });
  port = await getPublishedPostgresPort(container);
  adminSql = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 8, prepare: false, ssl: false });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await adminSql`SELECT 1`; break; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  await adminSql.unsafe("CREATE ROLE anon");
  await adminSql.unsafe("CREATE ROLE authenticated");
});

after(async () => {
  for (const scenario of scenarios.reverse()) {
    await scenario.sql.end({ timeout: 1 }).catch(() => {});
    await adminSql?.unsafe(`DROP DATABASE IF EXISTS "${scenario.databaseName}" WITH (FORCE)`).catch(() => {});
  }
  await adminSql?.end({ timeout: 1 }).catch(() => {});
  if (container) await cleanupOwnedPostgresContainer(container);
});

test("publication and visibility commit atomically; exact replay is idempotent; conflicts fail closed", async () => {
  const fixture = await createScenario("publish");
  const { projection, authority, registrationIdentity } = await registerCanonical(fixture);

  // A failure after several visibility updates must roll those updates back and
  // leave no receipt. This is exercised by a real PostgreSQL trigger.
  await fixture.sql.unsafe(`CREATE FUNCTION reject_cppg_content_publish() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture rejection'; END $$`);
  await fixture.sql.unsafe(`CREATE TRIGGER reject_cppg_content_publish BEFORE UPDATE ON contents FOR EACH ROW WHEN (NEW.status = 'PUBLISHED') EXECUTE FUNCTION reject_cppg_content_publish()`);
  await assert.rejects(publish(fixture, projection, registrationIdentity), hasCode("PUBLICATION_PERSISTENCE_FAILURE"));
  await fixture.sql.unsafe(`DROP TRIGGER reject_cppg_content_publish ON contents`);
  await fixture.sql.unsafe(`DROP FUNCTION reject_cppg_content_publish()`);
  await assertUnpublished(fixture);

  // Fail after every visibility update but before receipt append.
  await fixture.sql.unsafe(`CREATE FUNCTION reject_cppg_receipt_append() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture receipt rejection'; END $$`);
  await fixture.sql.unsafe(`CREATE TRIGGER reject_cppg_receipt_append BEFORE INSERT ON cppg_publication_receipts FOR EACH ROW EXECUTE FUNCTION reject_cppg_receipt_append()`);
  await assert.rejects(publish(fixture, projection, registrationIdentity), hasCode("PUBLICATION_PERSISTENCE_FAILURE"));
  await fixture.sql.unsafe(`DROP TRIGGER reject_cppg_receipt_append ON cppg_publication_receipts`);
  await fixture.sql.unsafe(`DROP FUNCTION reject_cppg_receipt_append()`);
  await assertUnpublished(fixture);

  // Fail after receipt append; the audit error must roll back both receipt and visibility.
  await fixture.sql.unsafe(`CREATE FUNCTION reject_cppg_publication_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'CPPG_CANONICAL_PUBLICATION_SUCCEEDED' THEN RAISE EXCEPTION 'fixture audit rejection'; END IF; RETURN NEW; END $$`);
  await fixture.sql.unsafe(`CREATE TRIGGER reject_cppg_publication_audit BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION reject_cppg_publication_audit()`);
  await assert.rejects(publish(fixture, projection, registrationIdentity), hasCode("PUBLICATION_PERSISTENCE_FAILURE"));
  await fixture.sql.unsafe(`DROP TRIGGER reject_cppg_publication_audit ON admin_audit_logs`);
  await fixture.sql.unsafe(`DROP FUNCTION reject_cppg_publication_audit()`);
  await assertUnpublished(fixture);

  const result = await publish(fixture, projection, registrationIdentity);
  assert.equal(result.outcome, "PUBLISHED");
  assert.equal(result.authorityId, authority.identity.authorityId);
  await assertAllCanonicalVisibility(fixture, projection);
  assert.equal(Number((await fixture.sql.unsafe(`SELECT count(*)::int AS count FROM cppg_publication_receipts`))[0]?.count), 1);
  assert.equal(Number((await fixture.sql.unsafe(`SELECT count(*)::int AS count FROM admin_audit_logs WHERE action='CPPG_CANONICAL_PUBLICATION_SUCCEEDED' AND result='SUCCESS'`))[0]?.count), 1);

  const replay = await publish(fixture, projection, registrationIdentity);
  assert.equal(replay.outcome, "ALREADY_PUBLISHED");
  assert.equal(replay.publicationId, result.publicationId);
  await assert.rejects(publish(fixture, projection, registrationIdentity, ["wrong-content-revision"]), hasCode("REVISION_MISMATCH"));
  await assert.rejects(publish(fixture, projection, "a".repeat(64)), hasCode("REGISTRATION_NOT_FOUND"));
  assert.equal(Number((await fixture.sql.unsafe(`SELECT count(*)::int AS count FROM cppg_publication_receipts`))[0]?.count), 1);
  const savedRegistration = await fixture.sql.unsafe(`SELECT state,publication_authority FROM cppg_runtime_registrations`);
  assert.equal(savedRegistration[0]?.state, "REGISTERED_UNPUBLISHED");
  assert.equal(savedRegistration[0]?.publication_authority, "NOT_GRANTED");
  await fixture.sql.unsafe(`UPDATE cppg_publication_receipts SET publication_state='PUBLISHED'`);
  await fixture.sql.unsafe(`DELETE FROM cppg_publication_receipts`);
  assert.equal(Number((await fixture.sql.unsafe(`SELECT count(*)::int AS count FROM cppg_publication_receipts`))[0]?.count), 1);
});

test("revoked and superseded registrations cannot publish", async () => {
  const revoked = await createScenario("revoked");
  const revokedState = await registerCanonical(revoked);
  await revokedState.authority.revoke(`cppg-pub-revoke-${ownerToken}`, "revoke before publication");
  await assert.rejects(publish(revoked, revokedState.projection, revokedState.registrationIdentity), hasCode("AUTHORITY_REVOKED"));
  await assertUnpublished(revoked);

  const superseded = await createScenario("superseded");
  const predecessor = await registerCanonical(superseded);
  const bundle = await readBundle();
  const firstUnit = bundle.theory.units[0];
  assert.ok(firstUnit);
  const successorProjection = await buildCppgCourseTheoryDraftProjectionFromBundle({
    ...bundle,
    theory: { ...bundle.theory, units: [{ ...firstUnit, purpose: `${firstUnit.purpose} successor approval fixture` }, ...bundle.theory.units.slice(1)] },
  }, { actorUserId: actorId });
  const successor = await evaluateCppgProjectionAuthorityForTesting(successorProjection, superseded.owner);
  await successor.approve(`cppg-pub-successor-${ownerToken}`);
  await successor.supersede(predecessor.authority.identity.authorityId, `cppg-pub-supersede-${ownerToken}`);
  await assert.rejects(publish(superseded, predecessor.projection, predecessor.registrationIdentity), hasCode("AUTHORITY_SUPERSEDED"));
  await assertUnpublished(superseded);
});

test("a newer content revision blocks publishing the older registered revision", async () => {
  const fixture = await createScenario("stale-revision");
  const state = await registerCanonical(fixture);
  const target = state.projection.contentRevisions[0];
  assert.ok(target);
  const contentId = String(target.payload.contentId);
  await fixture.sql.unsafe(
    `INSERT INTO content_revisions (id,content_type,content_id,course_id,title,content_date,version,revision_status,snapshot_json,change_summary,is_latest,created_by,semantic_hash,created_at)
     VALUES ($1,'LESSON',$2,'course-cppg','newer revision','2026-09-28','2','draft','{}','test newer revision',0,$3,$4,now()::timestamptz + interval '1 second')`,
    [`${contentId}:revision:v2`, contentId, actorId, "b".repeat(64)],
  );
  await assert.rejects(publish(fixture, state.projection, state.registrationIdentity), hasCode("REVISION_MISMATCH"));
  await assertUnpublished(fixture);
});

test("publication revocation appends an immutable event, projects REVOKED, and enforces replay/current authority", async () => {
  const fixture = await createScenario("revoke-lifecycle");
  const state = await registerCanonical(fixture);
  assert.equal((await getCppgPublicationEffectiveState(fixture.executor, state.registrationIdentity)).state, "UNPUBLISHED");
  const publication = await publish(fixture, state.projection, state.registrationIdentity);
  const receiptBefore = await fixture.sql.unsafe(`SELECT * FROM cppg_publication_receipts WHERE publication_id=$1`, [publication.publicationId]);
  const authoritySequence = Number((await fixture.sql.unsafe(`SELECT latest_sequence FROM runtime_authority_roots WHERE authority_id=$1`, [publication.authorityId]))[0]?.latest_sequence);
  const input: CppgPublicationRevocationInput = {
    publicationId: publication.publicationId,
    publicationSemanticIdentity: publication.publicationSemanticIdentity,
    registrationSemanticIdentity: state.registrationIdentity,
    authorityId: publication.authorityId,
    authoritySequence,
    actor,
    reasonCode: "POLICY_CORRECTION",
    details: "Disposable lifecycle fixture",
    idempotencyKey: `revoke-${ownerToken}-${fixture.databaseName}`,
  };
  assert.equal((await getCppgPublicationEffectiveState(fixture.executor, state.registrationIdentity)).state, "PUBLISHED");
  let releaseRevocation!: () => void;
  let signalAppend!: () => void;
  const appended = new Promise<void>((resolve) => { signalAppend = resolve; });
  const waitToCommit = new Promise<void>((resolve) => { releaseRevocation = resolve; });
  const revocationPromise = revokeCppgPublicationForTesting(input, fixture.owner, { afterAppend: async () => { signalAppend(); await waitToCommit; } });
  await appended;
  let publicationReplaySettled = false;
  const publicationReplay = publish(fixture, state.projection, state.registrationIdentity).finally(() => { publicationReplaySettled = true; });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(publicationReplaySettled, false, "publication replay waits for the in-flight revocation root lock");
  releaseRevocation();
  const revoked = await revocationPromise;
  assert.equal(revoked.outcome, "REVOKED");
  assert.equal((await publicationReplay).outcome, "ALREADY_PUBLISHED");
  assert.equal((await getCppgPublicationEffectiveState(fixture.executor, state.registrationIdentity)).state, "REVOKED");
  assert.equal((await revokeCppgPublicationForTesting(input, fixture.owner)).outcome, "ALREADY_REVOKED");
  await assert.rejects(revokeCppgPublicationForTesting({ ...input, reasonCode: "OTHER_REASON" }, fixture.owner), hasCode("REVOCATION_IDEMPOTENCY_CONFLICT"));
  await assert.rejects(revokeCppgPublicationForTesting({ ...input, idempotencyKey: `${input.idempotencyKey}-second` }, fixture.owner), hasCode("PUBLICATION_ALREADY_REVOKED"));
  const receiptAfter = await fixture.sql.unsafe(`SELECT * FROM cppg_publication_receipts WHERE publication_id=$1`, [publication.publicationId]);
  assert.deepEqual(receiptAfter, receiptBefore);
  assert.equal(Number((await fixture.sql.unsafe(`SELECT count(*)::int AS count FROM cppg_publication_revocations`))[0]?.count), 1);
  assert.equal(Number((await fixture.sql.unsafe(`SELECT latest_sequence FROM runtime_authority_roots WHERE authority_id=$1`, [publication.authorityId]))[0]?.latest_sequence), authoritySequence);
  assert.equal(Number((await fixture.sql.unsafe(`SELECT count(*)::int AS count FROM admin_audit_logs WHERE action='CPPG_PUBLICATION_REVOCATION_SUCCEEDED' AND result='SUCCESS'`))[0]?.count), 1);
});

test("runtime authority revocation alone does not create a publication revocation", async () => {
  const fixture = await createScenario("revoke-authority-independent");
  const state = await registerCanonical(fixture);
  const publication = await publish(fixture, state.projection, state.registrationIdentity);
  await state.authority.revoke(`cppg-revoke-independent-${ownerToken}`, "authority-only lifecycle fixture");
  assert.equal((await getCppgPublicationEffectiveState(fixture.executor, state.registrationIdentity)).state, "PUBLISHED");
  assert.equal(Number((await fixture.sql.unsafe(`SELECT count(*)::int AS count FROM cppg_publication_revocations WHERE publication_id=$1`, [publication.publicationId]))[0]?.count), 0);
  await assert.rejects(revokeCppgPublicationForTesting({ publicationId: publication.publicationId, publicationSemanticIdentity: publication.publicationSemanticIdentity,
    registrationSemanticIdentity: state.registrationIdentity, authorityId: publication.authorityId, authoritySequence: publication.authoritySequence, actor,
    reasonCode: "POLICY_CORRECTION", idempotencyKey: `stale-${ownerToken}` }, fixture.owner), hasCode("REVOCATION_AUTHORITY_STALE"));
});

test("revocation rejects missing or mismatched targets and rolls back failures around append", async () => {
  const fixture = await createScenario("revoke-rollback");
  const state = await registerCanonical(fixture);
  const root = await fixture.sql.unsafe(`SELECT authority_id,latest_sequence FROM runtime_authority_roots LIMIT 1`);
  const base = {
    publicationId: randomUUID(), publicationSemanticIdentity: "a".repeat(64),
    registrationSemanticIdentity: state.registrationIdentity, authorityId: String(root[0]?.authority_id),
    authoritySequence: Number(root[0]?.latest_sequence), actor, reasonCode: "POLICY_CORRECTION",
    idempotencyKey: `missing-${ownerToken}`,
  } satisfies CppgPublicationRevocationInput;
  await assert.rejects(revokeCppgPublicationForTesting(base, fixture.owner), hasCode("PUBLICATION_NOT_FOUND"));
  assert.equal((await getCppgPublicationEffectiveState(fixture.executor, state.registrationIdentity)).state, "UNPUBLISHED");
  const published = await publish(fixture, state.projection, state.registrationIdentity);
  const exact = { ...base, publicationId: published.publicationId, publicationSemanticIdentity: published.publicationSemanticIdentity,
    authoritySequence: published.authoritySequence, idempotencyKey: `rollback-${ownerToken}` };
  await assert.rejects(revokeCppgPublicationForTesting({ ...exact, publicationSemanticIdentity: "b".repeat(64) }, fixture.owner), hasCode("PUBLICATION_IDENTITY_MISMATCH"));
  await assert.rejects(revokeCppgPublicationForTesting(exact, fixture.owner, { beforeAppend: async () => { throw new Error("fixture before append"); } }), hasCode("REVOCATION_POLICY_DENIED"));
  await assert.rejects(revokeCppgPublicationForTesting(exact, fixture.owner, { afterAppend: async () => { throw new Error("fixture after append"); } }), hasCode("REVOCATION_POLICY_DENIED"));
  assert.equal((await getCppgPublicationEffectiveState(fixture.executor, state.registrationIdentity)).state, "PUBLISHED");
  assert.equal(Number((await fixture.sql.unsafe(`SELECT count(*)::int AS count FROM cppg_publication_revocations`))[0]?.count), 0);
  const concurrentInput = { ...exact, idempotencyKey: `concurrent-${ownerToken}` };
  const outcomes = await Promise.all([
    revokeCppgPublicationForTesting(concurrentInput, fixture.owner),
    revokeCppgPublicationForTesting(concurrentInput, fixture.owner),
  ]);
  assert.deepEqual(outcomes.map((item) => item.outcome).sort(), ["ALREADY_REVOKED", "REVOKED"]);
  assert.equal(Number((await fixture.sql.unsafe(`SELECT count(*)::int AS count FROM cppg_publication_revocations`))[0]?.count), 1);
});

test("mutable live content and curriculum rows must still match the immutable registration projection", async (t) => {
  for (const drift of ["content", "lesson", "curriculum"] as const) {
    await t.test(`${drift} drift is denied before visibility or receipt`, async () => {
      const fixture = await createScenario(`drift-${drift}`);
      const state = await registerCanonical(fixture);
      if (drift === "content") {
        const content = state.projection.contents[0]!;
        await fixture.sql.unsafe(`UPDATE contents SET body = body || ' drift' WHERE id=$1`, [content.id]);
      } else if (drift === "lesson") {
        const lesson = state.projection.lessons[0]!;
        await fixture.sql.unsafe(`UPDATE lessons SET title = title || ' drift' WHERE id=$1`, [lesson.id]);
      } else {
        const node = state.projection.curriculumNodes[0]!;
        await fixture.sql.unsafe(`UPDATE curriculum_nodes SET path = path || '.drift' WHERE id=$1`, [node.id]);
      }
      await assert.rejects(publish(fixture, state.projection, state.registrationIdentity), hasCode("REGISTRATION_BINDING_MISMATCH"));
      await assertProjectionUnpublished(fixture, state.projection);
    });
  }
});

test("authority root lock serializes publication against concurrent revocation", async () => {
  const fixture = await createScenario("concurrent");
  const state = await registerCanonical(fixture);
  let releasePublication!: () => void;
  let signalRootLocked!: () => void;
  const waitToRelease = new Promise<void>((resolve) => { releasePublication = resolve; });
  const rootLocked = new Promise<void>((resolve) => { signalRootLocked = resolve; });
  let paused = false;
  const gatedOwner = new PostgresRuntimeAuthorityPersistence({
    query: (statement, parameters) => fixture.executor.query(statement, parameters),
    transaction: async <T>(callback: (executor: PostgresTransactionExecutor) => Promise<T>) => fixture.executor.transaction(async (transaction: PostgresTransactionExecutor) => callback({
      query: async <Row extends Record<string, unknown>>(statement: string, parameters: readonly PostgresQueryValue[]) => {
        const result = await transaction.query<Row>(statement, parameters);
        if (!paused && statement.includes(`FROM public."runtime_authority_roots" AS root`)) {
          paused = true;
          signalRootLocked();
          await waitToRelease;
        }
        return result;
      },
    })),
  });
  const publishing = publish(fixture, state.projection, state.registrationIdentity, undefined, gatedOwner);
  await rootLocked;
  let revocationSettled = false;
  const revocation = state.authority.revoke(`cppg-pub-race-revoke-${ownerToken}`, "concurrent publication test").finally(() => { revocationSettled = true; });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(revocationSettled, false, "revocation must wait for publication's authority root lock");
  releasePublication();
  assert.equal((await publishing).outcome, "PUBLISHED");
  await revocation;
  assert.equal(revocationSettled, true);
  assert.equal(Number((await fixture.sql.unsafe(`SELECT count(*)::int AS count FROM cppg_publication_receipts`))[0]?.count), 1);
  await assertAllCanonicalVisibility(fixture, state.projection);
});

test("legacy published course flags alone do not satisfy canonical publication", async () => {
  const fixture = await createScenario("legacy");
  await fixture.sql.unsafe(`INSERT INTO users(id) VALUES ($1)`, [actorId]);
  await fixture.sql.unsafe(`INSERT INTO course_groups(id) VALUES ('legacy-group')`);
  await fixture.sql.unsafe(`INSERT INTO courses(id,course_group_id,code,slug,name,short_name,active,published) VALUES ('course-cppg','legacy-group','CPPG','cppg','legacy','CPPG',1,1)`);
  const projection = await buildCppgCourseTheoryDraftProjectionFromBundle(await readBundle(), { actorUserId: actorId });
  await assert.rejects(publish(fixture, projection, "c".repeat(64)), hasCode("REGISTRATION_NOT_FOUND"));
  assert.equal(Number((await fixture.sql.unsafe(`SELECT count(*)::int AS count FROM cppg_publication_receipts`))[0]?.count), 0);
});

async function createScenario(name: string): Promise<Scenario> {
  const databaseName = `cppg_pub_${name}_${ownerToken.replaceAll("-", "").slice(0, 10)}_${scenarioIndex++}`;
  await requireAdminSql().unsafe(`CREATE DATABASE "${databaseName}"`);
  const sql = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/${databaseName}`, { max: 6, prepare: false, ssl: false });
  const ready = await waitForSql(sql);
  await setupDatabase(ready);
  const executor = createExecutor(ready);
  const scenario = { databaseName, sql: ready, executor, owner: new PostgresRuntimeAuthorityPersistence(executor) };
  scenarios.push(scenario);
  return scenario;
}

async function registerCanonical(scenario: Awaited<ReturnType<typeof createScenario>>) {
  const bundle = await readBundle();
  const projection = await buildCppgCourseTheoryDraftProjectionFromBundle(bundle, { actorUserId: actorId });
  bundlesByProjection.set(projection, bundle);
  await scenario.sql.unsafe(`INSERT INTO users(id) VALUES ($1)`, [actorId]);
  await scenario.sql.unsafe(`INSERT INTO course_groups(id) VALUES ('group-cppg')`);
  const authority = await evaluateCppgProjectionAuthorityForTesting(projection, scenario.owner);
  await authority.approve(`cppg-pub-approval-${ownerToken}-${scenario.databaseName}`);
  await persistCppgCourseTheoryDraftProjectionForTesting(projection, actorId, scenario.owner);
  const rows = await scenario.sql.unsafe(`SELECT registration_semantic_identity FROM cppg_runtime_registrations`);
  return { projection, authority, registrationIdentity: String(rows[0]?.registration_semantic_identity), bundle };
}

async function publish(
  scenario: Awaited<ReturnType<typeof createScenario>>,
  projection: CppgCourseTheoryDraftProjection | undefined,
  registrationIdentity: string,
  requestedContentRevisionIds?: readonly string[],
  owner = scenario.owner,
) {
  const input = {
    registrationSemanticIdentity: registrationIdentity,
    requestedContentRevisionIds: requestedContentRevisionIds ?? projection?.contentRevisions.map((record) => record.id) ?? ["no-revision"],
    actor,
  };
  if (!projection) return authorizeAndPublishCppgRegistrationForTesting(input, owner, await readBundle());
  const bundle = bundlesByProjection.get(projection) ?? await readBundle();
  return authorizeAndPublishCppgRegistrationForTesting(input, owner, bundle);
}

async function assertUnpublished(scenario: Awaited<ReturnType<typeof createScenario>>) {
  assert.equal(Number((await scenario.sql.unsafe(`SELECT count(*)::int AS count FROM courses WHERE id='course-cppg' AND active=1 AND published=1`))[0]?.count), 0);
  assert.equal(Number((await scenario.sql.unsafe(`SELECT count(*)::int AS count FROM cppg_publication_receipts`))[0]?.count), 0);
}

async function assertProjectionUnpublished(scenario: Awaited<ReturnType<typeof createScenario>>, projection: CppgCourseTheoryDraftProjection) {
  await assertUnpublished(scenario);
  const checks: readonly [string, readonly string[], string][] = [
    ["courses", [projection.course.id], `active=1 OR published=1`],
    ["curriculum_trees", [projection.curriculumTree.id], `status <> 'DRAFT'`],
    ["subjects", projection.subjects.map((row) => row.id), `active=1`],
    ["curriculum_nodes", projection.curriculumNodes.map((row) => row.id), `status <> 'INACTIVE'`],
    ["topics", projection.topics.map((row) => row.id), `active=1`],
    ["learning_units", projection.learningUnits.map((row) => row.id), `active=1 OR published=1`],
    ["contents", projection.contents.map((row) => row.id), `status <> 'DRAFT'`],
    ["lessons", projection.lessons.map((row) => row.id), `active=1 OR published=1`],
    ["course_lessons", projection.courseLessons.map((row) => row.id), `status <> 'DRAFT'`],
    ["content_revisions", projection.contentRevisions.map((row) => row.id), `revision_status <> 'draft' OR is_latest=1`],
  ];
  for (const [table, ids, visiblePredicate] of checks) {
    const count = await scenario.sql.unsafe(`SELECT count(*)::int AS count FROM ${table} WHERE id=ANY($1::text[]) AND (${visiblePredicate})`, [textArray(ids)] as never);
    assert.equal(Number(count[0]?.count), 0, `${table} visibility must roll back`);
  }
}

async function assertAllCanonicalVisibility(scenario: Awaited<ReturnType<typeof createScenario>>, projection: CppgCourseTheoryDraftProjection) {
  const expectations: readonly [string, string, readonly PostgresQueryValue[], number][] = [
    ["courses", `SELECT count(*)::int AS count FROM courses WHERE id=$1 AND active=1 AND published=1`, [projection.course.id], 1],
    ["trees", `SELECT count(*)::int AS count FROM curriculum_trees WHERE id=$1 AND status='ACTIVE'`, [projection.curriculumTree.id], 1],
    ["subjects", `SELECT count(*)::int AS count FROM subjects WHERE id=ANY($1::text[]) AND active=1`, [textArray(projection.subjects.map((r) => r.id))], projection.subjects.length],
    ["nodes", `SELECT count(*)::int AS count FROM curriculum_nodes WHERE id=ANY($1::text[]) AND status='ACTIVE'`, [textArray(projection.curriculumNodes.map((r) => r.id))], projection.curriculumNodes.length],
    ["topics", `SELECT count(*)::int AS count FROM topics WHERE id=ANY($1::text[]) AND active=1`, [textArray(projection.topics.map((r) => r.id))], projection.topics.length],
    ["units", `SELECT count(*)::int AS count FROM learning_units WHERE id=ANY($1::text[]) AND active=1 AND published=1`, [textArray(projection.learningUnits.map((r) => r.id))], projection.learningUnits.length],
    ["contents", `SELECT count(*)::int AS count FROM contents WHERE id=ANY($1::text[]) AND status='PUBLISHED'`, [textArray(projection.contents.map((r) => r.id))], projection.contents.length],
    ["lessons", `SELECT count(*)::int AS count FROM lessons WHERE id=ANY($1::text[]) AND active=1 AND published=1`, [textArray(projection.lessons.map((r) => r.id))], projection.lessons.length],
    ["course lessons", `SELECT count(*)::int AS count FROM course_lessons WHERE id=ANY($1::text[]) AND status='PUBLISHED'`, [textArray(projection.courseLessons.map((r) => r.id))], projection.courseLessons.length],
    ["revisions", `SELECT count(*)::int AS count FROM content_revisions WHERE id=ANY($1::text[]) AND revision_status='published' AND is_latest=1`, [textArray(projection.contentRevisions.map((r) => r.id))], projection.contentRevisions.length],
  ];
  for (const [name, query, parameters, expected] of expectations) {
    const rows = await scenario.sql.unsafe(query, [...parameters] as never);
    assert.equal(Number(rows[0]?.count), expected, `${name} visibility`);
  }
}

function textArray(values: readonly string[]): PostgresQueryValue {
  return [...values] as unknown as PostgresQueryValue;
}

function hasCode(code: string) {
  return (error: unknown) => error instanceof Error && "code" in error && (error as Error & { code: string }).code === code;
}

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

async function setupDatabase(client: NonNullable<typeof adminSql>) {
  await client.unsafe(`CREATE TABLE app_schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  await applyMigration(client, await readFile("db/postgres/migrations/0053_runtime_authority_postgres_persistence.sql", "utf8"));
  await createProjectionTables(client);
  await applyMigration(client, await readFile("db/postgres/migrations/0054_cppg_canonical_registration.sql", "utf8"));
  await applyMigration(client, await readFile("db/postgres/migrations/0055_cppg_publication_receipts.sql", "utf8"));
  await applyMigration(client, await readFile("db/postgres/migrations/0056_cppg_publication_revocations.sql", "utf8"));
}

async function createProjectionTables(client: NonNullable<typeof adminSql>) {
  const ddl = [
    `CREATE TABLE users(id text PRIMARY KEY)`,
    `CREATE TABLE course_groups(id text PRIMARY KEY)`,
    `CREATE TABLE admin_audit_logs(id text PRIMARY KEY,actor_user_id text NOT NULL,actor_role text NOT NULL,action text NOT NULL,resource_type text NOT NULL,resource_id text NOT NULL,result text NOT NULL,request_id text,metadata_json text NOT NULL DEFAULT '{}',created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE courses(id text PRIMARY KEY,course_group_id text NOT NULL,code text NOT NULL,slug text NOT NULL,name text NOT NULL,short_name text NOT NULL,description text NOT NULL DEFAULT '',total_levels integer NOT NULL DEFAULT 1,passing_score integer NOT NULL DEFAULT 60,difficulty text NOT NULL DEFAULT 'BEGINNER',active integer NOT NULL DEFAULT 1,published integer NOT NULL DEFAULT 0,display_order integer NOT NULL DEFAULT 0,is_sample integer NOT NULL DEFAULT 0,deleted_at text,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(code),UNIQUE(slug))`,
    `CREATE TABLE curriculum_trees(id text PRIMARY KEY,course_id text NOT NULL,title text NOT NULL,version text NOT NULL,source_type text,source_document text,status text NOT NULL,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE subjects(id text PRIMARY KEY,course_id text NOT NULL,code text NOT NULL,name text NOT NULL,description text NOT NULL,display_order integer NOT NULL,active integer NOT NULL,is_sample integer NOT NULL,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE curriculum_nodes(id text PRIMARY KEY,curriculum_tree_id text NOT NULL,parent_id text,node_type text NOT NULL,title text NOT NULL,description text NOT NULL,official_code text,official_title text,sort_order integer NOT NULL,depth integer NOT NULL,path text,is_required integer NOT NULL,is_practical integer NOT NULL,metadata text,status text NOT NULL,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE topics(id text PRIMARY KEY,subject_id text NOT NULL,code text NOT NULL,name text NOT NULL,description text NOT NULL,display_order integer NOT NULL,active integer NOT NULL,is_sample integer NOT NULL,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE learning_units(id text PRIMARY KEY,course_id text NOT NULL,subject_id text NOT NULL,topic_id text,code text NOT NULL,title text NOT NULL,description text NOT NULL,display_order integer NOT NULL,active integer NOT NULL,published integer NOT NULL,completion_policy text NOT NULL,minimum_progress_percent integer NOT NULL,minimum_study_seconds integer NOT NULL,is_sample integer NOT NULL,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE contents(id text PRIMARY KEY,slug text NOT NULL,canonical_key text NOT NULL,title text NOT NULL,summary text NOT NULL,body text NOT NULL,body_format text NOT NULL,learning_objectives_json text NOT NULL,core_concepts_json text NOT NULL,practical_examples_json text NOT NULL,diagrams_json text NOT NULL,media_json text NOT NULL,version text NOT NULL,status text NOT NULL,created_by text,deleted_at text,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE lessons(id text PRIMARY KEY,learning_unit_id text,course_id text NOT NULL,subject_id text NOT NULL,topic_id text NOT NULL,code text NOT NULL,title text NOT NULL,summary text NOT NULL,content text NOT NULL,content_format text NOT NULL,estimated_minutes integer NOT NULL,display_order integer NOT NULL,active integer NOT NULL,published integer NOT NULL,is_sample integer NOT NULL,version integer NOT NULL,deleted_at text,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE course_lessons(id text PRIMARY KEY,course_id text NOT NULL,curriculum_node_id text,content_id text NOT NULL,lesson_id text,display_title text NOT NULL,sort_order integer NOT NULL,estimated_minutes integer NOT NULL,is_required integer NOT NULL,completion_rule text NOT NULL,status text NOT NULL,deleted_at text,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE content_revisions(id text PRIMARY KEY,content_type text NOT NULL,content_id text NOT NULL,course_id text,title text NOT NULL,content_date text NOT NULL,version text NOT NULL,revision_status text NOT NULL,snapshot_json text NOT NULL,change_summary text NOT NULL,is_latest integer NOT NULL,created_by text NOT NULL,semantic_hash text,published_at text,created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ];
  for (const statement of ddl) await client.unsafe(statement);
}

async function applyMigration(client: NonNullable<typeof adminSql>, source: string): Promise<void> {
  const statements = source.replace(/^\s*(?:--[^\r\n]*\r?\n\s*)*BEGIN\s*;/iu, "").replace(/COMMIT\s*;\s*$/iu, "");
  await client.begin(async (transaction) => { await transaction.unsafe(statements); });
}

function createExecutor(client: NonNullable<typeof adminSql>): PostgresExecutor {
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
    close: async () => { await client.end({ timeout: 1 }); },
  };
}

async function waitForSql(client: ReturnType<typeof postgres>) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await client`SELECT 1`; return client; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error("CPPG_PUBLICATION_POSTGRES_NOT_READY");
}

function requireAdminSql(): NonNullable<typeof adminSql> {
  if (!adminSql) throw new Error("CPPG_PUBLICATION_ADMIN_POSTGRES_UNAVAILABLE");
  return adminSql;
}
