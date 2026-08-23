ALTER TABLE `content_revisions` ADD COLUMN `semantic_hash` text;--> statement-breakpoint
ALTER TABLE `content_revisions` ADD COLUMN `human_review_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `content_revisions_semantic_hash_unique` ON `content_revisions` (`content_type`,`content_id`,`semantic_hash`);--> statement-breakpoint
CREATE TABLE `content_revision_concepts` (
  `id` text PRIMARY KEY NOT NULL,
  `revision_id` text NOT NULL REFERENCES `content_revisions`(`id`) ON DELETE RESTRICT,
  `concept_id` text REFERENCES `ontology_concepts`(`id`) ON DELETE RESTRICT,
  `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `relation_type` text DEFAULT 'MAPS_TO' NOT NULL,
  `qualification_json` text NOT NULL,
  `provenance_json` text NOT NULL,
  `mapping_status` text DEFAULT 'SUGGESTED' NOT NULL,
  `mapping_version` integer DEFAULT 1 NOT NULL,
  `reviewed_by` text REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `reviewed_at` text,
  CONSTRAINT `content_revision_concepts_relation_check` CHECK (`relation_type` = 'MAPS_TO'),
  CONSTRAINT `content_revision_concepts_status_check` CHECK (`mapping_status` IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  CONSTRAINT `content_revision_concepts_version_check` CHECK (`mapping_version` > 0),
  CONSTRAINT `content_revision_concepts_review_check` CHECK (`mapping_status` <> 'APPROVED' OR (`reviewed_by` IS NOT NULL AND `reviewed_at` IS NOT NULL)),
  CONSTRAINT `content_revision_concepts_identity_check` CHECK (`concept_id` IS NOT NULL OR length(`qualification_json`) > 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX `content_revision_concepts_current_unique` ON `content_revision_concepts` (`revision_id`,`concept_id`,`mapping_version`) WHERE `mapping_status` IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED');--> statement-breakpoint
CREATE INDEX `content_revision_concepts_version_status_idx` ON `content_revision_concepts` (`revision_id`,`mapping_status`,`mapping_version`);--> statement-breakpoint
CREATE INDEX `content_revision_concepts_concept_status_idx` ON `content_revision_concepts` (`concept_id`,`mapping_status`);--> statement-breakpoint
CREATE TRIGGER `content_revisions_review_guard_insert` BEFORE INSERT ON `content_revisions` WHEN NEW.human_review_hash IS NOT NULL AND (NEW.semantic_hash IS NULL OR NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL) BEGIN SELECT RAISE(ABORT, 'content_revisions_review_binding_check'); END;--> statement-breakpoint
CREATE TRIGGER `content_revisions_review_guard_update` BEFORE UPDATE OF human_review_hash, semantic_hash, reviewed_by, reviewed_at ON `content_revisions` WHEN NEW.human_review_hash IS NOT NULL AND (NEW.semantic_hash IS NULL OR NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL) BEGIN SELECT RAISE(ABORT, 'content_revisions_review_binding_check'); END;
