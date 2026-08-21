CREATE TABLE `learning_event_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_event_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`previous_revision_id` text,
	`action` text NOT NULL,
	`reason_code` text NOT NULL,
	`payload_schema_version` integer DEFAULT 1 NOT NULL,
	`correction_payload_json` text DEFAULT '{}' NOT NULL,
	`semantic_hash` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`previous_revision_id`) REFERENCES `learning_event_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "learning_event_revisions_source_check" CHECK("learning_event_revisions"."source_type" IN ('QUESTION_ATTEMPT', 'MOCK_ATTEMPT', 'MOCK_ITEM_RESULT', 'PRACTICAL_ATTEMPT', 'PRACTICAL_EVALUATION', 'LESSON_PROGRESS', 'COURSE_LESSON_PROGRESS', 'LECTURE_PROGRESS', 'AUDIO_PROGRESS')),
	CONSTRAINT "learning_event_revisions_action_check" CHECK("learning_event_revisions"."action" IN ('CORRECT', 'INVALIDATE', 'RESTORE_ELIGIBILITY', 'CORRECT_CONCEPT_MAPPING')),
	CONSTRAINT "learning_event_revisions_sequence_check" CHECK("learning_event_revisions"."sequence" > 0),
	CONSTRAINT "learning_event_revisions_payload_version_check" CHECK("learning_event_revisions"."payload_schema_version" > 0),
	CONSTRAINT "learning_event_revisions_payload_length_check" CHECK(length("learning_event_revisions"."correction_payload_json") <= 20000),
	CONSTRAINT "learning_event_revisions_hash_check" CHECK(length("learning_event_revisions"."semantic_hash") = 64 AND "learning_event_revisions"."semantic_hash" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_event_revisions_sequence_unique` ON `learning_event_revisions` (`source_type`,`source_event_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `learning_event_revisions_semantic_unique` ON `learning_event_revisions` (`source_type`,`source_event_id`,`semantic_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `learning_event_revisions_predecessor_unique` ON `learning_event_revisions` (`previous_revision_id`) WHERE "learning_event_revisions"."previous_revision_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `learning_event_revisions_source_idx` ON `learning_event_revisions` (`source_type`,`source_event_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `learning_event_revisions_actor_idx` ON `learning_event_revisions` (`actor_user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `audio_progress` ADD `content_revision_id` text REFERENCES content_revisions(id);--> statement-breakpoint
ALTER TABLE `lecture_progress` ADD `content_revision_id` text REFERENCES content_revisions(id);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mock_exam_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`question_version_id` text,
	`concept_mapping_set_hash` text,
	`answer_data` text DEFAULT '' NOT NULL,
	`is_correct` integer,
	`score` integer,
	`answered_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `mock_exam_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`question_version_id`) REFERENCES `question_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "mock_exam_answers_version_binding_check" CHECK(("__new_mock_exam_answers"."question_version_id" IS NULL AND "__new_mock_exam_answers"."concept_mapping_set_hash" IS NULL) OR ("__new_mock_exam_answers"."question_version_id" IS NOT NULL AND length("__new_mock_exam_answers"."concept_mapping_set_hash") = 64 AND "__new_mock_exam_answers"."concept_mapping_set_hash" NOT GLOB '*[^0-9a-f]*'))
);
--> statement-breakpoint
INSERT INTO `__new_mock_exam_answers`("id", "attempt_id", "question_id", "question_version_id", "concept_mapping_set_hash", "answer_data", "is_correct", "score", "answered_at", "created_at", "updated_at") SELECT "id", "attempt_id", "question_id", NULL, NULL, "answer_data", "is_correct", "score", "answered_at", "created_at", "updated_at" FROM `mock_exam_answers`;--> statement-breakpoint
DROP TABLE `mock_exam_answers`;--> statement-breakpoint
ALTER TABLE `__new_mock_exam_answers` RENAME TO `mock_exam_answers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `mock_exam_answers_attempt_question_unique` ON `mock_exam_answers` (`attempt_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `mock_exam_answers_attempt_idx` ON `mock_exam_answers` (`attempt_id`,`answered_at`);--> statement-breakpoint
CREATE TABLE `__new_mock_exam_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`mock_exam_id` text NOT NULL,
	`user_id` text NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	`submitted_at` text,
	`status` text DEFAULT 'IN_PROGRESS' NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`wrong_count` integer DEFAULT 0 NOT NULL,
	`unanswered_count` integer DEFAULT 0 NOT NULL,
	`composition_semantic_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`mock_exam_id`) REFERENCES `mock_exams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "mock_exam_attempts_status_check" CHECK("__new_mock_exam_attempts"."status" IN ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'CANCELLED')),
	CONSTRAINT "mock_exam_attempts_score_check" CHECK("__new_mock_exam_attempts"."score" >= 0 AND "__new_mock_exam_attempts"."score" <= 100),
	CONSTRAINT "mock_exam_attempts_composition_hash_check" CHECK("__new_mock_exam_attempts"."composition_semantic_hash" IS NULL OR (length("__new_mock_exam_attempts"."composition_semantic_hash") = 64 AND "__new_mock_exam_attempts"."composition_semantic_hash" NOT GLOB '*[^0-9a-f]*'))
);
--> statement-breakpoint
INSERT INTO `__new_mock_exam_attempts`("id", "mock_exam_id", "user_id", "started_at", "expires_at", "submitted_at", "status", "score", "correct_count", "wrong_count", "unanswered_count", "composition_semantic_hash", "created_at", "updated_at") SELECT "id", "mock_exam_id", "user_id", "started_at", "expires_at", "submitted_at", "status", "score", "correct_count", "wrong_count", "unanswered_count", NULL, "created_at", "updated_at" FROM `mock_exam_attempts`;--> statement-breakpoint
DROP TABLE `mock_exam_attempts`;--> statement-breakpoint
ALTER TABLE `__new_mock_exam_attempts` RENAME TO `mock_exam_attempts`;--> statement-breakpoint
CREATE INDEX `mock_exam_attempts_user_exam_idx` ON `mock_exam_attempts` (`user_id`,`mock_exam_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `mock_exam_attempts_status_expiry_idx` ON `mock_exam_attempts` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `__new_question_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`question_version_id`) REFERENCES `question_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "question_attempts_score_check" CHECK("__new_question_attempts"."score" >= 0 AND "__new_question_attempts"."score" <= 100),
	CONSTRAINT "question_attempts_response_time_check" CHECK("__new_question_attempts"."response_time" >= 0),
	CONSTRAINT "question_attempts_mode_check" CHECK("__new_question_attempts"."mode" IN ('LEARNING', 'EXAM')),
	CONSTRAINT "question_attempts_version_binding_check" CHECK(("__new_question_attempts"."question_version_id" IS NULL AND "__new_question_attempts"."concept_mapping_set_hash" IS NULL) OR ("__new_question_attempts"."question_version_id" IS NOT NULL AND length("__new_question_attempts"."concept_mapping_set_hash") = 64 AND "__new_question_attempts"."concept_mapping_set_hash" NOT GLOB '*[^0-9a-f]*'))
);
--> statement-breakpoint
INSERT INTO `__new_question_attempts`("id", "idempotency_key", "user_id", "question_id", "question_version_id", "concept_mapping_set_hash", "course_id", "mode", "exam_session_id", "selected_answer", "is_correct", "score", "response_time", "attempted_at") SELECT "id", "idempotency_key", "user_id", "question_id", NULL, NULL, "course_id", "mode", "exam_session_id", "selected_answer", "is_correct", "score", "response_time", "attempted_at" FROM `question_attempts`;--> statement-breakpoint
DROP TABLE `question_attempts`;--> statement-breakpoint
ALTER TABLE `__new_question_attempts` RENAME TO `question_attempts`;--> statement-breakpoint
CREATE UNIQUE INDEX `question_attempts_idempotency_unique` ON `question_attempts` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `question_attempts_user_course_idx` ON `question_attempts` (`user_id`,`course_id`,`attempted_at`);--> statement-breakpoint
CREATE INDEX `question_attempts_user_course_question_idx` ON `question_attempts` (`user_id`,`course_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `question_attempts_question_idx` ON `question_attempts` (`question_id`,`attempted_at`);--> statement-breakpoint
ALTER TABLE `user_course_lesson_progress` ADD `content_version` text;--> statement-breakpoint
ALTER TABLE `user_lesson_progress` ADD `content_version` integer;
