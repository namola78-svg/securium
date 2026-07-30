CREATE TABLE `contents` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`canonical_key` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`body_format` text DEFAULT 'MARKDOWN' NOT NULL,
	`learning_objectives_json` text DEFAULT '[]' NOT NULL,
	`core_concepts_json` text DEFAULT '[]' NOT NULL,
	`practical_examples_json` text DEFAULT '[]' NOT NULL,
	`diagrams_json` text DEFAULT '[]' NOT NULL,
	`media_json` text DEFAULT '[]' NOT NULL,
	`version` text DEFAULT '1.0.0' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_by` text,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "contents_status_check" CHECK("contents"."status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
	CONSTRAINT "contents_body_format_check" CHECK("contents"."body_format" IN ('MARKDOWN', 'STRUCTURED_JSON', 'PLAIN_TEXT')),
	CONSTRAINT "contents_body_length_check" CHECK(length("contents"."body") <= 200000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contents_slug_unique` ON `contents` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `contents_canonical_key_unique` ON `contents` (`canonical_key`);--> statement-breakpoint
CREATE INDEX `contents_status_idx` ON `contents` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `course_lesson_extensions` (
	`id` text PRIMARY KEY NOT NULL,
	`course_lesson_id` text NOT NULL,
	`learning_objectives_override_json` text,
	`additional_body` text,
	`exam_points_json` text DEFAULT '[]' NOT NULL,
	`practical_notes` text DEFAULT '' NOT NULL,
	`legal_notes` text DEFAULT '' NOT NULL,
	`standard_notes` text DEFAULT '' NOT NULL,
	`evidence_notes` text DEFAULT '' NOT NULL,
	`common_mistakes` text DEFAULT '' NOT NULL,
	`instructor_notes` text DEFAULT '' NOT NULL,
	`version` text DEFAULT '1.0.0' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_lesson_id`) REFERENCES `course_lessons`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "course_lesson_extensions_status_check" CHECK("course_lesson_extensions"."status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
	CONSTRAINT "course_lesson_extensions_additional_body_length_check" CHECK("course_lesson_extensions"."additional_body" IS NULL OR length("course_lesson_extensions"."additional_body") <= 100000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_lesson_extensions_lesson_unique` ON `course_lesson_extensions` (`course_lesson_id`);--> statement-breakpoint
CREATE INDEX `course_lesson_extensions_status_idx` ON `course_lesson_extensions` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `course_lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`curriculum_node_id` text,
	`content_id` text NOT NULL,
	`display_title` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`difficulty` text,
	`importance` integer,
	`estimated_minutes` integer DEFAULT 10 NOT NULL,
	`is_required` integer DEFAULT true NOT NULL,
	`completion_rule` text DEFAULT 'MANUAL' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`curriculum_node_id`) REFERENCES `curriculum_nodes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "course_lessons_status_check" CHECK("course_lessons"."status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
	CONSTRAINT "course_lessons_completion_rule_check" CHECK("course_lessons"."completion_rule" IN ('MANUAL', 'SCROLL_END', 'MINIMUM_REQUIREMENTS')),
	CONSTRAINT "course_lessons_estimated_minutes_check" CHECK("course_lessons"."estimated_minutes" > 0 AND "course_lessons"."estimated_minutes" <= 1440),
	CONSTRAINT "course_lessons_importance_check" CHECK("course_lessons"."importance" IS NULL OR ("course_lessons"."importance" >= 0 AND "course_lessons"."importance" <= 100))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_lessons_course_node_content_unique` ON `course_lessons` (`course_id`,`curriculum_node_id`,`content_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `course_lessons_node_order_unique` ON `course_lessons` (`course_id`,`curriculum_node_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `course_lessons_course_listing_idx` ON `course_lessons` (`course_id`,`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `course_lessons_content_usage_idx` ON `course_lessons` (`content_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `user_course_lesson_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`course_lesson_id` text NOT NULL,
	`status` text DEFAULT 'IN_PROGRESS' NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`last_studied_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_lesson_id`) REFERENCES `course_lessons`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "user_course_lesson_progress_status_check" CHECK("user_course_lesson_progress"."status" IN ('IN_PROGRESS', 'COMPLETED')),
	CONSTRAINT "user_course_lesson_progress_percent_check" CHECK("user_course_lesson_progress"."progress_percent" >= 0 AND "user_course_lesson_progress"."progress_percent" <= 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_course_lesson_progress_unique` ON `user_course_lesson_progress` (`user_id`,`course_id`,`course_lesson_id`);--> statement-breakpoint
CREATE INDEX `user_course_lesson_progress_user_course_idx` ON `user_course_lesson_progress` (`user_id`,`course_id`,`status`,`last_studied_at`);--> statement-breakpoint
CREATE INDEX `user_course_lesson_progress_lesson_idx` ON `user_course_lesson_progress` (`course_lesson_id`,`status`);