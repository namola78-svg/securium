-- CS1A R2 canonical append-only governance receipts. No backfill or classification.
BEGIN;

CREATE TABLE public."cs1a_governance_receipts" (
  "receipt_id" text PRIMARY KEY,
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "resource_revision_id" text NOT NULL,
  "parent_revision_id" text,
  "revision_hash" text NOT NULL,
  "source_set_hash" text NOT NULL,
  "policy_version" text NOT NULL,
  "rights_disposition" text NOT NULL,
  "currentness_disposition" text NOT NULL,
  "content_class" text NOT NULL,
  "authoring_origin" text NOT NULL,
  "source_origin" text NOT NULL,
  "publication_authority" text NOT NULL,
  "decision" text NOT NULL,
  "reason_code" text NOT NULL,
  "human_decision_hash" text NOT NULL,
  "human_decision_ref" text NOT NULL,
  "human_decision_at" text NOT NULL,
  "semantic_decision_hash" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "supersedes_receipt_id" text REFERENCES public."cs1a_governance_receipts"("receipt_id") ON DELETE RESTRICT,
  "source_manifest_ref" text,
  "source_authority" text,
  "actor_audit_log_id" text NOT NULL,
  "git_sha" text,
  "execution_id" text,
  "created_at" text NOT NULL,
  CONSTRAINT "cs1a_governance_receipts_resource_type_check" CHECK ("resource_type" IN ('CONTENT', 'CONTENT_REVISION', 'QUESTION', 'QUESTION_VERSION', 'LESSON', 'LEARNING_UNIT', 'COURSE_LESSON', 'CURRICULUM_TREE', 'CURRICULUM_NODE', 'COURSE_GROUP', 'COURSE', 'SUBJECT', 'TOPIC')),
  CONSTRAINT "cs1a_governance_receipts_content_class_check" CHECK ("content_class" IN ('PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED', 'AUTHORIZED_EXTERNAL_SOURCE', 'REVIEW_REQUIRED_EXTERNAL_SOURCE', 'LEGACY_REVIEW_REQUIRED', 'MUST_EXCLUDE', 'UNKNOWN')),
  CONSTRAINT "cs1a_governance_receipts_decision_check" CHECK ("decision" IN ('ALLOW_DRAFT', 'ALLOW_CANONICAL', 'ALLOW_PUBLICATION', 'DENY', 'DEFER_RIGHTS', 'DEFER_CURRENTNESS')),
  CONSTRAINT "cs1a_governance_receipts_reason_code_check" CHECK ("reason_code" IN ('AUTHORIZED_PROSPECTIVE_ORIGINAL', 'AUTHORIZED_EXTERNAL_SOURCE', 'REVIEW_REQUIRED', 'LEGACY_REVIEW_REQUIRED', 'MUST_EXCLUDE', 'UNKNOWN_CONTENT_CLASS', 'MISSING_PROVENANCE', 'UNSUPPORTED_POLICY_VERSION', 'INVALID_RESOURCE_IDENTITY', 'AMBIGUOUS_EFFECTIVE_STATE', 'PUBLICATION_AUTHORITY_REQUIRED', 'POLICY_DENY')),
  CONSTRAINT "cs1a_governance_receipts_rights_check" CHECK ("rights_disposition" IN ('ORIGINAL_INTERNAL', 'REVIEWED_EXTERNAL_AUTHORIZED', 'REVIEW_REQUIRED', 'LEGACY_UNRESOLVED', 'EXCLUDED', 'UNKNOWN')),
  CONSTRAINT "cs1a_governance_receipts_currentness_check" CHECK ("currentness_disposition" IN ('CURRENT', 'CURRENT_WITH_VERSION_UNCERTAINTY', 'HISTORICAL', 'SUPERSEDED', 'FUTURE_EFFECTIVE', 'UNKNOWN', 'REVIEW_REQUIRED')),
  CONSTRAINT "cs1a_governance_receipts_publication_authority_check" CHECK ("publication_authority" IN ('NOT_GRANTED', 'GRANTED_BY_SEPARATE_AUTHORITY', 'NOT_APPLICABLE')),
  CONSTRAINT "cs1a_governance_receipts_authoring_origin_check" CHECK ("authoring_origin" IN ('SECURIUM_ADMIN_CMS', 'SECURIUM_GIT_PACKAGE', 'EXTERNAL_SOURCE', 'LEGACY', 'UNKNOWN')),
  CONSTRAINT "cs1a_governance_receipts_source_origin_check" CHECK ("source_origin" IN ('NONE_NOT_APPLICABLE', 'KNOWN_SOURCE_PACKAGE', 'KNOWN_EXTERNAL_SOURCE', 'LEGACY_UNKNOWN', 'UNKNOWN')),
  CONSTRAINT "cs1a_governance_receipts_policy_check" CHECK ("policy_version" = 'CS1A_POLICY_V1'),
  CONSTRAINT "cs1a_governance_receipts_hash_check" CHECK ("revision_hash" ~ '^[0-9a-f]{64}$' AND "source_set_hash" ~ '^[0-9a-f]{64}$' AND "human_decision_hash" ~ '^[0-9a-f]{64}$' AND "semantic_decision_hash" ~ '^[0-9a-f]{64}$' AND "idempotency_key" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "cs1a_governance_receipts_source_binding_check" CHECK (("source_origin" = 'NONE_NOT_APPLICABLE' AND "source_authority" IS NULL AND "source_manifest_ref" IS NULL) OR ("source_origin" <> 'NONE_NOT_APPLICABLE' AND length(trim("source_authority")) > 0)),
  CONSTRAINT "cs1a_governance_receipts_publication_separation_check" CHECK (("decision" = 'ALLOW_PUBLICATION' AND "publication_authority" = 'GRANTED_BY_SEPARATE_AUTHORITY' AND "supersedes_receipt_id" IS NOT NULL) OR ("decision" <> 'ALLOW_PUBLICATION' AND "publication_authority" <> 'GRANTED_BY_SEPARATE_AUTHORITY')),
  CONSTRAINT "cs1a_governance_receipts_no_self_supersession_check" CHECK ("supersedes_receipt_id" IS NULL OR "supersedes_receipt_id" <> "receipt_id")
);

CREATE UNIQUE INDEX "cs1a_governance_receipts_idempotency_unique" ON public."cs1a_governance_receipts" ("idempotency_key");
CREATE UNIQUE INDEX "cs1a_governance_receipts_semantic_hash_unique" ON public."cs1a_governance_receipts" ("semantic_decision_hash");
CREATE INDEX "cs1a_governance_receipts_resource_idx" ON public."cs1a_governance_receipts" ("resource_type", "resource_id", "resource_revision_id", "created_at");
CREATE INDEX "cs1a_governance_receipts_supersession_idx" ON public."cs1a_governance_receipts" ("supersedes_receipt_id");

CREATE OR REPLACE FUNCTION public.cs1a_governance_receipts_same_resource_supersession()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."supersedes_receipt_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."cs1a_governance_receipts" prior
    WHERE prior."receipt_id" = NEW."supersedes_receipt_id"
      AND prior."resource_type" = NEW."resource_type"
      AND prior."resource_id" = NEW."resource_id"
  ) THEN
    RAISE EXCEPTION 'CS1A supersession must remain within one governed resource';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cs1a_governance_receipts_same_resource_supersession
BEFORE INSERT ON public."cs1a_governance_receipts" FOR EACH ROW
EXECUTE FUNCTION public.cs1a_governance_receipts_same_resource_supersession();

CREATE OR REPLACE FUNCTION public.cs1a_governance_receipts_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CS1A governance receipts are append-only';
END;
$$;
CREATE TRIGGER cs1a_governance_receipts_no_update BEFORE UPDATE ON public."cs1a_governance_receipts" FOR EACH ROW EXECUTE FUNCTION public.cs1a_governance_receipts_immutable();
CREATE TRIGGER cs1a_governance_receipts_no_delete BEFORE DELETE ON public."cs1a_governance_receipts" FOR EACH ROW EXECUTE FUNCTION public.cs1a_governance_receipts_immutable();

REVOKE ALL PRIVILEGES ON TABLE public."cs1a_governance_receipts" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."cs1a_governance_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cs1a_governance_receipts" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0021_cs1a_governance_receipts', 'cs1a-governance-receipts-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
