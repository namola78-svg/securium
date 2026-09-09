PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_occupational_roles` (
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
	CONSTRAINT "occupational_roles_status_check" CHECK("__new_occupational_roles"."status" IN ('DRAFT', 'ACTIVE', 'RETIRED')),
	CONSTRAINT "occupational_roles_identity_check" CHECK(length(trim("__new_occupational_roles"."role_key")) = length("__new_occupational_roles"."role_key") AND length("__new_occupational_roles"."role_key") BETWEEN 8 AND 255 AND substr("__new_occupational_roles"."role_key", 1, 5) = 'role:' AND "__new_occupational_roles"."role_key" NOT GLOB '*[^a-z0-9._:-]*' AND instr(substr("__new_occupational_roles"."role_key", 6), ':') > 1 AND instr(substr("__new_occupational_roles"."role_key", 6), ':') < length(substr("__new_occupational_roles"."role_key", 6)) AND instr(substr("__new_occupational_roles"."role_key", 6 + instr(substr("__new_occupational_roles"."role_key", 6), ':')), ':') = 0 AND length(trim("__new_occupational_roles"."label")) > 0),
	CONSTRAINT "occupational_roles_active_review_check" CHECK("__new_occupational_roles"."status" <> 'ACTIVE' OR ("__new_occupational_roles"."reviewed_by" IS NOT NULL AND "__new_occupational_roles"."reviewed_at" IS NOT NULL AND length(trim("__new_occupational_roles"."review_evidence_json")) > 2))
);
--> statement-breakpoint
INSERT INTO `__new_occupational_roles`("id", "role_key", "label", "description", "status", "source_type", "source_id", "provenance_json", "reviewed_by", "reviewed_at", "review_evidence_json", "created_at", "updated_at") SELECT "id", "role_key", "label", "description", "status", "source_type", "source_id", "provenance_json", "reviewed_by", "reviewed_at", "review_evidence_json", "created_at", "updated_at" FROM `occupational_roles`;--> statement-breakpoint
DROP TABLE `occupational_roles`;--> statement-breakpoint
ALTER TABLE `__new_occupational_roles` RENAME TO `occupational_roles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `occupational_roles_key_unique` ON `occupational_roles` (`role_key`);--> statement-breakpoint
CREATE INDEX `occupational_roles_status_idx` ON `occupational_roles` (`status`,`role_key`);--> statement-breakpoint
CREATE INDEX `occupational_roles_source_idx` ON `occupational_roles` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `__new_occupational_role_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	`language` text DEFAULT 'und' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `occupational_roles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "occupational_role_aliases_identity_check" CHECK(length(trim("__new_occupational_role_aliases"."alias")) > 0 AND length("__new_occupational_role_aliases"."alias") <= 300 AND "__new_occupational_role_aliases"."alias" = trim("__new_occupational_role_aliases"."alias") AND "__new_occupational_role_aliases"."alias" = lower("__new_occupational_role_aliases"."alias") AND "__new_occupational_role_aliases"."alias" NOT GLOB '*  *' AND "__new_occupational_role_aliases"."alias" NOT GLOB ('*' || char(9) || '*') AND "__new_occupational_role_aliases"."alias" NOT GLOB ('*' || char(10) || '*') AND "__new_occupational_role_aliases"."alias" NOT GLOB ('*' || char(13) || '*') AND "__new_occupational_role_aliases"."alias" NOT GLOB ('*' || char(11) || '*') AND "__new_occupational_role_aliases"."alias" NOT GLOB ('*' || char(12) || '*') AND "__new_occupational_role_aliases"."normalized_alias" = "__new_occupational_role_aliases"."alias")
);
--> statement-breakpoint
INSERT INTO `__new_occupational_role_aliases`("id", "role_id", "alias", "normalized_alias", "language", "source", "created_at", "updated_at") SELECT "id", "role_id", "alias", "normalized_alias", "language", "source", "created_at", "updated_at" FROM `occupational_role_aliases`;--> statement-breakpoint
DROP TABLE `occupational_role_aliases`;--> statement-breakpoint
ALTER TABLE `__new_occupational_role_aliases` RENAME TO `occupational_role_aliases`;--> statement-breakpoint
CREATE UNIQUE INDEX `occupational_role_aliases_role_normalized_unique` ON `occupational_role_aliases` (`role_id`,`normalized_alias`);--> statement-breakpoint
CREATE INDEX `occupational_role_aliases_lookup_idx` ON `occupational_role_aliases` (`normalized_alias`);--> statement-breakpoint
CREATE TRIGGER `occupational_roles_role_key_immutable` BEFORE UPDATE OF `role_key` ON `occupational_roles`
WHEN NEW.`role_key` IS NOT OLD.`role_key`
BEGIN
  SELECT RAISE(ABORT, 'Occupational Role semantic key is immutable');
END;
