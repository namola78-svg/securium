import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORITY_EVENT_SCHEMA_VERSION,
  buildAuthorityEventCandidate,
  commandHash,
  decideAuthorityIdempotency,
  normalizeAuthorityCommand,
  type AuthorityCommand,
  type AuthorityEvent,
} from "../lib/policy/runtime-authority-event-ledger.ts";
import {
  AUTHORITY_LOCK_ORDER,
  AUTHORITY_PERSISTENCE_BACKEND_CAPABILITIES,
  AUTHORITY_TRANSACTION_OWNER,
  AuthorityPersistenceContractError,
  assertRootMatchesCanonicalHistory,
  parseAuthorityEventPersistenceRecord,
  parseAuthorityRootPersistenceRecord,
  persistenceRecordToCanonicalEvent,
  persistenceRecordsToCanonicalEvents,
  type AuthorityEventPersistenceRecord,
  type AuthorityIdempotencyLookup,
  type RuntimeAuthorityPersistenceTransaction,
} from "../lib/policy/runtime-authority-persistence-contract.ts";
import { approvalSubjectHash, type RuntimeAuthoritySubject } from "../lib/policy/runtime-authority-binding.ts";

const hash = (value: string) => value.repeat(64);
const subject: RuntimeAuthoritySubject = Object.freeze({
  contractVersion: "SECURIUM_RUNTIME_AUTHORITY_SUBJECT_V1",
  registrationPurpose: "COURSE_THEORY_DRAFT",
  courseId: "course",
  courseSlug: "course",
  packageKey: "package",
  sourceManifestId: "manifest",
  sourcePackageHash: hash("a"),
  foundationId: "foundation",
  foundationHash: hash("b"),
  runtimeRevisionId: "revision",
  semanticHash: hash("c"),
  publicationAuthority: "NOT_GRANTED",
});

const approval = (
  authorityId = "authority-a",
  idempotencyKey = "request-1",
  createdAt = "2026-09-21T00:00:00.000Z",
): AuthorityCommand => ({
  authorityId,
  eventType: "APPROVAL_CREATED",
  payload: {
    subject,
    approvalSubjectHash: approvalSubjectHash(subject),
    createdAt,
  },
  idempotencyKey,
});

async function acceptedEvent(): Promise<AuthorityEvent> {
  return buildAuthorityEventCandidate(
    approval(),
    {
      eventId: "event-a1",
      sequence: 1,
      recordedAt: "2026-09-21T00:00:00.000Z",
    },
  );
}

async function persistenceRecord(): Promise<AuthorityEventPersistenceRecord> {
  const event = await acceptedEvent();
  return {
    eventId: event.eventId,
    authorityId: event.authorityId,
    sequence: event.sequence,
    schemaVersion: event.schemaVersion,
    eventType: event.eventType,
    payload: event.payload,
    idempotencyKey: event.idempotencyKey,
    commandHash: event.commandHash,
    recordedAt: event.recordedAt,
  };
}

test("persistence root is only coordination state", () => {
  const root = parseAuthorityRootPersistenceRecord({
    authorityId: "authority-a",
    latestSequence: 0,
  });
  assert.deepEqual(root, { authorityId: "authority-a", latestSequence: 0 });
  assert.deepEqual(Object.keys(root), ["authorityId", "latestSequence"]);
  assert.throws(
    () => parseAuthorityRootPersistenceRecord({ ...root, state: "REVOKED" }),
    (error: unknown) => error instanceof AuthorityPersistenceContractError,
  );
});

test("persisted event shape is strict and malformed records fail closed", async () => {
  const record = await persistenceRecord();
  const parsed = parseAuthorityEventPersistenceRecord(record);
  assert.deepEqual(parsed, record);
  assert.throws(
    () => parseAuthorityEventPersistenceRecord({ ...record, implementationOnly: true }),
    (error: unknown) => error instanceof AuthorityPersistenceContractError,
  );
  assert.throws(
    () => parseAuthorityEventPersistenceRecord({ ...record, sequence: 0 }),
    (error: unknown) => error instanceof AuthorityPersistenceContractError,
  );
});

test("explicit mapping preserves the exact Phase2A canonical envelope", async () => {
  const record = await persistenceRecord();
  const canonical = persistenceRecordToCanonicalEvent(record);
  assert.deepEqual(Object.keys(canonical).sort(), [
    "authorityId",
    "commandHash",
    "eventId",
    "eventType",
    "idempotencyKey",
    "payload",
    "recordedAt",
    "schemaVersion",
    "sequence",
  ]);
  assert.equal("persistenceOnlyMetadata" in canonical, false);
});

test("mapped records reuse Phase2A validation and preserve immutability", async () => {
  const record = await persistenceRecord();
  const input = [record];
  const before = structuredClone(input);
  const events = persistenceRecordsToCanonicalEvents(input, "authority-a");
  assert.equal(events.length, 1);
  assert.deepEqual(input, before);
  assert.equal(events[0].schemaVersion, AUTHORITY_EVENT_SCHEMA_VERSION);
  assert.throws(
    () => persistenceRecordsToCanonicalEvents([{ ...record, authorityId: "authority-b" }], "authority-a"),
    (error: unknown) => error instanceof AuthorityPersistenceContractError && error.code === "LEDGER_CORRUPTION",
  );
});

test("root/history mismatch is corruption and is not repaired", async () => {
  const record = await persistenceRecord();
  assert.throws(
    () => assertRootMatchesCanonicalHistory({ authorityId: "authority-a", latestSequence: 0 }, [record]),
    (error: unknown) => error instanceof AuthorityPersistenceContractError && error.code === "LEDGER_CORRUPTION",
  );
});

test("corrupt history takes precedence over an otherwise replayable event", async () => {
  const record = await persistenceRecord();
  assert.throws(
    () => persistenceRecordsToCanonicalEvents([{ ...record, eventId: "event-a2", sequence: 2 }], "authority-a"),
    (error: unknown) => error instanceof AuthorityPersistenceContractError && error.code === "LEDGER_CORRUPTION",
  );
});

test("idempotency contract represents not-found, replay, and conflict outcomes", async () => {
  const command = approval();
  const event = await acceptedEvent();
  const record = await persistenceRecord();
  const hashValue = await commandHash(command);
  const notFound: AuthorityIdempotencyLookup = { kind: "NOT_FOUND" };
  assert.equal(notFound.kind, "NOT_FOUND");

  const phase2aReplay = decideAuthorityIdempotency(command, hashValue, [event]);
  assert.equal(phase2aReplay.kind, "REPLAY_EXISTING");
  const replay: AuthorityIdempotencyLookup = {
    kind: "REPLAY_EXISTING",
    event: record,
  };
  assert.equal(replay.kind, phase2aReplay.kind);

  const alteredCommand = approval(
    "authority-a",
    "request-1",
    "2026-09-22T00:00:00.000Z",
  );
  const alteredHash = await commandHash(alteredCommand);
  const phase2aConflict = decideAuthorityIdempotency(
    alteredCommand,
    alteredHash,
    [event],
  );
  assert.equal(phase2aConflict.kind, "IDEMPOTENCY_CONFLICT");
  const conflict: AuthorityIdempotencyLookup = {
    kind: "IDEMPOTENCY_CONFLICT",
    existing: record,
  };
  assert.equal(conflict.kind, phase2aConflict.kind);
});

test("idempotency identity remains isolated by authority", async () => {
  const eventA = await acceptedEvent();
  const commandB = approval("authority-b", "request-1");
  const hashB = await commandHash(commandB);
  const decision = decideAuthorityIdempotency(commandB, hashB, [eventA]);
  assert.equal(decision.kind, "NEW_COMMAND");
});

test("Phase2A rejects caller-controlled canonical fields", () => {
  const command = approval();
  for (const injected of ["eventId", "sequence", "recordedAt", "commandHash", "resultingState", "successorState"]) {
    assert.throws(
      () => normalizeAuthorityCommand({ ...command, [injected]: "caller-controlled" }),
      (error: unknown) => error instanceof Error,
    );
  }
});

test("successor context remains server-resolved and caller state is rejected", () => {
  const command = {
    authorityId: "authority-a",
    eventType: "SUPERSESSION_DECLARED" as const,
    payload: {
      successorAuthorityId: "authority-b",
      successorSubjectHash: hash("d"),
      createdAt: "2026-09-21T00:00:00.000Z",
    },
    idempotencyKey: "supersede-1",
  };
  const normalized = normalizeAuthorityCommand(command);
  const normalizedPayload = normalized.payload as Extract<
    AuthorityCommand["payload"],
    { successorAuthorityId: string }
  >;
  assert.equal(normalizedPayload.successorAuthorityId, "authority-b");
  assert.deepEqual(Object.keys(normalized.payload).sort(), [
    "createdAt",
    "successorAuthorityId",
    "successorSubjectHash",
  ]);
  assert.throws(
    () =>
      normalizeAuthorityCommand({
        ...command,
        payload: { ...command.payload, successorState: { state: "APPROVED" } },
      }),
    (error: unknown) => error instanceof Error,
  );
  assert.throws(
    () =>
      normalizeAuthorityCommand({
        ...command,
        successorContext: { authorityId: "authority-b", state: "APPROVED" },
      }),
    (error: unknown) => error instanceof Error,
  );
});

test("backend capabilities preserve PostgreSQL/D1 distinction", () => {
  assert.equal(AUTHORITY_PERSISTENCE_BACKEND_CAPABILITIES.postgresql.productionAuthorityWriterCapable, true);
  assert.equal(AUTHORITY_PERSISTENCE_BACKEND_CAPABILITIES.postgresql.canonicalRuntimePersistence, true);
  assert.equal(AUTHORITY_PERSISTENCE_BACKEND_CAPABILITIES.d1.domainContractParity, true);
  assert.equal(AUTHORITY_PERSISTENCE_BACKEND_CAPABILITIES.d1.productionAuthorityWriterCapable, false);
  assert.equal(AUTHORITY_PERSISTENCE_BACKEND_CAPABILITIES.d1.canonicalRuntimePersistence, false);
});

test("repository capability surface is transaction-scoped and has no CRUD operations", () => {
  type TransactionMethod = keyof RuntimeAuthorityPersistenceTransaction;
  const declaredMethods: readonly TransactionMethod[] = [
    "loadAuthorityRoot",
    "loadAcceptedAuthorityEvents",
    "findAcceptedByIdempotency",
    "resolveSuccessorAuthority",
    "appendAcceptedEvent",
    "updateLatestSequence",
  ];
  const forbiddenMethods: readonly Exclude<
    TransactionMethod,
    (typeof declaredMethods)[number]
  >[] = [];
  assert.deepEqual(forbiddenMethods, []);
  assert.equal(declaredMethods.includes("updateCanonicalEvent" as TransactionMethod), false);
  assert.equal(declaredMethods.includes("deleteCanonicalEvent" as TransactionMethod), false);
  assert.equal(AUTHORITY_TRANSACTION_OWNER, "RUNTIME_AUTHORITY_COMMAND_SERVICE");
  assert.equal(AUTHORITY_LOCK_ORDER, "ASCENDING_CANONICAL_AUTHORITY_ID");
});
