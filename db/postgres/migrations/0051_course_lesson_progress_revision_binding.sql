-- Bind CourseLesson progress uniqueness to the server-resolved content version.
-- Legacy rows with a NULL content_version remain unbound and are not backfilled.
BEGIN;

DROP INDEX IF EXISTS "user_course_lesson_progress_unique";
CREATE UNIQUE INDEX "user_course_lesson_progress_revision_unique"
  ON "user_course_lesson_progress" ("user_id", "course_id", "course_lesson_id", "content_version");

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0051_course_lesson_progress_revision_binding', 'course-lesson-progress-revision-binding-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
