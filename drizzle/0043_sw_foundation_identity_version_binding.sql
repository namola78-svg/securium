CREATE TABLE `foundation_question_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`foundation_binding_key` text NOT NULL,
	`foundation_version` text NOT NULL,
	`foundation_question_id` text NOT NULL,
	`semantic_hash` text NOT NULL,
	`lifecycle_state` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`retired_at` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "foundation_question_bindings_identity_check" CHECK(length(trim("foundation_question_bindings"."foundation_binding_key")) > 0 AND length(trim("foundation_question_bindings"."foundation_version")) > 0 AND length(trim("foundation_question_bindings"."foundation_question_id")) > 0),
	CONSTRAINT "foundation_question_bindings_hash_check" CHECK(length("foundation_question_bindings"."semantic_hash") = 64 AND "foundation_question_bindings"."semantic_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "foundation_question_bindings_lifecycle_check" CHECK("foundation_question_bindings"."lifecycle_state" IN ('ACTIVE', 'RETIRED')),
	CONSTRAINT "foundation_question_bindings_retirement_check" CHECK("foundation_question_bindings"."lifecycle_state" <> 'RETIRED' OR "foundation_question_bindings"."retired_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `foundation_question_bindings_identity_unique` ON `foundation_question_bindings` (`foundation_binding_key`,`foundation_version`,`foundation_question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `foundation_question_bindings_id_course_unique` ON `foundation_question_bindings` (`id`,`course_id`);--> statement-breakpoint
CREATE INDEX `foundation_question_bindings_course_question_idx` ON `foundation_question_bindings` (`course_id`,`foundation_question_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_question_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text,
	`foundation_question_binding_id` text,
	`question_version_id` text,
	`concept_mapping_set_hash` text,
	`course_id` text NOT NULL,
	`mode` text DEFAULT 'LEARNING' NOT NULL,
	`exam_session_id` text,
	`selected_answer` text NOT NULL,
	`is_correct` integer NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`response_time` integer DEFAULT 0 NOT NULL,
	`attempted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`attempt_sequence` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`question_version_id`) REFERENCES `question_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`foundation_question_binding_id`,`course_id`) REFERENCES `foundation_question_bindings`(`id`,`course_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "question_attempts_score_check" CHECK("__new_question_attempts"."score" >= 0 AND "__new_question_attempts"."score" <= 100),
	CONSTRAINT "question_attempts_response_time_check" CHECK("__new_question_attempts"."response_time" >= 0),
	CONSTRAINT "question_attempts_attempt_sequence_check" CHECK("__new_question_attempts"."attempt_sequence" IS NULL OR "__new_question_attempts"."attempt_sequence" >= 1),
	CONSTRAINT "question_attempts_mode_check" CHECK("__new_question_attempts"."mode" IN ('LEARNING', 'EXAM')),
	CONSTRAINT "question_attempts_version_binding_check" CHECK(("__new_question_attempts"."question_version_id" IS NULL AND "__new_question_attempts"."concept_mapping_set_hash" IS NULL) OR ("__new_question_attempts"."question_version_id" IS NOT NULL AND length("__new_question_attempts"."concept_mapping_set_hash") = 64 AND "__new_question_attempts"."concept_mapping_set_hash" NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "question_attempts_identity_path_check" CHECK(("__new_question_attempts"."question_id" IS NOT NULL AND "__new_question_attempts"."foundation_question_binding_id" IS NULL) OR ("__new_question_attempts"."question_id" IS NULL AND "__new_question_attempts"."foundation_question_binding_id" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_question_attempts`("id", "idempotency_key", "user_id", "question_id", "foundation_question_binding_id", "question_version_id", "concept_mapping_set_hash", "course_id", "mode", "exam_session_id", "selected_answer", "is_correct", "score", "response_time", "attempted_at", "attempt_sequence") SELECT "id", "idempotency_key", "user_id", "question_id", NULL, "question_version_id", "concept_mapping_set_hash", "course_id", "mode", "exam_session_id", "selected_answer", "is_correct", "score", "response_time", "attempted_at", "attempt_sequence" FROM `question_attempts`;--> statement-breakpoint
DROP TABLE `question_attempts`;--> statement-breakpoint
ALTER TABLE `__new_question_attempts` RENAME TO `question_attempts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `question_attempts_idempotency_unique` ON `question_attempts` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `question_attempts_user_course_idx` ON `question_attempts` (`user_id`,`course_id`,`attempted_at`);--> statement-breakpoint
CREATE INDEX `question_attempts_user_course_question_idx` ON `question_attempts` (`user_id`,`course_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `question_attempts_foundation_binding_idx` ON `question_attempts` (`course_id`,`foundation_question_binding_id`);--> statement-breakpoint
CREATE INDEX `question_attempts_question_idx` ON `question_attempts` (`question_id`,`attempted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `question_attempts_partition_sequence_unique` ON `question_attempts` (`user_id`,`course_id`,`question_id`,`attempt_sequence`) WHERE "question_attempts"."attempt_sequence" IS NOT NULL;
