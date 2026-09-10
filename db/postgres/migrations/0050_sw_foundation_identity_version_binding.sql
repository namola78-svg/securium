-- Add identity-only Foundation question/version bindings to generic attempts.
-- Foundation content remains the sole semantic authority; no question content is copied.
BEGIN;

CREATE TABLE public."foundation_question_bindings" (
  "id" text PRIMARY KEY,
  "course_id" text NOT NULL,
  "foundation_binding_key" text NOT NULL,
  "foundation_version" text NOT NULL,
  "foundation_question_id" text NOT NULL,
  "semantic_hash" text NOT NULL,
  "lifecycle_state" text NOT NULL DEFAULT 'ACTIVE',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "retired_at" text,
  CONSTRAINT "foundation_question_bindings_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES public."courses" ("id")
    ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "foundation_question_bindings_identity_check"
    CHECK (length(trim("foundation_binding_key")) > 0
      AND length(trim("foundation_version")) > 0
      AND length(trim("foundation_question_id")) > 0),
  CONSTRAINT "foundation_question_bindings_hash_check"
    CHECK ("semantic_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "foundation_question_bindings_lifecycle_check"
    CHECK ("lifecycle_state" IN ('ACTIVE', 'RETIRED')),
  CONSTRAINT "foundation_question_bindings_retirement_check"
    CHECK ("lifecycle_state" <> 'RETIRED' OR "retired_at" IS NOT NULL)
);

CREATE UNIQUE INDEX "foundation_question_bindings_identity_unique"
  ON public."foundation_question_bindings"
  ("foundation_binding_key", "foundation_version", "foundation_question_id");

CREATE UNIQUE INDEX "foundation_question_bindings_id_course_unique"
  ON public."foundation_question_bindings" ("id", "course_id");

CREATE INDEX "foundation_question_bindings_course_question_idx"
  ON public."foundation_question_bindings" ("course_id", "foundation_question_id");

REVOKE ALL PRIVILEGES ON TABLE public."foundation_question_bindings" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."foundation_question_bindings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."question_attempts"
  ALTER COLUMN "question_id" DROP NOT NULL;

ALTER TABLE public."question_attempts"
  ADD COLUMN "foundation_question_binding_id" text;

ALTER TABLE public."question_attempts"
  ADD CONSTRAINT "question_attempts_foundation_binding_course_fk"
  FOREIGN KEY ("foundation_question_binding_id", "course_id")
  REFERENCES public."foundation_question_bindings" ("id", "course_id")
  ON UPDATE NO ACTION ON DELETE RESTRICT;

ALTER TABLE public."question_attempts"
  ADD CONSTRAINT "question_attempts_identity_path_check"
  CHECK (("question_id" IS NOT NULL AND "foundation_question_binding_id" IS NULL)
    OR ("question_id" IS NULL AND "foundation_question_binding_id" IS NOT NULL));

CREATE INDEX "question_attempts_foundation_binding_idx"
  ON public."question_attempts" ("course_id", "foundation_question_binding_id");

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0050_sw_foundation_identity_version_binding', 'sw-foundation-identity-version-binding-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
