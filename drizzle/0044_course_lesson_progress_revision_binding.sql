DROP INDEX `user_course_lesson_progress_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_course_lesson_progress_revision_unique` ON `user_course_lesson_progress` (`user_id`,`course_id`,`course_lesson_id`,`content_version`);
