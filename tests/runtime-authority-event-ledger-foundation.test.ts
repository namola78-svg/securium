import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORITY_COMMAND_HASH_DOMAIN,
  AUTHORITY_EVENT_SCHEMA_VERSION,
  buildAuthorityEventCandidate,
  commandHash,
  decideAuthorityIdempotency,
  normalizeAuthorityCommand,
  replayAuthorityLedger,
  validateAuthorityLedger,
  type AuthorityCommand,
  type AuthorityEvent,
} from "../lib/policy/runtime-authority-event-ledger.ts";
import { approvalSubjectHash, type RuntimeAuthoritySubject } from "../lib/policy/runtime-authority-binding.ts";
import { reduceRuntimeAuthorityLifecycle, type RuntimeAuthorityLifecycleEvent } from "../lib/policy/runtime-authority-lifecycle.ts";

const hash = (c: string) => c.repeat(64);
const subject: RuntimeAuthoritySubject = Object.freeze({ contractVersion: "SECURIUM_RUNTIME_AUTHORITY_SUBJECT_V1", registrationPurpose: "COURSE_THEORY_DRAFT", courseId: "course", courseSlug: "course", packageKey: "package", sourceManifestId: "manifest", sourcePackageHash: hash("a"), foundationId: "foundation", foundationHash: hash("b"), runtimeRevisionId: "revision", semanticHash: hash("c"), publicationAuthority: "NOT_GRANTED" });
const approval = (authorityId = "authority-a"): AuthorityCommand => ({ authorityId, eventType: "APPROVAL_CREATED", payload: { subject, approvalSubjectHash: approvalSubjectHash(subject), createdAt: "2026-09-21T00:00:00.000Z" }, idempotencyKey: "request-1" });
const revocation = (authorityId = "authority-a", key = "request-2"): AuthorityCommand => ({ authorityId, eventType: "REVOCATION_DECLARED", payload: { reason: "test", createdAt: "2026-09-21T00:01:00.000Z" }, idempotencyKey: key });
const supersession = (authorityId = "authority-a", successorAuthorityId = "authority-b", key = "request-2"): AuthorityCommand => ({ authorityId, eventType: "SUPERSESSION_DECLARED", payload: { successorAuthorityId, successorSubjectHash: approvalSubjectHash(subject), createdAt: "2026-09-21T00:02:00.000Z" }, idempotencyKey: key });
const supersessionEvent = (authorityId: string, successorAuthorityId: string, successorSubject = subject, createdAt = "2026-09-21T00:02:00.000Z"): RuntimeAuthorityLifecycleEvent => ({ contractVersion: "SECURIUM_RUNTIME_AUTHORITY_LIFECYCLE_V1", eventType: "SUPERSESSION_DECLARED", authorityId, successorAuthorityId, successorSubjectHash: approvalSubjectHash(successorSubject), createdAt });
const expectCode = (fn: () => unknown, code: string) => assert.throws(fn, (error: unknown) => error instanceof Error && ((error as Error & { code?: string }).code === code || error.message.includes(code)));
async function event(command: AuthorityCommand, eventId: string, sequence: number, existing: readonly AuthorityEvent[] = [], replayContext = {}): Promise<AuthorityEvent> { return buildAuthorityEventCandidate(command, { eventId, sequence, recordedAt: "2026-09-21T00:02:00.000Z" }, existing, replayContext); }

test("strict command rejects trusted field injection and unknown fields", () => {
  expectCode(() => normalizeAuthorityCommand({ ...approval(), eventId: "caller-event" }), "MALFORMED_AUTHORITY_COMMAND");
  const command = { ...approval() } as Record<string, unknown>;
  Object.defineProperty(command, "sequence", { value: 1, enumerable: false });
  expectCode(() => normalizeAuthorityCommand(command), "MALFORMED_AUTHORITY_COMMAND");
  expectCode(() => normalizeAuthorityCommand({ ...approval(), eventType: "UNKNOWN" }), "UNKNOWN_AUTHORITY_EVENT");
  for (const invalid of [
    { ...approval(), authorityId: undefined },
    { ...approval(), idempotencyKey: undefined },
    { ...approval(), payload: "wrong" },
    { ...approval(), recordedAt: "caller-time" },
    { ...approval(), resultingState: "REVOKED" },
    { ...approval(), binding: { trusted: true } },
  ]) expectCode(() => normalizeAuthorityCommand(invalid), "MALFORMED_AUTHORITY_COMMAND");
  const symbolCommand = { ...approval(), [Symbol("injected")]: true };
  expectCode(() => normalizeAuthorityCommand(symbolCommand), "MALFORMED_AUTHORITY_COMMAND");
  const customPrototype = Object.create({ injected: true }) as Record<string, unknown>;
  Object.assign(customPrototype, approval());
  expectCode(() => normalizeAuthorityCommand(customPrototype), "MALFORMED_AUTHORITY_COMMAND");
});

test("canonical command hash is stable and semantic", async () => {
  const first = await commandHash(approval());
  const approvalPayload = approval().payload as Extract<AuthorityCommand["payload"], { subject: RuntimeAuthoritySubject }>;
  const reordered = { idempotencyKey: "request-1", payload: { createdAt: approvalPayload.createdAt, approvalSubjectHash: approvalPayload.approvalSubjectHash, subject }, eventType: "APPROVAL_CREATED", authorityId: "authority-a" } as unknown as AuthorityCommand;
  assert.equal(first, await commandHash(reordered));
  assert.notEqual(first, await commandHash(revocation("authority-a", "request-1")));
  assert.notEqual(first, await commandHash(approval("authority-b")));
  assert.equal(first, "52156a3518f1652c34b9806ff05d5b734104dc0680f9d32b93941b243f48f309");
  assert.equal(first, await commandHash({ ...approval(), idempotencyKey: "different-retry-key" }));
  assert.equal(first.length, 64);
  assert.equal(AUTHORITY_COMMAND_HASH_DOMAIN, "SECURIUM_RUNTIME_AUTHORITY_COMMAND_V1");
});

test("idempotency is authority-local and does not deduplicate by hash alone", async () => {
  const first = await event(approval(), "event-a1", 1);
  const hashValue = await commandHash(approval());
  assert.equal(decideAuthorityIdempotency(approval(), hashValue, [first]).kind, "REPLAY_EXISTING");
  assert.equal(decideAuthorityIdempotency({ ...approval(), idempotencyKey: "altered" }, hashValue, [first]).kind, "NEW_COMMAND");
  assert.equal(decideAuthorityIdempotency({ ...approval("authority-b") }, hashValue, [first]).kind, "NEW_COMMAND");
  const altered = { ...approval(), payload: { ...approval().payload, createdAt: "2026-09-21T00:03:00.000Z" } } as AuthorityCommand;
  assert.equal(decideAuthorityIdempotency(altered, await commandHash(altered), [first]).kind, "IDEMPOTENCY_CONFLICT");
  assert.equal(decideAuthorityIdempotency({ ...approval(), idempotencyKey: "request-1" }, "f".repeat(64), [first]).kind, "IDEMPOTENCY_CONFLICT");
});

test("sequence starts at one and rejects gaps, duplicates, and wrong authority", async () => {
  const first = await event(approval(), "event-a1", 1);
  assert.equal(replayAuthorityLedger("authority-a", []).lastSequence, 0);
  assert.equal(first.sequence, 1);
  const second = await event(revocation(), "event-a2", 2, [first]);
  assert.equal(replayAuthorityLedger("authority-a", [first, second]).lastSequence, 2);
  expectCode(() => validateAuthorityLedger([{ ...second, eventId: "event-a3", sequence: 3 }], "authority-a"), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
  expectCode(() => validateAuthorityLedger([{ ...first, eventId: "event-a2" }, first], "authority-a"), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
  expectCode(() => validateAuthorityLedger([first], "authority-b"), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
});

test("replay uses lifecycle reducer and preserves terminal behavior", async () => {
  const first = await event(approval(), "event-a1", 1);
  const terminal = await event(revocation(), "event-a2", 2, [first]);
  const replay = replayAuthorityLedger("authority-a", [first, terminal]);
  assert.equal(replay.state, "REVOKED");
  assert.equal(replay.eventCount, 2);
  const exact = await buildAuthorityEventCandidate(revocation(), { eventId: "event-a3", sequence: 3, recordedAt: "2026-09-21T00:03:00.000Z" }, [first, terminal]).catch((error: unknown) => error);
  assert.equal((exact as Error & { code?: string }).code, "AUTHORITY_COMMAND_REPLAY");
  expectCode(() => replayAuthorityLedger("authority-a", [first, terminal, { ...terminal, eventId: "event-a3", sequence: 3, idempotencyKey: "new-key", payload: { ...terminal.payload, reason: "second" } }]), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
});

test("replay is deterministic and does not mutate histories or payloads", async () => {
  const first = await event(approval(), "event-a1", 1);
  const terminal = await event(revocation(), "event-a2", 2, [first]);
  const history = [first, terminal];
  const before = structuredClone(history);
  const one = replayAuthorityLedger("authority-a", history);
  const two = replayAuthorityLedger("authority-a", history);
  assert.deepEqual(one, two);
  assert.deepEqual(history, before);
  const command = approval();
  const commandBefore = structuredClone(command);
  await commandHash(command);
  normalizeAuthorityCommand(command);
  decideAuthorityIdempotency(command, await commandHash(command), [first]);
  assert.deepEqual(command, commandBefore);
});

test("event envelope is strict and duplicate event/idempotency identities fail closed", async () => {
  const first = await event(approval(), "event-a1", 1);
  assert.equal(first.schemaVersion, AUTHORITY_EVENT_SCHEMA_VERSION);
  expectCode(() => validateAuthorityLedger([{ ...first, trustedState: "REVOKED" } as AuthorityEvent], "authority-a"), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
  const hidden = { ...first } as Record<string, unknown>;
  Object.defineProperty(hidden, "trustedState", { value: "REVOKED", enumerable: false });
  expectCode(() => validateAuthorityLedger([hidden as AuthorityEvent], "authority-a"), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
  const symbol = { ...first, [Symbol("trustedState")]: "REVOKED" };
  expectCode(() => validateAuthorityLedger([symbol as AuthorityEvent], "authority-a"), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
  const customPrototype = Object.create({ trustedState: "REVOKED" }) as Record<string, unknown>;
  Object.assign(customPrototype, first);
  expectCode(() => validateAuthorityLedger([customPrototype as AuthorityEvent], "authority-a"), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
  expectCode(() => validateAuthorityLedger([{ ...first, eventId: "event-a1" }, { ...first, sequence: 2, eventId: "event-a1" }], "authority-a"), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
  expectCode(() => validateAuthorityLedger([{ ...first }, { ...first, sequence: 2, eventId: "event-a2" }], "authority-a"), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
  expectCode(() => validateAuthorityLedger([{ ...first, schemaVersion: 2 } as unknown as AuthorityEvent], "authority-a"), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
});

test("persisted duplicate lifecycle fingerprints fail closed even with new identities", async () => {
  const first = await event(approval(), "event-a1", 1);
  const duplicate = { ...first, eventId: "event-a2", sequence: 2, idempotencyKey: "request-duplicate" };
  expectCode(() => replayAuthorityLedger("authority-a", [first, duplicate]), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
});

test("candidate construction is server-context-owned and consumes no sequence on replay", async () => {
  const first = await event(approval(), "event-a1", 1);
  const replay = await buildAuthorityEventCandidate(approval(), { eventId: "caller-event", sequence: 2, recordedAt: "2026-09-21T00:03:00.000Z" }, [first]).catch((error: unknown) => error);
  assert.equal((replay as Error & { code?: string }).code, "AUTHORITY_COMMAND_REPLAY");
  assert.equal(first.eventId, "event-a1");
  await assert.rejects(() => buildAuthorityEventCandidate(revocation(), { eventId: "event-a2", sequence: 1, recordedAt: "2026-09-21T00:03:00.000Z" }, [first]), (error: unknown) => error instanceof Error && (error as Error & { code?: string }).code === "AUTHORITY_SEQUENCE_CONFLICT");
});

test("successor validation preserves self, subject, and multiple-successor rejection", () => {
  const approvedA: RuntimeAuthorityLifecycleEvent = { contractVersion: "SECURIUM_RUNTIME_AUTHORITY_LIFECYCLE_V1", eventType: "APPROVAL_CREATED", authorityId: "authority-a", subject, approvalSubjectHash: approvalSubjectHash(subject), createdAt: "2026-09-21T00:00:00.000Z" };
  const approvedB: RuntimeAuthorityLifecycleEvent = { ...approvedA, authorityId: "authority-b" };
  const valid = reduceRuntimeAuthorityLifecycle([approvedA, approvedB, supersessionEvent("authority-a", "authority-b")]);
  assert.equal(valid.records.get("authority-a")?.state, "SUPERSEDED");
  expectCode(() => reduceRuntimeAuthorityLifecycle([approvedA, supersessionEvent("authority-a", "authority-a")]), "AUTHORITY_LIFECYCLE_UNAVAILABLE");
  expectCode(() => reduceRuntimeAuthorityLifecycle([approvedA, approvedB, supersessionEvent("authority-a", "authority-b", { ...subject, semanticHash: hash("d") })]), "APPROVAL_BINDING_MISMATCH");
  expectCode(() => reduceRuntimeAuthorityLifecycle([approvedA, approvedB, supersessionEvent("authority-a", "authority-b"), supersessionEvent("authority-a", "authority-c")]), "AUTHORITY_SUPERSEDED");
});

test("supersession replay resolves a successor through read-only authority context", async () => {
  const approvedA = await event(approval("authority-a"), "event-a1", 1);
  const context = { authoritiesById: new Map([["authority-b", { authorityId: "authority-b", subject, approvalSubjectHash: approvalSubjectHash(subject) }]]) };
  const approvedB = await event(approval("authority-b"), "event-b1", 1);
  const successor = await event(supersession(), "event-a2", 2, [approvedA], context);
  assert.equal(replayAuthorityLedger("authority-a", [approvedA, successor], context).state, "SUPERSEDED");
  expectCode(() => replayAuthorityLedger("authority-a", [approvedA, successor]), "AUTHORITY_LIFECYCLE_UNAVAILABLE");
  const wrongAuthority = { ...approvedB, authorityId: "authority-a", eventId: "event-a2", sequence: 2, idempotencyKey: "wrong" };
  expectCode(() => replayAuthorityLedger("authority-a", [approvedA, wrongAuthority], context), "AUTHORITY_LEDGER_INTEGRITY_ERROR");
});

test("new terminal commands are lifecycle rejections, while exact retries remain replayable", async () => {
  const first = await event(approval(), "event-a1", 1);
  const terminal = await event(revocation(), "event-a2", 2, [first]);
  const newCommand = revocation("authority-a", "request-3");
  await assert.rejects(() => buildAuthorityEventCandidate(newCommand, { eventId: "event-a3", sequence: 3, recordedAt: "2026-09-21T00:04:00.000Z" }, [first, terminal]), (error: unknown) => error instanceof Error && (error as Error & { code?: string }).code === "AUTHORITY_REVOKED");
  const exact = await buildAuthorityEventCandidate(revocation(), { eventId: "unused", sequence: 3, recordedAt: "2026-09-21T00:04:00.000Z" }, [first, terminal]).catch((error: unknown) => error);
  assert.equal((exact as Error & { code?: string }).code, "AUTHORITY_COMMAND_REPLAY");
});

test("successor revocation does not resurrect predecessor and same-subject authorities stay isolated", () => {
  const approvedA: RuntimeAuthorityLifecycleEvent = { contractVersion: "SECURIUM_RUNTIME_AUTHORITY_LIFECYCLE_V1", eventType: "APPROVAL_CREATED", authorityId: "authority-a", subject, approvalSubjectHash: approvalSubjectHash(subject), createdAt: "2026-09-21T00:00:00.000Z" };
  const approvedB: RuntimeAuthorityLifecycleEvent = { ...approvedA, authorityId: "authority-b" };
  const revokedB: RuntimeAuthorityLifecycleEvent = { contractVersion: "SECURIUM_RUNTIME_AUTHORITY_LIFECYCLE_V1", eventType: "REVOCATION_DECLARED", authorityId: "authority-b", reason: "test", createdAt: "2026-09-21T00:03:00.000Z" };
  const result = reduceRuntimeAuthorityLifecycle([approvedA, approvedB, supersessionEvent("authority-a", "authority-b"), revokedB]);
  assert.equal(result.records.get("authority-a")?.state, "SUPERSEDED");
  assert.equal(result.records.get("authority-b")?.state, "REVOKED");
  assert.equal(replayAuthorityLedger("authority-a", []).state, "NONE");
  assert.equal(replayAuthorityLedger("authority-b", []).state, "NONE");
});
