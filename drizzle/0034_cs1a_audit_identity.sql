CREATE TABLE `cs1a_governance_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_version` text NOT NULL,
	`human_decision_hash` text NOT NULL,
	`decision` text NOT NULL,
	`reason_code` text NOT NULL,
	`publication_authority` text NOT NULL,
	`subject_count` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "cs1a_governance_decisions_subject_count_check" CHECK("cs1a_governance_decisions"."subject_count" > 0),
	CONSTRAINT "cs1a_governance_decisions_hash_check" CHECK("cs1a_governance_decisions"."human_decision_hash" GLOB '[0-9a-f]*' AND length("cs1a_governance_decisions"."human_decision_hash") = 64 AND "cs1a_governance_decisions"."human_decision_hash" NOT GLOB '*[^0-9a-f]*')
);
CREATE UNIQUE INDEX `cs1a_governance_decisions_identity_unique` ON `cs1a_governance_decisions` (`contract_version`,`human_decision_hash`);
CREATE TABLE `cs1a_governance_decision_subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`decision_id` text NOT NULL REFERENCES `cs1a_governance_decisions`(`id`) ON DELETE restrict,
	`canonical_subject_identity` text NOT NULL REFERENCES `content_revisions`(`id`) ON DELETE restrict,
	`governance_scope` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`content_hash` text NOT NULL,
	`revision_hash` text NOT NULL,
	`policy_version` text NOT NULL,
	`decision` text NOT NULL,
	`reason_code` text NOT NULL,
	`rights_disposition` text NOT NULL,
	`currentness_disposition` text NOT NULL,
	`authoring_origin` text NOT NULL,
	`content_class` text NOT NULL,
	`source_origin` text NOT NULL,
	`publication_authority` text NOT NULL,
	`source_authority` text,
	`source_manifest_ref` text,
	`source_set_hash` text,
	`parent_revision_id` text,
	`immutable_provenance_identity` text,
	CONSTRAINT "cs1a_governance_decision_subjects_resource_type_check" CHECK("cs1a_governance_decision_subjects"."resource_type" = 'CONTENT_REVISION')
);
CREATE UNIQUE INDEX `cs1a_governance_decision_subjects_membership_unique` ON `cs1a_governance_decision_subjects` (`decision_id`,`canonical_subject_identity`);
CREATE INDEX `cs1a_governance_decision_subjects_decision_idx` ON `cs1a_governance_decision_subjects` (`decision_id`);
CREATE TABLE `cs1a_governance_decision_audits` (
	`decision_id` text PRIMARY KEY NOT NULL REFERENCES `cs1a_governance_decisions`(`id`) ON DELETE restrict,
	`audit_log_id` text NOT NULL REFERENCES `admin_audit_logs`(`id`) ON DELETE restrict,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `cs1a_governance_decision_audits_audit_unique` ON `cs1a_governance_decision_audits` (`audit_log_id`);
