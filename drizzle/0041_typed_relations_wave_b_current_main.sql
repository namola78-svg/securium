CREATE TABLE `occupational_role_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	`language` text DEFAULT 'und' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `occupational_roles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "occupational_role_aliases_identity_check" CHECK(length(trim("occupational_role_aliases"."alias")) > 0 AND length("occupational_role_aliases"."alias") <= 300 AND "occupational_role_aliases"."alias" = trim("occupational_role_aliases"."alias") AND "occupational_role_aliases"."alias" = lower("occupational_role_aliases"."alias") AND "occupational_role_aliases"."alias" NOT GLOB '*[^ -~]*' AND "occupational_role_aliases"."alias" NOT GLOB '*  *' AND "occupational_role_aliases"."normalized_alias" = "occupational_role_aliases"."alias")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `occupational_role_aliases_normalized_unique` ON `occupational_role_aliases` (`normalized_alias`);--> statement-breakpoint
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
	CONSTRAINT "occupational_roles_identity_check" CHECK(length(trim("occupational_roles"."role_key")) = length("occupational_roles"."role_key") AND length("occupational_roles"."role_key") BETWEEN 8 AND 255 AND substr("occupational_roles"."role_key", 1, 5) = 'role:' AND "occupational_roles"."role_key" NOT GLOB '*[^a-z0-9._:-]*' AND instr(substr("occupational_roles"."role_key", 6), ':') > 1 AND instr(substr("occupational_roles"."role_key", 6), ':') < length(substr("occupational_roles"."role_key", 6)) AND instr(substr("occupational_roles"."role_key", 6 + instr(substr("occupational_roles"."role_key", 6), ':')), ':') = 0 AND length(trim("occupational_roles"."label")) > 0),
	CONSTRAINT "occupational_roles_active_review_check" CHECK("occupational_roles"."status" <> 'ACTIVE' OR ("occupational_roles"."reviewed_by" IS NOT NULL AND "occupational_roles"."reviewed_at" IS NOT NULL AND length(trim("occupational_roles"."review_evidence_json")) > 2))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `occupational_roles_key_unique` ON `occupational_roles` (`role_key`);--> statement-breakpoint
CREATE INDEX `occupational_roles_status_idx` ON `occupational_roles` (`status`,`role_key`);--> statement-breakpoint
CREATE INDEX `occupational_roles_source_idx` ON `occupational_roles` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `role_skill_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`relation_type` text DEFAULT 'ROLE_REQUIRES_SKILL' NOT NULL,
	`relation_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`source_type` text DEFAULT 'SECURIUM_AUTHORED' NOT NULL,
	`source_id` text,
	`provenance_json` text DEFAULT '{}' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`review_evidence_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `occupational_roles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "role_skill_relations_type_check" CHECK("role_skill_relations"."relation_type" = 'ROLE_REQUIRES_SKILL'),
	CONSTRAINT "role_skill_relations_version_check" CHECK("role_skill_relations"."relation_version" > 0),
	CONSTRAINT "role_skill_relations_status_check" CHECK("role_skill_relations"."status" IN ('DRAFT', 'ACTIVE', 'RETIRED')),
	CONSTRAINT "role_skill_relations_provenance_check" CHECK(length(trim("role_skill_relations"."source_type")) > 0 AND length(trim("role_skill_relations"."provenance_json")) > 2),
	CONSTRAINT "role_skill_relations_active_review_check" CHECK("role_skill_relations"."status" <> 'ACTIVE' OR ("role_skill_relations"."reviewed_by" IS NOT NULL AND "role_skill_relations"."reviewed_at" IS NOT NULL AND length(trim("role_skill_relations"."review_evidence_json")) > 2))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_skill_relations_edge_unique` ON `role_skill_relations` (`role_id`,`skill_id`,`relation_type`);--> statement-breakpoint
CREATE INDEX `role_skill_relations_role_status_idx` ON `role_skill_relations` (`role_id`,`status`);--> statement-breakpoint
CREATE INDEX `role_skill_relations_skill_status_idx` ON `role_skill_relations` (`skill_id`,`status`);--> statement-breakpoint
CREATE TABLE `skill_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	`language` text DEFAULT 'und' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "skill_aliases_identity_check" CHECK(length(trim("skill_aliases"."alias")) > 0 AND length("skill_aliases"."alias") <= 300 AND "skill_aliases"."alias" = trim("skill_aliases"."alias") AND "skill_aliases"."alias" = lower("skill_aliases"."alias") AND "skill_aliases"."alias" NOT GLOB '*[^ -~]*' AND "skill_aliases"."alias" NOT GLOB '*  *' AND "skill_aliases"."normalized_alias" = "skill_aliases"."alias")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_aliases_normalized_unique` ON `skill_aliases` (`normalized_alias`);--> statement-breakpoint
CREATE INDEX `skill_aliases_lookup_idx` ON `skill_aliases` (`normalized_alias`);--> statement-breakpoint
CREATE TABLE `skill_concept_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`concept_id` text NOT NULL,
	`relation_type` text DEFAULT 'SKILL_REQUIRES_CONCEPT' NOT NULL,
	`relation_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`source_type` text DEFAULT 'SECURIUM_AUTHORED' NOT NULL,
	`source_id` text,
	`provenance_json` text DEFAULT '{}' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`review_evidence_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`concept_id`) REFERENCES `ontology_concepts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "skill_concept_relations_type_check" CHECK("skill_concept_relations"."relation_type" = 'SKILL_REQUIRES_CONCEPT'),
	CONSTRAINT "skill_concept_relations_version_check" CHECK("skill_concept_relations"."relation_version" > 0),
	CONSTRAINT "skill_concept_relations_status_check" CHECK("skill_concept_relations"."status" IN ('DRAFT', 'ACTIVE', 'RETIRED')),
	CONSTRAINT "skill_concept_relations_provenance_check" CHECK(length(trim("skill_concept_relations"."source_type")) > 0 AND length(trim("skill_concept_relations"."provenance_json")) > 2),
	CONSTRAINT "skill_concept_relations_active_review_check" CHECK("skill_concept_relations"."status" <> 'ACTIVE' OR ("skill_concept_relations"."reviewed_by" IS NOT NULL AND "skill_concept_relations"."reviewed_at" IS NOT NULL AND length(trim("skill_concept_relations"."review_evidence_json")) > 2))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_concept_relations_edge_unique` ON `skill_concept_relations` (`skill_id`,`concept_id`,`relation_type`);--> statement-breakpoint
CREATE INDEX `skill_concept_relations_skill_status_idx` ON `skill_concept_relations` (`skill_id`,`status`);--> statement-breakpoint
CREATE INDEX `skill_concept_relations_concept_status_idx` ON `skill_concept_relations` (`concept_id`,`status`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_key` text NOT NULL,
	`label` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text,
	`provenance_json` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`review_evidence_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "skills_status_check" CHECK("skills"."status" IN ('DRAFT', 'ACTIVE', 'RETIRED')),
	CONSTRAINT "skills_identity_check" CHECK(length(trim("skills"."skill_key")) = length("skills"."skill_key") AND length("skills"."skill_key") BETWEEN 9 AND 255 AND substr("skills"."skill_key", 1, 6) = 'skill:' AND "skills"."skill_key" NOT GLOB '*[^a-z0-9._:-]*' AND instr(substr("skills"."skill_key", 7), ':') > 1 AND instr(substr("skills"."skill_key", 7), ':') < length(substr("skills"."skill_key", 7)) AND instr(substr("skills"."skill_key", 7 + instr(substr("skills"."skill_key", 7), ':')), ':') = 0 AND length(trim("skills"."label")) > 0 AND length(trim("skills"."source_type")) > 0 AND length(trim("skills"."provenance_json")) > 2),
	CONSTRAINT "skills_active_review_check" CHECK("skills"."status" <> 'ACTIVE' OR ("skills"."reviewed_by" IS NOT NULL AND "skills"."reviewed_at" IS NOT NULL AND length(trim("skills"."review_evidence_json")) > 2))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_key_unique` ON `skills` (`skill_key`);--> statement-breakpoint
CREATE INDEX `skills_status_idx` ON `skills` (`status`,`skill_key`);--> statement-breakpoint
CREATE INDEX `skills_source_idx` ON `skills` (`source_type`,`source_id`);
