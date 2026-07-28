CREATE TABLE `level_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`level_id` text NOT NULL,
	`content_type` text NOT NULL,
	`content_id` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "level_contents_type_check" CHECK("level_contents"."content_type" IN ('QUESTION', 'SUBJECT', 'TOPIC', 'CONTENT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `level_contents_unique` ON `level_contents` (`level_id`,`content_type`,`content_id`);--> statement-breakpoint
CREATE INDEX `level_contents_level_idx` ON `level_contents` (`level_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `levels` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`code` text NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`passing_score` integer DEFAULT 60 NOT NULL,
	`required_level_id` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`required_level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "levels_number_check" CHECK("levels"."number" > 0),
	CONSTRAINT "levels_passing_score_check" CHECK("levels"."passing_score" >= 0 AND "levels"."passing_score" <= 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `levels_course_code_unique` ON `levels` (`course_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `levels_course_number_unique` ON `levels` (`course_id`,`number`);--> statement-breakpoint
CREATE INDEX `levels_course_listing_idx` ON `levels` (`course_id`,`active`,`published`,`display_order`);--> statement-breakpoint
CREATE TABLE `mock_exam_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`answer_data` text DEFAULT '' NOT NULL,
	`is_correct` integer,
	`score` integer,
	`answered_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `mock_exam_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mock_exam_answers_attempt_question_unique` ON `mock_exam_answers` (`attempt_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `mock_exam_answers_attempt_idx` ON `mock_exam_answers` (`attempt_id`,`answered_at`);--> statement-breakpoint
CREATE TABLE `mock_exam_attempts` (
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
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`mock_exam_id`) REFERENCES `mock_exams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "mock_exam_attempts_status_check" CHECK("mock_exam_attempts"."status" IN ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'CANCELLED')),
	CONSTRAINT "mock_exam_attempts_score_check" CHECK("mock_exam_attempts"."score" >= 0 AND "mock_exam_attempts"."score" <= 100)
);
--> statement-breakpoint
CREATE INDEX `mock_exam_attempts_user_exam_idx` ON `mock_exam_attempts` (`user_id`,`mock_exam_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `mock_exam_attempts_status_expiry_idx` ON `mock_exam_attempts` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `mock_exam_questions` (
	`mock_exam_id` text NOT NULL,
	`question_id` text NOT NULL,
	`section_id` text,
	`score` integer DEFAULT 10 NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`mock_exam_id`) REFERENCES `mock_exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`section_id`) REFERENCES `mock_exam_sections`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mock_exam_questions_unique` ON `mock_exam_questions` (`mock_exam_id`,`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `mock_exam_questions_order_unique` ON `mock_exam_questions` (`mock_exam_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `mock_exam_questions_section_idx` ON `mock_exam_questions` (`section_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `mock_exam_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`mock_exam_id` text NOT NULL,
	`subject_id` text,
	`title` text NOT NULL,
	`question_count` integer NOT NULL,
	`score_weight` integer DEFAULT 100 NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`mock_exam_id`) REFERENCES `mock_exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mock_exam_sections_order_unique` ON `mock_exam_sections` (`mock_exam_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `mock_exam_sections_exam_idx` ON `mock_exam_sections` (`mock_exam_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `mock_exams` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`exam_type` text DEFAULT 'QUICK' NOT NULL,
	`question_count` integer NOT NULL,
	`time_limit_minutes` integer NOT NULL,
	`passing_score` integer DEFAULT 60 NOT NULL,
	`start_at` text,
	`end_at` text,
	`result_open_at` text,
	`max_attempts` integer DEFAULT 1 NOT NULL,
	`randomize_questions` integer DEFAULT true NOT NULL,
	`randomize_choices` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "mock_exams_type_check" CHECK("mock_exams"."exam_type" IN ('QUICK', 'SUBJECT', 'REALISTIC', 'WRONG_ANSWER', 'WEAK_AREA', 'MANAGED')),
	CONSTRAINT "mock_exams_status_check" CHECK("mock_exams"."status" IN ('DRAFT', 'READY', 'OPEN', 'CLOSED', 'ARCHIVED')),
	CONSTRAINT "mock_exams_score_check" CHECK("mock_exams"."passing_score" >= 0 AND "mock_exams"."passing_score" <= 100),
	CONSTRAINT "mock_exams_limits_check" CHECK("mock_exams"."question_count" > 0 AND "mock_exams"."time_limit_minutes" > 0 AND "mock_exams"."max_attempts" > 0)
);
--> statement-breakpoint
CREATE INDEX `mock_exams_course_public_idx` ON `mock_exams` (`course_id`,`published`,`status`,`start_at`,`end_at`);--> statement-breakpoint
CREATE TABLE `review_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`last_reviewed_at` text,
	`next_review_at` text NOT NULL,
	`interval_days` integer DEFAULT 0 NOT NULL,
	`ease_factor` integer DEFAULT 250 NOT NULL,
	`consecutive_correct` integer DEFAULT 0 NOT NULL,
	`consecutive_wrong` integer DEFAULT 0 NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'DUE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "review_schedules_target_check" CHECK("review_schedules"."target_type" IN ('QUESTION', 'TOPIC', 'CONTENT', 'MOCK_EXAM_QUESTION')),
	CONSTRAINT "review_schedules_status_check" CHECK("review_schedules"."status" IN ('DUE', 'SCHEDULED', 'PAUSED', 'MASTERED')),
	CONSTRAINT "review_schedules_interval_check" CHECK("review_schedules"."interval_days" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_schedules_user_target_course_unique` ON `review_schedules` (`user_id`,`course_id`,`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `review_schedules_due_idx` ON `review_schedules` (`user_id`,`status`,`next_review_at`);--> statement-breakpoint
CREATE INDEX `review_schedules_course_idx` ON `review_schedules` (`user_id`,`course_id`,`next_review_at`);--> statement-breakpoint
CREATE TABLE `user_learning_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`daily_question_goal` integer DEFAULT 20 NOT NULL,
	`daily_study_minutes` integer DEFAULT 30 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "user_learning_settings_goal_check" CHECK("user_learning_settings"."daily_question_goal" > 0 AND "user_learning_settings"."daily_question_goal" <= 500 AND "user_learning_settings"."daily_study_minutes" > 0 AND "user_learning_settings"."daily_study_minutes" <= 1440)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_learning_settings_user_unique` ON `user_learning_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_level_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`level_id` text NOT NULL,
	`status` text DEFAULT 'LOCKED' NOT NULL,
	`best_score` integer DEFAULT 0 NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`mastered_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "user_level_progress_status_check" CHECK("user_level_progress"."status" IN ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'MASTERED')),
	CONSTRAINT "user_level_progress_score_check" CHECK("user_level_progress"."best_score" >= 0 AND "user_level_progress"."best_score" <= 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_level_progress_unique` ON `user_level_progress` (`user_id`,`course_id`,`level_id`);--> statement-breakpoint
CREATE INDEX `user_level_progress_user_course_idx` ON `user_level_progress` (`user_id`,`course_id`,`status`);