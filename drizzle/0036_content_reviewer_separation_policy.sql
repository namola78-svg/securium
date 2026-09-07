CREATE TABLE `content_review_owner_attestations` (
  `attestation_id` text PRIMARY KEY NOT NULL,
  `contract_version` text NOT NULL DEFAULT 'CONTENT_REVIEW_JUDGMENT_V1',
  `resource_type` text NOT NULL,
  `resource_id` text NOT NULL,
  `reviewed_input_identity` text NOT NULL,
  `owner_user_id` text NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
  `attestation_type` text NOT NULL DEFAULT 'RESPONSIBLE_OWNER',
  `policy_version` text NOT NULL DEFAULT 'CONTENT_REVIEWER_SEPARATION_POLICY_V1',
  `semantic_identity` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `lifecycle_state` text NOT NULL DEFAULT 'ACTIVE',
  `supersedes_attestation_id` text,
  `audit_log_id` text NOT NULL REFERENCES `admin_audit_logs`(`id`) ON UPDATE no action ON DELETE restrict,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`supersedes_attestation_id`) REFERENCES `content_review_owner_attestations`(`attestation_id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `content_review_owner_attestations_policy_check` CHECK (`policy_version` = 'CONTENT_REVIEWER_SEPARATION_POLICY_V1'),
  CONSTRAINT `content_review_owner_attestations_lifecycle_check` CHECK (`lifecycle_state` IN ('ACTIVE', 'HISTORICAL', 'INVALIDATED', 'SUPERSEDED')),
  CONSTRAINT `content_review_owner_attestations_no_self_supersession_check` CHECK (`supersedes_attestation_id` IS NULL OR `supersedes_attestation_id` <> `attestation_id`)
);
CREATE UNIQUE INDEX `content_review_owner_attestations_semantic_unique` ON `content_review_owner_attestations` (`semantic_identity`);
CREATE UNIQUE INDEX `content_review_owner_attestations_idempotency_unique` ON `content_review_owner_attestations` (`idempotency_key`);
CREATE UNIQUE INDEX `content_review_owner_attestations_active_state_unique` ON `content_review_owner_attestations` (`reviewed_input_identity`) WHERE `lifecycle_state` = 'ACTIVE';
CREATE TABLE `content_review_policy_evaluations` (
  `evaluation_id` text PRIMARY KEY NOT NULL,
  `judgment_id` text NOT NULL REFERENCES `content_review_judgments`(`judgment_id`) ON UPDATE no action ON DELETE restrict,
  `policy_version` text NOT NULL DEFAULT 'CONTENT_REVIEWER_SEPARATION_POLICY_V1',
  `reviewed_input_identity` text NOT NULL,
  `reviewer_user_id` text NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
  `owner_attestation_id` text REFERENCES `content_review_owner_attestations`(`attestation_id`) ON UPDATE no action ON DELETE restrict,
  `provenance_class` text NOT NULL,
  `risk_class` text NOT NULL,
  `required_reviewer_count` integer NOT NULL,
  `reviewer_slot` integer NOT NULL DEFAULT 1,
  `evaluation_result` text NOT NULL,
  `reason_codes_json` text NOT NULL DEFAULT '[]',
  `semantic_identity` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `audit_log_id` text NOT NULL REFERENCES `admin_audit_logs`(`id`) ON UPDATE no action ON DELETE restrict,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `content_review_policy_evaluations_policy_check` CHECK (`policy_version` = 'CONTENT_REVIEWER_SEPARATION_POLICY_V1'),
  CONSTRAINT `content_review_policy_evaluations_reviewer_count_check` CHECK (`required_reviewer_count` IN (1, 2)),
  CONSTRAINT `content_review_policy_evaluations_reviewer_slot_check` CHECK (`reviewer_slot` IN (1, 2) AND `reviewer_slot` <= `required_reviewer_count`),
  CONSTRAINT `content_review_policy_evaluations_result_check` CHECK (`evaluation_result` IN ('ALLOW', 'DENY'))
);
CREATE UNIQUE INDEX `content_review_policy_evaluations_semantic_unique` ON `content_review_policy_evaluations` (`semantic_identity`);
CREATE UNIQUE INDEX `content_review_policy_evaluations_idempotency_unique` ON `content_review_policy_evaluations` (`idempotency_key`);
CREATE UNIQUE INDEX `content_review_policy_evaluations_judgment_reviewer_unique` ON `content_review_policy_evaluations` (`judgment_id`, `reviewer_user_id`);
CREATE TRIGGER `content_review_owner_attestations_no_update` BEFORE UPDATE ON `content_review_owner_attestations` BEGIN SELECT RAISE(ABORT, 'Reviewer separation history is append-only'); END;
CREATE TRIGGER `content_review_owner_attestations_no_delete` BEFORE DELETE ON `content_review_owner_attestations` BEGIN SELECT RAISE(ABORT, 'Reviewer separation history is append-only'); END;
CREATE TRIGGER `content_review_policy_evaluations_no_update` BEFORE UPDATE ON `content_review_policy_evaluations` BEGIN SELECT RAISE(ABORT, 'Reviewer separation history is append-only'); END;
CREATE TRIGGER `content_review_policy_evaluations_no_delete` BEFORE DELETE ON `content_review_policy_evaluations` BEGIN SELECT RAISE(ABORT, 'Reviewer separation history is append-only'); END;
