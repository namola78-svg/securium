import { AppError } from "../errors.ts";
import {
  approvalSubjectHash,
  normalizeRuntimeAuthoritySubject,
  type RuntimeAuthoritySubject,
} from "./runtime-authority-binding.ts";
import {
  reduceRuntimeAuthorityLifecycle,
  type RuntimeAuthorityEventType,
  type RuntimeAuthorityLifecycleEvent,
  type RuntimeAuthorityLifecycleRecord,
} from "./runtime-authority-lifecycle.ts";
import { sha256Canonical } from "./stable-canonical-hash.ts";

export const AUTHORITY_COMMAND_HASH_DOMAIN = "SECURIUM_RUNTIME_AUTHORITY_COMMAND_V1" as const;
export const AUTHORITY_EVENT_SCHEMA_VERSION = 1 as const;

type ApprovalPayload = Readonly<{
  subject: RuntimeAuthoritySubject;
  approvalSubjectHash: string;
  createdAt: string;
}>;
type SupersessionPayload = Readonly<{
  successorAuthorityId: string;
  successorSubjectHash: string;
  createdAt: string;
}>;
type RevocationPayload = Readonly<{ reason: string; createdAt: string }>;

export type AuthorityCommand = Readonly<{
  authorityId: string;
  eventType: RuntimeAuthorityEventType;
  payload: ApprovalPayload | SupersessionPayload | RevocationPayload;
  idempotencyKey: string;
}>;

export type AuthorityEvent = Readonly<{
  eventId: string;
  authorityId: string;
  sequence: number;
  eventType: RuntimeAuthorityEventType;
  schemaVersion: typeof AUTHORITY_EVENT_SCHEMA_VERSION;
  idempotencyKey: string;
  commandHash: string;
  payload: ApprovalPayload | SupersessionPayload | RevocationPayload;
  recordedAt: string;
}>;

export type AuthorityEventCandidate = AuthorityEvent;

export type AuthorityReference = Readonly<Pick<RuntimeAuthorityLifecycleRecord, "authorityId" | "subject" | "approvalSubjectHash">>;
export type AuthorityReplayContext = Readonly<{ authoritiesById?: ReadonlyMap<string, AuthorityReference> }>;

export type IdempotencyDecision =
  | Readonly<{ kind: "NEW_COMMAND" }>
  | Readonly<{ kind: "REPLAY_EXISTING"; event: AuthorityEvent }>
  | Readonly<{ kind: "IDEMPOTENCY_CONFLICT"; existing: AuthorityEvent }>;

export type AuthorityLedgerReplay = Readonly<{
  authorityId: string;
  state: "NONE" | RuntimeAuthorityLifecycleRecord["state"];
  lastSequence: number;
  eventCount: number;
  lastEventId: string | null;
  record: RuntimeAuthorityLifecycleRecord | null;
}>;

function fail(code: string, message: string, status = 400): never {
  throw new AppError(message, status, code);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], code = "MALFORMED_AUTHORITY_COMMAND"): void {
  const expected = new Set(keys);
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !expected.has(key))) fail(code, "Unexpected authority contract field.", code === "MALFORMED_AUTHORITY_COMMAND" ? 400 : 503);
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.prototype.propertyIsEnumerable.call(value, key))) fail(code, "Authority contract fields must be enumerable and complete.", code === "MALFORMED_AUTHORITY_COMMAND" ? 400 : 503);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function iso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function normalizePayload(eventType: RuntimeAuthorityEventType, raw: unknown): ApprovalPayload | SupersessionPayload | RevocationPayload {
  if (!isPlainObject(raw)) fail("MALFORMED_AUTHORITY_COMMAND", "Authority payload must be a plain object.");
  if (eventType === "APPROVAL_CREATED") {
    exactKeys(raw, ["subject", "approvalSubjectHash", "createdAt"]);
    if (!isPlainObject(raw.subject) || !sha256(raw.approvalSubjectHash) || !iso(raw.createdAt)) fail("MALFORMED_AUTHORITY_COMMAND", "Approval payload is invalid.");
    const subject = normalizeRuntimeAuthoritySubject(raw.subject as RuntimeAuthoritySubject);
    if (approvalSubjectHash(subject) !== raw.approvalSubjectHash) fail("APPROVAL_BINDING_MISMATCH", "Approval subject hash does not match the subject.");
    return Object.freeze({ subject, approvalSubjectHash: raw.approvalSubjectHash, createdAt: raw.createdAt });
  }
  if (eventType === "SUPERSESSION_DECLARED") {
    exactKeys(raw, ["successorAuthorityId", "successorSubjectHash", "createdAt"]);
    if (!nonEmpty(raw.successorAuthorityId) || !sha256(raw.successorSubjectHash) || !iso(raw.createdAt)) fail("MALFORMED_AUTHORITY_COMMAND", "Supersession payload is invalid.");
    return Object.freeze({ successorAuthorityId: raw.successorAuthorityId, successorSubjectHash: raw.successorSubjectHash, createdAt: raw.createdAt });
  }
  exactKeys(raw, ["reason", "createdAt"]);
  if (!nonEmpty(raw.reason) || !iso(raw.createdAt)) fail("MALFORMED_AUTHORITY_COMMAND", "Revocation payload is invalid.");
  return Object.freeze({ reason: raw.reason, createdAt: raw.createdAt });
}

export function normalizeAuthorityCommand(raw: unknown): AuthorityCommand {
  if (!isPlainObject(raw)) fail("MALFORMED_AUTHORITY_COMMAND", "Authority command must be a plain object.");
  exactKeys(raw, ["authorityId", "eventType", "payload", "idempotencyKey"]);
  if (!nonEmpty(raw.authorityId) || !nonEmpty(raw.idempotencyKey) || typeof raw.eventType !== "string") fail("MALFORMED_AUTHORITY_COMMAND", "Authority command identity is invalid.");
  if (raw.eventType !== "APPROVAL_CREATED" && raw.eventType !== "SUPERSESSION_DECLARED" && raw.eventType !== "REVOCATION_DECLARED") fail("UNKNOWN_AUTHORITY_EVENT", "Unknown authority event type.");
  return Object.freeze({ authorityId: raw.authorityId, eventType: raw.eventType, payload: normalizePayload(raw.eventType, raw.payload), idempotencyKey: raw.idempotencyKey });
}

export async function commandHash(command: AuthorityCommand): Promise<string> {
  const normalized = normalizeAuthorityCommand(command);
  return sha256Canonical({ domain: AUTHORITY_COMMAND_HASH_DOMAIN, authorityId: normalized.authorityId, eventType: normalized.eventType, payload: normalized.payload });
}

export function decideAuthorityIdempotency(command: AuthorityCommand, hash: string, existing: readonly AuthorityEvent[]): IdempotencyDecision {
  const match = existing.find((event) => event.authorityId === command.authorityId && event.idempotencyKey === command.idempotencyKey);
  if (!match) return { kind: "NEW_COMMAND" };
  return match.commandHash === hash ? { kind: "REPLAY_EXISTING", event: match } : { kind: "IDEMPOTENCY_CONFLICT", existing: match };
}

function lifecycleEvent(event: AuthorityEvent): RuntimeAuthorityLifecycleEvent {
  if (event.eventType === "APPROVAL_CREATED") return { contractVersion: "SECURIUM_RUNTIME_AUTHORITY_LIFECYCLE_V1", eventType: event.eventType, authorityId: event.authorityId, ...(event.payload as ApprovalPayload) };
  if (event.eventType === "SUPERSESSION_DECLARED") return { contractVersion: "SECURIUM_RUNTIME_AUTHORITY_LIFECYCLE_V1", eventType: event.eventType, authorityId: event.authorityId, ...(event.payload as SupersessionPayload) };
  return { contractVersion: "SECURIUM_RUNTIME_AUTHORITY_LIFECYCLE_V1", eventType: event.eventType, authorityId: event.authorityId, ...(event.payload as RevocationPayload) };
}

function referenceEvent(reference: AuthorityReference): RuntimeAuthorityLifecycleEvent {
  return {
    contractVersion: "SECURIUM_RUNTIME_AUTHORITY_LIFECYCLE_V1",
    eventType: "APPROVAL_CREATED",
    authorityId: reference.authorityId,
    subject: reference.subject,
    approvalSubjectHash: reference.approvalSubjectHash,
    createdAt: "1970-01-01T00:00:00.000Z",
  };
}

function lifecycleEventsForReplay(authorityId: string, events: readonly AuthorityEvent[], context: AuthorityReplayContext): RuntimeAuthorityLifecycleEvent[] {
  const result: RuntimeAuthorityLifecycleEvent[] = [];
  const referenced = new Set<string>();
  for (const event of events) {
    const successorAuthorityId = event.eventType === "SUPERSESSION_DECLARED" ? (event.payload as SupersessionPayload).successorAuthorityId : null;
    if (successorAuthorityId !== null && event.authorityId === authorityId && !referenced.has(successorAuthorityId)) {
      const reference = context.authoritiesById?.get(successorAuthorityId);
      if (!reference) fail("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Cannot supersede to an unknown authority.", 503);
      if (reference.authorityId === authorityId) fail("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Supersession target is invalid.", 503);
      result.push(referenceEvent(reference));
      referenced.add(reference.authorityId);
    }
    result.push(lifecycleEvent(event));
  }
  return result;
}

export function nextAuthoritySequence(events: readonly AuthorityEvent[]): number {
  validateAuthorityLedger(events, events[0]?.authorityId ?? null);
  return (events.at(-1)?.sequence ?? 0) + 1;
}

export function validateAuthorityLedger(events: readonly AuthorityEvent[], authorityId: string | null): void {
  if (!Array.isArray(events)) fail("AUTHORITY_LEDGER_INTEGRITY_ERROR", "Authority ledger must be an array.", 503);
  const ids = new Set<string>();
  const keys = new Set<string>();
  let expected = 1;
  for (const rawEvent of events) {
    if (!isPlainObject(rawEvent)) fail("AUTHORITY_LEDGER_INTEGRITY_ERROR", "Malformed authority event.", 503);
    const event = rawEvent as Partial<AuthorityEvent> & Record<string, unknown>;
    exactKeys(event, ["eventId", "authorityId", "sequence", "eventType", "schemaVersion", "idempotencyKey", "commandHash", "payload", "recordedAt"], "AUTHORITY_LEDGER_INTEGRITY_ERROR");
    if (authorityId !== null && event.authorityId !== authorityId) fail("AUTHORITY_LEDGER_INTEGRITY_ERROR", "Authority event belongs to another aggregate.", 503);
    const rawSequence = event.sequence;
    if (!nonEmpty(event.eventId) || !nonEmpty(event.authorityId) || event.schemaVersion !== AUTHORITY_EVENT_SCHEMA_VERSION || !Number.isSafeInteger(rawSequence) || (rawSequence as number) < 1 || !nonEmpty(event.idempotencyKey) || !sha256(event.commandHash) || !iso(event.recordedAt)) fail("AUTHORITY_LEDGER_INTEGRITY_ERROR", "Authority event envelope is invalid.", 503);
    const sequence = rawSequence as number;
    if (ids.has(event.eventId)) fail("AUTHORITY_LEDGER_INTEGRITY_ERROR", "Duplicate authority event identity.", 503);
    const idempotency = `${event.authorityId}\u0000${event.idempotencyKey}`;
    if (keys.has(idempotency)) fail("AUTHORITY_LEDGER_INTEGRITY_ERROR", "Duplicate authority idempotency identity.", 503);
    if (sequence !== expected) fail("AUTHORITY_LEDGER_INTEGRITY_ERROR", "Authority event sequence is not contiguous.", 503);
    ids.add(event.eventId); keys.add(idempotency); expected += 1;
    if (event.eventType !== "APPROVAL_CREATED" && event.eventType !== "SUPERSESSION_DECLARED" && event.eventType !== "REVOCATION_DECLARED") fail("AUTHORITY_LEDGER_INTEGRITY_ERROR", "Unknown authority event type.", 503);
    normalizePayload(event.eventType, event.payload);
  }
}

export function replayAuthorityLedger(authorityId: string, events: readonly AuthorityEvent[], context: AuthorityReplayContext = {}): AuthorityLedgerReplay {
  if (!nonEmpty(authorityId)) fail("MALFORMED_AUTHORITY_COMMAND", "Authority identity is invalid.");
  validateAuthorityLedger(events, authorityId);
  const lifecycleEvents: RuntimeAuthorityLifecycleEvent[] = [];
  for (const event of events) {
    const prior = reduceRuntimeAuthorityLifecycle(lifecycleEvents).records.get(event.authorityId);
    if (prior?.state === "REVOKED" || prior?.state === "SUPERSEDED") fail("AUTHORITY_LEDGER_INTEGRITY_ERROR", "A terminal authority has a trailing lifecycle event.", 503);
    lifecycleEvents.push(...lifecycleEventsForReplay(authorityId, [event], context));
    const reduced = reduceRuntimeAuthorityLifecycle(lifecycleEvents);
    if (reduced.events.length !== lifecycleEvents.length) fail("AUTHORITY_LEDGER_INTEGRITY_ERROR", "Duplicate persisted lifecycle fact.", 503);
  }
  const lifecycle = reduceRuntimeAuthorityLifecycle(lifecycleEvents);
  const record = lifecycle.records.get(authorityId) ?? null;
  return Object.freeze({ authorityId, state: record?.state ?? "NONE", lastSequence: events.at(-1)?.sequence ?? 0, eventCount: events.length, lastEventId: events.at(-1)?.eventId ?? null, record });
}

export async function buildAuthorityEventCandidate(commandInput: unknown, context: Readonly<{ eventId: string; sequence: number; recordedAt: string }>, existing: readonly AuthorityEvent[] = [], replayContext: AuthorityReplayContext = {}): Promise<AuthorityEventCandidate> {
  const command = normalizeAuthorityCommand(commandInput);
  if (!nonEmpty(context.eventId) || !Number.isSafeInteger(context.sequence) || context.sequence < 1 || !iso(context.recordedAt)) fail("MALFORMED_AUTHORITY_EVENT", "Trusted event context is invalid.");
  const hash = await commandHash(command);
  const decision = decideAuthorityIdempotency(command, hash, existing);
  if (decision.kind !== "NEW_COMMAND") fail(decision.kind === "IDEMPOTENCY_CONFLICT" ? "IDEMPOTENCY_CONFLICT" : "AUTHORITY_COMMAND_REPLAY", "Authority command is not a new append.");
  validateAuthorityLedger(existing, command.authorityId);
  const current = replayAuthorityLedger(command.authorityId, existing, replayContext);
  if (current.state === "REVOKED") fail("AUTHORITY_REVOKED", "A revoked authority cannot accept a new lifecycle command.");
  if (current.state === "SUPERSEDED") fail("AUTHORITY_SUPERSEDED", "A superseded authority cannot accept a new lifecycle command.");
  const next = (existing.at(-1)?.sequence ?? 0) + 1;
  if (context.sequence !== next) fail("AUTHORITY_SEQUENCE_CONFLICT", "Trusted event sequence is stale or invalid.");
  const candidate = Object.freeze({ eventId: context.eventId, authorityId: command.authorityId, sequence: context.sequence, eventType: command.eventType, schemaVersion: AUTHORITY_EVENT_SCHEMA_VERSION, idempotencyKey: command.idempotencyKey, commandHash: hash, payload: command.payload, recordedAt: context.recordedAt });
  replayAuthorityLedger(command.authorityId, [...existing, candidate], replayContext);
  return candidate;
}
