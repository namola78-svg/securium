-- Generic content revision registration V1.
-- Server-only, append-only registration aggregate. No historical backfill.
BEGIN;

CREATE TABLE public."content_revision_registrations" (
  "id" text PRIMARY KEY,
  "registration_contract_version" text NOT NULL,
  "resource_type" text NOT NULL,
  "qualification_id" text NOT NULL REFERENCES public."courses"("id") ON DELETE RESTRICT,
  "package_key" text NOT NULL,
  "package_semantic_identity" text NOT NULL,
  "provenance_aggregate_identity" text NOT NULL,
  "registration_semantic_identity" text NOT NULL,
  "state" text NOT NULL DEFAULT 'REGISTERED_REVIEW_PENDING',
  "idempotency_key" text,
  "created_by" text NOT NULL REFERENCES public."users"("id") ON DELETE RESTRICT,
  "audit_log_id" text NOT NULL REFERENCES public."admin_audit_logs"("id") ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "content_revision_registrations_contract_check" CHECK ("registration_contract_version" = 'CONTENT_REVISION_REGISTRATION_V1'),
  CONSTRAINT "content_revision_registrations_state_check" CHECK ("state" = 'REGISTERED_REVIEW_PENDING'),
  CONSTRAINT "content_revision_registrations_identity_check" CHECK (length(trim("package_key")) > 0 AND length(trim("package_semantic_identity")) > 0 AND length(trim("provenance_aggregate_identity")) > 0 AND length(trim("registration_semantic_identity")) > 0)
);

CREATE UNIQUE INDEX "content_revision_registrations_semantic_unique"
  ON public."content_revision_registrations" ("registration_contract_version", "registration_semantic_identity");
CREATE UNIQUE INDEX "content_revision_registrations_idempotency_unique"
  ON public."content_revision_registrations" ("idempotency_key");
CREATE UNIQUE INDEX "content_revision_registrations_audit_unique"
  ON public."content_revision_registrations" ("audit_log_id");
CREATE INDEX "content_revision_registrations_scope_idx"
  ON public."content_revision_registrations" ("qualification_id", "package_key", "created_at");

CREATE TABLE public."content_revision_registration_subjects" (
  "id" text PRIMARY KEY,
  "registration_id" text NOT NULL REFERENCES public."content_revision_registrations"("id") ON DELETE RESTRICT,
  "content_revision_id" text NOT NULL REFERENCES public."content_revisions"("id") ON DELETE RESTRICT,
  "semantic_revision_id" text NOT NULL,
  "content_hash" text NOT NULL,
  "provenance_identity" text NOT NULL,
  "source_lineage" text NOT NULL,
  "rights_state" text NOT NULL DEFAULT 'REVIEW_REQUIRED',
  "originality_state" text NOT NULL DEFAULT 'REVIEW_REQUIRED',
  "currentness_state" text NOT NULL DEFAULT 'REVIEW_REQUIRED',
  "responsible_owner_state" text NOT NULL DEFAULT 'OWNER_ATTESTATION_REQUIRED',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "content_revision_registration_subjects_hash_check" CHECK ("content_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "content_revision_registration_subjects_state_check" CHECK ("rights_state" = 'REVIEW_REQUIRED' AND "originality_state" = 'REVIEW_REQUIRED' AND "currentness_state" = 'REVIEW_REQUIRED' AND "responsible_owner_state" = 'OWNER_ATTESTATION_REQUIRED'),
  CONSTRAINT "content_revision_registration_subjects_identity_check" CHECK (length(trim("semantic_revision_id")) > 0 AND length(trim("provenance_identity")) > 0 AND length(trim("source_lineage")) > 0)
);

CREATE UNIQUE INDEX "content_revision_registration_subjects_membership_unique"
  ON public."content_revision_registration_subjects" ("registration_id", "content_revision_id");
CREATE UNIQUE INDEX "content_revision_registration_subjects_semantic_unique"
  ON public."content_revision_registration_subjects" ("registration_id", "semantic_revision_id");
CREATE INDEX "content_revision_registration_subjects_registration_idx"
  ON public."content_revision_registration_subjects" ("registration_id", "semantic_revision_id");

CREATE TABLE public."content_revision_registration_sources" (
  "id" text PRIMARY KEY,
  "registration_subject_id" text NOT NULL REFERENCES public."content_revision_registration_subjects"("id") ON DELETE RESTRICT,
  "source_identity_id" text NOT NULL REFERENCES public."source_identities"("id") ON DELETE RESTRICT,
  "binding_role" text NOT NULL,
  "locator" text NOT NULL,
  "expression_reuse" text NOT NULL DEFAULT 'NOT_USED',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "content_revision_registration_sources_role_check" CHECK (length(trim("binding_role")) > 0 AND "binding_role" = 'SCOPE_REFERENCE'),
  CONSTRAINT "content_revision_registration_sources_expression_check" CHECK ("expression_reuse" = 'NOT_USED' AND length(trim("locator")) > 0)
);

CREATE UNIQUE INDEX "content_revision_registration_sources_identity_unique"
  ON public."content_revision_registration_sources" ("registration_subject_id", "source_identity_id", "binding_role", "locator");
CREATE INDEX "content_revision_registration_sources_subject_idx"
  ON public."content_revision_registration_sources" ("registration_subject_id", "binding_role");
CREATE INDEX "content_revision_registration_sources_source_idx"
  ON public."content_revision_registration_sources" ("source_identity_id", "created_at");

CREATE OR REPLACE FUNCTION public.content_revision_registration_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Content revision registration rows are append-only';
END;
$$;

CREATE TRIGGER content_revision_registrations_no_update
BEFORE UPDATE ON public."content_revision_registrations" FOR EACH ROW
EXECUTE FUNCTION public.content_revision_registration_immutable();
CREATE TRIGGER content_revision_registrations_no_delete
BEFORE DELETE ON public."content_revision_registrations" FOR EACH ROW
EXECUTE FUNCTION public.content_revision_registration_immutable();
CREATE TRIGGER content_revision_registration_subjects_no_update
BEFORE UPDATE ON public."content_revision_registration_subjects" FOR EACH ROW
EXECUTE FUNCTION public.content_revision_registration_immutable();
CREATE TRIGGER content_revision_registration_subjects_no_delete
BEFORE DELETE ON public."content_revision_registration_subjects" FOR EACH ROW
EXECUTE FUNCTION public.content_revision_registration_immutable();
CREATE TRIGGER content_revision_registration_sources_no_update
BEFORE UPDATE ON public."content_revision_registration_sources" FOR EACH ROW
EXECUTE FUNCTION public.content_revision_registration_immutable();
CREATE TRIGGER content_revision_registration_sources_no_delete
BEFORE DELETE ON public."content_revision_registration_sources" FOR EACH ROW
EXECUTE FUNCTION public.content_revision_registration_immutable();

REVOKE ALL PRIVILEGES ON TABLE public."content_revision_registrations", public."content_revision_registration_subjects", public."content_revision_registration_sources" FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."content_revision_registrations", public."content_revision_registration_subjects", public."content_revision_registration_sources" TO service_role;
ALTER TABLE public."content_revision_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_revision_registrations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."content_revision_registration_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_revision_registration_subjects" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."content_revision_registration_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_revision_registration_sources" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0028_generic_content_revision_registration_v1', 'generic-content-revision-registration-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
