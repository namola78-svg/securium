ALTER TABLE `question_versions` ADD COLUMN `semantic_hash` text;--> statement-breakpoint
ALTER TABLE `question_versions` ADD COLUMN `blueprint_id` text;--> statement-breakpoint
ALTER TABLE `question_versions` ADD COLUMN `qualification_json` text;--> statement-breakpoint
ALTER TABLE `question_versions` ADD COLUMN `provenance_json` text;--> statement-breakpoint
ALTER TABLE `question_versions` ADD COLUMN `governance_json` text;--> statement-breakpoint
ALTER TABLE `question_versions` ADD COLUMN `human_review_hash` text;--> statement-breakpoint
ALTER TABLE `question_versions` ADD COLUMN `human_reviewed_by` text;--> statement-breakpoint
ALTER TABLE `question_versions` ADD COLUMN `human_reviewed_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `question_versions_semantic_hash_unique` ON `question_versions` (`question_id`,`version`,`semantic_hash`);--> statement-breakpoint
CREATE TABLE `question_concepts` (
  `id` text PRIMARY KEY NOT NULL,
  `question_version_id` text NOT NULL REFERENCES `question_versions`(`id`) ON DELETE RESTRICT,
  `concept_id` text NOT NULL REFERENCES `ontology_concepts`(`id`) ON DELETE RESTRICT,
  `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `relation_type` text DEFAULT 'MAPS_TO' NOT NULL,
  `qualification_json` text,
  `provenance_json` text,
  `mapping_status` text DEFAULT 'LEGACY_UNVERIFIED' NOT NULL,
  `mapping_version` integer DEFAULT 1 NOT NULL,
  `reviewed_by` text REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `reviewed_at` text,
  CONSTRAINT `question_concepts_relation_check` CHECK (`relation_type` = 'MAPS_TO'),
  CONSTRAINT `question_concepts_status_check` CHECK (`mapping_status` IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  CONSTRAINT `question_concepts_version_check` CHECK (`mapping_version` > 0),
  CONSTRAINT `question_concepts_review_check` CHECK (`mapping_status` <> 'APPROVED' OR (`reviewed_by` IS NOT NULL AND `reviewed_at` IS NOT NULL))
);--> statement-breakpoint
CREATE UNIQUE INDEX `question_concepts_current_unique` ON `question_concepts` (`question_version_id`,`concept_id`) WHERE `mapping_status` IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED');--> statement-breakpoint
CREATE INDEX `question_concepts_version_status_idx` ON `question_concepts` (`question_version_id`,`mapping_status`,`created_at`);--> statement-breakpoint
CREATE INDEX `question_concepts_concept_status_idx` ON `question_concepts` (`concept_id`,`mapping_status`,`created_at`);--> statement-breakpoint
CREATE TRIGGER `question_versions_review_guard_insert` BEFORE INSERT ON `question_versions` WHEN NEW.human_review_hash IS NOT NULL AND (NEW.semantic_hash IS NULL OR NEW.human_reviewed_by IS NULL OR NEW.human_reviewed_at IS NULL) BEGIN SELECT RAISE(ABORT, 'question_versions_review_binding_check'); END;--> statement-breakpoint
CREATE TRIGGER `question_versions_review_guard_update` BEFORE UPDATE OF human_review_hash, semantic_hash, human_reviewed_by, human_reviewed_at ON `question_versions` WHEN NEW.human_review_hash IS NOT NULL AND (NEW.semantic_hash IS NULL OR NEW.human_reviewed_by IS NULL OR NEW.human_reviewed_at IS NULL) BEGIN SELECT RAISE(ABORT, 'question_versions_review_binding_check'); END;
