-- Add governed metadata to the reusable Fact -> Concept binding.
-- Non-production implementation migration; production apply requires a separate preflight.
BEGIN;

ALTER TABLE public."fact_concept_bindings"
  ADD COLUMN IF NOT EXISTS "relation_type" text NOT NULL DEFAULT 'MAPS_TO',
  ADD COLUMN IF NOT EXISTS "qualification_json" text,
  ADD COLUMN IF NOT EXISTS "mapping_basis" text,
  ADD COLUMN IF NOT EXISTS "provenance_json" text,
  ADD COLUMN IF NOT EXISTS "mapping_status" text NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
  ADD COLUMN IF NOT EXISTS "mapping_version" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "reviewed_by" text,
  ADD COLUMN IF NOT EXISTS "reviewed_at" text;

ALTER TABLE public."fact_concept_bindings"
  ADD CONSTRAINT "fact_concept_bindings_relation_check"
    CHECK ("relation_type" = 'MAPS_TO'),
  ADD CONSTRAINT "fact_concept_bindings_status_check"
    CHECK ("mapping_status" IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  ADD CONSTRAINT "fact_concept_bindings_version_check"
    CHECK ("mapping_version" > 0),
  ADD CONSTRAINT "fact_concept_bindings_review_check"
    CHECK ("mapping_status" <> 'APPROVED' OR ("reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL));

ALTER TABLE public."fact_concept_bindings"
  ADD CONSTRAINT "fact_concept_bindings_reviewed_by_fk"
  FOREIGN KEY ("reviewed_by") REFERENCES public."users" ("id")
  ON UPDATE NO ACTION ON DELETE NO ACTION;

DROP INDEX IF EXISTS public."fact_concept_bindings_identity_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "fact_concept_bindings_current_unique"
ON public."fact_concept_bindings" ("fact_identity_id", "concept_id")
WHERE "mapping_status" IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED');
CREATE INDEX IF NOT EXISTS "fact_concept_bindings_fact_status_idx"
ON public."fact_concept_bindings" ("fact_identity_id", "mapping_status", "created_at");
CREATE INDEX IF NOT EXISTS "fact_concept_bindings_concept_status_idx"
ON public."fact_concept_bindings" ("concept_id", "mapping_status", "created_at");
CREATE INDEX IF NOT EXISTS "fact_concept_bindings_semantic_version_idx"
ON public."fact_concept_bindings" ("fact_identity_id", "concept_id", "mapping_version");

REVOKE ALL PRIVILEGES ON TABLE public."fact_concept_bindings" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."fact_concept_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fact_concept_bindings" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0012_fact_concept_mapping_governance', 'pending-sha256')
ON CONFLICT (id) DO NOTHING;

COMMIT;
