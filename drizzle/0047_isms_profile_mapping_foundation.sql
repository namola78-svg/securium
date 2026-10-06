CREATE TABLE `isms_profile_requirement_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`standard_id` text NOT NULL,
	`profile_requirement_code` text,
	`applicability_state` text NOT NULL,
	`mapping_state` text NOT NULL,
	`effective_from` text,
	`effective_to` text,
	`rationale` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`authority_assertion_id` text,
	`supersedes_mapping_id` text,
	`created_by` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `isms_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`standard_id`) REFERENCES `isms_standards`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`authority_assertion_id`) REFERENCES `temporal_assertions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`supersedes_mapping_id`) REFERENCES `isms_profile_requirement_mappings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "isms_profile_mappings_applicability_check" CHECK("isms_profile_requirement_mappings"."applicability_state" IN ('APPLIES', 'NOT_APPLICABLE', 'VARIANT', 'UNRESOLVED')),
	CONSTRAINT "isms_profile_mappings_state_check" CHECK("isms_profile_requirement_mappings"."mapping_state" IN ('CURRENT', 'PENDING', 'SUPERSEDED')),
	CONSTRAINT "isms_profile_mappings_interval_check" CHECK("isms_profile_requirement_mappings"."effective_to" IS NULL OR ("isms_profile_requirement_mappings"."effective_from" IS NOT NULL AND "isms_profile_requirement_mappings"."effective_to" > "isms_profile_requirement_mappings"."effective_from")),
	CONSTRAINT "isms_profile_mappings_version_check" CHECK("isms_profile_requirement_mappings"."version" > 0),
	CONSTRAINT "isms_profile_mappings_current_has_authority_check" CHECK("isms_profile_requirement_mappings"."mapping_state" != 'CURRENT' OR "isms_profile_requirement_mappings"."authority_assertion_id" IS NOT NULL),
	CONSTRAINT "isms_profile_mappings_current_is_resolved_check" CHECK("isms_profile_requirement_mappings"."mapping_state" != 'CURRENT' OR "isms_profile_requirement_mappings"."applicability_state" != 'UNRESOLVED'),
	CONSTRAINT "isms_profile_mappings_variant_has_profile_code_check" CHECK("isms_profile_requirement_mappings"."applicability_state" != 'VARIANT' OR "isms_profile_requirement_mappings"."profile_requirement_code" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `isms_profile_requirement_mappings_profile_idx` ON `isms_profile_requirement_mappings` (`profile_id`,`mapping_state`,`effective_from`,`effective_to`);--> statement-breakpoint
CREATE INDEX `isms_profile_requirement_mappings_standard_idx` ON `isms_profile_requirement_mappings` (`standard_id`,`profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `isms_profile_mappings_active_identity_unique` ON `isms_profile_requirement_mappings` (`profile_id`,`standard_id`,`profile_requirement_code`) WHERE "isms_profile_requirement_mappings"."mapping_state" IN ('CURRENT', 'PENDING');--> statement-breakpoint
CREATE UNIQUE INDEX `isms_profile_mappings_active_null_code_unique` ON `isms_profile_requirement_mappings` (`profile_id`,`standard_id`) WHERE "isms_profile_requirement_mappings"."profile_requirement_code" IS NULL AND "isms_profile_requirement_mappings"."mapping_state" IN ('CURRENT', 'PENDING');--> statement-breakpoint
CREATE TABLE `isms_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_key` text NOT NULL,
	`profile_type` text NOT NULL,
	`official_identifier` text,
	`canonical_label` text NOT NULL,
	`criteria_state` text NOT NULL,
	`lifecycle_state` text DEFAULT 'CURRENT' NOT NULL,
	`effective_from` text,
	`effective_to` text,
	`criteria_assertion_id` text,
	`eligibility_assertion_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`supersedes_profile_id` text,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`criteria_assertion_id`) REFERENCES `temporal_assertions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`eligibility_assertion_id`) REFERENCES `temporal_assertions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`supersedes_profile_id`) REFERENCES `isms_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "isms_profiles_type_check" CHECK("isms_profiles"."profile_type" IN ('GENERAL', 'SIMPLIFIED', 'STRENGTHENED', 'OTHER')),
	CONSTRAINT "isms_profiles_criteria_state_check" CHECK("isms_profiles"."criteria_state" IN ('CURRENT_EFFECTIVE', 'PENDING_OFFICIAL_CRITERIA', 'SUPERSEDED', 'NOT_APPLICABLE', 'UNRESOLVED')),
	CONSTRAINT "isms_profiles_lifecycle_check" CHECK("isms_profiles"."lifecycle_state" IN ('CURRENT', 'SUPERSEDED', 'INACTIVE')),
	CONSTRAINT "isms_profiles_interval_check" CHECK("isms_profiles"."effective_to" IS NULL OR ("isms_profiles"."effective_from" IS NOT NULL AND "isms_profiles"."effective_to" > "isms_profiles"."effective_from")),
	CONSTRAINT "isms_profiles_version_check" CHECK("isms_profiles"."version" > 0),
	CONSTRAINT "isms_profiles_pending_has_no_criteria_authority_check" CHECK("isms_profiles"."criteria_state" != 'PENDING_OFFICIAL_CRITERIA' OR "isms_profiles"."criteria_assertion_id" IS NULL)
	,CONSTRAINT "isms_profiles_current_has_criteria_authority_check" CHECK("isms_profiles"."criteria_state" != 'CURRENT_EFFECTIVE' OR "isms_profiles"."criteria_assertion_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `isms_profiles_key_unique` ON `isms_profiles` (`profile_key`);--> statement-breakpoint
CREATE INDEX `isms_profiles_state_idx` ON `isms_profiles` (`lifecycle_state`,`criteria_state`,`effective_from`,`effective_to`);
--> statement-breakpoint
CREATE TRIGGER "isms_profiles_no_delete" BEFORE DELETE ON "isms_profiles" BEGIN SELECT RAISE(ABORT, 'ISMS_PROFILE_HISTORY_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER "isms_profile_mappings_no_delete" BEFORE DELETE ON "isms_profile_requirement_mappings" BEGIN SELECT RAISE(ABORT, 'ISMS_PROFILE_MAPPING_HISTORY_IMMUTABLE'); END;
