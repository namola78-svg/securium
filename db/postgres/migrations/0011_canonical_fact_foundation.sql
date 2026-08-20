-- FR-1A canonical Fact repository foundation (PostgreSQL parity migration).
BEGIN;

CREATE TABLE IF NOT EXISTS "fact_identities" (
  "id" text PRIMARY KEY NOT NULL,
  "canonical_key" text NOT NULL,
  "domain" text NOT NULL,
  "canonical_label" text NOT NULL,
  "normalized_semantic_identity" text NOT NULL,
  "scope_discriminator" text NOT NULL,
  "lifecycle_state" text NOT NULL DEFAULT 'DRAFT',
  "created_by" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "retired_at" text,
  CONSTRAINT "fact_identities_scope_check" CHECK (length(trim("scope_discriminator")) > 0 AND length("scope_discriminator") <= 300),
  CONSTRAINT "fact_identities_lifecycle_check" CHECK ("lifecycle_state" IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  CONSTRAINT "fact_identities_semantic_identity_check" CHECK (length(trim("normalized_semantic_identity")) > 0 AND length("normalized_semantic_identity") <= 300)
);

CREATE UNIQUE INDEX IF NOT EXISTS "fact_identities_canonical_key_unique"
ON "fact_identities" ("canonical_key");
CREATE INDEX IF NOT EXISTS "fact_identities_domain_lifecycle_idx"
ON "fact_identities" ("domain", "lifecycle_state", "created_at");

CREATE TABLE IF NOT EXISTS "temporal_assertions" (
  "id" text PRIMARY KEY NOT NULL,
  "fact_identity_id" text NOT NULL REFERENCES "fact_identities" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "normalized_proposition" text NOT NULL,
  "effective_from" text NOT NULL,
  "effective_to" text,
  "currentness_state" text NOT NULL,
  "qualification" text NOT NULL DEFAULT '',
  "normative_strength" text NOT NULL,
  "payload_json" text NOT NULL,
  "provenance_json" text NOT NULL,
  "payload_hash" text NOT NULL,
  "provenance_hash" text NOT NULL,
  "lifecycle_state" text NOT NULL DEFAULT 'DRAFT',
  "created_by" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "temporal_assertions_interval_check" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
  CONSTRAINT "temporal_assertions_currentness_check" CHECK ("currentness_state" IN ('CURRENT_VERIFIED', 'CURRENT_WITH_QUALIFICATION', 'FUTURE_CHANGE_PENDING', 'UNVERIFIED', 'SUPERSEDED', 'CONFLICTING')),
  CONSTRAINT "temporal_assertions_normative_strength_check" CHECK ("normative_strength" IN ('STATUTORY_REQUIREMENT', 'REGULATORY_REQUIREMENT', 'OFFICIAL_INTERPRETATION', 'OFFICIAL_GUIDANCE', 'BEST_PRACTICE_REFERENCE', 'EXAM_IDENTITY_FACT', 'NEUTRAL_DEFINITION')),
  CONSTRAINT "temporal_assertions_lifecycle_check" CHECK ("lifecycle_state" IN ('DRAFT', 'PUBLISHED', 'SUPERSEDED')),
  CONSTRAINT "temporal_assertions_payload_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "temporal_assertions_provenance_hash_check" CHECK ("provenance_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "temporal_assertions_payload_length_check" CHECK (length("payload_json") <= 100000 AND length("provenance_json") <= 100000 AND length("qualification") <= 2000)
);

CREATE UNIQUE INDEX IF NOT EXISTS "temporal_assertions_semantic_digest_unique"
ON "temporal_assertions" ("fact_identity_id", "payload_hash", "provenance_hash");
CREATE INDEX IF NOT EXISTS "temporal_assertions_fact_history_idx"
ON "temporal_assertions" ("fact_identity_id", "effective_from", "created_at");
CREATE INDEX IF NOT EXISTS "temporal_assertions_currentness_idx"
ON "temporal_assertions" ("currentness_state", "effective_from", "effective_to");
CREATE INDEX IF NOT EXISTS "temporal_assertions_lifecycle_idx"
ON "temporal_assertions" ("lifecycle_state", "created_at");

CREATE TABLE IF NOT EXISTS "source_identities" (
  "id" text PRIMARY KEY NOT NULL,
  "canonical_key" text NOT NULL,
  "source_type" text NOT NULL,
  "canonical_label" text NOT NULL,
  "normalized_identity" text NOT NULL,
  "publisher" text NOT NULL DEFAULT '',
  "jurisdiction" text NOT NULL DEFAULT '',
  "lifecycle_state" text NOT NULL DEFAULT 'ACTIVE',
  "created_by" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "source_identities_lifecycle_check" CHECK ("lifecycle_state" IN ('ACTIVE', 'RETIRED')),
  CONSTRAINT "source_identities_identity_check" CHECK (length(trim("normalized_identity")) > 0 AND length("normalized_identity") <= 300)
);

CREATE UNIQUE INDEX IF NOT EXISTS "source_identities_canonical_key_unique"
ON "source_identities" ("canonical_key");
CREATE UNIQUE INDEX IF NOT EXISTS "source_identities_normalized_unique"
ON "source_identities" ("source_type", "normalized_identity");
CREATE INDEX IF NOT EXISTS "source_identities_type_lifecycle_idx"
ON "source_identities" ("source_type", "lifecycle_state", "created_at");

CREATE TABLE IF NOT EXISTS "assertion_source_bindings" (
  "id" text PRIMARY KEY NOT NULL,
  "temporal_assertion_id" text NOT NULL REFERENCES "temporal_assertions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "source_identity_id" text NOT NULL REFERENCES "source_identities" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "source_role" text NOT NULL,
  "source_version" text NOT NULL DEFAULT '',
  "source_hash" text NOT NULL DEFAULT '',
  "locator" text NOT NULL,
  "verification_metadata_json" text NOT NULL DEFAULT '{}',
  "created_by" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "assertion_source_bindings_role_check" CHECK ("source_role" IN ('PRIMARY_AUTHORITY', 'SUPPORTING_AUTHORITY', 'CONTEXT_SOURCE')),
  CONSTRAINT "assertion_source_bindings_hash_check" CHECK ("source_hash" = '' OR "source_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "assertion_source_bindings_metadata_length_check" CHECK (length("verification_metadata_json") <= 100000)
);

CREATE UNIQUE INDEX IF NOT EXISTS "assertion_source_bindings_identity_unique"
ON "assertion_source_bindings" ("temporal_assertion_id", "source_identity_id", "source_role", "locator");
CREATE UNIQUE INDEX IF NOT EXISTS "assertion_source_bindings_primary_unique"
ON "assertion_source_bindings" ("temporal_assertion_id") WHERE "source_role" = 'PRIMARY_AUTHORITY';
CREATE INDEX IF NOT EXISTS "assertion_source_bindings_assertion_role_idx"
ON "assertion_source_bindings" ("temporal_assertion_id", "source_role", "created_at");
CREATE INDEX IF NOT EXISTS "assertion_source_bindings_source_idx"
ON "assertion_source_bindings" ("source_identity_id", "created_at");

CREATE TABLE IF NOT EXISTS "fact_concept_bindings" (
  "id" text PRIMARY KEY NOT NULL,
  "fact_identity_id" text NOT NULL REFERENCES "fact_identities" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "concept_id" text NOT NULL REFERENCES "ontology_concepts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  "created_by" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE UNIQUE INDEX IF NOT EXISTS "fact_concept_bindings_identity_unique"
ON "fact_concept_bindings" ("fact_identity_id", "concept_id");
CREATE INDEX IF NOT EXISTS "fact_concept_bindings_concept_idx"
ON "fact_concept_bindings" ("concept_id", "created_at");

CREATE TABLE IF NOT EXISTS "fact_track_bindings" (
  "id" text PRIMARY KEY NOT NULL,
  "fact_identity_id" text NOT NULL REFERENCES "fact_identities" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "track_key" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "fact_track_bindings_track_check" CHECK (length(trim("track_key")) > 0 AND length("track_key") <= 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS "fact_track_bindings_identity_unique"
ON "fact_track_bindings" ("fact_identity_id", "track_key");
CREATE INDEX IF NOT EXISTS "fact_track_bindings_track_idx"
ON "fact_track_bindings" ("track_key", "created_at");

REVOKE ALL PRIVILEGES ON TABLE public."fact_identities" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."temporal_assertions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."source_identities" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."assertion_source_bindings" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."fact_concept_bindings" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."fact_track_bindings" FROM PUBLIC, anon, authenticated;

ALTER TABLE public."fact_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fact_identities" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."temporal_assertions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."temporal_assertions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."source_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."source_identities" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."assertion_source_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."assertion_source_bindings" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fact_concept_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fact_concept_bindings" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fact_track_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fact_track_bindings" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0011_canonical_fact_foundation', 'manual-canonical-fact-foundation')
ON CONFLICT (id) DO NOTHING;

COMMIT;
