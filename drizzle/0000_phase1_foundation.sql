CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`course_id` text,
	`request_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_target_idx` ON `audit_logs` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `course_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_groups_code_unique` ON `course_groups` (`code`);--> statement-breakpoint
CREATE INDEX `course_groups_listing_idx` ON `course_groups` (`active`,`deleted_at`,`display_order`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`course_group_id` text NOT NULL,
	`code` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`thumbnail_url` text,
	`total_levels` integer DEFAULT 1 NOT NULL,
	`passing_score` integer DEFAULT 60 NOT NULL,
	`difficulty` text DEFAULT 'BEGINNER' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_group_id`) REFERENCES `course_groups`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "courses_passing_score_check" CHECK("courses"."passing_score" >= 0 AND "courses"."passing_score" <= 100),
	CONSTRAINT "courses_total_levels_check" CHECK("courses"."total_levels" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_code_unique` ON `courses` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `courses_slug_unique` ON `courses` (`slug`);--> statement-breakpoint
CREATE INDEX `courses_group_idx` ON `courses` (`course_group_id`,`active`,`display_order`);--> statement-breakpoint
CREATE INDEX `courses_public_listing_idx` ON `courses` (`active`,`published`,`deleted_at`,`display_order`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_code_unique` ON `roles` (`code`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_course_code_unique` ON `subjects` (`course_id`,`code`);--> statement-breakpoint
CREATE INDEX `subjects_course_listing_idx` ON `subjects` (`course_id`,`active`,`deleted_at`,`display_order`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`parent_topic_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`parent_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_subject_code_unique` ON `topics` (`subject_id`,`code`);--> statement-breakpoint
CREATE INDEX `topics_subject_listing_idx` ON `topics` (`subject_id`,`active`,`deleted_at`,`display_order`);--> statement-breakpoint
CREATE INDEX `topics_parent_idx` ON `topics` (`parent_topic_id`);--> statement-breakpoint
CREATE TABLE `user_course_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`enrolled_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	`current_level` integer DEFAULT 1 NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`total_xp` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "enrollments_progress_check" CHECK("user_course_enrollments"."progress_percent" >= 0 AND "user_course_enrollments"."progress_percent" <= 100),
	CONSTRAINT "enrollments_status_check" CHECK("user_course_enrollments"."status" IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_user_course_unique` ON `user_course_enrollments` (`user_id`,`course_id`);--> statement-breakpoint
CREATE INDEX `enrollments_user_status_idx` ON `user_course_enrollments` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `enrollments_course_status_idx` ON `user_course_enrollments` (`course_id`,`status`);--> statement-breakpoint
CREATE TABLE `user_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`completed_lessons` integer DEFAULT 0 NOT NULL,
	`completed_questions` integer DEFAULT 0 NOT NULL,
	`correct_answers` integer DEFAULT 0 NOT NULL,
	`total_answers` integer DEFAULT 0 NOT NULL,
	`last_studied_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "user_progress_percent_check" CHECK("user_progress"."progress_percent" >= 0 AND "user_progress"."progress_percent" <= 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_progress_scope_unique` ON `user_progress` (`user_id`,`course_id`,`subject_id`,`topic_id`);--> statement-breakpoint
CREATE INDEX `user_progress_user_course_idx` ON `user_progress` (`user_id`,`course_id`,`last_studied_at`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`course_id` text,
	`granted_by` text,
	`granted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_roles_scope_unique` ON `user_roles` (`user_id`,`role_id`,`course_id`);--> statement-breakpoint
CREATE INDEX `user_roles_course_idx` ON `user_roles` (`course_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`last_signed_in_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);
