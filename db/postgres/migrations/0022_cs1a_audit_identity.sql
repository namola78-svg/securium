-- CS1A G1 lossless decision identity and canonical audit binding.
-- Additive only; no historical backfill or rewrite.
BEGIN;

CREATE TABLE public."cs1a_governance_decisions" (
  "id" text PRIMARY KEY,
  "contract_version" text NOT NULL,
  "human_decision_hash" text NOT NULL,
  "decision" text NOT NULL,
  "reason_code" text NOT NULL,
  "publication_authority" text NOT NULL,
  "subject_count" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cs1a_governance_decisions_identity_unique" UNIQUE ("contract_version", "human_decision_hash"),
  CONSTRAINT "cs1a_governance_decisions_subject_count_check" CHECK ("subject_count" > 0),
  CONSTRAINT "cs1a_governance_decisions_hash_check" CHECK ("human_decision_hash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE public."cs1a_governance_decision_subjects" (
  "id" text PRIMARY KEY,
  "decision_id" text NOT NULL REFERENCES public."cs1a_governance_decisions"("id") ON DELETE RESTRICT,
  "canonical_subject_identity" text NOT NULL REFERENCES public."content_revisions"("id") ON DELETE RESTRICT,
  "governance_scope" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "content_hash" text NOT NULL,
  "revision_hash" text NOT NULL,
  "policy_version" text NOT NULL,
  "decision" text NOT NULL,
  "reason_code" text NOT NULL,
  "rights_disposition" text NOT NULL,
  "currentness_disposition" text NOT NULL,
  "authoring_origin" text NOT NULL,
  "content_class" text NOT NULL,
  "source_origin" text NOT NULL,
  "publication_authority" text NOT NULL,
  "source_authority" text,
  "source_manifest_ref" text,
  "source_set_hash" text,
  "parent_revision_id" text,
  "immutable_provenance_identity" text,
  CONSTRAINT "cs1a_governance_decision_subjects_membership_unique" UNIQUE ("decision_id", "canonical_subject_identity"),
  CONSTRAINT "cs1a_governance_decision_subjects_resource_type_check" CHECK ("resource_type" = 'CONTENT_REVISION')
);

CREATE INDEX "cs1a_governance_decision_subjects_decision_idx"
  ON public."cs1a_governance_decision_subjects" ("decision_id");

CREATE TABLE public."cs1a_governance_decision_audits" (
  "decision_id" text PRIMARY KEY REFERENCES public."cs1a_governance_decisions"("id") ON DELETE RESTRICT,
  "audit_log_id" text NOT NULL REFERENCES public."admin_audit_logs"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cs1a_governance_decision_audits_audit_unique" UNIQUE ("audit_log_id")
);

REVOKE ALL PRIVILEGES ON TABLE public."cs1a_governance_decisions", public."cs1a_governance_decision_subjects", public."cs1a_governance_decision_audits" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."cs1a_governance_decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cs1a_governance_decisions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."cs1a_governance_decision_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cs1a_governance_decision_subjects" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."cs1a_governance_decision_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cs1a_governance_decision_audits" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0022_cs1a_audit_identity', 'cs1a-audit-identity-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
