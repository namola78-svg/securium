CREATE TABLE `ai_reviewed_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_id` text NOT NULL,
	`course_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`title` text NOT NULL,
	`content_json` text NOT NULL,
	`created_by` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`generation_id`) REFERENCES `ai_specialized_generation_records`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_reviewed_contents_generation_unique` ON `ai_reviewed_contents` (`generation_id`);--> statement-breakpoint
CREATE INDEX `ai_reviewed_contents_course_idx` ON `ai_reviewed_contents` (`course_id`,`active`,`updated_at`);--> statement-breakpoint
CREATE TABLE `ai_specialized_generation_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`generated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`source_context_ids_json` text DEFAULT '[]' NOT NULL,
	`disclaimer` text NOT NULL,
	`request_id` text NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`generation_status` text NOT NULL,
	`review_status` text DEFAULT 'PENDING' NOT NULL,
	`original_result_json` text DEFAULT '{}' NOT NULL,
	`error_code` text,
	`input_fingerprint` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_micros` integer DEFAULT 0 NOT NULL,
	`retention_until` text,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ai_specialized_records_target_check" CHECK("ai_specialized_generation_records"."target_type" IN ('WRITTEN_ANSWER', 'RISK_SCENARIO', 'PRIVACY_ASSESSMENT', 'SECURE_CODE')),
	CONSTRAINT "ai_specialized_records_provider_check" CHECK("ai_specialized_generation_records"."provider" IN ('mock', 'openai')),
	CONSTRAINT "ai_specialized_records_generation_status_check" CHECK("ai_specialized_generation_records"."generation_status" IN ('generated', 'failed', 'insufficient_context', 'reviewed', 'rejected')),
	CONSTRAINT "ai_specialized_records_review_status_check" CHECK("ai_specialized_generation_records"."review_status" IN ('PENDING', 'REVIEWED', 'APPROVED_WITH_EDITS', 'REJECTED', 'DELETED', 'COPIED')),
	CONSTRAINT "ai_specialized_records_nonnegative_check" CHECK("ai_specialized_generation_records"."latency_ms" >= 0 AND "ai_specialized_generation_records"."input_tokens" >= 0 AND "ai_specialized_generation_records"."output_tokens" >= 0 AND "ai_specialized_generation_records"."estimated_cost_micros" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_specialized_records_request_unique` ON `ai_specialized_generation_records` (`request_id`);--> statement-breakpoint
CREATE INDEX `ai_specialized_records_user_idx` ON `ai_specialized_generation_records` (`user_id`,`course_id`,`generated_at`);--> statement-breakpoint
CREATE INDEX `ai_specialized_records_target_idx` ON `ai_specialized_generation_records` (`target_type`,`target_id`,`generated_at`);--> statement-breakpoint
CREATE INDEX `ai_specialized_records_review_idx` ON `ai_specialized_generation_records` (`review_status`,`deleted_at`,`generated_at`);--> statement-breakpoint
CREATE TABLE `ai_specialized_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`revision` integer NOT NULL,
	`action` text NOT NULL,
	`edited_result_json` text DEFAULT '{}' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`generation_id`) REFERENCES `ai_specialized_generation_records`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ai_specialized_reviews_action_check" CHECK("ai_specialized_reviews"."action" IN ('REVIEWED', 'APPROVED_WITH_EDITS', 'REJECTED', 'DELETED', 'COPIED')),
	CONSTRAINT "ai_specialized_reviews_revision_check" CHECK("ai_specialized_reviews"."revision" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_specialized_reviews_revision_unique` ON `ai_specialized_reviews` (`generation_id`,`revision`);--> statement-breakpoint
CREATE INDEX `ai_specialized_reviews_reviewer_idx` ON `ai_specialized_reviews` (`reviewer_id`,`created_at`);