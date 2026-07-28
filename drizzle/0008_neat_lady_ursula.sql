CREATE TABLE `ai_generation_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`question_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`generated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`source_context_ids_json` text DEFAULT '[]' NOT NULL,
	`disclaimer` text NOT NULL,
	`reviewed` integer DEFAULT false NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`request_id` text NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`result_json` text DEFAULT '{}' NOT NULL,
	`error_code` text,
	`prompt_fingerprint` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_micros` integer DEFAULT 0 NOT NULL,
	`retention_until` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ai_generation_records_provider_check" CHECK("ai_generation_records"."provider" IN ('mock', 'openai')),
	CONSTRAINT "ai_generation_records_status_check" CHECK("ai_generation_records"."status" IN ('generated', 'failed', 'insufficient_context', 'reviewed', 'rejected')),
	CONSTRAINT "ai_generation_records_nonnegative_check" CHECK("ai_generation_records"."latency_ms" >= 0 AND "ai_generation_records"."input_tokens" >= 0 AND "ai_generation_records"."output_tokens" >= 0 AND "ai_generation_records"."estimated_cost_micros" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_generation_records_request_unique` ON `ai_generation_records` (`request_id`);--> statement-breakpoint
CREATE INDEX `ai_generation_records_user_course_idx` ON `ai_generation_records` (`user_id`,`course_id`,`generated_at`);--> statement-breakpoint
CREATE INDEX `ai_generation_records_question_idx` ON `ai_generation_records` (`question_id`,`generated_at`);--> statement-breakpoint
CREATE INDEX `ai_generation_records_status_idx` ON `ai_generation_records` (`status`,`generated_at`);