import { AppError } from "../errors.ts";
import {
  approvalSubjectHash,
  canonicalRuntimeAuthoritySubject,
  normalizeRuntimeAuthoritySubject,
  type RuntimeAuthoritySubject,
} from "./runtime-authority-binding.ts";

export const RUNTIME_AUTHORITY_LIFECYCLE_CONTRACT_V1 = "SECURIUM_RUNTIME_AUTHORITY_LIFECYCLE_V1" as const;
export const RUNTIME_AUTHORITY_EVENT_TYPES = [
  "APPROVAL_CREATED",
  "SUPERSESSION_DECLARED",
  "REVOCATION_DECLARED",
] as const;

export type RuntimeAuthorityEventType = (typeof RUNTIME_AUTHORITY_EVENT_TYPES)[number];
export type RuntimeAuthorityLifecycleState = "APPROVED_ACTIVE" | "SUPERSEDED" | "REVOKED";

export type RuntimeAuthorityApprovalCreatedEvent = Readonly<{
  contractVersion: typeof RUNTIME_AUTHORITY_LIFECYCLE_CONTRACT_V1;
  eventType: "APPROVAL_CREATED";
  authorityId: string;
  subject: RuntimeAuthoritySubject;
  approvalSubjectHash: string;
  createdAt: string;
  actorId?: string;
  auditId?: string;
  requestId?: string;
  idempotencyKey?: string;
}>;

export type RuntimeAuthoritySupersessionDeclaredEvent = Readonly<{
  contractVersion: typeof RUNTIME_AUTHORITY_LIFECYCLE_CONTRACT_V1;
  eventType: "SUPERSESSION_DECLARED";
  authorityId: string;
  successorAuthorityId: string;
  successorSubjectHash: string;
  createdAt: string;
  actorId?: string;
  auditId?: string;
  requestId?: string;
  idempotencyKey?: string;
}>;

export type RuntimeAuthorityRevocationDeclaredEvent = Readonly<{
  contractVersion: typeof RUNTIME_AUTHORITY_LIFECYCLE_CONTRACT_V1;
  eventType: "REVOCATION_DECLARED";
  authorityId: string;
  reason: string;
  createdAt: string;
  actorId?: string;
  auditId?: string;
  requestId?: string;
  idempotencyKey?: string;
}>;

export type RuntimeAuthorityLifecycleEvent =
  | RuntimeAuthorityApprovalCreatedEvent
  | RuntimeAuthoritySupersessionDeclaredEvent
  | RuntimeAuthorityRevocationDeclaredEvent;

export type RuntimeAuthorityLifecycleRecord = Readonly<{
  authorityId: string;
  subject: RuntimeAuthoritySubject;
  approvalSubjectHash: string;
  state: RuntimeAuthorityLifecycleState;
  supersededByAuthorityId: string | null;
  revoked: boolean;
}>;

export type RuntimeAuthorityLifecycleSnapshot = Readonly<{
  events: readonly RuntimeAuthorityLifecycleEvent[];
  records: ReadonlyMap<string, RuntimeAuthorityLifecycleRecord>;
}>;

function lifecycleFailure(code: string, message: string, status = 409): never {
  throw new AppError(message, status, code);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function ensureEventBase(event: Record<string, unknown>): void {
  if (event.contractVersion !== RUNTIME_AUTHORITY_LIFECYCLE_CONTRACT_V1) lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Unsupported authority lifecycle contract.", 503);
  if (!isIdentifier(event.authorityId) || !isIdentifier(event.createdAt)) lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Authority lifecycle event identity is invalid.", 503);
}

function eventFingerprint(event: RuntimeAuthorityLifecycleEvent): string {
  if (event.eventType === "APPROVAL_CREATED") {
    return JSON.stringify({ eventType: event.eventType, authorityId: event.authorityId, approvalSubjectHash: event.approvalSubjectHash, subject: canonicalRuntimeAuthoritySubject(event.subject), createdAt: event.createdAt });
  }
  if (event.eventType === "SUPERSESSION_DECLARED") {
    return JSON.stringify({ eventType: event.eventType, authorityId: event.authorityId, successorAuthorityId: event.successorAuthorityId, successorSubjectHash: event.successorSubjectHash, createdAt: event.createdAt });
  }
  return JSON.stringify({ eventType: event.eventType, authorityId: event.authorityId, reason: event.reason, createdAt: event.createdAt });
}

function normalizeEvent(rawEvent: unknown): RuntimeAuthorityLifecycleEvent {
  if (!isRecord(rawEvent)) lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Authority lifecycle event must be an object.", 503);
  ensureEventBase(rawEvent);
  if (typeof rawEvent.eventType !== "string" || !RUNTIME_AUTHORITY_EVENT_TYPES.includes(rawEvent.eventType as RuntimeAuthorityEventType)) lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Unknown authority lifecycle event.", 503);
  if (rawEvent.eventType === "APPROVAL_CREATED") {
    if (!isRecord(rawEvent.subject)) lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Approval event subject is unavailable.", 503);
    const subject = normalizeRuntimeAuthoritySubject(rawEvent.subject as RuntimeAuthoritySubject);
    if (!isSha256(rawEvent.approvalSubjectHash) || rawEvent.approvalSubjectHash !== approvalSubjectHash(subject)) lifecycleFailure("APPROVAL_BINDING_MISMATCH", "Approval event subject hash does not match its subject.");
    return Object.freeze({
      contractVersion: RUNTIME_AUTHORITY_LIFECYCLE_CONTRACT_V1,
      eventType: "APPROVAL_CREATED",
      authorityId: rawEvent.authorityId as string,
      subject,
      approvalSubjectHash: rawEvent.approvalSubjectHash,
      createdAt: rawEvent.createdAt as string,
      ...(isIdentifier(rawEvent.actorId) ? { actorId: rawEvent.actorId } : {}),
      ...(isIdentifier(rawEvent.auditId) ? { auditId: rawEvent.auditId } : {}),
      ...(isIdentifier(rawEvent.requestId) ? { requestId: rawEvent.requestId } : {}),
      ...(isIdentifier(rawEvent.idempotencyKey) ? { idempotencyKey: rawEvent.idempotencyKey } : {}),
    });
  }
  if (rawEvent.eventType === "SUPERSESSION_DECLARED") {
    if (!isIdentifier(rawEvent.successorAuthorityId) || rawEvent.successorAuthorityId === rawEvent.authorityId || !isSha256(rawEvent.successorSubjectHash)) lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Supersession event identity is invalid.", 503);
    return Object.freeze({
      contractVersion: RUNTIME_AUTHORITY_LIFECYCLE_CONTRACT_V1,
      eventType: "SUPERSESSION_DECLARED",
      authorityId: rawEvent.authorityId as string,
      successorAuthorityId: rawEvent.successorAuthorityId,
      successorSubjectHash: rawEvent.successorSubjectHash,
      createdAt: rawEvent.createdAt as string,
      ...(isIdentifier(rawEvent.actorId) ? { actorId: rawEvent.actorId } : {}),
      ...(isIdentifier(rawEvent.auditId) ? { auditId: rawEvent.auditId } : {}),
      ...(isIdentifier(rawEvent.requestId) ? { requestId: rawEvent.requestId } : {}),
      ...(isIdentifier(rawEvent.idempotencyKey) ? { idempotencyKey: rawEvent.idempotencyKey } : {}),
    });
  }
  if (!isIdentifier(rawEvent.reason)) lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Revocation reason is required.", 503);
  return Object.freeze({
    contractVersion: RUNTIME_AUTHORITY_LIFECYCLE_CONTRACT_V1,
    eventType: "REVOCATION_DECLARED",
    authorityId: rawEvent.authorityId as string,
    reason: rawEvent.reason,
    createdAt: rawEvent.createdAt as string,
    ...(isIdentifier(rawEvent.actorId) ? { actorId: rawEvent.actorId } : {}),
    ...(isIdentifier(rawEvent.auditId) ? { auditId: rawEvent.auditId } : {}),
    ...(isIdentifier(rawEvent.requestId) ? { requestId: rawEvent.requestId } : {}),
    ...(isIdentifier(rawEvent.idempotencyKey) ? { idempotencyKey: rawEvent.idempotencyKey } : {}),
  });
}

export function reduceRuntimeAuthorityLifecycle(
  events: readonly RuntimeAuthorityLifecycleEvent[],
): RuntimeAuthorityLifecycleSnapshot {
  if (!Array.isArray(events)) lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Authority lifecycle event collection is unavailable.", 503);
  const normalizedEvents: RuntimeAuthorityLifecycleEvent[] = [];
  const records = new Map<string, RuntimeAuthorityLifecycleRecord>();
  const seenEventFingerprints = new Set<string>();

  for (const rawEvent of events) {
    const event = normalizeEvent(rawEvent);
    const fingerprint = eventFingerprint(event);
    if (seenEventFingerprints.has(fingerprint)) continue;
    seenEventFingerprints.add(fingerprint);
    normalizedEvents.push(event);

    if (event.eventType === "APPROVAL_CREATED") {
      const existing = records.get(event.authorityId);
      if (existing) {
        if (existing.approvalSubjectHash !== event.approvalSubjectHash || canonicalRuntimeAuthoritySubject(existing.subject) !== canonicalRuntimeAuthoritySubject(event.subject)) {
          lifecycleFailure("APPROVAL_BINDING_MISMATCH", "An authority identity cannot be reused for a different subject.");
        }
        if (existing.revoked) lifecycleFailure("AUTHORITY_REVOKED", "A revoked authority cannot reactivate.");
        if (existing.state === "SUPERSEDED") lifecycleFailure("AUTHORITY_SUPERSEDED", "A superseded authority cannot reactivate.");
        continue;
      }
      records.set(event.authorityId, { authorityId: event.authorityId, subject: event.subject, approvalSubjectHash: event.approvalSubjectHash, state: "APPROVED_ACTIVE", supersededByAuthorityId: null, revoked: false });
      continue;
    }

    if (event.eventType === "SUPERSESSION_DECLARED") {
      const existing = records.get(event.authorityId);
      if (!existing) lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Cannot supersede an unknown authority.", 503);
      if (existing.revoked) lifecycleFailure("AUTHORITY_REVOKED", "A revoked authority cannot be superseded into an active path.");
      if (existing.state === "SUPERSEDED" && existing.supersededByAuthorityId !== event.successorAuthorityId) lifecycleFailure("AUTHORITY_SUPERSEDED", "Supersession target is immutable.");
      const successor = records.get(event.successorAuthorityId);
      if (!successor) lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Cannot supersede to an unknown authority.", 503);
      if (successor && successor.approvalSubjectHash !== event.successorSubjectHash) lifecycleFailure("APPROVAL_BINDING_MISMATCH", "Supersession successor does not bind to the approved subject.");
      records.set(event.authorityId, { ...existing, state: existing.revoked ? "REVOKED" : "SUPERSEDED", supersededByAuthorityId: event.successorAuthorityId });
      continue;
    }

    const existing = records.get(event.authorityId);
    if (!existing) lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Cannot revoke an unknown authority.", 503);
    if (existing.revoked) continue;
    records.set(event.authorityId, { ...existing, state: "REVOKED", revoked: true });
  }

  return Object.freeze({ events: Object.freeze(normalizedEvents), records });
}

export function resolveRuntimeAuthorityLifecycle(
  events: readonly RuntimeAuthorityLifecycleEvent[],
  authorityId: string,
): RuntimeAuthorityLifecycleRecord | null {
  return reduceRuntimeAuthorityLifecycle(events).records.get(authorityId) ?? null;
}

export function assertRuntimeAuthorityLifecycleActive(record: RuntimeAuthorityLifecycleRecord | null): asserts record is RuntimeAuthorityLifecycleRecord {
  if (!record) lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Runtime authority lifecycle is unavailable.", 503);
  if (record.state === "REVOKED") lifecycleFailure("AUTHORITY_REVOKED", "Runtime authority has been revoked.");
  if (record.state === "SUPERSEDED") lifecycleFailure("AUTHORITY_SUPERSEDED", "Runtime authority has been superseded.");
  if (record.state !== "APPROVED_ACTIVE") lifecycleFailure("AUTHORITY_LIFECYCLE_UNAVAILABLE", "Runtime authority lifecycle is not explicitly active.", 503);
}

export function buildRuntimeAuthorityLifecycleResolver(
  events: readonly RuntimeAuthorityLifecycleEvent[],
): (subject: RuntimeAuthoritySubject, authorityId: string) => RuntimeAuthorityLifecycleState | null {
  const snapshot = reduceRuntimeAuthorityLifecycle(events);
  return (subject, authorityId) => {
    if (!isIdentifier(authorityId)) return null;
    const hash = approvalSubjectHash(subject);
    const record = snapshot.records.get(authorityId);
    if (!record || record.approvalSubjectHash !== hash) return null;
    return record?.state ?? null;
  };
}
