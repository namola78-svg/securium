CREATE TABLE `lecture_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lecture_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`lecture_id`) REFERENCES `lectures`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lecture_bookmarks_user_lecture_unique` ON `lecture_bookmarks` (`user_id`,`lecture_id`);--> statement-breakpoint
CREATE INDEX `lecture_bookmarks_user_recent_idx` ON `lecture_bookmarks` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lecture_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lecture_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`lecture_id`) REFERENCES `lectures`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "lecture_notes_content_length_check" CHECK(length("lecture_notes"."content") <= 4000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lecture_notes_user_lecture_unique` ON `lecture_notes` (`user_id`,`lecture_id`);--> statement-breakpoint
CREATE INDEX `lecture_notes_user_updated_idx` ON `lecture_notes` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `lecture_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lecture_id` text NOT NULL,
	`current_position_seconds` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`last_played_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`lecture_id`) REFERENCES `lectures`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "lecture_progress_position_check" CHECK("lecture_progress"."current_position_seconds" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lecture_progress_user_lecture_unique` ON `lecture_progress` (`user_id`,`lecture_id`);--> statement-breakpoint
CREATE INDEX `lecture_progress_user_recent_idx` ON `lecture_progress` (`user_id`,`last_played_at`);--> statement-breakpoint
CREATE INDEX `lecture_progress_lecture_completed_idx` ON `lecture_progress` (`lecture_id`,`completed`);--> statement-breakpoint
CREATE TABLE `lectures` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`title` text NOT NULL,
	`instructor_name` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`video_provider` text NOT NULL,
	`video_url` text NOT NULL,
	`thumbnail_url` text DEFAULT '' NOT NULL,
	`duration_seconds` integer NOT NULL,
	`free` integer DEFAULT false NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "lectures_duration_check" CHECK("lectures"."duration_seconds" > 0 AND "lectures"."duration_seconds" <= 86400),
	CONSTRAINT "lectures_display_order_check" CHECK("lectures"."display_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lectures_topic_order_unique` ON `lectures` (`topic_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `lectures_course_listing_idx` ON `lectures` (`course_id`,`published`,`display_order`);--> statement-breakpoint
CREATE INDEX `lectures_subject_listing_idx` ON `lectures` (`subject_id`,`published`,`display_order`);--> statement-breakpoint
CREATE INDEX `lectures_topic_listing_idx` ON `lectures` (`topic_id`,`published`,`display_order`);