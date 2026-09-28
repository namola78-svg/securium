import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import postgres from "postgres";

import type { PostgresExecutor, PostgresQueryValue, PostgresTransactionExecutor } from "../db/provider/postgres-database-provider.ts";
import { PostgresRuntimeAuthorityPersistence } from "../db/runtime-authority-postgres-persistence.ts";
import { approvalSubjectHash, type RuntimeAuthoritySubject } from "../lib/policy/runtime-authority-binding.ts";
import { executeRuntimeAuthorityCommand } from "../lib/services/runtime-authority-command-service.ts";
import {
  buildCppgCourseTheoryDraftProjectionFromBundle,
  evaluateCppgProjectionAuthorityForTesting,
  type CppgFoundationBundle,
} from "../lib/services/cppg-runtime-course-registration.ts";
import {
  cleanupOwnedPostgresContainer,
  createOwnedPostgresContainer,
  getPublishedPostgresPort,
} from "../scripts/owned-postgres-container.mjs";

const password = "runtime-authority-foundation-test-password";
const ownerToken = randomUUID();
(process.env as unknown as { NODE_ENV?: string }).NODE_ENV = "test";
let ownedContainer: Awaited<ReturnType<typeof createOwnedPostgresContainer>> | undefined;
let sql: ReturnType<typeof postgres> | undefined;
let executor: PostgresExecutor | undefined;
let owner: PostgresRuntimeAuthorityPersistence;

const subject: RuntimeAuthoritySubject = Object.freeze({
  contractVersion: "SECURIUM_RUNTIME_AUTHORITY_SUBJECT_V1",
  registrationPurpose: "COURSE_THEORY_DRAFT",
  courseId: "course-cppg",
  courseSlug: "cppg",
  packageKey: "securium-cppg-foundation",
  sourceManifestId: "SECURIUM_CPPG_FOUNDATION_SOURCE_SHA256_V1",
  sourcePackageHash: "a".repeat(64),
  foundationId: "SECURIUM_CPPG_FOUNDATION_V1",
  foundationHash: "b".repeat(64),
  runtimeRevisionId: "cppg-runtime-revision-1",
  semanticHash: "c".repeat(64),
  publicationAuthority: "NOT_GRANTED",
});

before(async () => {
  ownedContainer = await createOwnedPostgresContainer({
    name: `securium-runtime-authority-${ownerToken}`,
    ownerToken,
    password,
    receiptPath: null,
  });
  const port = await getPublishedPostgresPort(ownedContainer);
  sql = postgres(
    `postgres://postgres:${password}@127.0.0.1:${port}/postgres`,
    {
      max: 1,
      prepare: false,
      ssl: false,
    },
  );
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await sql`SELECT 1`;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  await sql.unsafe(`CREATE TABLE app_schema_migrations (
    id text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  await sql.unsafe(
    await readFile(
      "db/postgres/migrations/0053_runtime_authority_postgres_persistence.sql",
      "utf8",
    ),
  );
  executor = createDisposableExecutor(requireSql());
  owner = new PostgresRuntimeAuthorityPersistence(executor);
});

after(async () => {
  await executor?.close?.().catch(() => {});
  if (ownedContainer) {
    await cleanupOwnedPostgresContainer(ownedContainer);
  }
});

function approval(idempotencyKey = "approval-1") {
  return {
    authorityId: "authority-cppg-v1",
    eventType: "APPROVAL_CREATED",
    payload: {
      subject,
      approvalSubjectHash: approvalSubjectHash(subject),
      createdAt: "2026-09-28T00:00:00.000Z",
    },
    idempotencyKey,
  };
}

test("PostgreSQL authority writer appends approval once and exact replay is idempotent", async () => {
  const first = await executeRuntimeAuthorityCommand(owner, approval(), {
    eventId: () => "authority-event-1",
    now: () => "2026-09-28T00:00:00.000Z",
  });
  assert.equal(first.outcome, "APPENDED");
  assert.equal(first.event.sequence, 1);

  const storedPayloadType = await requireSql().unsafe(
    `SELECT jsonb_typeof("payload_json") AS payload_type
     FROM "runtime_authority_events"
     WHERE "event_id" = 'authority-event-1'`,
  );
  assert.equal(storedPayloadType[0]?.payload_type, "object");

  const replay = await executeRuntimeAuthorityCommand(owner, approval(), {
    eventId: () => "authority-event-unused",
    now: () => "2026-09-28T00:01:00.000Z",
  });
  assert.equal(replay.outcome, "REPLAY_EXISTING");
  assert.equal(replay.event.eventId, "authority-event-1");

  const rows = await requireSql().unsafe(
    `SELECT
      (SELECT count(*)::int FROM "runtime_authority_roots") AS roots,
      (SELECT count(*)::int FROM "runtime_authority_events") AS events`,
  );
  assert.deepEqual(rows[0], { roots: 1, events: 1 });
});

test("same authority-local idempotency key with different command fails closed", async () => {
  await assert.rejects(
    executeRuntimeAuthorityCommand(owner, {
      ...approval(),
      payload: {
        ...approval().payload,
        createdAt: "2026-09-28T00:02:00.000Z",
      },
    }),
    (error: unknown) => errorCode(error) === "IDEMPOTENCY_CONFLICT",
  );
});

test("revocation appends sequence two and blocks later new commands", async () => {
  const revoked = await executeRuntimeAuthorityCommand(
    owner,
    {
      authorityId: "authority-cppg-v1",
      eventType: "REVOCATION_DECLARED",
      payload: {
        reason: "synthetic disposable test revocation",
        createdAt: "2026-09-28T00:03:00.000Z",
      },
      idempotencyKey: "revoke-1",
    },
    {
      eventId: () => "authority-event-2",
      now: () => "2026-09-28T00:03:00.000Z",
    },
  );
  assert.equal(revoked.outcome, "APPENDED");
  assert.equal(revoked.event.sequence, 2);

  await assert.rejects(
    executeRuntimeAuthorityCommand(
      owner,
      {
        authorityId: "authority-cppg-v1",
        eventType: "REVOCATION_DECLARED",
        payload: {
          reason: "second revocation must not append",
          createdAt: "2026-09-28T00:04:00.000Z",
        },
        idempotencyKey: "revoke-2",
      },
      {
        eventId: () => "authority-event-3",
        now: () => "2026-09-28T00:04:00.000Z",
      },
    ),
    (error: unknown) => errorCode(error) === "AUTHORITY_REVOKED",
  );

  const rows = await requireSql().unsafe(
    `SELECT "latest_sequence" AS sequence
     FROM "runtime_authority_roots"
     WHERE "authority_id" = 'authority-cppg-v1'`,
  );
  assert.equal(rows[0]?.sequence, 2);
});

test("authority event table is database-enforced append-only", async () => {
  const before = await requireSql().unsafe(
    `SELECT "idempotency_key" AS key
     FROM "runtime_authority_events"
     WHERE "event_id" = 'authority-event-1'`,
  );

  await requireSql().unsafe(
    `UPDATE "runtime_authority_events"
     SET "idempotency_key" = 'tampered'
     WHERE "event_id" = 'authority-event-1'`,
  );
  await requireSql().unsafe(
    `DELETE FROM "runtime_authority_events"
     WHERE "event_id" = 'authority-event-1'`,
  );

  const after = await requireSql().unsafe(
    `SELECT "idempotency_key" AS key
     FROM "runtime_authority_events"
     WHERE "event_id" = 'authority-event-1'`,
  );
  assert.equal(before.length, 1);
  assert.equal(after.length, 1);
  assert.equal(after[0]?.key, before[0]?.key);
});

test("CPPG approval lifecycle persists, reloads, revokes, and supersedes through PostgreSQL", async () => {
  const bundle = await readCppgFoundationBundle();
  const options = { actorUserId: "disposable-postgres-cppg-test" };
  const original = await buildCppgCourseTheoryDraftProjectionFromBundle(bundle, options);
  const changedUnit = bundle.theory.units[0];
  assert.ok(changedUnit);
  const successor = await buildCppgCourseTheoryDraftProjectionFromBundle({
    ...bundle,
    theory: {
      ...bundle.theory,
      units: [{ ...changedUnit, purpose: `${changedUnit.purpose} PostgreSQL successor test` }, ...bundle.theory.units.slice(1)],
    },
  }, options);

  const originalAuthority = await evaluateCppgProjectionAuthorityForTesting(original, owner);
  assert.equal(originalAuthority.state.state, "NOT_CURRENT");
  const originalApproval = await originalAuthority.approve(`cppg-pg-approval-${ownerToken}`);
  assert.equal(originalApproval.outcome, "APPENDED");
  assert.equal(originalApproval.event.sequence, 1);

  const reloadedApproval = await evaluateCppgProjectionAuthorityForTesting(original, owner);
  assert.equal(reloadedApproval.state.state, "CURRENT");
  assert.equal(reloadedApproval.identity.approvalSubjectHash, originalAuthority.identity.approvalSubjectHash);
  const exactReplay = await reloadedApproval.approve(`cppg-pg-approval-${ownerToken}`);
  assert.equal(exactReplay.outcome, "REPLAY_EXISTING");
  assert.equal(exactReplay.event.eventId, originalApproval.event.eventId);

  const successorAuthority = await evaluateCppgProjectionAuthorityForTesting(successor, owner);
  const successorApproval = await successorAuthority.approve(`cppg-pg-successor-${ownerToken}`);
  assert.equal(successorApproval.event.sequence, 1);
  const supersession = await successorAuthority.supersede(originalAuthority.identity.authorityId, `cppg-pg-supersede-${ownerToken}`);
  assert.equal(supersession.event.sequence, 2);
  assert.equal((await evaluateCppgProjectionAuthorityForTesting(original, owner)).state.state, "NOT_CURRENT");
  assert.equal((await evaluateCppgProjectionAuthorityForTesting(successor, owner)).state.state, "CURRENT");

  const revocation = await successorAuthority.revoke(`cppg-pg-revoke-${ownerToken}`, "disposable PostgreSQL CPPG lifecycle test");
  assert.equal(revocation.event.sequence, 2);
  const replayedRevocation = await (await evaluateCppgProjectionAuthorityForTesting(successor, owner))
    .revoke(`cppg-pg-revoke-${ownerToken}`, "disposable PostgreSQL CPPG lifecycle test");
  assert.equal(replayedRevocation.outcome, "REPLAY_EXISTING");
  assert.equal((await evaluateCppgProjectionAuthorityForTesting(successor, owner)).state.state, "NOT_CURRENT");

  const storedPayload = await requireSql().unsafe(
    `SELECT jsonb_typeof("payload_json") AS payload_type
     FROM "runtime_authority_events"
     WHERE "authority_id" = $1 AND "event_type" = 'APPROVAL_CREATED'`,
    [originalAuthority.identity.authorityId],
  );
  assert.deepEqual(storedPayload, [{ payload_type: "object" }]);
});

async function readCppgFoundationBundle(): Promise<CppgFoundationBundle> {
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

function requireSql(): NonNullable<typeof sql> {
  if (!sql) throw new Error("TEST_POSTGRES_CLIENT_UNAVAILABLE");
  return sql;
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}


function createDisposableExecutor(client: NonNullable<typeof sql>): PostgresExecutor {
  const queryWith = async <Row extends Record<string, unknown>>(
    connection: { unsafe: (text: string, parameters?: readonly unknown[]) => PromiseLike<Row[] & { count?: number | null }> },
    text: string,
    parameters: readonly PostgresQueryValue[],
  ) => {
    const rows = await connection.unsafe(text, parameters);
    return {
      rows: Array.from(rows),
      rowCount: typeof rows.count === "number" ? rows.count : rows.length,
    };
  };

  return {
    query: <Row extends Record<string, unknown>>(text: string, parameters: readonly PostgresQueryValue[]) =>
      queryWith<Row>(client as never, text, parameters),
    async transaction<T>(callback: (executor: PostgresTransactionExecutor) => Promise<T>): Promise<T> {
      let result!: T;
      await client.begin(async (transaction) => {
        result = await callback({
          query: <Row extends Record<string, unknown>>(text: string, parameters: readonly PostgresQueryValue[]) =>
            queryWith<Row>(transaction as never, text, parameters),
        });
      });
      return result;
    },
    async close() {
      await client.end({ timeout: 5 });
    },
  };
}
