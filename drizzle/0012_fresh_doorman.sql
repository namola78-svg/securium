CREATE TABLE `content_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`content_id` text NOT NULL,
	`course_id` text,
	`title` text NOT NULL,
	`content_date` text NOT NULL,
	`version` text NOT NULL,
	`revision_status` text DEFAULT 'draft' NOT NULL,
	`snapshot_json` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	`published_at` text,
	`superseded_at` text,
	`change_summary` text DEFAULT '' NOT NULL,
	`previous_version_id` text,
	`is_latest` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`previous_version_id`) REFERENCES `content_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "content_revisions_type_check" CHECK("content_revisions"."content_type" IN ('LEGAL_ARTICLE', 'ISMS_STANDARD', 'PRIVACY_IMPACT_ITEM', 'SUBJECT', 'SECURE_CODING_WEAKNESS', 'LEARNING_UNIT', 'LESSON', 'QUESTION_EXPLANATION', 'AUDIO_CONTENT', 'LECTURE')),
	CONSTRAINT "content_revisions_status_check" CHECK("content_revisions"."revision_status" IN ('draft', 'review', 'published', 'superseded', 'archived')),
	CONSTRAINT "content_revisions_latest_status_check" CHECK("content_revisions"."is_latest" = 0 OR "content_revisions"."revision_status" = 'published'),
	CONSTRAINT "content_revisions_snapshot_length_check" CHECK(length("content_revisions"."snapshot_json") <= 100000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_revisions_identity_version_unique` ON `content_revisions` (`content_type`,`content_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_revisions_single_latest_unique` ON `content_revisions` (`content_type`,`content_id`) WHERE "content_revisions"."is_latest" = 1;--> statement-breakpoint
CREATE INDEX `content_revisions_public_idx` ON `content_revisions` (`content_type`,`content_id`,`revision_status`,`is_latest`);--> statement-breakpoint
CREATE INDEX `content_revisions_course_idx` ON `content_revisions` (`course_id`,`revision_status`,`content_date`);--> statement-breakpoint
CREATE INDEX `content_revisions_previous_idx` ON `content_revisions` (`previous_version_id`);