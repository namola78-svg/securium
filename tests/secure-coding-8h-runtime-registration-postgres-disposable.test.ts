import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import postgres from "postgres";
import type { PostgresExecutor, PostgresQueryValue, PostgresTransactionExecutor } from "../db/provider/postgres-database-provider.ts";
import { PostgresRuntimeAuthorityPersistence } from "../db/runtime-authority-postgres-persistence.ts";
import { approvalSubjectHash } from "../lib/policy/runtime-authority-binding.ts";
import { sha256Canonical } from "../lib/policy/stable-canonical-hash.ts";
import { executeRuntimeAuthorityCommand } from "../lib/services/runtime-authority-command-service.ts";
import {
  buildSecureCoding8HRegistrationProjection,
  deriveSecureCoding8HRegistrationBinding,
  registerSecureCoding8HRuntime,
} from "../lib/services/secure-coding-8h-runtime-registration.ts";
import { cleanupOwnedPostgresContainer, createOwnedPostgresContainer, getPublishedPostgresPort } from "../scripts/owned-postgres-container.mjs";

const token = randomUUID();
const password = "python-8h-registration-disposable-test-password";
const actor = "python-8h-registration-test-actor";
(process.env as unknown as { NODE_ENV?: string }).NODE_ENV = "test";
(process.env as unknown as { SECURIUM_PYTHON_8H_TEST_AUTHORITY?: string }).SECURIUM_PYTHON_8H_TEST_AUTHORITY = "1";
let container: Awaited<ReturnType<typeof createOwnedPostgresContainer>> | undefined;
let sql: ReturnType<typeof postgres> | undefined;
let baseExecutor: PostgresExecutor;
let owner: PostgresRuntimeAuthorityPersistence;
let binding: Awaited<ReturnType<typeof deriveSecureCoding8HRegistrationBinding>>;

before(async () => {
  container = await createOwnedPostgresContainer({ name: `securium-python-8h-registration-${token}`, ownerToken: token, password, receiptPath: null });
  const port = await getPublishedPostgresPort(container);
  sql = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 6, prepare: false, ssl: false });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await sql`SELECT 1`; break; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  await sql.unsafe("CREATE ROLE anon");
  await sql.unsafe("CREATE ROLE authenticated");
  await sql.unsafe(`CREATE TABLE app_schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  await sql.unsafe(`CREATE TABLE public.ontology_concepts (id text PRIMARY KEY)`);
  await sql.unsafe(`CREATE TABLE public.users (id text PRIMARY KEY, email text UNIQUE, display_name text)`);
  await sql.unsafe(`CREATE TABLE public.course_groups (id text PRIMARY KEY)`);
  await sql.unsafe(`CREATE TABLE public.courses (
    id text PRIMARY KEY, course_group_id text NOT NULL REFERENCES public.course_groups(id), code text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE, name text NOT NULL, short_name text NOT NULL, description text NOT NULL DEFAULT '',
    thumbnail_url text, total_levels integer NOT NULL DEFAULT 1, passing_score integer NOT NULL DEFAULT 60,
    difficulty text NOT NULL DEFAULT 'BEGINNER', active integer NOT NULL DEFAULT 1, published integer NOT NULL DEFAULT 0,
    display_order integer NOT NULL DEFAULT 0, is_sample integer NOT NULL DEFAULT 0, deleted_at text
  )`);
  await sql.unsafe(`CREATE TABLE public.questions (
    id text PRIMARY KEY,title text NOT NULL,content text NOT NULL,type text NOT NULL,difficulty text NOT NULL DEFAULT 'MEDIUM',
    explanation text NOT NULL DEFAULT '',wrong_answer_explanation text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'DRAFT',
    source text,source_date text,version integer NOT NULL DEFAULT 1,answer_config_json text NOT NULL DEFAULT '{}',
    is_sample integer NOT NULL DEFAULT 0,created_by text NOT NULL REFERENCES public.users(id),reviewed_by text,published_at text,archived_at text
  )`);
  await sql.unsafe(`CREATE TABLE public.question_choices (
    id text PRIMARY KEY,question_id text NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    content text NOT NULL,display_order integer NOT NULL DEFAULT 0,is_correct integer NOT NULL DEFAULT 0,explanation text NOT NULL DEFAULT '',
    UNIQUE(question_id,display_order)
  )`);
  await sql.unsafe(`CREATE TABLE public.question_courses (
    question_id text NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,course_id text NOT NULL REFERENCES public.courses(id),
    weight integer NOT NULL DEFAULT 100,UNIQUE(question_id,course_id)
  )`);
  await sql.unsafe(`CREATE TABLE public.question_versions (
    id text PRIMARY KEY,question_id text NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,version integer NOT NULL,
    snapshot_json text NOT NULL,review_comment text NOT NULL DEFAULT '',created_by text NOT NULL REFERENCES public.users(id),
    UNIQUE(question_id,version)
  )`);
  await applyMigration(sql, "0013_question_governance_foundation.sql");
  await applyMigration(sql, "0053_runtime_authority_postgres_persistence.sql");
  await applyMigration(sql, "0056_secure_coding_8h_runtime_registration.sql");
  await sql.unsafe(`INSERT INTO public.users(id,email,display_name) VALUES ($1,'python8h-test@example.invalid','Disposable test actor')`, [actor]);
  await sql.unsafe(`INSERT INTO public.course_groups(id) VALUES ('group-independent')`);
  baseExecutor = createExecutor(sql);
  owner = new PostgresRuntimeAuthorityPersistence(baseExecutor);
  binding = await deriveSecureCoding8HRegistrationBinding(await buildSecureCoding8HRegistrationProjection());
});

after(async () => {
  await baseExecutor?.close?.().catch(() => {});
  await sql?.end({ timeout: 1 }).catch(() => {});
  if (container) await cleanupOwnedPostgresContainer(container);
});

test("disposable TEST_AUTHORITY approval registers the exact export projection atomically and unpublished", async () => {
  assert.equal(binding.projection.counts.questions, 40);
  assert.equal(binding.projection.counts.choices, 160);
  assert.equal(binding.projection.counts.versions, 40);
  assert.equal(binding.projection.counts.courseBindings, 40);
  await approve();
  const first = await registerSecureCoding8HRuntime(actor, owner);
  assert.equal(first.outcome, "REGISTERED");
  const replay = await registerSecureCoding8HRuntime(actor, owner);
  assert.equal(replay.outcome, "EXACT_REPLAY");
  assert.equal(replay.registrationId, first.registrationId);
  assert.deepEqual(await counts(), { courses: 1, questions: 40, choices: 160, versions: 40, mappings: 40, receipts: 1 });
  const receipt = (await requireSql().unsafe(`SELECT * FROM public.secure_coding_8h_runtime_registrations`))[0];
  assert.equal(receipt?.state, "REGISTERED_UNPUBLISHED");
  assert.equal(receipt?.publication_authority, "NOT_GRANTED");
  assert.equal(receipt?.course_id, binding.candidate.courseId);
  assert.equal(receipt?.course_slug, binding.candidate.slug);
  assert.equal(receipt?.package_key, binding.candidate.packageKey);
  assert.equal(receipt?.source_manifest_id, binding.candidate.sourceManifestId);
  assert.equal(receipt?.source_package_hash, binding.candidate.combinedSourcePackageHash);
  assert.equal(receipt?.foundation_id, binding.candidate.foundationId);
  assert.equal(receipt?.foundation_hash, binding.candidate.foundationHash);
  assert.equal(receipt?.materialization_hash, binding.candidate.materializationHash);
  assert.equal(receipt?.revision_binding_hash, binding.candidate.revisionBindingHash);
  assert.equal(receipt?.authority_id, binding.authorityId);
  assert.equal(receipt?.approval_subject_hash, binding.approvalSubjectHash);
  assert.equal(receipt?.questions_count, binding.candidate.expectedCounts.questions);
  assert.equal(receipt?.choices_count, binding.candidate.expectedCounts.choices);
  assert.equal(receipt?.versions_count, binding.candidate.expectedCounts.versions);
  assert.equal(receipt?.mappings_count, binding.candidate.expectedCounts.mappings);
  const course = (await requireSql().unsafe(`SELECT active,published FROM public.courses WHERE id=$1`, [binding.subject.courseId]))[0];
  assert.equal(Number(course?.active), 0);
  assert.equal(Number(course?.published), 0);
  const q36 = (await requireSql().unsafe(`SELECT q.version,v.id,v.version,v.semantic_hash FROM public.questions q JOIN public.question_versions v ON v.question_id=q.id WHERE q.id LIKE '%-Q36'`))[0];
  assert.equal(Number(q36?.version), 2);
  assert.equal(q36?.id, "version-question-developer-secure-coding-8h-python-vibe-Q36-v2");
  assert.equal(q36?.semantic_hash, binding.projection.versionRows.find((row) => row.questionId.endsWith("-Q36"))?.semanticHash);
  const q36Versions = await requireSql().unsafe(`SELECT id,version FROM public.question_versions WHERE question_id LIKE '%-Q36' ORDER BY version`);
  assert.deepEqual(Array.from(q36Versions), [{ id: binding.candidate.q36VersionIdentity.runtimeQuestionVersionId, version: 2 }]);
});

test("conflicting registration receipt replay is rejected without changing canonical rows", async () => {
  await reset();
  await approve();
  await registerSecureCoding8HRuntime(actor, owner);
  await requireSql().unsafe(`DROP RULE secure_coding_8h_runtime_registrations_no_update ON public.secure_coding_8h_runtime_registrations`);
  await requireSql().unsafe(`UPDATE public.secure_coding_8h_runtime_registrations SET foundation_hash=$1 WHERE course_id=$2`, ["f".repeat(64), binding.candidate.courseId]);
  await assert.rejects(() => registerSecureCoding8HRuntime(actor, owner), (error: unknown) => code(error) === "PYTHON_8H_RECEIPT_CONFLICT");
  assert.deepEqual(await counts(), { courses: 1, questions: 40, choices: 160, versions: 40, mappings: 40, receipts: 1 });
});

test("legacy Python-looking rows cannot satisfy registration without a receipt", async () => {
  await reset();
  await approve();
  await requireSql().unsafe(`INSERT INTO public.courses(id,course_group_id,code,slug,name,short_name,description,total_levels,passing_score,difficulty,active,published,display_order,is_sample) VALUES ($1,'group-independent','SECURE_CODING_8H',$2,'Securium Developer Secure Coding 8H','SC8H','Securium Developer Secure Coding 8H',8,60,'INTERMEDIATE',0,0,8,0)`, [binding.subject.courseId,binding.subject.courseSlug]);
  const q = binding.projection.questionRows[0]!;
  await requireSql().unsafe(`INSERT INTO public.questions(id,title,content,type,difficulty,explanation,status,source,version,answer_config_json,is_sample,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11)`, [q.id,q.title,q.content,q.type,q.difficulty,q.explanation,q.status,q.source,q.version,q.answerConfigJson,actor]);
  await assert.rejects(() => registerSecureCoding8HRuntime(actor, owner), (error: unknown) => code(error) === "PYTHON_8H_LEGACY_COLLISION");
  assert.deepEqual(await counts(), { courses: 1, questions: 1, choices: 0, versions: 0, mappings: 0, receipts: 0 });
});

for (const [stage, failAt] of [["questions", 5], ["question_choices", 17], ["question_versions", 5], ["secure_coding_8h_runtime_registrations", 1]] as const) {
test(`failure at ${stage} after ${failAt} attempted inserts rolls back course and every canonical descendant`, async () => {
    await reset();
    await approve();
    await requireSql().unsafe(`CREATE SEQUENCE public.python_8h_fail_counter`);
    await requireSql().unsafe(`CREATE FUNCTION public.fail_python_8h_insert() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE n bigint; BEGIN IF TG_TABLE_NAME = current_setting('app.python_8h_fail_table', true) THEN n := nextval('public.python_8h_fail_counter'); IF n >= ${failAt} THEN RAISE EXCEPTION 'forced disposable failure'; END IF; END IF; RETURN NEW; END $$`);
    await requireSql().unsafe(`CREATE TRIGGER fail_python_8h_insert BEFORE INSERT ON public.${stage} FOR EACH ROW EXECUTE FUNCTION public.fail_python_8h_insert()`);
    const faultOwner = new PostgresRuntimeAuthorityPersistence(withTransactionSetting(baseExecutor, "app.python_8h_fail_table", stage));
    await assert.rejects(() => registerSecureCoding8HRuntime(actor, faultOwner));
    assert.deepEqual(await counts(), { courses: 0, questions: 0, choices: 0, versions: 0, mappings: 0, receipts: 0 });
    await requireSql().unsafe(`DROP TRIGGER fail_python_8h_insert ON public.${stage}`);
    await requireSql().unsafe(`DROP FUNCTION public.fail_python_8h_insert()`);
    await requireSql().unsafe(`DROP SEQUENCE public.python_8h_fail_counter`);
  });
}

for (const [kind, statement, expectedCode] of [
  ["question", `UPDATE public.questions SET content='conflicting legacy edit' WHERE id LIKE '%-Q03'`, "PYTHON_8H_QUESTION_CONFLICT"],
  ["choice", `UPDATE public.question_choices SET content='conflicting choice edit' WHERE id LIKE '%-Q03-choice-01'`, "PYTHON_8H_CHOICE_CONFLICT"],
  ["version", `UPDATE public.question_versions SET snapshot_json='{}' WHERE id LIKE '%-Q03-v1'`, "PYTHON_8H_VERSION_CONFLICT"],
  ["mapping", `UPDATE public.question_courses SET weight=101 WHERE question_id LIKE '%-Q03'`, "PYTHON_8H_MAPPING_CONFLICT"],
] as const) {
  test(`conflicting existing ${kind} state is rejected without overwrite`, async () => {
    await reset();
    await approve();
    await registerSecureCoding8HRuntime(actor, owner);
    await requireSql().unsafe(statement);
    await assert.rejects(() => registerSecureCoding8HRuntime(actor, owner), (error: unknown) => code(error) === expectedCode);
  });
}

test("revoked approval and generic authority masquerade are denied", async () => {
  await reset();
  await approve();
  await executeRuntimeAuthorityCommand(owner, {
    authorityId: binding.authorityId,
    eventType: "REVOCATION_DECLARED",
    payload: { reason: "disposable revocation test", createdAt: new Date().toISOString() },
    idempotencyKey: `revoke-${token}`,
  });
  await assert.rejects(() => registerSecureCoding8HRuntime(actor, owner));
  await reset();
  const generic = { ...binding.subject, courseId: "generic-course", courseSlug: "generic", packageKey: "generic-package" };
  const genericHash = approvalSubjectHash(generic);
  await executeRuntimeAuthorityCommand(owner, {
    authorityId: `runtime-authority:generic:${genericHash}`,
    eventType: "APPROVAL_CREATED",
    payload: { subject: generic, approvalSubjectHash: genericHash, createdAt: new Date().toISOString() },
    idempotencyKey: `generic-${token}`,
  });
  await assert.rejects(() => registerSecureCoding8HRuntime(actor, owner));
  assert.deepEqual(await counts(), { courses: 0, questions: 0, choices: 0, versions: 0, mappings: 0, receipts: 0 });
});

test("stale package, Foundation, materialization, revision, and packageKey subjects are denied", async () => {
  for (const [label, mutate] of [
    ["source package", (subject: typeof binding.subject) => ({ ...subject, sourcePackageHash: "a".repeat(64) })],
    ["Foundation", (subject: typeof binding.subject) => ({ ...subject, foundationHash: "b".repeat(64) })],
    ["materialization", (subject: typeof binding.subject) => ({ ...subject, semanticHash: "c".repeat(64) })],
    ["revision binding", (subject: typeof binding.subject) => ({ ...subject, runtimeRevisionId: `${subject.packageKey}:revision:${"d".repeat(64)}` })],
    ["package key", (subject: typeof binding.subject) => ({ ...subject, packageKey: `${subject.packageKey}:stale` })],
  ] as const) {
    await reset();
    const wrongSubject = mutate(binding.subject);
    await executeRuntimeAuthorityCommand(owner, {
      authorityId: binding.authorityId,
      eventType: "APPROVAL_CREATED",
      payload: { subject: wrongSubject, approvalSubjectHash: approvalSubjectHash(wrongSubject), createdAt: new Date().toISOString() },
      idempotencyKey: `wrong-${label}-${token}`,
    });
    await assert.rejects(() => registerSecureCoding8HRuntime(actor, owner));
    assert.deepEqual(await counts(), { courses: 0, questions: 0, choices: 0, versions: 0, mappings: 0, receipts: 0 });
  }
});

test("superseded authority is denied at registration time", async () => {
  await reset();
  await approve();
  const successorSubject = { ...binding.subject, semanticHash: await sha256Canonical({ successor: token }) };
  const successorHash = approvalSubjectHash(successorSubject);
  const successorId = `runtime-authority-python8h-${successorHash}`;
  await executeRuntimeAuthorityCommand(owner, {
    authorityId: successorId,
    eventType: "APPROVAL_CREATED",
    payload: { subject: successorSubject, approvalSubjectHash: successorHash, createdAt: new Date().toISOString() },
    idempotencyKey: `successor-${token}`,
  });
  await executeRuntimeAuthorityCommand(owner, {
    authorityId: binding.authorityId,
    eventType: "SUPERSESSION_DECLARED",
    payload: { successorAuthorityId: successorId, successorSubjectHash: successorHash, createdAt: new Date().toISOString() },
    idempotencyKey: `supersede-${token}`,
  });
  await assert.rejects(() => registerSecureCoding8HRuntime(actor, owner));
  assert.deepEqual(await counts(), { courses: 0, questions: 0, choices: 0, versions: 0, mappings: 0, receipts: 0 });
});

test("registration holds the authority root lock until commit, then concurrent revocation takes effect", async () => {
  await reset();
  await approve();
  let signalStarted!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const gated = withQueryGate(baseExecutor, async (statement) => {
    if (statement.includes("INSERT INTO public.questions")) { signalStarted(); await blocked; }
  });
  const pendingRegistration = registerSecureCoding8HRuntime(actor, new PostgresRuntimeAuthorityPersistence(gated));
  await started;
  let revokeSettled = false;
  const pendingRevocation = executeRuntimeAuthorityCommand(owner, {
    authorityId: binding.authorityId,
    eventType: "REVOCATION_DECLARED",
    payload: { reason: "concurrent disposable revocation", createdAt: new Date().toISOString() },
    idempotencyKey: `concurrent-revoke-${token}`,
  }).finally(() => { revokeSettled = true; });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(revokeSettled, false);
  release();
  assert.equal((await pendingRegistration).outcome, "REGISTERED");
  await pendingRevocation;
  await assert.rejects(() => registerSecureCoding8HRuntime(actor, owner));
  assert.deepEqual(await counts(), { courses: 1, questions: 40, choices: 160, versions: 40, mappings: 40, receipts: 1 });
});

test("D1 cannot invoke canonical writer; exact currentness is absent without a persisted approval", async () => {
  await reset();
  const noApproval = await import("../lib/services/secure-coding-8h-runtime-registration.ts");
  await assert.rejects(() => registerSecureCoding8HRuntime(actor, {} as PostgresRuntimeAuthorityPersistence), (error: unknown) => code(error) === "PYTHON_8H_POSTGRES_REQUIRED");
  assert.equal(typeof noApproval.registerSecureCoding8HRuntime, "function");
  await assert.rejects(() => registerSecureCoding8HRuntime(actor, owner));
  assert.deepEqual(await counts(), { courses: 0, questions: 0, choices: 0, versions: 0, mappings: 0, receipts: 0 });
});

test("invalid approvalSubjectHash is rejected and a different authorityId cannot authorize", async () => {
  await reset();
  await assert.rejects(() => executeRuntimeAuthorityCommand(owner, {
    authorityId: binding.authorityId,
    eventType: "APPROVAL_CREATED",
    payload: { subject: binding.subject, approvalSubjectHash: "e".repeat(64), createdAt: new Date().toISOString() },
    idempotencyKey: `wrong-subject-hash-${token}`,
  }));
  await executeRuntimeAuthorityCommand(owner, {
    authorityId: `runtime-authority:other:${binding.approvalSubjectHash}`,
    eventType: "APPROVAL_CREATED",
    payload: { subject: binding.subject, approvalSubjectHash: binding.approvalSubjectHash, createdAt: new Date().toISOString() },
    idempotencyKey: `wrong-authority-id-${token}`,
  });
  await assert.rejects(() => registerSecureCoding8HRuntime(actor, owner));
  assert.deepEqual(await counts(), { courses: 0, questions: 0, choices: 0, versions: 0, mappings: 0, receipts: 0 });
});

async function approve() {
  await executeRuntimeAuthorityCommand(owner, {
    authorityId: binding.authorityId,
    eventType: "APPROVAL_CREATED",
    payload: { subject: binding.subject, approvalSubjectHash: binding.approvalSubjectHash, createdAt: new Date().toISOString() },
    idempotencyKey: `python-8h-approval-${token}`,
  });
}

async function reset() {
  await requireSql().unsafe(`TRUNCATE public.secure_coding_8h_runtime_registrations, public.question_concepts, public.question_courses, public.question_choices, public.question_versions, public.questions, public.courses RESTART IDENTITY`);
  await requireSql().unsafe(`TRUNCATE public.runtime_authority_events, public.runtime_authority_roots`);
}

async function counts() {
  const row = (await requireSql().unsafe(`SELECT
    (SELECT count(*) FROM public.courses WHERE id=$1)::int AS courses,
    (SELECT count(*) FROM public.questions WHERE id LIKE $2)::int AS questions,
    (SELECT count(*) FROM public.question_choices WHERE question_id LIKE $2)::int AS choices,
    (SELECT count(*) FROM public.question_versions WHERE question_id LIKE $2)::int AS versions,
    (SELECT count(*) FROM public.question_courses WHERE course_id=$1)::int AS mappings,
    (SELECT count(*) FROM public.secure_coding_8h_runtime_registrations)::int AS receipts`, [binding.subject.courseId, `question-${binding.subject.courseId}-%`]))[0]!;
  return row;
}

async function applyMigration(client: ReturnType<typeof postgres>, name: string) {
  const sqlText = (await readFile(`db/postgres/migrations/${name}`, "utf8"))
    .replace(/^BEGIN;\s*$/gmu, "")
    .replace(/^COMMIT;\s*$/gmu, "");
  await client.unsafe(sqlText);
}
function requireSql() { if (!sql) throw new Error("DISPOSABLE_POSTGRES_UNAVAILABLE"); return sql; }
function createExecutor(client: ReturnType<typeof postgres>): PostgresExecutor {
  return {
    query: async <Row extends Record<string, unknown>>(statement: string, parameters: readonly PostgresQueryValue[]) => {
      const rows = await client.unsafe<Row[]>(statement, parameters as never[]);
      return { rows: [...rows], rowCount: rows.count ?? rows.length };
    },
    transaction: <T>(callback: (executor: PostgresTransactionExecutor) => Promise<T>): Promise<T> => client.begin(async (transaction) => {
      const result = await callback({
        query: async <Row extends Record<string, unknown>>(statement: string, parameters: readonly PostgresQueryValue[]) => {
          const rows = await transaction.unsafe<Row[]>(statement, parameters as never[]);
          return { rows: [...rows], rowCount: rows.count ?? rows.length };
        },
      });
      return result as unknown as Awaited<ReturnType<typeof callback>>;
    }) as unknown as Promise<T>,
    close: async () => {},
  };
}
function withTransactionSetting(base: PostgresExecutor, key: string, value: string): PostgresExecutor {
  return {
    ...base,
    transaction: async <T>(callback: (executor: PostgresTransactionExecutor) => Promise<T>) => base.transaction(async (tx) => {
      await tx.query(`SELECT set_config($1,$2,true)`, [key,value]);
      return callback(tx);
    }),
  };
}
function withQueryGate(base: PostgresExecutor, gate: (statement: string) => Promise<void>): PostgresExecutor {
  return {
    ...base,
    transaction: async <T>(callback: (executor: PostgresTransactionExecutor) => Promise<T>) => base.transaction((tx) => callback({
      query: async <Row extends Record<string, unknown>>(statement: string, parameters: readonly PostgresQueryValue[]) => { await gate(statement); return tx.query<Row>(statement, parameters); },
    })),
  };
}
function code(error: unknown) { return error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : ""; }
