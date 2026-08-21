ALTER TABLE `fact_concept_bindings` ADD COLUMN `relation_type` text NOT NULL DEFAULT 'MAPS_TO';--> statement-breakpoint
ALTER TABLE `fact_concept_bindings` ADD COLUMN `qualification_json` text;--> statement-breakpoint
ALTER TABLE `fact_concept_bindings` ADD COLUMN `mapping_basis` text;--> statement-breakpoint
ALTER TABLE `fact_concept_bindings` ADD COLUMN `provenance_json` text;--> statement-breakpoint
ALTER TABLE `fact_concept_bindings` ADD COLUMN `mapping_status` text NOT NULL DEFAULT 'LEGACY_UNVERIFIED';--> statement-breakpoint
ALTER TABLE `fact_concept_bindings` ADD COLUMN `mapping_version` integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `fact_concept_bindings` ADD COLUMN `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `fact_concept_bindings` ADD COLUMN `reviewed_at` text;--> statement-breakpoint
DROP INDEX `fact_concept_bindings_identity_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `fact_concept_bindings_current_unique` ON `fact_concept_bindings` (`fact_identity_id`,`concept_id`) WHERE `mapping_status` IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED');--> statement-breakpoint
CREATE INDEX `fact_concept_bindings_fact_status_idx` ON `fact_concept_bindings` (`fact_identity_id`,`mapping_status`,`created_at`);--> statement-breakpoint
CREATE INDEX `fact_concept_bindings_concept_status_idx` ON `fact_concept_bindings` (`concept_id`,`mapping_status`,`created_at`);--> statement-breakpoint
CREATE INDEX `fact_concept_bindings_semantic_version_idx` ON `fact_concept_bindings` (`fact_identity_id`,`concept_id`,`mapping_version`);--> statement-breakpoint
CREATE TRIGGER `fact_concept_bindings_relation_guard_insert` BEFORE INSERT ON `fact_concept_bindings` WHEN NEW.relation_type <> 'MAPS_TO' BEGIN SELECT RAISE(ABORT, 'fact_concept_bindings_relation_check'); END;--> statement-breakpoint
CREATE TRIGGER `fact_concept_bindings_status_guard_insert` BEFORE INSERT ON `fact_concept_bindings` WHEN NEW.mapping_status NOT IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED') BEGIN SELECT RAISE(ABORT, 'fact_concept_bindings_status_check'); END;--> statement-breakpoint
CREATE TRIGGER `fact_concept_bindings_version_guard_insert` BEFORE INSERT ON `fact_concept_bindings` WHEN NEW.mapping_version <= 0 BEGIN SELECT RAISE(ABORT, 'fact_concept_bindings_version_check'); END;--> statement-breakpoint
CREATE TRIGGER `fact_concept_bindings_review_guard_insert` BEFORE INSERT ON `fact_concept_bindings` WHEN NEW.mapping_status = 'APPROVED' AND (NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL) BEGIN SELECT RAISE(ABORT, 'fact_concept_bindings_review_check'); END;--> statement-breakpoint
CREATE TRIGGER `fact_concept_bindings_relation_guard_update` BEFORE UPDATE OF relation_type ON `fact_concept_bindings` WHEN NEW.relation_type <> 'MAPS_TO' BEGIN SELECT RAISE(ABORT, 'fact_concept_bindings_relation_check'); END;--> statement-breakpoint
CREATE TRIGGER `fact_concept_bindings_status_guard_update` BEFORE UPDATE OF mapping_status ON `fact_concept_bindings` WHEN NEW.mapping_status NOT IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED') BEGIN SELECT RAISE(ABORT, 'fact_concept_bindings_status_check'); END;--> statement-breakpoint
CREATE TRIGGER `fact_concept_bindings_version_guard_update` BEFORE UPDATE OF mapping_version ON `fact_concept_bindings` WHEN NEW.mapping_version <= 0 BEGIN SELECT RAISE(ABORT, 'fact_concept_bindings_version_check'); END;--> statement-breakpoint
CREATE TRIGGER `fact_concept_bindings_review_guard_update` BEFORE UPDATE OF mapping_status, reviewed_by, reviewed_at ON `fact_concept_bindings` WHEN NEW.mapping_status = 'APPROVED' AND (NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL) BEGIN SELECT RAISE(ABORT, 'fact_concept_bindings_review_check'); END;
