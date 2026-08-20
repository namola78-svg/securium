CREATE TABLE `assertion_source_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`temporal_assertion_id` text NOT NULL,
	`source_identity_id` text NOT NULL,
	`source_role` text NOT NULL,
	`source_version` text DEFAULT '' NOT NULL,
	`source_hash` text DEFAULT '' NOT NULL,
	`locator` text NOT NULL,
	`verification_metadata_json` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`temporal_assertion_id`) REFERENCES `temporal_assertions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_identity_id`) REFERENCES `source_identities`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "assertion_source_bindings_role_check" CHECK("assertion_source_bindings"."source_role" IN ('PRIMARY_AUTHORITY', 'SUPPORTING_AUTHORITY', 'CONTEXT_SOURCE')),
	CONSTRAINT "assertion_source_bindings_hash_check" CHECK("assertion_source_bindings"."source_hash" = '' OR (length("assertion_source_bindings"."source_hash") = 64 AND "assertion_source_bindings"."source_hash" NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "assertion_source_bindings_metadata_length_check" CHECK(length("assertion_source_bindings"."verification_metadata_json") <= 100000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assertion_source_bindings_identity_unique` ON `assertion_source_bindings` (`temporal_assertion_id`,`source_identity_id`,`source_role`,`locator`);--> statement-breakpoint
CREATE UNIQUE INDEX `assertion_source_bindings_primary_unique` ON `assertion_source_bindings` (`temporal_assertion_id`) WHERE "assertion_source_bindings"."source_role" = 'PRIMARY_AUTHORITY';--> statement-breakpoint
CREATE INDEX `assertion_source_bindings_assertion_role_idx` ON `assertion_source_bindings` (`temporal_assertion_id`,`source_role`,`created_at`);--> statement-breakpoint
CREATE INDEX `assertion_source_bindings_source_idx` ON `assertion_source_bindings` (`source_identity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `fact_concept_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`fact_identity_id` text NOT NULL,
	`concept_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`fact_identity_id`) REFERENCES `fact_identities`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`concept_id`) REFERENCES `ontology_concepts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fact_concept_bindings_identity_unique` ON `fact_concept_bindings` (`fact_identity_id`,`concept_id`);--> statement-breakpoint
CREATE INDEX `fact_concept_bindings_concept_idx` ON `fact_concept_bindings` (`concept_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `fact_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_key` text NOT NULL,
	`domain` text NOT NULL,
	`canonical_label` text NOT NULL,
	`normalized_semantic_identity` text NOT NULL,
	`scope_discriminator` text NOT NULL,
	`lifecycle_state` text DEFAULT 'DRAFT' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`retired_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fact_identities_scope_check" CHECK(length(trim("fact_identities"."scope_discriminator")) > 0 AND length("fact_identities"."scope_discriminator") <= 300),
	CONSTRAINT "fact_identities_lifecycle_check" CHECK("fact_identities"."lifecycle_state" IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
	CONSTRAINT "fact_identities_semantic_identity_check" CHECK(length(trim("fact_identities"."normalized_semantic_identity")) > 0 AND length("fact_identities"."normalized_semantic_identity") <= 300)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fact_identities_canonical_key_unique` ON `fact_identities` (`canonical_key`);--> statement-breakpoint
CREATE INDEX `fact_identities_domain_lifecycle_idx` ON `fact_identities` (`domain`,`lifecycle_state`,`created_at`);--> statement-breakpoint
CREATE TABLE `fact_track_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`fact_identity_id` text NOT NULL,
	`track_key` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`fact_identity_id`) REFERENCES `fact_identities`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fact_track_bindings_track_check" CHECK(length(trim("fact_track_bindings"."track_key")) > 0 AND length("fact_track_bindings"."track_key") <= 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fact_track_bindings_identity_unique` ON `fact_track_bindings` (`fact_identity_id`,`track_key`);--> statement-breakpoint
CREATE INDEX `fact_track_bindings_track_idx` ON `fact_track_bindings` (`track_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `source_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_key` text NOT NULL,
	`source_type` text NOT NULL,
	`canonical_label` text NOT NULL,
	`normalized_identity` text NOT NULL,
	`publisher` text DEFAULT '' NOT NULL,
	`jurisdiction` text DEFAULT '' NOT NULL,
	`lifecycle_state` text DEFAULT 'ACTIVE' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "source_identities_lifecycle_check" CHECK("source_identities"."lifecycle_state" IN ('ACTIVE', 'RETIRED')),
	CONSTRAINT "source_identities_identity_check" CHECK(length(trim("source_identities"."normalized_identity")) > 0 AND length("source_identities"."normalized_identity") <= 300)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_identities_canonical_key_unique` ON `source_identities` (`canonical_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `source_identities_normalized_unique` ON `source_identities` (`source_type`,`normalized_identity`);--> statement-breakpoint
CREATE INDEX `source_identities_type_lifecycle_idx` ON `source_identities` (`source_type`,`lifecycle_state`,`created_at`);--> statement-breakpoint
CREATE TABLE `temporal_assertions` (
	`id` text PRIMARY KEY NOT NULL,
	`fact_identity_id` text NOT NULL,
	`normalized_proposition` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`currentness_state` text NOT NULL,
	`qualification` text DEFAULT '' NOT NULL,
	`normative_strength` text NOT NULL,
	`payload_json` text NOT NULL,
	`provenance_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`provenance_hash` text NOT NULL,
	`lifecycle_state` text DEFAULT 'DRAFT' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`fact_identity_id`) REFERENCES `fact_identities`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "temporal_assertions_interval_check" CHECK("temporal_assertions"."effective_to" IS NULL OR "temporal_assertions"."effective_to" > "temporal_assertions"."effective_from"),
	CONSTRAINT "temporal_assertions_currentness_check" CHECK("temporal_assertions"."currentness_state" IN ('CURRENT_VERIFIED', 'CURRENT_WITH_QUALIFICATION', 'FUTURE_CHANGE_PENDING', 'UNVERIFIED', 'SUPERSEDED', 'CONFLICTING')),
	CONSTRAINT "temporal_assertions_normative_strength_check" CHECK("temporal_assertions"."normative_strength" IN ('STATUTORY_REQUIREMENT', 'REGULATORY_REQUIREMENT', 'OFFICIAL_INTERPRETATION', 'OFFICIAL_GUIDANCE', 'BEST_PRACTICE_REFERENCE', 'EXAM_IDENTITY_FACT', 'NEUTRAL_DEFINITION')),
	CONSTRAINT "temporal_assertions_lifecycle_check" CHECK("temporal_assertions"."lifecycle_state" IN ('DRAFT', 'PUBLISHED', 'SUPERSEDED')),
	CONSTRAINT "temporal_assertions_payload_hash_check" CHECK(length("temporal_assertions"."payload_hash") = 64 AND "temporal_assertions"."payload_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "temporal_assertions_provenance_hash_check" CHECK(length("temporal_assertions"."provenance_hash") = 64 AND "temporal_assertions"."provenance_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "temporal_assertions_payload_length_check" CHECK(length("temporal_assertions"."payload_json") <= 100000 AND length("temporal_assertions"."provenance_json") <= 100000 AND length("temporal_assertions"."qualification") <= 2000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `temporal_assertions_semantic_digest_unique` ON `temporal_assertions` (`fact_identity_id`,`payload_hash`,`provenance_hash`);--> statement-breakpoint
CREATE INDEX `temporal_assertions_fact_history_idx` ON `temporal_assertions` (`fact_identity_id`,`effective_from`,`created_at`);--> statement-breakpoint
CREATE INDEX `temporal_assertions_currentness_idx` ON `temporal_assertions` (`currentness_state`,`effective_from`,`effective_to`);--> statement-breakpoint
CREATE INDEX `temporal_assertions_lifecycle_idx` ON `temporal_assertions` (`lifecycle_state`,`created_at`);