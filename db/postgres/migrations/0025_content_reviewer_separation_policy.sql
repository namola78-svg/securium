-- Generic reviewer-separation policy V1; additive only, no backfill or review execution.
BEGIN;

CREATE TABLE public."content_review_owner_attestations" (
  "attestation_id" text PRIMARY KEY,
  "contract_version" text NOT NULL DEFAULT 'CONTENT_REVIEW_JUDGMENT_V1',
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "reviewed_input_identity" text NOT NULL,
  "owner_user_id" text NOT NULL REFERENCES public."users"("id") ON DELETE RESTRICT,
  "attestation_type" text NOT NULL DEFAULT 'RESPONSIBLE_OWNER',
  "policy_version" text NOT NULL DEFAULT 'CONTENT_REVIEWER_SEPARATION_POLICY_V1',
  "semantic_identity" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "lifecycle_state" text NOT NULL DEFAULT 'ACTIVE',
  "supersedes_attestation_id" text REFERENCES public."content_review_owner_attestations"("attestation_id") ON DELETE RESTRICT,
  "audit_log_id" text NOT NULL REFERENCES public."admin_audit_logs"("id") ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "content_review_owner_attestations_contract_check" CHECK ("contract_version" = 'CONTENT_REVIEW_JUDGMENT_V1'),
  CONSTRAINT "content_review_owner_attestations_policy_check" CHECK ("policy_version" = 'CONTENT_REVIEWER_SEPARATION_POLICY_V1'),
  CONSTRAINT "content_review_owner_attestations_type_check" CHECK ("attestation_type" = 'RESPONSIBLE_OWNER'),
  CONSTRAINT "content_review_owner_attestations_lifecycle_check" CHECK ("lifecycle_state" IN ('ACTIVE', 'HISTORICAL', 'INVALIDATED', 'SUPERSEDED')),
  CONSTRAINT "content_review_owner_attestations_hash_check" CHECK ("reviewed_input_identity" ~ '^[0-9a-f]{64}$' AND "semantic_identity" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "content_review_owner_attestations_no_self_supersession_check" CHECK ("supersedes_attestation_id" IS NULL OR "supersedes_attestation_id" <> "attestation_id")
);
CREATE UNIQUE INDEX "content_review_owner_attestations_semantic_unique" ON public."content_review_owner_attestations" ("semantic_identity");
CREATE UNIQUE INDEX "content_review_owner_attestations_idempotency_unique" ON public."content_review_owner_attestations" ("idempotency_key");
CREATE UNIQUE INDEX "content_review_owner_attestations_active_state_unique" ON public."content_review_owner_attestations" ("reviewed_input_identity") WHERE "lifecycle_state" = 'ACTIVE';
CREATE INDEX "content_review_owner_attestations_lookup_idx" ON public."content_review_owner_attestations" ("resource_type", "resource_id", "reviewed_input_identity", "lifecycle_state");

CREATE TABLE public."content_review_policy_evaluations" (
  "evaluation_id" text PRIMARY KEY,
  "judgment_id" text NOT NULL REFERENCES public."content_review_judgments"("judgment_id") ON DELETE RESTRICT,
  "policy_version" text NOT NULL DEFAULT 'CONTENT_REVIEWER_SEPARATION_POLICY_V1',
  "reviewed_input_identity" text NOT NULL,
  "reviewer_user_id" text NOT NULL REFERENCES public."users"("id") ON DELETE RESTRICT,
  "owner_attestation_id" text REFERENCES public."content_review_owner_attestations"("attestation_id") ON DELETE RESTRICT,
  "provenance_class" text NOT NULL,
  "risk_class" text NOT NULL,
  "required_reviewer_count" integer NOT NULL,
  "reviewer_slot" integer NOT NULL DEFAULT 1,
  "evaluation_result" text NOT NULL,
  "reason_codes_json" text NOT NULL DEFAULT '[]',
  "semantic_identity" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "audit_log_id" text NOT NULL REFERENCES public."admin_audit_logs"("id") ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "content_review_policy_evaluations_policy_check" CHECK ("policy_version" = 'CONTENT_REVIEWER_SEPARATION_POLICY_V1'),
  CONSTRAINT "content_review_policy_evaluations_provenance_check" CHECK ("provenance_class" IN ('KNOWN_AUTHOR', 'UNKNOWN_AUTHOR', 'CONFLICTING_AUTHOR')),
  CONSTRAINT "content_review_policy_evaluations_risk_check" CHECK ("risk_class" IN ('STANDARD', 'HIGH_TRUST')),
  CONSTRAINT "content_review_policy_evaluations_reviewer_count_check" CHECK ("required_reviewer_count" IN (1, 2)),
  CONSTRAINT "content_review_policy_evaluations_reviewer_slot_check" CHECK ("reviewer_slot" IN (1, 2) AND "reviewer_slot" <= "required_reviewer_count"),
  CONSTRAINT "content_review_policy_evaluations_result_check" CHECK ("evaluation_result" IN ('ALLOW', 'DENY')),
  CONSTRAINT "content_review_policy_evaluations_hash_check" CHECK ("reviewed_input_identity" ~ '^[0-9a-f]{64}$' AND "semantic_identity" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "content_review_policy_evaluations_semantic_unique" ON public."content_review_policy_evaluations" ("semantic_identity");
CREATE UNIQUE INDEX "content_review_policy_evaluations_idempotency_unique" ON public."content_review_policy_evaluations" ("idempotency_key");
CREATE UNIQUE INDEX "content_review_policy_evaluations_judgment_reviewer_unique" ON public."content_review_policy_evaluations" ("judgment_id", "reviewer_user_id");

CREATE OR REPLACE FUNCTION public.content_review_reviewer_separation_history_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Reviewer separation history is append-only';
END;
$$;
CREATE TRIGGER content_review_owner_attestations_no_update BEFORE UPDATE ON public."content_review_owner_attestations" FOR EACH ROW EXECUTE FUNCTION public.content_review_reviewer_separation_history_immutable();
CREATE TRIGGER content_review_owner_attestations_no_delete BEFORE DELETE ON public."content_review_owner_attestations" FOR EACH ROW EXECUTE FUNCTION public.content_review_reviewer_separation_history_immutable();
CREATE TRIGGER content_review_policy_evaluations_no_update BEFORE UPDATE ON public."content_review_policy_evaluations" FOR EACH ROW EXECUTE FUNCTION public.content_review_reviewer_separation_history_immutable();
CREATE TRIGGER content_review_policy_evaluations_no_delete BEFORE DELETE ON public."content_review_policy_evaluations" FOR EACH ROW EXECUTE FUNCTION public.content_review_reviewer_separation_history_immutable();

REVOKE ALL PRIVILEGES ON TABLE public."content_review_owner_attestations", public."content_review_policy_evaluations" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."content_review_owner_attestations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_review_owner_attestations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."content_review_policy_evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_review_policy_evaluations" FORCE ROW LEVEL SECURITY;
INSERT INTO app_schema_migrations (id, checksum) VALUES ('0025_content_reviewer_separation_policy', 'content-reviewer-separation-policy-v1') ON CONFLICT (id) DO NOTHING;
COMMIT;
