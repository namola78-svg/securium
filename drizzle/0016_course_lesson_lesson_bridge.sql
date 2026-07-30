ALTER TABLE `course_lessons` ADD `lesson_id` text REFERENCES lessons(id);--> statement-breakpoint
ALTER TABLE `course_lessons` ADD `unlock_condition` text;--> statement-breakpoint
ALTER TABLE `user_course_lesson_progress` ADD `last_viewed_at` text;--> statement-breakpoint
ALTER TABLE `user_course_lesson_progress` ADD `time_spent_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `course_lessons_lesson_usage_idx` ON `course_lessons` (`lesson_id`,`course_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `course_lessons_course_lesson_unique` ON `course_lessons` (`course_id`,`lesson_id`) WHERE `lesson_id` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `user_course_lesson_progress_viewed_idx` ON `user_course_lesson_progress` (`user_id`,`course_id`,`last_viewed_at`);--> statement-breakpoint
INSERT OR IGNORE INTO contents
  (id, slug, canonical_key, title, summary, body, body_format,
   learning_objectives_json, core_concepts_json, practical_examples_json,
   diagrams_json, media_json, version, status, created_by, deleted_at,
   created_at, updated_at)
SELECT
  'content-from-lesson-' || l.id,
  'lesson-' || lower(replace(l.id, '_', '-')),
  'lesson.' || l.id,
  l.title,
  l.summary,
  l.content,
  CASE WHEN l.content_format = 'MARKDOWN' THEN 'MARKDOWN' ELSE 'PLAIN_TEXT' END,
  '[]',
  '[]',
  '[]',
  '[]',
  '[]',
  cast(l.version AS text),
  CASE WHEN l.active = 1 AND l.published = 1 AND l.deleted_at IS NULL THEN 'PUBLISHED' ELSE 'DRAFT' END,
  NULL,
  l.deleted_at,
  l.created_at,
  l.updated_at
FROM lessons l;--> statement-breakpoint
INSERT OR IGNORE INTO course_lessons
  (id, course_id, curriculum_node_id, content_id, lesson_id, display_title,
   sort_order, difficulty, importance, estimated_minutes, is_required,
   unlock_condition, completion_rule, status, deleted_at, created_at, updated_at)
SELECT
  'course-lesson-from-' || l.id,
  l.course_id,
  NULL,
  'content-from-lesson-' || l.id,
  l.id,
  l.title,
  l.display_order,
  NULL,
  NULL,
  l.estimated_minutes,
  1,
  NULL,
  'MANUAL',
  CASE WHEN l.active = 1 AND l.published = 1 AND l.deleted_at IS NULL THEN 'PUBLISHED' ELSE 'DRAFT' END,
  l.deleted_at,
  l.created_at,
  l.updated_at
FROM lessons l;--> statement-breakpoint
INSERT OR IGNORE INTO user_course_lesson_progress
  (id, user_id, course_id, course_lesson_id, status, progress_percent,
   completed_at, last_viewed_at, time_spent_seconds, last_studied_at,
   created_at, updated_at)
SELECT
  'course-lesson-progress-from-' || ulp.id,
  ulp.user_id,
  ulp.course_id,
  'course-lesson-from-' || ulp.lesson_id,
  ulp.status,
  ulp.progress_percent,
  ulp.completed_at,
  ulp.last_viewed_at,
  ulp.study_seconds,
  ulp.last_studied_at,
  ulp.created_at,
  ulp.updated_at
FROM user_lesson_progress ulp
WHERE EXISTS (
  SELECT 1
  FROM course_lessons cl
  WHERE cl.id = 'course-lesson-from-' || ulp.lesson_id
);--> statement-breakpoint
