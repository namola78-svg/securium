-- Forward reconciliation: current review CURRENTNESS domain.
-- No historical review rows or currentness history are fabricated.
BEGIN;

ALTER TABLE public."content_review_judgments"
  DROP CONSTRAINT "content_review_judgments_domain_check";

ALTER TABLE public."content_review_judgments"
  ADD CONSTRAINT "content_review_judgments_domain_check"
  CHECK ("review_domain" IN ('TECHNICAL', 'SAFETY_SECURITY_CONTENT', 'COPYRIGHT_RIGHTS', 'SUPPORT_QUALIFICATION', 'CURRENTNESS'));

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0047_forward_review_currentness_reconciliation', 'forward-review-currentness-reconciliation-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
