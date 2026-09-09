-- Fail before any canonical table replacement when pre-existing normalized aliases
-- collide. The preflight index is intentionally temporary and is removed before
-- the rebuild begins. A failed CREATE UNIQUE INDEX leaves the original table and
-- its existing data/indexes untouched.
DROP TABLE IF EXISTS `__new_occupational_role_aliases`;--> statement-breakpoint
DROP INDEX IF EXISTS `__occupational_role_aliases_collision_preflight`;--> statement-breakpoint
CREATE UNIQUE INDEX `__occupational_role_aliases_collision_preflight`
  ON `occupational_role_aliases` (`normalized_alias`);--> statement-breakpoint
DROP INDEX `__occupational_role_aliases_collision_preflight`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	CONSTRAINT "occupational_role_aliases_identity_check" CHECK(length(trim("__new_occupational_role_aliases"."alias")) > 0 AND length("__new_occupational_role_aliases"."alias") <= 300 AND "__new_occupational_role_aliases"."alias" = trim("__new_occupational_role_aliases"."alias") AND "__new_occupational_role_aliases"."alias" = lower("__new_occupational_role_aliases"."alias") AND "__new_occupational_role_aliases"."alias" NOT GLOB '*[^ -~]*' AND "__new_occupational_role_aliases"."alias" NOT GLOB '*  *' AND "__new_occupational_role_aliases"."normalized_alias" = "__new_occupational_role_aliases"."alias")
);
--> statement-breakpoint
INSERT INTO `__new_occupational_role_aliases`("id", "role_id", "alias", "normalized_alias", "language", "source", "created_at", "updated_at") SELECT "id", "role_id", "alias", "normalized_alias", "language", "source", "created_at", "updated_at" FROM `occupational_role_aliases`;--> statement-breakpoint
CREATE UNIQUE INDEX `occupational_role_aliases_normalized_unique`
	ON `__new_occupational_role_aliases` (`normalized_alias`);--> statement-breakpoint
CREATE INDEX `__occupational_role_aliases_lookup_idx_new`
	ON `__new_occupational_role_aliases` (`normalized_alias`);--> statement-breakpoint
DROP TABLE `occupational_role_aliases`;--> statement-breakpoint
ALTER TABLE `__new_occupational_role_aliases` RENAME TO `occupational_role_aliases`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX `__occupational_role_aliases_lookup_idx_new`;--> statement-breakpoint
CREATE INDEX `occupational_role_aliases_lookup_idx` ON `occupational_role_aliases` (`normalized_alias`);
