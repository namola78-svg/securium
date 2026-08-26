CREATE TABLE `cs1a_governance_receipts` (
	`receipt_id` text PRIMARY KEY NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`resource_revision_id` text NOT NULL,
	`parent_revision_id` text,
	`revision_hash` text NOT NULL,
	`source_set_hash` text NOT NULL,
	`policy_version` text NOT NULL,
	`rights_disposition` text NOT NULL,
	`currentness_disposition` text NOT NULL,
	`content_class` text NOT NULL,
	`authoring_origin` text NOT NULL,
	`source_origin` text NOT NULL,
	`publication_authority` text NOT NULL,
	`decision` text NOT NULL,
	`reason_code` text NOT NULL,
	`human_decision_hash` text NOT NULL,
	`human_decision_ref` text NOT NULL,
	`human_decision_at` text NOT NULL,
	`semantic_decision_hash` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`supersedes_receipt_id` text,
	`source_manifest_ref` text,
	`source_authority` text,
	`actor_audit_log_id` text NOT NULL,
	`git_sha` text,
	`execution_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`supersedes_receipt_id`) REFERENCES `cs1a_governance_receipts`(`receipt_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "cs1a_governance_receipts_resource_type_check" CHECK("cs1a_governance_receipts"."resource_type" IN ('CONTENT', 'CONTENT_REVISION', 'QUESTION', 'QUESTION_VERSION', 'LESSON', 'LEARNING_UNIT', 'COURSE_LESSON', 'CURRICULUM_TREE', 'CURRICULUM_NODE', 'COURSE_GROUP', 'COURSE', 'SUBJECT', 'TOPIC')),
	CONSTRAINT "cs1a_governance_receipts_content_class_check" CHECK("cs1a_governance_receipts"."content_class" IN ('PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED', 'AUTHORIZED_EXTERNAL_SOURCE', 'REVIEW_REQUIRED_EXTERNAL_SOURCE', 'LEGACY_REVIEW_REQUIRED', 'MUST_EXCLUDE', 'UNKNOWN')),
	CONSTRAINT "cs1a_governance_receipts_decision_check" CHECK("cs1a_governance_receipts"."decision" IN ('ALLOW_DRAFT', 'ALLOW_CANONICAL', 'ALLOW_PUBLICATION', 'DENY', 'DEFER_RIGHTS', 'DEFER_CURRENTNESS')),
	CONSTRAINT "cs1a_governance_receipts_reason_code_check" CHECK("cs1a_governance_receipts"."reason_code" IN ('AUTHORIZED_PROSPECTIVE_ORIGINAL', 'AUTHORIZED_EXTERNAL_SOURCE', 'REVIEW_REQUIRED', 'LEGACY_REVIEW_REQUIRED', 'MUST_EXCLUDE', 'UNKNOWN_CONTENT_CLASS', 'MISSING_PROVENANCE', 'UNSUPPORTED_POLICY_VERSION', 'INVALID_RESOURCE_IDENTITY', 'AMBIGUOUS_EFFECTIVE_STATE', 'PUBLICATION_AUTHORITY_REQUIRED', 'POLICY_DENY')),
	CONSTRAINT "cs1a_governance_receipts_rights_check" CHECK("cs1a_governance_receipts"."rights_disposition" IN ('ORIGINAL_INTERNAL', 'REVIEWED_EXTERNAL_AUTHORIZED', 'REVIEW_REQUIRED', 'LEGACY_UNRESOLVED', 'EXCLUDED', 'UNKNOWN')),
	CONSTRAINT "cs1a_governance_receipts_currentness_check" CHECK("cs1a_governance_receipts"."currentness_disposition" IN ('CURRENT', 'CURRENT_WITH_VERSION_UNCERTAINTY', 'HISTORICAL', 'SUPERSEDED', 'FUTURE_EFFECTIVE', 'UNKNOWN', 'REVIEW_REQUIRED')),
	CONSTRAINT "cs1a_governance_receipts_publication_authority_check" CHECK("cs1a_governance_receipts"."publication_authority" IN ('NOT_GRANTED', 'GRANTED_BY_SEPARATE_AUTHORITY', 'NOT_APPLICABLE')),
	CONSTRAINT "cs1a_governance_receipts_authoring_origin_check" CHECK("cs1a_governance_receipts"."authoring_origin" IN ('SECURIUM_ADMIN_CMS', 'SECURIUM_GIT_PACKAGE', 'EXTERNAL_SOURCE', 'LEGACY', 'UNKNOWN')),
	CONSTRAINT "cs1a_governance_receipts_source_origin_check" CHECK("cs1a_governance_receipts"."source_origin" IN ('NONE_NOT_APPLICABLE', 'KNOWN_SOURCE_PACKAGE', 'KNOWN_EXTERNAL_SOURCE', 'LEGACY_UNKNOWN', 'UNKNOWN')),
	CONSTRAINT "cs1a_governance_receipts_policy_check" CHECK("cs1a_governance_receipts"."policy_version" = 'CS1A_POLICY_V1'),
	CONSTRAINT "cs1a_governance_receipts_hash_check" CHECK("cs1a_governance_receipts"."revision_hash" GLOB '[0-9a-f]*' AND length("cs1a_governance_receipts"."revision_hash") = 64 AND "cs1a_governance_receipts"."revision_hash" NOT GLOB '*[^0-9a-f]*' AND "cs1a_governance_receipts"."source_set_hash" GLOB '[0-9a-f]*' AND length("cs1a_governance_receipts"."source_set_hash") = 64 AND "cs1a_governance_receipts"."source_set_hash" NOT GLOB '*[^0-9a-f]*' AND "cs1a_governance_receipts"."human_decision_hash" GLOB '[0-9a-f]*' AND length("cs1a_governance_receipts"."human_decision_hash") = 64 AND "cs1a_governance_receipts"."human_decision_hash" NOT GLOB '*[^0-9a-f]*' AND "cs1a_governance_receipts"."semantic_decision_hash" GLOB '[0-9a-f]*' AND length("cs1a_governance_receipts"."semantic_decision_hash") = 64 AND "cs1a_governance_receipts"."semantic_decision_hash" NOT GLOB '*[^0-9a-f]*' AND "cs1a_governance_receipts"."idempotency_key" GLOB '[0-9a-f]*' AND length("cs1a_governance_receipts"."idempotency_key") = 64 AND "cs1a_governance_receipts"."idempotency_key" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "cs1a_governance_receipts_source_binding_check" CHECK(("cs1a_governance_receipts"."source_origin" = 'NONE_NOT_APPLICABLE' AND "cs1a_governance_receipts"."source_authority" IS NULL AND "cs1a_governance_receipts"."source_manifest_ref" IS NULL) OR ("cs1a_governance_receipts"."source_origin" <> 'NONE_NOT_APPLICABLE' AND length(trim("cs1a_governance_receipts"."source_authority")) > 0)),
	CONSTRAINT "cs1a_governance_receipts_publication_separation_check" CHECK(("cs1a_governance_receipts"."decision" = 'ALLOW_PUBLICATION' AND "cs1a_governance_receipts"."publication_authority" = 'GRANTED_BY_SEPARATE_AUTHORITY' AND "cs1a_governance_receipts"."supersedes_receipt_id" IS NOT NULL) OR ("cs1a_governance_receipts"."decision" <> 'ALLOW_PUBLICATION' AND "cs1a_governance_receipts"."publication_authority" <> 'GRANTED_BY_SEPARATE_AUTHORITY')),
	CONSTRAINT "cs1a_governance_receipts_no_self_supersession_check" CHECK("cs1a_governance_receipts"."supersedes_receipt_id" IS NULL OR "cs1a_governance_receipts"."supersedes_receipt_id" <> "cs1a_governance_receipts"."receipt_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cs1a_governance_receipts_idempotency_unique` ON `cs1a_governance_receipts` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `cs1a_governance_receipts_semantic_hash_unique` ON `cs1a_governance_receipts` (`semantic_decision_hash`);--> statement-breakpoint
CREATE INDEX `cs1a_governance_receipts_resource_idx` ON `cs1a_governance_receipts` (`resource_type`,`resource_id`,`resource_revision_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `cs1a_governance_receipts_supersession_idx` ON `cs1a_governance_receipts` (`supersedes_receipt_id`);
--> statement-breakpoint
CREATE TRIGGER `cs1a_governance_receipts_same_resource_supersession` BEFORE INSERT ON `cs1a_governance_receipts`
WHEN NEW.supersedes_receipt_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `cs1a_governance_receipts` prior
  WHERE prior.receipt_id = NEW.supersedes_receipt_id
    AND prior.resource_type = NEW.resource_type
    AND prior.resource_id = NEW.resource_id
)
BEGIN
  SELECT RAISE(ABORT, 'CS1A supersession must remain within one governed resource');
END;
--> statement-breakpoint
CREATE TRIGGER `cs1a_governance_receipts_no_update` BEFORE UPDATE ON `cs1a_governance_receipts`
BEGIN SELECT RAISE(ABORT, 'CS1A governance receipts are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `cs1a_governance_receipts_no_delete` BEFORE DELETE ON `cs1a_governance_receipts`
BEGIN SELECT RAISE(ABORT, 'CS1A governance receipts are append-only'); END;
