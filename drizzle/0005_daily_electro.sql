CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`content_format` text DEFAULT 'PLAIN_TEXT' NOT NULL,
	`estimated_minutes` integer DEFAULT 10 NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "lessons_content_format_check" CHECK("lessons"."content_format" IN ('PLAIN_TEXT', 'MARKDOWN')),
	CONSTRAINT "lessons_estimated_minutes_check" CHECK("lessons"."estimated_minutes" > 0 AND "lessons"."estimated_minutes" <= 1440),
	CONSTRAINT "lessons_version_check" CHECK("lessons"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_topic_code_unique` ON `lessons` (`topic_id`,`code`);--> statement-breakpoint
CREATE INDEX `lessons_course_listing_idx` ON `lessons` (`course_id`,`active`,`published`,`deleted_at`,`display_order`);--> statement-breakpoint
CREATE INDEX `lessons_subject_listing_idx` ON `lessons` (`subject_id`,`active`,`published`,`display_order`);--> statement-breakpoint
CREATE INDEX `lessons_topic_listing_idx` ON `lessons` (`topic_id`,`active`,`published`,`display_order`);--> statement-breakpoint
CREATE TABLE `user_lesson_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`status` text DEFAULT 'IN_PROGRESS' NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`last_studied_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "user_lesson_progress_status_check" CHECK("user_lesson_progress"."status" IN ('IN_PROGRESS', 'COMPLETED')),
	CONSTRAINT "user_lesson_progress_percent_check" CHECK("user_lesson_progress"."progress_percent" >= 0 AND "user_lesson_progress"."progress_percent" <= 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_lesson_progress_unique` ON `user_lesson_progress` (`user_id`,`lesson_id`);--> statement-breakpoint
CREATE INDEX `user_lesson_progress_user_course_idx` ON `user_lesson_progress` (`user_id`,`course_id`,`status`,`last_studied_at`);--> statement-breakpoint
CREATE INDEX `user_lesson_progress_lesson_idx` ON `user_lesson_progress` (`lesson_id`,`status`);