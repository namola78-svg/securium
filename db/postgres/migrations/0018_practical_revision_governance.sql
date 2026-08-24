-- Bounded Practical Governance PR A foundation. Canonical activation requires separate authorization.
BEGIN;

ALTER TABLE public."practical_rubric_versions"
  ADD COLUMN "evaluation_semantic_hash" text,
  ADD COLUMN "evaluation_method" text,
  ADD COLUMN "human_review_hash" text,
  ADD COLUMN "evidence_classification" text,
  ADD CONSTRAINT "practical_rubric_versions_evaluation_method_check"
    CHECK ("evaluation_method" IS NULL OR "evaluation_method" IN ('RULE_BASED', 'STRUCTURED_HUMAN_REVIEW', 'HYBRID')),
  ADD CONSTRAINT "practical_rubric_versions_evidence_check"
    CHECK ("evidence_classification" IS NULL OR "evidence_classification" IN ('ELIGIBLE_PERFORMANCE_EVIDENCE', 'ELIGIBLE_AFTER_HUMAN_EVALUATION', 'SUPPORTING_ACTIVITY_ONLY')),
  ADD CONSTRAINT "practical_rubric_versions_evaluation_hash_check"
    CHECK ("evaluation_semantic_hash" IS NULL OR "evaluation_semantic_hash" ~ '^[0-9a-f]{64}$');

CREATE TABLE public."canonical_practicals" (
  "id" text PRIMARY KEY,
  "semantic_key" text NOT NULL UNIQUE,
  "lifecycle" text NOT NULL DEFAULT 'DRAFT',
  "created_by" text NOT NULL,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canonical_practicals_lifecycle_check" CHECK ("lifecycle" IN ('DRAFT', 'HUMAN_APPROVED', 'CANONICAL_UNPUBLISHED', 'SUPERSEDED'))
);

CREATE TABLE public."practical_governance_versions" (
  "id" text PRIMARY KEY,
  "practical_id" text NOT NULL REFERENCES public."canonical_practicals" ("id") ON DELETE RESTRICT,
  "version" integer NOT NULL,
  "semantic_hash" text NOT NULL,
  "human_review_hash" text NOT NULL,
  "safety_review_hash" text NOT NULL,
  "rights_binding" text NOT NULL,
  "provenance_binding" text NOT NULL,
  "concept_mapping_hash" text NOT NULL,
  "theory_dependency_json" text NOT NULL,
  "currentness_reference" text NOT NULL,
  "lifecycle" text NOT NULL DEFAULT 'DRAFT',
  "superseded_by_id" text REFERENCES public."practical_governance_versions" ("id") ON DELETE RESTRICT,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "practical_governance_versions_identity_unique" UNIQUE ("practical_id", "version"),
  CONSTRAINT "practical_governance_versions_semantic_unique" UNIQUE ("practical_id", "semantic_hash"),
  CONSTRAINT "practical_governance_versions_hash_check" CHECK ("semantic_hash" ~ '^[0-9a-f]{64}$' AND "human_review_hash" ~ '^[0-9a-f]{64}$' AND "safety_review_hash" ~ '^[0-9a-f]{64}$' AND "concept_mapping_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "practical_governance_versions_lifecycle_check" CHECK ("lifecycle" IN ('DRAFT', 'HUMAN_APPROVED', 'CANONICAL_UNPUBLISHED', 'SUPERSEDED'))
);
CREATE INDEX "practical_governance_versions_lifecycle_idx" ON public."practical_governance_versions" ("lifecycle", "created_at");

CREATE TABLE public."practical_reviewer_material_versions" (
  "id" text PRIMARY KEY,
  "practical_version_id" text NOT NULL REFERENCES public."practical_governance_versions" ("id") ON DELETE RESTRICT,
  "rubric_version_id" text NOT NULL REFERENCES public."practical_rubric_versions" ("id") ON DELETE RESTRICT,
  "payload_json" text NOT NULL,
  "payload_digest" text NOT NULL,
  "visibility" text NOT NULL DEFAULT 'REVIEWER_ONLY',
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "practical_reviewer_material_versions_identity_unique" UNIQUE ("practical_version_id", "rubric_version_id"),
  CONSTRAINT "practical_reviewer_material_versions_visibility_check" CHECK ("visibility" = 'REVIEWER_ONLY'),
  CONSTRAINT "practical_reviewer_material_versions_digest_check" CHECK ("payload_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "practical_reviewer_material_versions_payload_length_check" CHECK (length("payload_json") <= 200000)
);

CREATE TABLE public."practical_version_concept_bindings" (
  "id" text PRIMARY KEY,
  "practical_version_id" text NOT NULL REFERENCES public."practical_governance_versions" ("id") ON DELETE RESTRICT,
  "concept_key" text NOT NULL,
  "concept_id" text,
  "mapping_semantic_hash" text NOT NULL,
  "qualification_json" text NOT NULL,
  "mapping_status" text NOT NULL DEFAULT 'PENDING',
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "practical_version_concept_bindings_identity_unique" UNIQUE ("practical_version_id", "concept_key"),
  CONSTRAINT "practical_version_concept_bindings_hash_check" CHECK ("mapping_semantic_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "practical_version_concept_bindings_status_check" CHECK ("mapping_status" IN ('PENDING', 'APPROVED', 'SUPERSEDED', 'LEGACY_UNVERIFIED')),
  CONSTRAINT "practical_version_concept_bindings_identity_check" CHECK ("concept_id" IS NOT NULL OR length("concept_key") > 0)
);

ALTER TABLE public."practical_attempts"
  ADD COLUMN "practical_governance_version_id" text REFERENCES public."practical_governance_versions" ("id") ON DELETE RESTRICT;

REVOKE ALL PRIVILEGES ON TABLE public."canonical_practicals", public."practical_governance_versions", public."practical_reviewer_material_versions", public."practical_version_concept_bindings" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."canonical_practicals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."canonical_practicals" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."practical_governance_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_governance_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."practical_reviewer_material_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_reviewer_material_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."practical_version_concept_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_version_concept_bindings" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0018_practical_revision_governance', 'pending-sha256')
ON CONFLICT (id) DO NOTHING;

COMMIT;
