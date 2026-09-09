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
  CONSTRAINT `role_skill_relations_type_check` CHECK (`relation_type` = 'ROLE_REQUIRES_SKILL'),
  CONSTRAINT `role_skill_relations_version_check` CHECK (`relation_version` > 0),
  CONSTRAINT `role_skill_relations_status_check` CHECK (`status` IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT `role_skill_relations_provenance_check` CHECK (length(trim(`source_type`)) > 0 AND length(trim(`provenance_json`)) > 2),
  CONSTRAINT `role_skill_relations_active_review_check` CHECK (`status` <> 'ACTIVE' OR (`reviewed_by` IS NOT NULL AND `reviewed_at` IS NOT NULL AND length(trim(`review_evidence_json`)) > 2)),
  FOREIGN KEY (`role_id`) REFERENCES `occupational_roles`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_skill_relations_edge_unique` ON `role_skill_relations` (`role_id`, `skill_id`, `relation_type`);
--> statement-breakpoint
CREATE INDEX `role_skill_relations_role_status_idx` ON `role_skill_relations` (`role_id`, `status`);
--> statement-breakpoint
CREATE INDEX `role_skill_relations_skill_status_idx` ON `role_skill_relations` (`skill_id`, `status`);
--> statement-breakpoint
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
  CONSTRAINT `skill_concept_relations_type_check` CHECK (`relation_type` = 'SKILL_REQUIRES_CONCEPT'),
  CONSTRAINT `skill_concept_relations_version_check` CHECK (`relation_version` > 0),
  CONSTRAINT `skill_concept_relations_status_check` CHECK (`status` IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT `skill_concept_relations_provenance_check` CHECK (length(trim(`source_type`)) > 0 AND length(trim(`provenance_json`)) > 2),
  CONSTRAINT `skill_concept_relations_active_review_check` CHECK (`status` <> 'ACTIVE' OR (`reviewed_by` IS NOT NULL AND `reviewed_at` IS NOT NULL AND length(trim(`review_evidence_json`)) > 2)),
  FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`concept_id`) REFERENCES `ontology_concepts`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_concept_relations_edge_unique` ON `skill_concept_relations` (`skill_id`, `concept_id`, `relation_type`);
--> statement-breakpoint
CREATE INDEX `skill_concept_relations_skill_status_idx` ON `skill_concept_relations` (`skill_id`, `status`);
--> statement-breakpoint
CREATE INDEX `skill_concept_relations_concept_status_idx` ON `skill_concept_relations` (`concept_id`, `status`);
