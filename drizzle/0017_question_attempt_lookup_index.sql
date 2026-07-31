CREATE INDEX IF NOT EXISTS "question_attempts_user_course_question_idx"
ON "question_attempts" ("user_id", "course_id", "question_id");
