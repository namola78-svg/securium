-- Additive canonical question governance foundation.
-- Production application requires a separate migration authorization.
BEGIN;

ALTER TABLE public."question_versions"
  ADD COLUMN "semantic_hash" text,
  ADD COLUMN "blueprint_id" text,
  ADD COLUMN "qualification_json" text,
  ADD COLUMN "provenance_json" text,
  ADD COLUMN "governance_json" text,
  ADD COLUMN "human_review_hash" text,
  ADD COLUMN "human_reviewed_by" text,
  ADD COLUMN "human_reviewed_at" text;

ALTER TABLE public."question_versions"
  ADD CONSTRAINT "question_versions_review_binding_check"
    CHECK ("human_review_hash" IS NULL OR ("semantic_hash" IS NOT NULL AND "human_reviewed_by" IS NOT NULL AND "human_reviewed_at" IS NOT NULL)),
  ADD CONSTRAINT "question_versions_reviewed_by_fk"
    FOREIGN KEY ("human_reviewed_by") REFERENCES public."users" ("id")
    ON UPDATE NO ACTION ON DELETE NO ACTION;

CREATE UNIQUE INDEX IF NOT EXISTS "question_versions_semantic_hash_unique"
ON public."question_versions" ("question_id", "version", "semantic_hash");

CREATE TABLE public."question_concepts" (
  "id" text PRIMARY KEY,
  "question_version_id" text NOT NULL REFERENCES public."question_versions" ("id") ON DELETE RESTRICT,
  "concept_id" text NOT NULL REFERENCES public."ontology_concepts" ("id") ON DELETE RESTRICT,
  "created_by" text NOT NULL REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "relation_type" text NOT NULL DEFAULT 'MAPS_TO',
  "qualification_json" text,
  "provenance_json" text,
  "mapping_status" text NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
  "mapping_version" integer NOT NULL DEFAULT 1,
  "reviewed_by" text REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "reviewed_at" text,
  CONSTRAINT "question_concepts_relation_check" CHECK ("relation_type" = 'MAPS_TO'),
  CONSTRAINT "question_concepts_status_check" CHECK ("mapping_status" IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  CONSTRAINT "question_concepts_version_check" CHECK ("mapping_version" > 0),
  CONSTRAINT "question_concepts_review_check" CHECK ("mapping_status" <> 'APPROVED' OR ("reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL))
);

CREATE UNIQUE INDEX "question_concepts_current_unique"
ON public."question_concepts" ("question_version_id", "concept_id")
WHERE "mapping_status" IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED');
CREATE INDEX "question_concepts_version_status_idx"
ON public."question_concepts" ("question_version_id", "mapping_status", "created_at");
CREATE INDEX "question_concepts_concept_status_idx"
ON public."question_concepts" ("concept_id", "mapping_status", "created_at");

REVOKE ALL PRIVILEGES ON TABLE public."question_concepts" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."question_concepts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."question_concepts" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0013_question_governance_foundation', 'pending-sha256')
ON CONFLICT (id) DO NOTHING;

COMMIT;
