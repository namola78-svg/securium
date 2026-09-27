import type {
  PostgresExecutor,
  PostgresTransactionExecutor,
} from "./provider/postgres-database-provider.ts";
import {
  parseAuthorityEventPersistenceRecord,
  parseAuthorityRootPersistenceRecord,
  persistenceRecordsToCanonicalEvents,
  type AuthorityEventPersistenceRecord,
  type AuthorityIdempotencyLookup,
  type RuntimeAuthorityPersistenceTransaction,
  type RuntimeAuthorityPersistenceTransactionOwner,
} from "../lib/policy/runtime-authority-persistence-contract.ts";
import { replayAuthorityLedger, type AuthorityReference } from "../lib/policy/runtime-authority-event-ledger.ts";

type RootRow = {
  authorityId: string;
  latestSequence: number;
};

type EventRow = {
  eventId: unknown;
  authorityId: unknown;
  sequence: unknown;
  schemaVersion: unknown;
  eventType: unknown;
  payloadJson: unknown;
  idempotencyKey: unknown;
  commandHash: unknown;
  recordedAt: unknown;
};

export class PostgresRuntimeAuthorityPersistence
  implements RuntimeAuthorityPersistenceTransactionOwner
{
  constructor(private readonly executor: PostgresExecutor) {}

  async withTransaction<T>(
    callback: (transaction: RuntimeAuthorityPersistenceTransaction) => Promise<T>,
  ): Promise<T> {
    return this.executor.transaction((executor) =>
      callback(new PostgresRuntimeAuthorityTransaction(executor)),
    );
  }
}

class PostgresRuntimeAuthorityTransaction
  implements RuntimeAuthorityPersistenceTransaction
{
  constructor(private readonly executor: PostgresTransactionExecutor) {}

  async loadAuthorityRoot(authorityId: string) {
    const result = await this.executor.query<RootRow>(
      `SELECT "authority_id" AS "authorityId",
              "latest_sequence" AS "latestSequence"
       FROM "runtime_authority_roots"
       WHERE "authority_id" = $1
       FOR UPDATE`,
      [authorityId],
    );
    const row = result.rows[0];
    return row ? parseAuthorityRootPersistenceRecord(row) : null;
  }

  async loadAcceptedAuthorityEvents(authorityId: string) {
    const result = await this.executor.query<EventRow>(
      `SELECT "event_id" AS "eventId",
              "authority_id" AS "authorityId",
              "sequence" AS "sequence",
              "schema_version" AS "schemaVersion",
              "event_type" AS "eventType",
              "payload_json"::text AS "payloadJson",
              "idempotency_key" AS "idempotencyKey",
              "command_hash" AS "commandHash",
              "recorded_at"::text AS "recordedAt"
       FROM "runtime_authority_events"
       WHERE "authority_id" = $1
       ORDER BY "sequence"`,
      [authorityId],
    );
    return result.rows.map(eventRowToPersistenceRecord);
  }

  async findAcceptedByIdempotency(
    authorityId: string,
    idempotencyKey: string,
    commandHash: string,
  ): Promise<AuthorityIdempotencyLookup> {
    const result = await this.executor.query<EventRow>(
      `SELECT "event_id" AS "eventId",
              "authority_id" AS "authorityId",
              "sequence" AS "sequence",
              "schema_version" AS "schemaVersion",
              "event_type" AS "eventType",
              "payload_json"::text AS "payloadJson",
              "idempotency_key" AS "idempotencyKey",
              "command_hash" AS "commandHash",
              "recorded_at"::text AS "recordedAt"
       FROM "runtime_authority_events"
       WHERE "authority_id" = $1 AND "idempotency_key" = $2`,
      [authorityId, idempotencyKey],
    );
    const row = result.rows[0];
    if (!row) return { kind: "NOT_FOUND" };
    const event = eventRowToPersistenceRecord(row);
    return event.commandHash === commandHash
      ? { kind: "REPLAY_EXISTING", event }
      : { kind: "IDEMPOTENCY_CONFLICT", existing: event };
  }

  async resolveSuccessorAuthority(
    authorityId: string,
  ): Promise<AuthorityReference | null> {
    const records = await this.loadAcceptedAuthorityEvents(authorityId);
    if (records.length === 0) return null;
    const events = persistenceRecordsToCanonicalEvents(records, authorityId);
    const replay = replayAuthorityLedger(authorityId, events);
    const record = replay.record;
    if (!record) return null;
    return {
      authorityId: record.authorityId,
      subject: record.subject,
      approvalSubjectHash: record.approvalSubjectHash,
    };
  }

  async appendAcceptedEvent(event: AuthorityEventPersistenceRecord) {
    const parsed = parseAuthorityEventPersistenceRecord(event);
    await this.executor.query(
      `INSERT INTO "runtime_authority_events"
        ("event_id","authority_id","sequence","schema_version","event_type",
         "payload_json","idempotency_key","command_hash","recorded_at")
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::timestamptz)`,
      [
        parsed.eventId,
        parsed.authorityId,
        parsed.sequence,
        parsed.schemaVersion,
        parsed.eventType,
        JSON.stringify(parsed.payload),
        parsed.idempotencyKey,
        parsed.commandHash,
        parsed.recordedAt,
      ],
    );
  }

  async updateLatestSequence(authorityId: string, latestSequence: number) {
    await this.executor.query(
      `INSERT INTO "runtime_authority_roots"
        ("authority_id","latest_sequence")
       VALUES ($1,$2)
       ON CONFLICT ("authority_id") DO UPDATE
       SET "latest_sequence" = EXCLUDED."latest_sequence",
           "updated_at" = now()`,
      [authorityId, latestSequence],
    );
  }
}

function eventRowToPersistenceRecord(
  row: EventRow,
): AuthorityEventPersistenceRecord {
  return parseAuthorityEventPersistenceRecord({
    eventId: requireDatabaseString(row.eventId),
    authorityId: requireDatabaseString(row.authorityId),
    sequence: requireDatabaseInteger(row.sequence),
    schemaVersion: requireDatabaseInteger(row.schemaVersion),
    eventType: requireDatabaseString(row.eventType),
    payload: parseDatabaseJson(row.payloadJson),
    idempotencyKey: requireDatabaseString(row.idempotencyKey),
    commandHash: requireDatabaseString(row.commandHash),
    recordedAt: normalizeDatabaseTimestamp(row.recordedAt),
  });
}

function requireDatabaseString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("RUNTIME_AUTHORITY_DATABASE_ROW_INVALID");
  }
  return value;
}

function requireDatabaseInteger(value: unknown): number {
  const normalized =
    typeof value === "number" ? value :
    typeof value === "bigint" ? Number(value) :
    typeof value === "string" && /^\\d+$/.test(value) ? Number(value) :
    Number.NaN;
  if (!Number.isSafeInteger(normalized)) {
    throw new Error("RUNTIME_AUTHORITY_DATABASE_ROW_INVALID");
  }
  return normalized;
}

function parseDatabaseJson(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("RUNTIME_AUTHORITY_DATABASE_ROW_INVALID");
}

function normalizeDatabaseTimestamp(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) return new Date(timestamp).toISOString();
  }
  throw new Error("RUNTIME_AUTHORITY_DATABASE_ROW_INVALID");
}
