-- Additive CP-A foundation; no backfill or materialization.
BEGIN;

CREATE TABLE "concepts" (
  "id" text PRIMARY KEY NOT NULL,
  "stable_key" text NOT NULL,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "concepts_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'RETIRED'))
);
CREATE UNIQUE INDEX "concepts_stable_key_unique" ON "concepts" ("stable_key");

CREATE TABLE "concept_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "concept_id" text NOT NULL REFERENCES "concepts"("id") ON DELETE RESTRICT,
  "version" integer NOT NULL,
  "semantic_hash" text NOT NULL,
  "definition" text NOT NULL,
  "scope" text NOT NULL,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "activated_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "concept_versions_version_check" CHECK ("version" > 0),
  CONSTRAINT "concept_versions_hash_check" CHECK ("semantic_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "concept_versions_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'RETIRED'))
);
CREATE UNIQUE INDEX "concept_versions_identity_unique" ON "concept_versions" ("concept_id", "version");
CREATE UNIQUE INDEX "concept_versions_hash_unique" ON "concept_versions" ("concept_id", "semantic_hash");
CREATE INDEX "concept_versions_status_idx" ON "concept_versions" ("concept_id", "status");

CREATE TABLE "concept_labels" (
  "id" text PRIMARY KEY NOT NULL,
  "concept_id" text NOT NULL REFERENCES "concepts"("id") ON DELETE RESTRICT,
  "language" text NOT NULL,
  "label" text NOT NULL,
  "normalized_label" text NOT NULL,
  "label_type" text NOT NULL DEFAULT 'PREF',
  "status" text NOT NULL DEFAULT 'DRAFT',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "concept_labels_type_check" CHECK ("label_type" IN ('PREF', 'ALT')),
  CONSTRAINT "concept_labels_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT "concept_labels_nonempty_check" CHECK (length(trim("label")) > 0 AND length(trim("normalized_label")) > 0)
);
CREATE UNIQUE INDEX "concept_labels_identity_unique" ON "concept_labels" ("concept_id", "language", "normalized_label");
CREATE UNIQUE INDEX "concept_labels_pref_language_unique" ON "concept_labels" ("concept_id", "language", "label_type") WHERE "label_type" = 'PREF' AND "status" = 'ACTIVE';

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0020_concept_persistence_cp_a', 'cp-a-schema-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
