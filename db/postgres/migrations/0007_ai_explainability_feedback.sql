-- Add administrator feedback storage for AI explainability traces.
-- Production execution requires explicit approval.
BEGIN;

CREATE TABLE IF NOT EXISTS "ai_explainability_feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "trace_source" text NOT NULL,
  "question_generation_id" text REFERENCES "ai_generation_records" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "specialized_generation_id" text REFERENCES "ai_specialized_generation_records" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "reviewer_id" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "rating" text NOT NULL,
  "issue_type" text NOT NULL,
  "note" text NOT NULL DEFAULT '',
  "metadata_json" text NOT NULL DEFAULT '{}',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "ai_explainability_feedback_trace_source_check" CHECK ("trace_source" IN ('QUESTION_EXPLANATION', 'SPECIALIZED_REVIEW')),
  CONSTRAINT "ai_explainability_feedback_rating_check" CHECK ("rating" IN ('HELPFUL', 'NOT_HELPFUL', 'NEEDS_REVIEW')),
  CONSTRAINT "ai_explainability_feedback_issue_type_check" CHECK ("issue_type" IN ('NONE', 'LOW_QUALITY_CONTEXT', 'MISSING_CITATION', 'WRONG_CONCEPT', 'PROMPT_ISSUE', 'SENSITIVE_CONTENT_RISK', 'OTHER')),
  CONSTRAINT "ai_explainability_feedback_target_check" CHECK (
    ("trace_source" = 'QUESTION_EXPLANATION' AND "question_generation_id" IS NOT NULL AND "specialized_generation_id" IS NULL)
    OR
    ("trace_source" = 'SPECIALIZED_REVIEW' AND "specialized_generation_id" IS NOT NULL AND "question_generation_id" IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS "ai_explainability_feedback_trace_idx"
ON "ai_explainability_feedback" ("trace_source", "created_at");

CREATE INDEX IF NOT EXISTS "ai_explainability_feedback_reviewer_idx"
ON "ai_explainability_feedback" ("reviewer_id", "created_at");

CREATE INDEX IF NOT EXISTS "ai_explainability_feedback_question_idx"
ON "ai_explainability_feedback" ("question_generation_id");

CREATE INDEX IF NOT EXISTS "ai_explainability_feedback_specialized_idx"
ON "ai_explainability_feedback" ("specialized_generation_id");

REVOKE ALL PRIVILEGES ON TABLE public."ai_explainability_feedback" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."ai_explainability_feedback" ENABLE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0007_ai_explainability_feedback', 'manual-ai-explainability-feedback')
ON CONFLICT (id) DO NOTHING;

COMMIT;
