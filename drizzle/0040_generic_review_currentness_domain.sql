PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE `content_review_judgments__currentness` (
  `judgment_id` text PRIMARY KEY NOT NULL,
  `contract_version` text NOT NULL,
  `review_domain` text NOT NULL,
  `reviewed_input_identity` text NOT NULL,
  `reviewed_input_snapshot_json` text NOT NULL,
  `semantic_review_identity` text NOT NULL,
  `result` text NOT NULL,
  `lifecycle_state` text NOT NULL DEFAULT 'ACTIVE',
  `reviewer_user_id` text NOT NULL,
  `audit_log_id` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `supersedes_judgment_id` text,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`audit_log_id`) REFERENCES `admin_audit_logs`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`supersedes_judgment_id`) REFERENCES `content_review_judgments__currentness`(`judgment_id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `content_review_judgments_contract_check` CHECK (`contract_version` = 'CONTENT_REVIEW_JUDGMENT_V1'),
  CONSTRAINT `content_review_judgments_domain_check` CHECK (`review_domain` IN ('TECHNICAL', 'SAFETY_SECURITY_CONTENT', 'COPYRIGHT_RIGHTS', 'SUPPORT_QUALIFICATION', 'CURRENTNESS')),
  CONSTRAINT `content_review_judgments_result_check` CHECK (`result` IN ('REVIEW_PERFORMED_PASS', 'REVIEW_PERFORMED_FAIL', 'REQUIRES_REVISION')),
  CONSTRAINT `content_review_judgments_lifecycle_check` CHECK (`lifecycle_state` IN ('ACTIVE', 'HISTORICAL', 'INVALIDATED', 'SUPERSEDED')),
  CONSTRAINT `content_review_judgments_hash_check` CHECK (`reviewed_input_identity` GLOB '[0-9a-f]*' AND length(`reviewed_input_identity`) = 64 AND `reviewed_input_identity` NOT GLOB '*[^0-9a-f]*' AND `semantic_review_identity` GLOB '[0-9a-f]*' AND length(`semantic_review_identity`) = 64 AND `semantic_review_identity` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `content_review_judgments_no_self_supersession_check` CHECK (`supersedes_judgment_id` IS NULL OR `supersedes_judgment_id` <> `judgment_id`)
);

INSERT INTO `content_review_judgments__currentness` (
  `judgment_id`, `contract_version`, `review_domain`, `reviewed_input_identity`,
  `reviewed_input_snapshot_json`, `semantic_review_identity`, `result`,
  `lifecycle_state`, `reviewer_user_id`, `audit_log_id`, `idempotency_key`,
  `supersedes_judgment_id`, `created_at`
)
SELECT
  `judgment_id`, `contract_version`, `review_domain`, `reviewed_input_identity`,
  `reviewed_input_snapshot_json`, `semantic_review_identity`, `result`,
  `lifecycle_state`, `reviewer_user_id`, `audit_log_id`, `idempotency_key`,
  `supersedes_judgment_id`, `created_at`
FROM `content_review_judgments`;

DROP TABLE `content_review_judgments`;
ALTER TABLE `content_review_judgments__currentness` RENAME TO `content_review_judgments`;

CREATE UNIQUE INDEX `content_review_judgments_idempotency_unique` ON `content_review_judgments` (`idempotency_key`);
CREATE INDEX `content_review_judgments_input_domain_idx` ON `content_review_judgments` (`reviewed_input_identity`, `review_domain`, `lifecycle_state`);
CREATE INDEX `content_review_judgments_supersession_idx` ON `content_review_judgments` (`supersedes_judgment_id`);
CREATE UNIQUE INDEX `content_review_judgments_single_successor_unique` ON `content_review_judgments` (`supersedes_judgment_id`) WHERE `supersedes_judgment_id` IS NOT NULL;
CREATE UNIQUE INDEX `content_review_judgments_semantic_reviewer_unique` ON `content_review_judgments` (`semantic_review_identity`, `reviewer_user_id`);

CREATE TRIGGER `content_review_judgments_no_update` BEFORE UPDATE ON `content_review_judgments`
BEGIN SELECT RAISE(ABORT, 'Content review judgment history is append-only'); END;
CREATE TRIGGER `content_review_judgments_no_delete` BEFORE DELETE ON `content_review_judgments`
BEGIN SELECT RAISE(ABORT, 'Content review judgment history is append-only'); END;

COMMIT;
PRAGMA foreign_keys=ON;
