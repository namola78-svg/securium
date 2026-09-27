import { randomUUID } from "node:crypto";
import { AppError } from "../errors.ts";
import {
  buildAuthorityEventCandidate,
  commandHash,
  normalizeAuthorityCommand,
  replayAuthorityLedger,
  type AuthorityCommand,
  type AuthorityEvent,
  type AuthorityReference,
  type AuthorityReplayContext,
} from "../policy/runtime-authority-event-ledger.ts";
import {
  persistenceRecordToCanonicalEvent,
  persistenceRecordsToCanonicalEvents,
  type AuthorityEventPersistenceRecord,
  type RuntimeAuthorityPersistenceTransaction,
  type RuntimeAuthorityPersistenceTransactionOwner,
} from "../policy/runtime-authority-persistence-contract.ts";

export type RuntimeAuthorityCommandResult = Readonly<{
  outcome: "APPENDED" | "REPLAY_EXISTING";
  event: AuthorityEvent;
}>;

export type RuntimeAuthorityCommandContext = Readonly<{
  eventId?: () => string;
  now?: () => string;
}>;

export async function executeRuntimeAuthorityCommand(
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  commandInput: unknown,
  context: RuntimeAuthorityCommandContext = {},
): Promise<RuntimeAuthorityCommandResult> {
  const command = normalizeAuthorityCommand(commandInput);
  const hash = await commandHash(command);
  const eventId = context.eventId ?? randomUUID;
  const now = context.now ?? (() => new Date().toISOString());

  return owner.withTransaction(async (transaction) => {
    const idempotency = await transaction.findAcceptedByIdempotency(
      command.authorityId,
      command.idempotencyKey,
      hash,
    );
    if (idempotency.kind === "REPLAY_EXISTING") {
      return {
        outcome: "REPLAY_EXISTING",
        event: persistenceRecordToCanonicalEvent(idempotency.event),
      };
    }
    if (idempotency.kind === "IDEMPOTENCY_CONFLICT") {
      throw new AppError(
        "Runtime authority idempotency key is already bound to another command.",
        409,
        "IDEMPOTENCY_CONFLICT",
      );
    }

    const root = await transaction.loadAuthorityRoot(command.authorityId);
    const persisted = await transaction.loadAcceptedAuthorityEvents(command.authorityId);
    const replayContext = await buildReplayContext(transaction, command, persisted);
    const existing = persistenceRecordsToCanonicalEvents(
      persisted,
      command.authorityId,
      replayContext,
    );
    const replay = replayAuthorityLedger(command.authorityId, existing, replayContext);

    if (root === null) {
      if (existing.length !== 0) {
        throw new AppError(
          "Runtime authority root is missing for accepted history.",
          503,
          "AUTHORITY_LEDGER_INTEGRITY_ERROR",
        );
      }
    } else if (root.latestSequence !== replay.lastSequence) {
      throw new AppError(
        "Runtime authority root sequence does not match canonical history.",
        503,
        "AUTHORITY_LEDGER_INTEGRITY_ERROR",
      );
    }

    const candidate = await buildAuthorityEventCandidate(
      command,
      {
        eventId: eventId(),
        sequence: replay.lastSequence + 1,
        recordedAt: now(),
      },
      existing,
      replayContext,
    );
    await transaction.appendAcceptedEvent(toPersistenceRecord(candidate));
    await transaction.updateLatestSequence(
      command.authorityId,
      candidate.sequence,
    );
    return { outcome: "APPENDED", event: candidate };
  });
}

async function buildReplayContext(
  transaction: RuntimeAuthorityPersistenceTransaction,
  command: AuthorityCommand,
  persisted: readonly AuthorityEventPersistenceRecord[],
): Promise<AuthorityReplayContext> {
  const successorIds = new Set<string>();
  for (const record of persisted) {
    if (record.eventType !== "SUPERSESSION_DECLARED") continue;
    const successor = (record.payload as { successorAuthorityId?: unknown })
      .successorAuthorityId;
    if (typeof successor === "string" && successor.length > 0) {
      successorIds.add(successor);
    }
  }
  if (command.eventType === "SUPERSESSION_DECLARED") {
    const successor = (
      command.payload as { successorAuthorityId?: unknown }
    ).successorAuthorityId;
    if (typeof successor === "string" && successor.length > 0) {
      successorIds.add(successor);
    }
  }
  if (successorIds.size === 0) return {};

  const authoritiesById = new Map<string, AuthorityReference>();
  for (const authorityId of successorIds) {
    const reference = await transaction.resolveSuccessorAuthority(authorityId);
    if (!reference) {
      throw new AppError(
        "Runtime authority successor is unavailable.",
        503,
        "AUTHORITY_LIFECYCLE_UNAVAILABLE",
      );
    }
    authoritiesById.set(authorityId, reference);
  }
  return { authoritiesById };
}

function toPersistenceRecord(
  event: AuthorityEvent,
): AuthorityEventPersistenceRecord {
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
