import {
  AUTHORITY_EVENT_SCHEMA_VERSION,
  replayAuthorityLedger,
  validateAuthorityLedger,
  type AuthorityCommand,
  type AuthorityEvent,
  type AuthorityReplayContext,
  type AuthorityReference,
} from "./runtime-authority-event-ledger.ts";
import {
  RUNTIME_AUTHORITY_EVENT_TYPES,
  type RuntimeAuthorityEventType,
} from "./runtime-authority-lifecycle.ts";

export const AUTHORITY_ROOT_IS_CANONICAL_HISTORY = false as const;
export const EVENT_TABLE_APPEND_ONLY = true as const;
export const PERSISTED_PROJECTION_REQUIRED = false as const;
export const Q_PERSIST_001_CORRUPTION_PRECEDENCE = true as const;

export const AUTHORITY_PERSISTENCE_BACKENDS = ["postgresql", "d1"] as const;
export type AuthorityPersistenceBackend = (typeof AUTHORITY_PERSISTENCE_BACKENDS)[number];

export type AuthorityRootPersistenceRecord = Readonly<{
  authorityId: string;
  latestSequence: number;
}>;

/**
 * A persistence record is deliberately named separately from AuthorityEvent.
 * The adapter below is the only boundary that turns a stored record into the
 * strict Phase2A event envelope.
 */
export type AuthorityEventPersistenceRecord = Readonly<{
  eventId: AuthorityEvent["eventId"];
  authorityId: AuthorityEvent["authorityId"];
  sequence: AuthorityEvent["sequence"];
  schemaVersion: AuthorityEvent["schemaVersion"];
  eventType: AuthorityEvent["eventType"];
  payload: AuthorityEvent["payload"];
  idempotencyKey: AuthorityEvent["idempotencyKey"];
  commandHash: AuthorityEvent["commandHash"];
  recordedAt: AuthorityEvent["recordedAt"];
}>;

export type AuthorityIdempotencyLookup =
  | Readonly<{ kind: "NOT_FOUND" }>
  | Readonly<{
      kind: "REPLAY_EXISTING";
      event: AuthorityEventPersistenceRecord;
    }>
  | Readonly<{
      kind: "IDEMPOTENCY_CONFLICT";
      existing: AuthorityEventPersistenceRecord;
    }>;

export const AUTHORITY_PERSISTENCE_ERROR_CODES = [
  "PERSISTENCE_CONTRACT_INVALID",
  "LEDGER_CORRUPTION",
  "CONCURRENCY_RETRYABLE",
  "PERSISTENCE_FAILURE",
] as const;
export type AuthorityPersistenceErrorCode =
  (typeof AUTHORITY_PERSISTENCE_ERROR_CODES)[number];

export class AuthorityPersistenceContractError extends Error {
  readonly code: AuthorityPersistenceErrorCode;

  constructor(code: AuthorityPersistenceErrorCode, message: string) {
    super(message);
    this.name = "AuthorityPersistenceContractError";
    this.code = code;
  }
}

export type AuthorityPersistenceBackendCapability = Readonly<{
  backend: AuthorityPersistenceBackend;
  domainContractParity: true;
  productionAuthorityWriterCapable: boolean;
  canonicalRuntimePersistence: boolean;
  transactionScopedReadback: boolean;
  authorityLocalSerialization: "REQUIRED" | "UNAVAILABLE";
}>;

export const AUTHORITY_PERSISTENCE_BACKEND_CAPABILITIES: Readonly<
  Record<AuthorityPersistenceBackend, AuthorityPersistenceBackendCapability>
> = Object.freeze({
  postgresql: Object.freeze({
    backend: "postgresql",
    domainContractParity: true,
    productionAuthorityWriterCapable: true,
    canonicalRuntimePersistence: true,
    transactionScopedReadback: true,
    authorityLocalSerialization: "REQUIRED",
  }),
  d1: Object.freeze({
    backend: "d1",
    domainContractParity: true,
    productionAuthorityWriterCapable: false,
    canonicalRuntimePersistence: false,
    transactionScopedReadback: false,
    authorityLocalSerialization: "UNAVAILABLE",
  }),
});

/**
 * This is a transaction-scoped capability surface, not a standalone
 * repository. The command service owns the transaction that supplies it.
 */
export interface RuntimeAuthorityPersistenceTransaction {
  loadAuthorityRoot(
    authorityId: string,
  ): Promise<AuthorityRootPersistenceRecord | null>;
  loadAcceptedAuthorityEvents(
    authorityId: string,
  ): Promise<readonly AuthorityEventPersistenceRecord[]>;
  findAcceptedByIdempotency(
    authorityId: string,
    idempotencyKey: string,
    commandHash: string,
  ): Promise<AuthorityIdempotencyLookup>;
  resolveSuccessorAuthority(
    authorityId: string,
  ): Promise<AuthorityReference | null>;
  appendAcceptedEvent(event: AuthorityEventPersistenceRecord): Promise<void>;
  updateLatestSequence(authorityId: string, latestSequence: number): Promise<void>;
}

/** The command service, not the repository, owns transaction scope. */
export interface RuntimeAuthorityPersistenceTransactionOwner {
  withTransaction<T>(
    callback: (transaction: RuntimeAuthorityPersistenceTransaction) => Promise<T>,
  ): Promise<T>;
}

export type RuntimeAuthorityPersistenceCommand = AuthorityCommand;

export const AUTHORITY_SEQUENCE_SCOPE = "AUTHORITY_LOCAL" as const;
export const AUTHORITY_FIRST_SEQUENCE = 1 as const;
export const AUTHORITY_LOCK_ORDER =
  "ASCENDING_CANONICAL_AUTHORITY_ID" as const;
export const AUTHORITY_TRANSACTION_OWNER =
  "RUNTIME_AUTHORITY_COMMAND_SERVICE" as const;
export const AUTHORITY_SERVER_WRITE_MODEL =
  "DIRECT_SERVER_POSTGRES_TRANSACTION" as const;

function fail(message: string): never {
  throw new AuthorityPersistenceContractError(
    "PERSISTENCE_CONTRACT_INVALID",
    message,
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const expectedKeys = new Set(expected);
  if (
    Reflect.ownKeys(value).some(
      (key) => typeof key !== "string" || !expectedKeys.has(key),
    ) ||
    Object.keys(value).length !== expected.length ||
    expected.some((key) => !Object.prototype.propertyIsEnumerable.call(value, key))
  ) {
    fail("Persistence record contains unknown or non-enumerable fields.");
  }
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

function sequence(value: unknown, allowZero: boolean): value is number {
  return (
    Number.isSafeInteger(value) &&
    (allowZero ? (value as number) >= 0 : (value as number) >= 1)
  );
}

function supportedEventType(value: unknown): value is RuntimeAuthorityEventType {
  return (
    typeof value === "string" &&
    RUNTIME_AUTHORITY_EVENT_TYPES.includes(value as RuntimeAuthorityEventType)
  );
}

export function parseAuthorityRootPersistenceRecord(
  raw: unknown,
): AuthorityRootPersistenceRecord {
  if (!isPlainObject(raw)) fail("Authority root persistence record is not an object.");
  exactKeys(raw, ["authorityId", "latestSequence"]);
  if (!nonEmpty(raw.authorityId) || !sequence(raw.latestSequence, true)) {
    fail("Authority root persistence record is malformed.");
  }
  return Object.freeze({
    authorityId: raw.authorityId,
    latestSequence: raw.latestSequence,
  });
}

export function parseAuthorityEventPersistenceRecord(
  raw: unknown,
): AuthorityEventPersistenceRecord {
  if (!isPlainObject(raw)) fail("Authority event persistence record is not an object.");
  exactKeys(raw, [
    "eventId",
    "authorityId",
    "sequence",
    "schemaVersion",
    "eventType",
    "payload",
    "idempotencyKey",
    "commandHash",
    "recordedAt",
  ]);
  if (
    !nonEmpty(raw.eventId) ||
    !nonEmpty(raw.authorityId) ||
    !sequence(raw.sequence, false) ||
    raw.schemaVersion !== AUTHORITY_EVENT_SCHEMA_VERSION ||
    !supportedEventType(raw.eventType) ||
    !isPlainObject(raw.payload) ||
    !nonEmpty(raw.idempotencyKey) ||
    !sha256(raw.commandHash) ||
    !iso(raw.recordedAt)
  ) {
    fail("Authority event persistence record is malformed.");
  }
  return Object.freeze({
    eventId: raw.eventId,
    authorityId: raw.authorityId,
    sequence: raw.sequence,
    schemaVersion: raw.schemaVersion,
    eventType: raw.eventType,
    payload: raw.payload as AuthorityEvent["payload"],
    idempotencyKey: raw.idempotencyKey,
    commandHash: raw.commandHash,
    recordedAt: raw.recordedAt,
  });
}

/** Explicitly strips persistence-only row data before the Phase2A boundary. */
export function persistenceRecordToCanonicalEvent(
  raw: AuthorityEventPersistenceRecord,
): AuthorityEvent {
  const record = parseAuthorityEventPersistenceRecord(raw);
  return Object.freeze({
    eventId: record.eventId,
    authorityId: record.authorityId,
    sequence: record.sequence,
    eventType: record.eventType,
    schemaVersion: record.schemaVersion,
    idempotencyKey: record.idempotencyKey,
    commandHash: record.commandHash,
    payload: record.payload,
    recordedAt: record.recordedAt,
  });
}

/**
 * Collection-level mapping is where contiguous sequence and lifecycle
 * validation can be applied without incorrectly treating sequence N>1 as a
 * standalone sequence-1 ledger.
 */
export function persistenceRecordsToCanonicalEvents(
  records: readonly AuthorityEventPersistenceRecord[],
  authorityId: string,
  replayContext: AuthorityReplayContext = {},
): readonly AuthorityEvent[] {
  const events = records.map(persistenceRecordToCanonicalEvent);
  try {
    validateAuthorityLedger(events, authorityId);
    replayAuthorityLedger(authorityId, events, replayContext);
  } catch (error) {
    throw new AuthorityPersistenceContractError(
      "LEDGER_CORRUPTION",
      error instanceof Error ? error.message : "Persisted authority history is corrupt.",
    );
  }
  return Object.freeze(events);
}

export function assertRootMatchesCanonicalHistory(
  root: AuthorityRootPersistenceRecord,
  events: readonly AuthorityEventPersistenceRecord[],
): void {
  const parsedRoot = parseAuthorityRootPersistenceRecord(root);
  const canonical = persistenceRecordsToCanonicalEvents(events, parsedRoot.authorityId);
  const latestSequence = canonical.at(-1)?.sequence ?? 0;
  if (latestSequence !== parsedRoot.latestSequence) {
    throw new AuthorityPersistenceContractError(
      "LEDGER_CORRUPTION",
      "Authority root sequence does not match validated canonical history.",
    );
  }
}
