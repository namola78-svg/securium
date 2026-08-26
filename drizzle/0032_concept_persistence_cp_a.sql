CREATE TABLE `concept_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`concept_id` text NOT NULL,
	`language` text NOT NULL,
	`label` text NOT NULL,
	`normalized_label` text NOT NULL,
	`label_type` text DEFAULT 'PREF' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`concept_id`) REFERENCES `concepts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "concept_labels_type_check" CHECK("concept_labels"."label_type" IN ('PREF', 'ALT')),
	CONSTRAINT "concept_labels_status_check" CHECK("concept_labels"."status" IN ('DRAFT', 'ACTIVE', 'RETIRED')),
	CONSTRAINT "concept_labels_nonempty_check" CHECK(length(trim("concept_labels"."label")) > 0 AND length(trim("concept_labels"."normalized_label")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `concept_labels_identity_unique` ON `concept_labels` (`concept_id`,`language`,`normalized_label`);--> statement-breakpoint
CREATE UNIQUE INDEX `concept_labels_pref_language_unique` ON `concept_labels` (`concept_id`,`language`,`label_type`) WHERE "concept_labels"."label_type" = 'PREF' AND "concept_labels"."status" = 'ACTIVE';--> statement-breakpoint
CREATE TABLE `concept_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`concept_id` text NOT NULL,
	`version` integer NOT NULL,
	`semantic_hash` text NOT NULL,
	`definition` text NOT NULL,
	`scope` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`activated_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`concept_id`) REFERENCES `concepts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "concept_versions_version_check" CHECK("concept_versions"."version" > 0),
	CONSTRAINT "concept_versions_hash_check" CHECK("concept_versions"."semantic_hash" GLOB '[0-9a-f]*' AND length("concept_versions"."semantic_hash") = 64 AND "concept_versions"."semantic_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "concept_versions_status_check" CHECK("concept_versions"."status" IN ('DRAFT', 'ACTIVE', 'RETIRED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `concept_versions_identity_unique` ON `concept_versions` (`concept_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `concept_versions_hash_unique` ON `concept_versions` (`concept_id`,`semantic_hash`);--> statement-breakpoint
CREATE INDEX `concept_versions_status_idx` ON `concept_versions` (`concept_id`,`status`);--> statement-breakpoint
CREATE TABLE `concepts` (
	`id` text PRIMARY KEY NOT NULL,
	`stable_key` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "concepts_status_check" CHECK("concepts"."status" IN ('DRAFT', 'ACTIVE', 'RETIRED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `concepts_stable_key_unique` ON `concepts` (`stable_key`);