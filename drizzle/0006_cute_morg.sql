CREATE TABLE `learning_units` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`topic_id` text,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`completion_policy` text DEFAULT 'MANUAL' NOT NULL,
	`minimum_progress_percent` integer DEFAULT 100 NOT NULL,
	`minimum_study_seconds` integer DEFAULT 0 NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "learning_units_completion_policy_check" CHECK("learning_units"."completion_policy" IN ('MANUAL', 'SCROLL_END', 'MINIMUM_REQUIREMENTS')),
	CONSTRAINT "learning_units_minimum_progress_check" CHECK("learning_units"."minimum_progress_percent" >= 0 AND "learning_units"."minimum_progress_percent" <= 100),
	CONSTRAINT "learning_units_minimum_study_seconds_check" CHECK("learning_units"."minimum_study_seconds" >= 0 AND "learning_units"."minimum_study_seconds" <= 86400)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_units_subject_code_unique` ON `learning_units` (`subject_id`,`code`);--> statement-breakpoint
CREATE INDEX `learning_units_course_listing_idx` ON `learning_units` (`course_id`,`active`,`published`,`deleted_at`,`display_order`);--> statement-breakpoint
CREATE INDEX `learning_units_subject_listing_idx` ON `learning_units` (`subject_id`,`active`,`published`,`display_order`);--> statement-breakpoint
CREATE INDEX `learning_units_topic_idx` ON `learning_units` (`topic_id`,`display_order`);--> statement-breakpoint
ALTER TABLE `lessons` ADD `learning_unit_id` text REFERENCES learning_units(id);--> statement-breakpoint
INSERT OR IGNORE INTO `learning_units`
  (`id`, `course_id`, `subject_id`, `topic_id`, `code`, `title`, `description`,
   `display_order`, `active`, `published`, `completion_policy`,
   `minimum_progress_percent`, `minimum_study_seconds`, `is_sample`)
SELECT
  t.id || '-unit',
  s.course_id,
  s.id,
  t.id,
  'UNIT_' || t.code,
  t.name,
  CASE
    WHEN t.is_sample = 1
      THEN '[개발용 샘플] 기존 본문형 레슨을 보존하며 생성한 학습단위입니다.'
    ELSE t.description
  END,
  t.display_order,
  t.active,
  CASE WHEN EXISTS (
    SELECT 1 FROM lessons l
    WHERE l.topic_id = t.id AND l.active = 1 AND l.published = 1
  ) THEN 1 ELSE 0 END,
  'MANUAL',
  100,
  0,
  t.is_sample
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM lessons l WHERE l.topic_id = t.id);--> statement-breakpoint
UPDATE `lessons`
SET `learning_unit_id` = `topic_id` || '-unit'
WHERE `learning_unit_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_learning_unit_code_unique` ON `lessons` (`learning_unit_id`,`code`);--> statement-breakpoint
CREATE INDEX `lessons_learning_unit_listing_idx` ON `lessons` (`learning_unit_id`,`active`,`published`,`display_order`);--> statement-breakpoint
ALTER TABLE `user_lesson_progress` ADD `last_viewed_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_lesson_progress` ADD `last_position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_lesson_progress` ADD `study_seconds` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `user_lesson_progress`
SET `last_viewed_at` = coalesce(
  nullif(`last_studied_at`, ''),
  `completed_at`,
  `started_at`,
  `created_at`,
  CURRENT_TIMESTAMP
)
WHERE `last_viewed_at` = '';
