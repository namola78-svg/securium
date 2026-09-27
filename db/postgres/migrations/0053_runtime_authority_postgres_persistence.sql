-- Canonical PostgreSQL persistence for the runtime-authority append-only ledger.
BEGIN;

CREATE TABLE public."runtime_authority_roots" (
  "authority_id" text PRIMARY KEY,
  "latest_sequence" integer NOT NULL DEFAULT 0 CHECK ("latest_sequence" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public."runtime_authority_events" (
  "event_id" text PRIMARY KEY,
  "authority_id" text NOT NULL,
  "sequence" integer NOT NULL CHECK ("sequence" >= 1),
  "schema_version" integer NOT NULL CHECK ("schema_version" = 1),
  "event_type" text NOT NULL CHECK ("event_type" IN ('APPROVAL_CREATED','SUPERSESSION_DECLARED','REVOCATION_DECLARED')),
  "payload_json" jsonb NOT NULL,
  "idempotency_key" text NOT NULL,
  "command_hash" text NOT NULL CHECK ("command_hash" ~ '^[a-f0-9]{64}$'),
  "recorded_at" timestamptz NOT NULL,
  UNIQUE ("authority_id", "sequence"),
  UNIQUE ("authority_id", "idempotency_key")
);

CREATE INDEX "runtime_authority_events_authority_sequence_idx"
  ON public."runtime_authority_events" ("authority_id", "sequence");

CREATE OR REPLACE FUNCTION public.runtime_authority_events_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'runtime authority events are append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "runtime_authority_events_no_update"
BEFORE UPDATE ON public."runtime_authority_events"
FOR EACH ROW EXECUTE FUNCTION public.runtime_authority_events_append_only_guard();

CREATE TRIGGER "runtime_authority_events_no_delete"
BEFORE DELETE ON public."runtime_authority_events"
FOR EACH ROW EXECUTE FUNCTION public.runtime_authority_events_append_only_guard();

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0053_runtime_authority_postgres_persistence', 'runtime-authority-postgres-persistence-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
