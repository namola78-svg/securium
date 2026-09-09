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
  CONSTRAINT `skills_status_check` CHECK (`status` IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT `skills_identity_check` CHECK (length(trim(`skill_key`)) = length(`skill_key`) AND length(`skill_key`) BETWEEN 9 AND 255 AND substr(`skill_key`, 1, 6) = 'skill:' AND `skill_key` NOT GLOB '*[^a-z0-9._:-]*' AND instr(substr(`skill_key`, 7), ':') > 1 AND instr(substr(`skill_key`, 7), ':') < length(substr(`skill_key`, 7)) AND instr(substr(`skill_key`, 7 + instr(substr(`skill_key`, 7), ':')), ':') = 0 AND length(trim(`label`)) > 0 AND length(trim(`source_type`)) > 0 AND length(trim(`provenance_json`)) > 2),
  CONSTRAINT `skills_active_review_check` CHECK (`status` <> 'ACTIVE' OR (`reviewed_by` IS NOT NULL AND `reviewed_at` IS NOT NULL AND length(trim(`review_evidence_json`)) > 2)),
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_key_unique` ON `skills` (`skill_key`);
--> statement-breakpoint
CREATE INDEX `skills_status_idx` ON `skills` (`status`, `skill_key`);
--> statement-breakpoint
CREATE INDEX `skills_source_idx` ON `skills` (`source_type`, `source_id`);
--> statement-breakpoint
CREATE TABLE `skill_aliases` (
  `id` text PRIMARY KEY NOT NULL,
  `skill_id` text NOT NULL,
  `alias` text NOT NULL,
  `normalized_alias` text NOT NULL,
  `language` text DEFAULT 'und' NOT NULL,
  `source` text DEFAULT 'manual' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `skill_aliases_identity_check` CHECK (length(trim(`alias`)) > 0 AND length(`alias`) <= 300 AND `alias` = trim(`alias`) AND `alias` = lower(`alias`) AND `alias` NOT GLOB '*[^ -~]*' AND `alias` NOT GLOB '*  *' AND `normalized_alias` = `alias`),
  FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_aliases_normalized_unique` ON `skill_aliases` (`normalized_alias`);
--> statement-breakpoint
CREATE INDEX `skill_aliases_lookup_idx` ON `skill_aliases` (`normalized_alias`);
--> statement-breakpoint
CREATE TRIGGER `skills_skill_key_immutable` BEFORE UPDATE OF `skill_key` ON `skills` BEGIN SELECT RAISE(ABORT, 'skill_key is immutable') WHERE NEW.skill_key IS NOT OLD.skill_key; END;
