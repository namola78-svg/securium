-- Append-only post-publication revocation facts. Publication receipts remain immutable.
BEGIN;

CREATE UNIQUE INDEX "cppg_publication_receipts_revocation_binding_uq"
  ON public."cppg_publication_receipts" (
    "publication_id", "publication_semantic_identity",
    "registration_semantic_identity", "authority_id", "authority_sequence"
  );

CREATE TABLE public."cppg_publication_revocations" (
  "revocation_id" text PRIMARY KEY,
  "publication_id" text NOT NULL,
  "publication_semantic_identity" text NOT NULL CHECK ("publication_semantic_identity" ~ '^[a-f0-9]{64}$'),
  "registration_semantic_identity" text NOT NULL CHECK ("registration_semantic_identity" ~ '^[a-f0-9]{64}$'),
  "authority_id" text NOT NULL,
  "authority_sequence" integer NOT NULL CHECK ("authority_sequence" > 0),
  "actor_id" text NOT NULL CHECK (length(trim("actor_id")) > 0),
  "reason_code" text NOT NULL CHECK ("reason_code" ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  "details" text CHECK ("details" IS NULL OR length("details") <= 1000),
  "previous_state" text NOT NULL DEFAULT 'PUBLISHED' CHECK ("previous_state" = 'PUBLISHED'),
  "effective_state" text NOT NULL DEFAULT 'REVOKED' CHECK ("effective_state" = 'REVOKED'),
  "idempotency_key" text NOT NULL CHECK (length(trim("idempotency_key")) BETWEEN 1 AND 200),
  "command_hash" text NOT NULL CHECK ("command_hash" ~ '^[a-f0-9]{64}$'),
  "recorded_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("publication_id"),
  UNIQUE ("idempotency_key"),
  FOREIGN KEY (
    "publication_id", "publication_semantic_identity",
    "registration_semantic_identity", "authority_id", "authority_sequence"
  ) REFERENCES public."cppg_publication_receipts" (
    "publication_id", "publication_semantic_identity",
    "registration_semantic_identity", "authority_id", "authority_sequence"
  )
);

CREATE RULE "cppg_publication_revocations_no_update" AS
ON UPDATE TO public."cppg_publication_revocations"
DO INSTEAD NOTHING;
CREATE RULE "cppg_publication_revocations_no_delete" AS
ON DELETE TO public."cppg_publication_revocations"
DO INSTEAD NOTHING;

REVOKE ALL PRIVILEGES ON TABLE public."cppg_publication_revocations" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."cppg_publication_revocations" ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_schema_migrations (id, checksum)
VALUES ('0056_cppg_publication_revocations', 'cppg-publication-revocations-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
