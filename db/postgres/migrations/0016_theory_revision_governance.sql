-- Bounded Theory revision governance extension. Production deployment requires separate authorization.
BEGIN;

ALTER TABLE public."content_revisions"
  ADD COLUMN "semantic_hash" text,
  ADD COLUMN "human_review_hash" text,
  ADD CONSTRAINT "content_revisions_review_binding_check"
    CHECK ("human_review_hash" IS NULL OR ("semantic_hash" IS NOT NULL AND "reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL));

CREATE UNIQUE INDEX "content_revisions_semantic_hash_unique"
ON public."content_revisions" ("content_type", "content_id", "semantic_hash");

CREATE TABLE public."content_revision_concepts" (
  "id" text PRIMARY KEY,
  "revision_id" text NOT NULL REFERENCES public."content_revisions" ("id") ON DELETE RESTRICT,
  "concept_id" text REFERENCES public."ontology_concepts" ("id") ON DELETE RESTRICT,
  "created_by" text NOT NULL REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "relation_type" text NOT NULL DEFAULT 'MAPS_TO',
  "qualification_json" text NOT NULL,
  "provenance_json" text NOT NULL,
  "mapping_status" text NOT NULL DEFAULT 'SUGGESTED',
  "mapping_version" integer NOT NULL DEFAULT 1,
  "reviewed_by" text REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "reviewed_at" text,
  CONSTRAINT "content_revision_concepts_relation_check" CHECK ("relation_type" = 'MAPS_TO'),
  CONSTRAINT "content_revision_concepts_status_check" CHECK ("mapping_status" IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  CONSTRAINT "content_revision_concepts_version_check" CHECK ("mapping_version" > 0),
  CONSTRAINT "content_revision_concepts_review_check" CHECK ("mapping_status" <> 'APPROVED' OR ("reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  CONSTRAINT "content_revision_concepts_identity_check" CHECK ("concept_id" IS NOT NULL OR length("qualification_json") > 0)
);

CREATE UNIQUE INDEX "content_revision_concepts_current_unique"
ON public."content_revision_concepts" ("revision_id", "concept_id", "mapping_version")
WHERE "mapping_status" IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED');
CREATE INDEX "content_revision_concepts_version_status_idx"
ON public."content_revision_concepts" ("revision_id", "mapping_status", "mapping_version");
CREATE INDEX "content_revision_concepts_concept_status_idx"
ON public."content_revision_concepts" ("concept_id", "mapping_status");

REVOKE ALL PRIVILEGES ON TABLE public."content_revision_concepts" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."content_revision_concepts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_revision_concepts" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0016_theory_revision_governance', 'pending-sha256')
ON CONFLICT (id) DO NOTHING;

COMMIT;
