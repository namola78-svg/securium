CREATE TABLE `content_revision_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_contract_version` text NOT NULL,
	`resource_type` text NOT NULL,
	`qualification_id` text NOT NULL REFERENCES `courses`(`id`) ON DELETE restrict,
	`package_key` text NOT NULL,
	`package_semantic_identity` text NOT NULL,
	`provenance_aggregate_identity` text NOT NULL,
	`registration_semantic_identity` text NOT NULL,
	`state` text DEFAULT 'REGISTERED_REVIEW_PENDING' NOT NULL,
	`idempotency_key` text,
	`created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
	`audit_log_id` text NOT NULL REFERENCES `admin_audit_logs`(`id`) ON DELETE restrict,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "content_revision_registrations_contract_check" CHECK("content_revision_registrations"."registration_contract_version" = 'CONTENT_REVISION_REGISTRATION_V1'),
	CONSTRAINT "content_revision_registrations_state_check" CHECK("content_revision_registrations"."state" = 'REGISTERED_REVIEW_PENDING'),
	CONSTRAINT "content_revision_registrations_identity_check" CHECK(length(trim("content_revision_registrations"."package_key")) > 0 AND length(trim("content_revision_registrations"."package_semantic_identity")) > 0 AND length(trim("content_revision_registrations"."provenance_aggregate_identity")) > 0 AND length(trim("content_revision_registrations"."registration_semantic_identity")) > 0)
);
CREATE UNIQUE INDEX `content_revision_registrations_semantic_unique` ON `content_revision_registrations` (`registration_contract_version`,`registration_semantic_identity`);
CREATE UNIQUE INDEX `content_revision_registrations_idempotency_unique` ON `content_revision_registrations` (`idempotency_key`);
CREATE UNIQUE INDEX `content_revision_registrations_audit_unique` ON `content_revision_registrations` (`audit_log_id`);
CREATE INDEX `content_revision_registrations_scope_idx` ON `content_revision_registrations` (`qualification_id`,`package_key`,`created_at`);

CREATE TABLE `content_revision_registration_subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL REFERENCES `content_revision_registrations`(`id`) ON DELETE restrict,
	`content_revision_id` text NOT NULL REFERENCES `content_revisions`(`id`) ON DELETE restrict,
	`semantic_revision_id` text NOT NULL,
	`content_hash` text NOT NULL,
	`provenance_identity` text NOT NULL,
	`source_lineage` text NOT NULL,
	`rights_state` text DEFAULT 'REVIEW_REQUIRED' NOT NULL,
	`originality_state` text DEFAULT 'REVIEW_REQUIRED' NOT NULL,
	`currentness_state` text DEFAULT 'REVIEW_REQUIRED' NOT NULL,
	`responsible_owner_state` text DEFAULT 'OWNER_ATTESTATION_REQUIRED' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "content_revision_registration_subjects_hash_check" CHECK("content_revision_registration_subjects"."content_hash" GLOB '[0-9a-f]*' AND length("content_revision_registration_subjects"."content_hash") = 64 AND "content_revision_registration_subjects"."content_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "content_revision_registration_subjects_state_check" CHECK("content_revision_registration_subjects"."rights_state" = 'REVIEW_REQUIRED' AND "content_revision_registration_subjects"."originality_state" = 'REVIEW_REQUIRED' AND "content_revision_registration_subjects"."currentness_state" = 'REVIEW_REQUIRED' AND "content_revision_registration_subjects"."responsible_owner_state" = 'OWNER_ATTESTATION_REQUIRED'),
	CONSTRAINT "content_revision_registration_subjects_identity_check" CHECK(length(trim("content_revision_registration_subjects"."semantic_revision_id")) > 0 AND length(trim("content_revision_registration_subjects"."provenance_identity")) > 0 AND length(trim("content_revision_registration_subjects"."source_lineage")) > 0)
);
CREATE UNIQUE INDEX `content_revision_registration_subjects_membership_unique` ON `content_revision_registration_subjects` (`registration_id`,`content_revision_id`);
CREATE UNIQUE INDEX `content_revision_registration_subjects_semantic_unique` ON `content_revision_registration_subjects` (`registration_id`,`semantic_revision_id`);
CREATE INDEX `content_revision_registration_subjects_registration_idx` ON `content_revision_registration_subjects` (`registration_id`,`semantic_revision_id`);

CREATE TABLE `content_revision_registration_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_subject_id` text NOT NULL REFERENCES `content_revision_registration_subjects`(`id`) ON DELETE restrict,
	`source_identity_id` text NOT NULL REFERENCES `source_identities`(`id`) ON DELETE restrict,
	`binding_role` text NOT NULL,
	`locator` text NOT NULL,
	`expression_reuse` text DEFAULT 'NOT_USED' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "content_revision_registration_sources_role_check" CHECK(length(trim("content_revision_registration_sources"."binding_role")) > 0 AND "content_revision_registration_sources"."binding_role" = 'SCOPE_REFERENCE'),
	CONSTRAINT "content_revision_registration_sources_expression_check" CHECK("content_revision_registration_sources"."expression_reuse" = 'NOT_USED' AND length(trim("content_revision_registration_sources"."locator")) > 0)
);
CREATE UNIQUE INDEX `content_revision_registration_sources_identity_unique` ON `content_revision_registration_sources` (`registration_subject_id`,`source_identity_id`,`binding_role`,`locator`);
CREATE INDEX `content_revision_registration_sources_subject_idx` ON `content_revision_registration_sources` (`registration_subject_id`,`binding_role`);
CREATE INDEX `content_revision_registration_sources_source_idx` ON `content_revision_registration_sources` (`source_identity_id`,`created_at`);

CREATE TRIGGER `content_revision_registrations_no_update` BEFORE UPDATE ON `content_revision_registrations` BEGIN SELECT RAISE(ABORT, 'Content revision registration rows are append-only'); END;
CREATE TRIGGER `content_revision_registrations_no_delete` BEFORE DELETE ON `content_revision_registrations` BEGIN SELECT RAISE(ABORT, 'Content revision registration rows are append-only'); END;
CREATE TRIGGER `content_revision_registration_subjects_no_update` BEFORE UPDATE ON `content_revision_registration_subjects` BEGIN SELECT RAISE(ABORT, 'Content revision registration rows are append-only'); END;
CREATE TRIGGER `content_revision_registration_subjects_no_delete` BEFORE DELETE ON `content_revision_registration_subjects` BEGIN SELECT RAISE(ABORT, 'Content revision registration rows are append-only'); END;
CREATE TRIGGER `content_revision_registration_sources_no_update` BEFORE UPDATE ON `content_revision_registration_sources` BEGIN SELECT RAISE(ABORT, 'Content revision registration rows are append-only'); END;
CREATE TRIGGER `content_revision_registration_sources_no_delete` BEFORE DELETE ON `content_revision_registration_sources` BEGIN SELECT RAISE(ABORT, 'Content revision registration rows are append-only'); END;
