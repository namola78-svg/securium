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
  eventId: string;
  authorityId: string;
  sequence: number;
  schemaVersion: number;
  eventType: AuthorityEventPersistenceRecord["eventType"];
  payloadJson: string;
  idempotencyKey: string;
  commandHash: string;
  recordedAt: string;
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
    eventId: row.eventId,
    authorityId: row.authorityId,
    sequence: Number(row.sequence),
    schemaVersion: Number(row.schemaVersion),
    eventType: row.eventType,
    payload: JSON.parse(row.payloadJson),
    idempotencyKey: row.idempotencyKey,
    commandHash: row.commandHash,
    recordedAt: row.recordedAt,
  });
}
