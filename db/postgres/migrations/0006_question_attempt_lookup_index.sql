-- Add a lookup index for dashboard recommendation anti-joins.
-- Production execution requires explicit approval.
BEGIN;

CREATE INDEX IF NOT EXISTS "question_attempts_user_course_question_idx"
ON "question_attempts" ("user_id", "course_id", "question_id");

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0006_question_attempt_lookup_index', 'manual-dashboard-question-attempt-lookup-index')
ON CONFLICT (id) DO NOTHING;

COMMIT;
