-- Additive enforcement repair; no backfill or review execution.
BEGIN;
DROP INDEX IF EXISTS public."content_review_judgments_semantic_unique";
CREATE UNIQUE INDEX "content_review_judgments_semantic_reviewer_unique" ON public."content_review_judgments" ("semantic_review_identity", "reviewer_user_id");
ALTER TABLE public."content_review_policy_evaluations"
  ADD COLUMN "resource_type" text NOT NULL DEFAULT 'CONTENT_REVISION',
  ADD COLUMN "resource_id" text NOT NULL DEFAULT 'SERVER_RESOLVED',
  ADD COLUMN "judgment_semantic_identity" text NOT NULL DEFAULT '',
  ADD COLUMN "author_user_id" text REFERENCES public."users"("id") ON DELETE RESTRICT,
  ADD COLUMN "owner_user_id" text REFERENCES public."users"("id") ON DELETE RESTRICT,
  ADD COLUMN "material_editor_user_ids_json" text NOT NULL DEFAULT '[]',
  ADD COLUMN "material_editor_provenance" text NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE public."content_review_policy_evaluations"
  ADD CONSTRAINT "content_review_policy_evaluations_editor_provenance_check" CHECK ("material_editor_provenance" IN ('KNOWN', 'UNKNOWN'));
CREATE UNIQUE INDEX "content_review_policy_evaluations_judgment_slot_unique" ON public."content_review_policy_evaluations" ("judgment_id", "reviewer_slot");
INSERT INTO app_schema_migrations (id, checksum) VALUES ('0026_content_reviewer_separation_enforcement', 'content-reviewer-separation-enforcement-v1') ON CONFLICT (id) DO NOTHING;
COMMIT;
