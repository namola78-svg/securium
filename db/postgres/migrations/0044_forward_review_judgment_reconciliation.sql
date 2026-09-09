-- Forward reconciliation: current generic review judgment authority.
-- CURRENTNESS is added by the separately ordered 0047 reconciliation.
BEGIN;

CREATE TABLE public."content_review_judgments" (
  "judgment_id" text PRIMARY KEY,
  "contract_version" text NOT NULL,
  "review_domain" text NOT NULL,
  "reviewed_input_identity" text NOT NULL,
  "reviewed_input_snapshot_json" text NOT NULL,
  "semantic_review_identity" text NOT NULL,
  "result" text NOT NULL,
  "lifecycle_state" text NOT NULL DEFAULT 'ACTIVE',
  "reviewer_user_id" text NOT NULL REFERENCES public."users"("id") ON DELETE RESTRICT,
  "audit_log_id" text NOT NULL REFERENCES public."admin_audit_logs"("id") ON DELETE RESTRICT,
  "idempotency_key" text NOT NULL,
  "supersedes_judgment_id" text REFERENCES public."content_review_judgments"("judgment_id") ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "conflict_slot_identity" text NOT NULL,
  CONSTRAINT "content_review_judgments_contract_check" CHECK ("contract_version" = 'CONTENT_REVIEW_JUDGMENT_V1'),
  CONSTRAINT "content_review_judgments_domain_check" CHECK ("review_domain" IN ('TECHNICAL', 'SAFETY_SECURITY_CONTENT', 'COPYRIGHT_RIGHTS', 'SUPPORT_QUALIFICATION')),
  CONSTRAINT "content_review_judgments_result_check" CHECK ("result" IN ('REVIEW_PERFORMED_PASS', 'REVIEW_PERFORMED_FAIL', 'REQUIRES_REVISION')),
  CONSTRAINT "content_review_judgments_lifecycle_check" CHECK ("lifecycle_state" IN ('ACTIVE', 'HISTORICAL', 'INVALIDATED', 'SUPERSEDED')),
  CONSTRAINT "content_review_judgments_hash_check" CHECK ("reviewed_input_identity" ~ '^[0-9a-f]{64}$' AND "semantic_review_identity" ~ '^[0-9a-f]{64}$' AND "idempotency_key" ~ '^[A-Za-z0-9._:-]{1,100}$'),
  CONSTRAINT "content_review_judgments_conflict_slot_hash_check" CHECK ("conflict_slot_identity" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "content_review_judgments_no_self_supersession_check" CHECK ("supersedes_judgment_id" IS NULL OR "supersedes_judgment_id" <> "judgment_id")
);

CREATE UNIQUE INDEX "content_review_judgments_idempotency_unique"
  ON public."content_review_judgments" ("idempotency_key");
CREATE INDEX "content_review_judgments_input_domain_idx"
  ON public."content_review_judgments" ("reviewed_input_identity", "review_domain", "lifecycle_state");
CREATE INDEX "content_review_judgments_supersession_idx"
  ON public."content_review_judgments" ("supersedes_judgment_id");
CREATE UNIQUE INDEX "content_review_judgments_single_successor_unique"
  ON public."content_review_judgments" ("supersedes_judgment_id")
  WHERE "supersedes_judgment_id" IS NOT NULL;
CREATE INDEX "content_review_judgments_conflict_slot_idx"
  ON public."content_review_judgments" ("conflict_slot_identity", "lifecycle_state");

CREATE FUNCTION public.content_review_judgment_active_slot_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  prior public."content_review_judgments"%ROWTYPE;
BEGIN
  IF NEW.lifecycle_state <> 'ACTIVE' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.conflict_slot_identity, 0));
  SELECT *
    INTO prior
    FROM public."content_review_judgments"
   WHERE conflict_slot_identity = NEW.conflict_slot_identity
     AND lifecycle_state = 'ACTIVE'
     AND judgment_id <> COALESCE(NEW.supersedes_judgment_id, '')
   ORDER BY judgment_id
   LIMIT 1;
  IF prior.judgment_id IS NOT NULL
     AND prior.semantic_review_identity <> NEW.semantic_review_identity THEN
    RAISE EXCEPTION 'Conflicting active content review judgment occupies this slot'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER content_review_judgments_active_slot_guard
BEFORE INSERT ON public."content_review_judgments"
FOR EACH ROW EXECUTE FUNCTION public.content_review_judgment_active_slot_guard();

CREATE TABLE public."content_review_judgment_subjects" (
  "judgment_id" text NOT NULL REFERENCES public."content_review_judgments"("judgment_id") ON DELETE RESTRICT,
  "subject_identity" text NOT NULL,
  "resource_revision_id" text NOT NULL,
  "content_semantic_hash" text NOT NULL,
  "semantic_ordinal" integer NOT NULL,
  PRIMARY KEY ("judgment_id", "subject_identity"),
  CONSTRAINT "content_review_judgment_subjects_ordinal_check" CHECK ("semantic_ordinal" >= 0),
  CONSTRAINT "content_review_judgment_subjects_hash_check" CHECK ("content_semantic_hash" ~ '^[0-9a-f]{64}$'),
  UNIQUE ("judgment_id", "semantic_ordinal")
);

CREATE INDEX "content_review_judgment_subjects_lookup_idx"
  ON public."content_review_judgment_subjects" ("subject_identity", "semantic_ordinal");

CREATE TABLE public."content_review_findings" (
  "finding_id" text PRIMARY KEY,
  "judgment_id" text NOT NULL REFERENCES public."content_review_judgments"("judgment_id") ON DELETE RESTRICT,
  "finding_semantic_identity" text NOT NULL,
  "subject_identity" text,
  "category" text NOT NULL,
  "severity" text NOT NULL,
  "disposition" text NOT NULL,
  "material_facts_json" text NOT NULL,
  CONSTRAINT "content_review_findings_hash_check" CHECK ("finding_semantic_identity" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "content_review_findings_severity_check" CHECK ("severity" IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
  CONSTRAINT "content_review_findings_disposition_check" CHECK ("disposition" IN ('OPEN', 'REMEDIATED', 'ACCEPTED', 'NOT_APPLICABLE')),
  UNIQUE ("judgment_id", "finding_semantic_identity")
);

CREATE FUNCTION public.content_review_judgment_history_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Content review judgment history is append-only';
END;
$$;

CREATE TRIGGER content_review_judgments_no_update
BEFORE UPDATE ON public."content_review_judgments"
FOR EACH ROW EXECUTE FUNCTION public.content_review_judgment_history_immutable();
CREATE TRIGGER content_review_judgments_no_delete
BEFORE DELETE ON public."content_review_judgments"
FOR EACH ROW EXECUTE FUNCTION public.content_review_judgment_history_immutable();
CREATE TRIGGER content_review_judgment_subjects_no_update
BEFORE UPDATE ON public."content_review_judgment_subjects"
FOR EACH ROW EXECUTE FUNCTION public.content_review_judgment_history_immutable();
CREATE TRIGGER content_review_judgment_subjects_no_delete
BEFORE DELETE ON public."content_review_judgment_subjects"
FOR EACH ROW EXECUTE FUNCTION public.content_review_judgment_history_immutable();
CREATE TRIGGER content_review_findings_no_update
BEFORE UPDATE ON public."content_review_findings"
FOR EACH ROW EXECUTE FUNCTION public.content_review_judgment_history_immutable();
CREATE TRIGGER content_review_findings_no_delete
BEFORE DELETE ON public."content_review_findings"
FOR EACH ROW EXECUTE FUNCTION public.content_review_judgment_history_immutable();

ALTER TABLE public."content_review_judgments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_review_judgments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."content_review_judgment_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_review_judgment_subjects" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."content_review_findings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_review_findings" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0044_forward_review_judgment_reconciliation', 'forward-review-judgment-reconciliation-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
