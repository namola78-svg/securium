CREATE TABLE `occupational_role_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	`language` text DEFAULT 'und' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `occupational_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `occupational_role_aliases_role_normalized_unique` ON `occupational_role_aliases` (`role_id`,`normalized_alias`);--> statement-breakpoint
CREATE INDEX `occupational_role_aliases_lookup_idx` ON `occupational_role_aliases` (`normalized_alias`);--> statement-breakpoint
CREATE TABLE `occupational_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`role_key` text NOT NULL,
	`label` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`source_type` text DEFAULT 'SECURIUM_AUTHORED' NOT NULL,
	`source_id` text,
	`provenance_json` text DEFAULT '{}' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`review_evidence_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "occupational_roles_status_check" CHECK("occupational_roles"."status" IN ('DRAFT', 'ACTIVE', 'RETIRED')),
	CONSTRAINT "occupational_roles_identity_check" CHECK(length(trim("occupational_roles"."role_key")) > 0 AND length(trim("occupational_roles"."label")) > 0),
	CONSTRAINT "occupational_roles_active_review_check" CHECK("occupational_roles"."status" <> 'ACTIVE' OR ("occupational_roles"."reviewed_by" IS NOT NULL AND "occupational_roles"."reviewed_at" IS NOT NULL AND length(trim("occupational_roles"."review_evidence_json")) > 2))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `occupational_roles_key_unique` ON `occupational_roles` (`role_key`);--> statement-breakpoint
CREATE INDEX `occupational_roles_status_idx` ON `occupational_roles` (`status`,`role_key`);--> statement-breakpoint
CREATE INDEX `occupational_roles_source_idx` ON `occupational_roles` (`source_type`,`source_id`);