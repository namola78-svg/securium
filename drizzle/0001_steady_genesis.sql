CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`course_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "bookmarks_target_type_check" CHECK("bookmarks"."target_type" IN ('QUESTION', 'TOPIC', 'SUBJECT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmarks_user_target_course_unique` ON `bookmarks` (`user_id`,`target_type`,`target_id`,`course_id`);--> statement-breakpoint
CREATE INDEX `bookmarks_user_course_idx` ON `bookmarks` (`user_id`,`course_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `learning_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`activity_type` text NOT NULL,
	`target_id` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `learning_activities_user_course_idx` ON `learning_activities` (`user_id`,`course_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `question_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`course_id` text NOT NULL,
	`selected_answer` text NOT NULL,
	`is_correct` integer NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`response_time` integer DEFAULT 0 NOT NULL,
	`attempted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "question_attempts_score_check" CHECK("question_attempts"."score" >= 0 AND "question_attempts"."score" <= 100),
	CONSTRAINT "question_attempts_response_time_check" CHECK("question_attempts"."response_time" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_attempts_idempotency_unique` ON `question_attempts` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `question_attempts_user_course_idx` ON `question_attempts` (`user_id`,`course_id`,`attempted_at`);--> statement-breakpoint
CREATE INDEX `question_attempts_question_idx` ON `question_attempts` (`question_id`,`attempted_at`);--> statement-breakpoint
CREATE TABLE `question_choices` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`content` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_correct` integer DEFAULT false NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_choices_order_unique` ON `question_choices` (`question_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `question_choices_question_idx` ON `question_choices` (`question_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `question_courses` (
	`question_id` text NOT NULL,
	`course_id` text NOT NULL,
	`weight` integer DEFAULT 100 NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "question_courses_weight_check" CHECK("question_courses"."weight" >= 0 AND "question_courses"."weight" <= 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_courses_unique` ON `question_courses` (`question_id`,`course_id`);--> statement-breakpoint
CREATE INDEX `question_courses_course_idx` ON `question_courses` (`course_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `question_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`reason` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`resolution_note` text DEFAULT '' NOT NULL,
	`handled_by` text,
	`handled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "question_reports_reason_check" CHECK("question_reports"."reason" IN ('WRONG_ANSWER', 'WRONG_EXPLANATION', 'TYPO', 'OUTDATED_STANDARD', 'DUPLICATE', 'OTHER')),
	CONSTRAINT "question_reports_status_check" CHECK("question_reports"."status" IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'))
);
--> statement-breakpoint
CREATE INDEX `question_reports_status_idx` ON `question_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `question_reports_question_idx` ON `question_reports` (`question_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `question_subjects` (
	`question_id` text NOT NULL,
	`subject_id` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_subjects_unique` ON `question_subjects` (`question_id`,`subject_id`);--> statement-breakpoint
CREATE INDEX `question_subjects_subject_idx` ON `question_subjects` (`subject_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `question_topics` (
	`question_id` text NOT NULL,
	`topic_id` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_topics_unique` ON `question_topics` (`question_id`,`topic_id`);--> statement-breakpoint
CREATE INDEX `question_topics_topic_idx` ON `question_topics` (`topic_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `question_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`review_comment` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_versions_unique` ON `question_versions` (`question_id`,`version`);--> statement-breakpoint
CREATE INDEX `question_versions_history_idx` ON `question_versions` (`question_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`type` text NOT NULL,
	`difficulty` text DEFAULT 'MEDIUM' NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	`wrong_answer_explanation` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`source` text,
	`source_date` text,
	`version` integer DEFAULT 1 NOT NULL,
	`answer_config_json` text DEFAULT '{}' NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`reviewed_by` text,
	`published_at` text,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "questions_type_check" CHECK("questions"."type" IN ('TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ESSAY', 'ORDERING', 'FILL_BLANK', 'CASE_ANALYSIS', 'CODE_ANALYSIS', 'LOG_ANALYSIS', 'CALCULATION')),
	CONSTRAINT "questions_status_check" CHECK("questions"."status" IN ('DRAFT', 'REVIEW_REQUESTED', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED')),
	CONSTRAINT "questions_difficulty_check" CHECK("questions"."difficulty" IN ('EASY', 'MEDIUM', 'HARD')),
	CONSTRAINT "questions_version_check" CHECK("questions"."version" > 0)
);
--> statement-breakpoint
CREATE INDEX `questions_public_idx` ON `questions` (`status`,`difficulty`,`published_at`);--> statement-breakpoint
CREATE INDEX `questions_author_idx` ON `questions` (`created_by`,`status`);--> statement-breakpoint
CREATE INDEX `questions_reviewer_idx` ON `questions` (`reviewed_by`,`status`);--> statement-breakpoint
CREATE TABLE `wrong_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`course_id` text NOT NULL,
	`last_attempt_id` text NOT NULL,
	`wrong_count` integer DEFAULT 1 NOT NULL,
	`mastered` integer DEFAULT false NOT NULL,
	`user_memo` text DEFAULT '' NOT NULL,
	`last_reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`last_attempt_id`) REFERENCES `question_attempts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "wrong_notes_count_check" CHECK("wrong_notes"."wrong_count" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wrong_notes_user_question_course_unique` ON `wrong_notes` (`user_id`,`question_id`,`course_id`);--> statement-breakpoint
CREATE INDEX `wrong_notes_user_course_idx` ON `wrong_notes` (`user_id`,`course_id`,`mastered`,`updated_at`);