CREATE TABLE `evidence_projections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_event_id` text NOT NULL,
	`source_revision_identity` text NOT NULL,
	`evidence_type` text NOT NULL,
	`concept_id` text NOT NULL,
	`concept_mapping_set_hash` text NOT NULL,
	`projection_version` text NOT NULL,
	`source_semantic_hash` text NOT NULL,
	`semantic_hash` text NOT NULL,
	`result_summary_json` text DEFAULT '{}' NOT NULL,
	`quality` text NOT NULL,
	`lifecycle` text DEFAULT 'ACTIVE' NOT NULL,
	`superseded_by_id` text,
	`invalidation_reason` text,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`concept_id`) REFERENCES `ontology_concepts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`superseded_by_id`) REFERENCES `evidence_projections`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evidence_projections_source_check" CHECK("evidence_projections"."source_type" IN ('QUESTION_ATTEMPT', 'MOCK_ATTEMPT', 'MOCK_ITEM_RESULT', 'PRACTICAL_EVALUATION', 'LESSON_PROGRESS', 'COURSE_LESSON_PROGRESS', 'LECTURE_PROGRESS', 'AUDIO_PROGRESS')),
	CONSTRAINT "evidence_projections_type_check" CHECK("evidence_projections"."evidence_type" IN ('PERFORMANCE_RESULT', 'PRACTICAL_PERFORMANCE', 'LEARNING_ACTIVITY')),
	CONSTRAINT "evidence_projections_lifecycle_check" CHECK("evidence_projections"."lifecycle" IN ('ACTIVE', 'SUPERSEDED', 'INVALIDATED')),
	CONSTRAINT "evidence_projections_quality_check" CHECK("evidence_projections"."quality" IN ('DIRECT_PERFORMANCE', 'HUMAN_EVALUATED', 'SUPPORTING_ACTIVITY')),
	CONSTRAINT "evidence_projections_hashes_check" CHECK(length("evidence_projections"."concept_mapping_set_hash") = 64 AND "evidence_projections"."concept_mapping_set_hash" NOT GLOB '*[^0-9a-f]*' AND length("evidence_projections"."source_semantic_hash") = 64 AND "evidence_projections"."source_semantic_hash" NOT GLOB '*[^0-9a-f]*' AND length("evidence_projections"."semantic_hash") = 64 AND "evidence_projections"."semantic_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "evidence_projections_payload_length_check" CHECK(length("evidence_projections"."result_summary_json") <= 4000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_projections_identity_unique` ON `evidence_projections` (`id`);--> statement-breakpoint
CREATE INDEX `evidence_projections_source_idx` ON `evidence_projections` (`source_type`,`source_event_id`,`lifecycle`);--> statement-breakpoint
CREATE INDEX `evidence_projections_user_idx` ON `evidence_projections` (`user_id`,`lifecycle`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `evidence_projections_concept_idx` ON `evidence_projections` (`concept_id`,`lifecycle`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `evidence_recompute_requests` (
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
	`attempts` integer DEFAULT 0 NOT NULL,
	`claimed_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`concept_id`) REFERENCES `ontology_concepts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evidence_recompute_requests_type_check" CHECK("evidence_recompute_requests"."request_type" IN ('EVIDENCE_RECOMPUTE_REQUIRED', 'MASTERY_RECOMPUTE_REQUIRED')),
	CONSTRAINT "evidence_recompute_requests_scope_check" CHECK("evidence_recompute_requests"."scope_type" IN ('EVENT', 'USER', 'CONCEPT', 'FULL')),
	CONSTRAINT "evidence_recompute_requests_status_check" CHECK("evidence_recompute_requests"."status" IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
	CONSTRAINT "evidence_recompute_requests_hash_check" CHECK(length("evidence_recompute_requests"."input_semantic_hash") = 64 AND "evidence_recompute_requests"."input_semantic_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "evidence_recompute_requests_attempts_check" CHECK("evidence_recompute_requests"."attempts" >= 0),
	CONSTRAINT "evidence_recompute_requests_scope_values_check" CHECK(("evidence_recompute_requests"."scope_type" <> 'EVENT' OR ("evidence_recompute_requests"."source_type" IS NOT NULL AND "evidence_recompute_requests"."source_event_id" IS NOT NULL AND "evidence_recompute_requests"."source_revision_identity" IS NOT NULL)) AND ("evidence_recompute_requests"."scope_type" <> 'USER' OR "evidence_recompute_requests"."user_id" IS NOT NULL) AND ("evidence_recompute_requests"."scope_type" <> 'CONCEPT' OR "evidence_recompute_requests"."concept_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_recompute_requests_semantic_unique` ON `evidence_recompute_requests` (`request_type`,`input_semantic_hash`);--> statement-breakpoint
CREATE INDEX `evidence_recompute_requests_work_idx` ON `evidence_recompute_requests` (`status`,`request_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `evidence_recompute_requests_user_idx` ON `evidence_recompute_requests` (`user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `evidence_recompute_requests_concept_idx` ON `evidence_recompute_requests` (`concept_id`,`status`,`created_at`);