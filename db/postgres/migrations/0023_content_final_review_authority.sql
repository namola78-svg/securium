-- Additive Phase C authority repository; no backfill or authority execution.
BEGIN;

CREATE TABLE public."content_final_review_authorities" (
  "authority_id" text PRIMARY KEY,
  "contract_version" text NOT NULL,
  "decision_type" text NOT NULL,
  "semantic_decision_hash" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "candidate_identity" text NOT NULL,
  "resource_type" text NOT NULL,
  "scope" text NOT NULL,
  "decision_outcome" text NOT NULL,
  "authority_state" text NOT NULL DEFAULT 'ACTIVE',
  "publication_authority" text NOT NULL,
  "actor_user_id" text NOT NULL REFERENCES public."users"("id") ON DELETE RESTRICT,
  "actor_role" text NOT NULL,
  "audit_log_id" text NOT NULL REFERENCES public."admin_audit_logs"("id") ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "content_final_review_authority_contract_check" CHECK ("contract_version" = 'CONTENT_FINAL_REVIEW_AUTHORITY_V1' AND "decision_type" = 'CONTENT_FINAL_REVIEW_DECISION'),
  CONSTRAINT "content_final_review_authority_hash_check" CHECK ("semantic_decision_hash" ~ '^[0-9a-f]{64}$' AND "candidate_identity" ~ '^[0-9a-f]{64}$' AND "idempotency_key" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "content_final_review_authority_outcome_check" CHECK ("decision_outcome" IN ('APPROVED', 'REJECTED')),
  CONSTRAINT "content_final_review_authority_state_check" CHECK ("authority_state" IN ('ACTIVE', 'HISTORICAL', 'INVALIDATED')),
  CONSTRAINT "content_final_review_authority_publication_check" CHECK ("publication_authority" = 'NOT_GRANTED')
);

CREATE UNIQUE INDEX "content_final_review_authority_semantic_unique" ON public."content_final_review_authorities" ("semantic_decision_hash");
CREATE UNIQUE INDEX "content_final_review_authority_idempotency_unique" ON public."content_final_review_authorities" ("idempotency_key");
CREATE INDEX "content_final_review_authority_lookup_idx" ON public."content_final_review_authorities" ("candidate_identity", "resource_type", "scope", "authority_state");

CREATE TABLE public."content_final_review_authority_subjects" (
  "authority_id" text NOT NULL REFERENCES public."content_final_review_authorities"("authority_id") ON DELETE RESTRICT,
  "subject_identity" text NOT NULL,
  "semantic_ordinal" integer NOT NULL,
  PRIMARY KEY ("authority_id", "semantic_ordinal"),
  CONSTRAINT "content_final_review_authority_subject_ordinal_check" CHECK ("semantic_ordinal" >= 0),
  CONSTRAINT "content_final_review_authority_subject_identity_check" CHECK (length(trim("subject_identity")) > 0),
  UNIQUE ("authority_id", "subject_identity")
);

CREATE INDEX "content_final_review_authority_subject_lookup_idx" ON public."content_final_review_authority_subjects" ("subject_identity", "semantic_ordinal");

REVOKE ALL PRIVILEGES ON TABLE public."content_final_review_authorities", public."content_final_review_authority_subjects" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."content_final_review_authorities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_final_review_authorities" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."content_final_review_authority_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_final_review_authority_subjects" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0023_content_final_review_authority', 'content-final-review-authority-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
