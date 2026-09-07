-- Additive Generic Review CURRENTNESS domain; no backfill or review execution.
BEGIN;

ALTER TABLE public."content_review_judgments"
  DROP CONSTRAINT "content_review_judgments_domain_check";

ALTER TABLE public."content_review_judgments"
  ADD CONSTRAINT "content_review_judgments_domain_check"
  CHECK ("review_domain" IN ('TECHNICAL', 'SAFETY_SECURITY_CONTENT', 'COPYRIGHT_RIGHTS', 'SUPPORT_QUALIFICATION', 'CURRENTNESS'));

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0029_generic_review_currentness_domain', 'generic-review-currentness-domain-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
