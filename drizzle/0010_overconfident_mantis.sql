CREATE TABLE `audio_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`title` text NOT NULL,
	`audio_url` text DEFAULT '' NOT NULL,
	`transcript` text DEFAULT '' NOT NULL,
	`transcript_segments_json` text DEFAULT '[]' NOT NULL,
	`duration_seconds` integer NOT NULL,
	`voice_provider` text DEFAULT '' NOT NULL,
	`voice_name` text DEFAULT '' NOT NULL,
	`speed_options_json` text DEFAULT '[0.75,1,1.25,1.5,2]' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "audio_contents_duration_check" CHECK("audio_contents"."duration_seconds" > 0 AND "audio_contents"."duration_seconds" <= 86400)
);
--> statement-breakpoint
CREATE INDEX `audio_contents_lesson_listing_idx` ON `audio_contents` (`lesson_id`,`published`,`created_at`);--> statement-breakpoint
CREATE TABLE `audio_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`audio_content_id` text NOT NULL,
	`current_position_seconds` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`last_played_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`audio_content_id`) REFERENCES `audio_contents`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "audio_progress_position_check" CHECK("audio_progress"."current_position_seconds" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audio_progress_user_content_unique` ON `audio_progress` (`user_id`,`audio_content_id`);--> statement-breakpoint
CREATE INDEX `audio_progress_user_recent_idx` ON `audio_progress` (`user_id`,`last_played_at`);--> statement-breakpoint
CREATE INDEX `audio_progress_content_completed_idx` ON `audio_progress` (`audio_content_id`,`completed`);