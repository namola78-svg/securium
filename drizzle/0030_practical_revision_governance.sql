ALTER TABLE `practical_rubric_versions` ADD COLUMN `evaluation_semantic_hash` text;--> statement-breakpoint
ALTER TABLE `practical_rubric_versions` ADD COLUMN `evaluation_method` text;--> statement-breakpoint
ALTER TABLE `practical_rubric_versions` ADD COLUMN `human_review_hash` text;--> statement-breakpoint
ALTER TABLE `practical_rubric_versions` ADD COLUMN `evidence_classification` text;--> statement-breakpoint
CREATE TABLE `canonical_practicals` (
  `id` text PRIMARY KEY NOT NULL,
  `semantic_key` text NOT NULL UNIQUE,
  `lifecycle` text DEFAULT 'DRAFT' NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `canonical_practicals_lifecycle_check` CHECK (`lifecycle` IN ('DRAFT', 'HUMAN_APPROVED', 'CANONICAL_UNPUBLISHED', 'SUPERSEDED'))
);--> statement-breakpoint
CREATE TABLE `practical_governance_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `practical_id` text NOT NULL REFERENCES `canonical_practicals`(`id`) ON DELETE RESTRICT,
  `version` integer NOT NULL,
  `semantic_hash` text NOT NULL,
  `human_review_hash` text NOT NULL,
  `safety_review_hash` text NOT NULL,
  `rights_binding` text NOT NULL,
  `provenance_binding` text NOT NULL,
  `concept_mapping_hash` text NOT NULL,
  `theory_dependency_json` text NOT NULL,
  `currentness_reference` text NOT NULL,
  `lifecycle` text DEFAULT 'DRAFT' NOT NULL,
  `superseded_by_id` text REFERENCES `practical_governance_versions`(`id`) ON DELETE RESTRICT,
  `created_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `practical_governance_versions_identity_unique` UNIQUE (`practical_id`, `version`),
  CONSTRAINT `practical_governance_versions_semantic_unique` UNIQUE (`practical_id`, `semantic_hash`),
  CONSTRAINT `practical_governance_versions_hash_check` CHECK (length(`semantic_hash`) = 64 AND `semantic_hash` NOT GLOB '*[^0-9a-f]*' AND length(`human_review_hash`) = 64 AND `human_review_hash` NOT GLOB '*[^0-9a-f]*' AND length(`safety_review_hash`) = 64 AND `safety_review_hash` NOT GLOB '*[^0-9a-f]*' AND length(`concept_mapping_hash`) = 64 AND `concept_mapping_hash` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `practical_governance_versions_lifecycle_check` CHECK (`lifecycle` IN ('DRAFT', 'HUMAN_APPROVED', 'CANONICAL_UNPUBLISHED', 'SUPERSEDED'))
);--> statement-breakpoint
CREATE INDEX `practical_governance_versions_lifecycle_idx` ON `practical_governance_versions` (`lifecycle`, `created_at`);--> statement-breakpoint
CREATE TABLE `practical_reviewer_material_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `practical_version_id` text NOT NULL REFERENCES `practical_governance_versions`(`id`) ON DELETE RESTRICT,
  `rubric_version_id` text NOT NULL REFERENCES `practical_rubric_versions`(`id`) ON DELETE RESTRICT,
  `payload_json` text NOT NULL,
  `payload_digest` text NOT NULL,
  `visibility` text DEFAULT 'REVIEWER_ONLY' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `practical_reviewer_material_versions_identity_unique` UNIQUE (`practical_version_id`, `rubric_version_id`),
  CONSTRAINT `practical_reviewer_material_versions_visibility_check` CHECK (`visibility` = 'REVIEWER_ONLY'),
  CONSTRAINT `practical_reviewer_material_versions_digest_check` CHECK (length(`payload_digest`) = 64 AND `payload_digest` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `practical_reviewer_material_versions_payload_length_check` CHECK (length(`payload_json`) <= 200000)
);--> statement-breakpoint
CREATE TABLE `practical_version_concept_bindings` (
  `id` text PRIMARY KEY NOT NULL,
  `practical_version_id` text NOT NULL REFERENCES `practical_governance_versions`(`id`) ON DELETE RESTRICT,
  `concept_key` text NOT NULL,
  `concept_id` text,
  `mapping_semantic_hash` text NOT NULL,
  `qualification_json` text NOT NULL,
  `mapping_status` text DEFAULT 'PENDING' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `practical_version_concept_bindings_identity_unique` UNIQUE (`practical_version_id`, `concept_key`),
  CONSTRAINT `practical_version_concept_bindings_hash_check` CHECK (length(`mapping_semantic_hash`) = 64 AND `mapping_semantic_hash` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `practical_version_concept_bindings_status_check` CHECK (`mapping_status` IN ('PENDING', 'APPROVED', 'SUPERSEDED', 'LEGACY_UNVERIFIED')),
  CONSTRAINT `practical_version_concept_bindings_identity_check` CHECK (`concept_id` IS NOT NULL OR length(`concept_key`) > 0)
);--> statement-breakpoint
ALTER TABLE `practical_attempts` ADD COLUMN `practical_governance_version_id` text REFERENCES `practical_governance_versions`(`id`) ON DELETE RESTRICT;--> statement-breakpoint
CREATE TRIGGER `practical_rubric_versions_evaluation_check_insert` BEFORE INSERT ON `practical_rubric_versions` WHEN NEW.evaluation_semantic_hash IS NOT NULL AND (length(NEW.evaluation_semantic_hash) <> 64 OR NEW.evaluation_semantic_hash GLOB '*[^0-9a-f]*' OR NEW.evaluation_method NOT IN ('RULE_BASED', 'STRUCTURED_HUMAN_REVIEW', 'HYBRID') OR NEW.evidence_classification NOT IN ('ELIGIBLE_PERFORMANCE_EVIDENCE', 'ELIGIBLE_AFTER_HUMAN_EVALUATION', 'SUPPORTING_ACTIVITY_ONLY')) BEGIN SELECT RAISE(ABORT, 'practical_rubric_versions_evaluation_check'); END;--> statement-breakpoint
CREATE TRIGGER `practical_rubric_versions_evaluation_check_update` BEFORE UPDATE OF evaluation_semantic_hash, evaluation_method, evidence_classification ON `practical_rubric_versions` WHEN NEW.evaluation_semantic_hash IS NOT NULL AND (length(NEW.evaluation_semantic_hash) <> 64 OR NEW.evaluation_semantic_hash GLOB '*[^0-9a-f]*' OR NEW.evaluation_method NOT IN ('RULE_BASED', 'STRUCTURED_HUMAN_REVIEW', 'HYBRID') OR NEW.evidence_classification NOT IN ('ELIGIBLE_PERFORMANCE_EVIDENCE', 'ELIGIBLE_AFTER_HUMAN_EVALUATION', 'SUPPORTING_ACTIVITY_ONLY')) BEGIN SELECT RAISE(ABORT, 'practical_rubric_versions_evaluation_check'); END;--> statement-breakpoint
