-- Bind CourseLesson progress uniqueness to the server-resolved content version.
-- Legacy rows with a NULL content_version remain unbound and are not backfilled.
BEGIN;

ALTER TABLE public."user_course_lesson_progress"
  ADD COLUMN IF NOT EXISTS "content_id" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_course_lesson_progress_content_fk'
  ) THEN
    ALTER TABLE public."user_course_lesson_progress"
      ADD CONSTRAINT "user_course_lesson_progress_content_fk"
      FOREIGN KEY ("content_id") REFERENCES public."contents" ("id")
      ON UPDATE NO ACTION ON DELETE RESTRICT;
  END IF;
END $$;

DROP INDEX IF EXISTS "user_course_lesson_progress_unique";
CREATE UNIQUE INDEX "user_course_lesson_progress_revision_unique"
  ON "user_course_lesson_progress" ("user_id", "course_id", "course_lesson_id", "content_id", "content_version");

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0051_course_lesson_progress_revision_binding', 'course-lesson-progress-revision-binding-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
