CREATE TABLE `evidence_rebuild_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_key` text DEFAULT 'EVIDENCE_V1' NOT NULL,
	`projection_version` text NOT NULL,
	`mapping_snapshot_hash` text NOT NULL,
	`source_cutoff` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`checkpoint` text,
	`active` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`failure_class` text,
	`superseded_by_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "evidence_rebuild_generations_status_check" CHECK("evidence_rebuild_generations"."status" IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SUPERSEDED')),
	CONSTRAINT "evidence_rebuild_generations_active_check" CHECK("evidence_rebuild_generations"."active" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_rebuild_generations_active_unique` ON `evidence_rebuild_generations` (`scope_key`) WHERE "evidence_rebuild_generations"."active" = 1;--> statement-breakpoint
CREATE INDEX `evidence_rebuild_generations_status_idx` ON `evidence_rebuild_generations` (`status`,`created_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_evidence_recompute_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`request_type` text DEFAULT 'EVIDENCE_RECOMPUTE_REQUIRED' NOT NULL,
	`scope_type` text NOT NULL,
	`source_type` text,
	`source_event_id` text,
	`source_revision_identity` text,
	`user_id` text,
	`concept_id` text,
	`projection_version` text NOT NULL,
	`reason_code` text NOT NULL,
	`input_semantic_hash` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`cursor` text,
	`generation_id` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`claimed_by` text,
	`claim_token` text,
	`claimed_at` text,
	`lease_expires_at` text,
	`next_attempt_at` text,
	`checkpoint` text,
	`error_class` text,
	`cancelled_at` text,
	`superseded_by_id` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`concept_id`) REFERENCES `ontology_concepts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evidence_recompute_requests_type_check" CHECK("__new_evidence_recompute_requests"."request_type" IN ('EVIDENCE_RECOMPUTE_REQUIRED', 'MASTERY_RECOMPUTE_REQUIRED')),
	CONSTRAINT "evidence_recompute_requests_scope_check" CHECK("__new_evidence_recompute_requests"."scope_type" IN ('EVENT', 'USER', 'CONCEPT', 'FULL')),
	CONSTRAINT "evidence_recompute_requests_status_check" CHECK("__new_evidence_recompute_requests"."status" IN ('PENDING', 'PROCESSING', 'RETRYABLE', 'COMPLETED', 'FAILED', 'CANCELLED', 'SUPERSEDED')),
	CONSTRAINT "evidence_recompute_requests_hash_check" CHECK(length("__new_evidence_recompute_requests"."input_semantic_hash") = 64 AND "__new_evidence_recompute_requests"."input_semantic_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "evidence_recompute_requests_attempts_check" CHECK("__new_evidence_recompute_requests"."attempts" >= 0),
	CONSTRAINT "evidence_recompute_requests_scope_values_check" CHECK(("__new_evidence_recompute_requests"."scope_type" <> 'EVENT' OR ("__new_evidence_recompute_requests"."source_type" IS NOT NULL AND "__new_evidence_recompute_requests"."source_event_id" IS NOT NULL AND "__new_evidence_recompute_requests"."source_revision_identity" IS NOT NULL)) AND ("__new_evidence_recompute_requests"."scope_type" <> 'USER' OR "__new_evidence_recompute_requests"."user_id" IS NOT NULL) AND ("__new_evidence_recompute_requests"."scope_type" <> 'CONCEPT' OR "__new_evidence_recompute_requests"."concept_id" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_evidence_recompute_requests`("id", "request_type", "scope_type", "source_type", "source_event_id", "source_revision_identity", "user_id", "concept_id", "projection_version", "reason_code", "input_semantic_hash", "status", "cursor", "generation_id", "attempts", "claimed_by", "claim_token", "claimed_at", "lease_expires_at", "next_attempt_at", "checkpoint", "error_class", "cancelled_at", "superseded_by_id", "completed_at", "created_at") SELECT "id", "request_type", "scope_type", "source_type", "source_event_id", "source_revision_identity", "user_id", "concept_id", "projection_version", "reason_code", "input_semantic_hash", "status", "cursor", "generation_id", "attempts", "claimed_by", "claim_token", "claimed_at", "lease_expires_at", "next_attempt_at", "checkpoint", "error_class", "cancelled_at", "superseded_by_id", "completed_at", "created_at" FROM `evidence_recompute_requests`;--> statement-breakpoint
DROP TABLE `evidence_recompute_requests`;--> statement-breakpoint
ALTER TABLE `__new_evidence_recompute_requests` RENAME TO `evidence_recompute_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_recompute_requests_semantic_unique` ON `evidence_recompute_requests` (`request_type`,`input_semantic_hash`);--> statement-breakpoint
CREATE INDEX `evidence_recompute_requests_work_idx` ON `evidence_recompute_requests` (`status`,`request_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `evidence_recompute_requests_user_idx` ON `evidence_recompute_requests` (`user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `evidence_recompute_requests_concept_idx` ON `evidence_recompute_requests` (`concept_id`,`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `evidence_projections` ADD `generation_id` text;--> statement-breakpoint
CREATE INDEX `evidence_projections_generation_idx` ON `evidence_projections` (`generation_id`,`lifecycle`);
