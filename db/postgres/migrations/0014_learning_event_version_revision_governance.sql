-- Additive learning-event version and revision governance.
-- Production application requires a separate migration authorization.
BEGIN;

ALTER TABLE public."question_attempts"
  ADD COLUMN "question_version_id" text,
  ADD COLUMN "concept_mapping_set_hash" text,
  ADD CONSTRAINT "question_attempts_question_version_fk"
    FOREIGN KEY ("question_version_id") REFERENCES public."question_versions" ("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "question_attempts_version_binding_check"
    CHECK (("question_version_id" IS NULL AND "concept_mapping_set_hash" IS NULL)
      OR ("question_version_id" IS NOT NULL AND "concept_mapping_set_hash" ~ '^[0-9a-f]{64}$'));

ALTER TABLE public."mock_exam_attempts"
  ADD COLUMN "composition_semantic_hash" text,
  ADD CONSTRAINT "mock_exam_attempts_composition_hash_check"
    CHECK ("composition_semantic_hash" IS NULL OR "composition_semantic_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE public."mock_exam_answers"
  ADD COLUMN "question_version_id" text,
  ADD COLUMN "concept_mapping_set_hash" text,
  ADD CONSTRAINT "mock_exam_answers_question_version_fk"
    FOREIGN KEY ("question_version_id") REFERENCES public."question_versions" ("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "mock_exam_answers_version_binding_check"
    CHECK (("question_version_id" IS NULL AND "concept_mapping_set_hash" IS NULL)
      OR ("question_version_id" IS NOT NULL AND "concept_mapping_set_hash" ~ '^[0-9a-f]{64}$'));

ALTER TABLE public."user_lesson_progress"
  ADD COLUMN "content_version" integer;

ALTER TABLE public."user_course_lesson_progress"
  ADD COLUMN "content_version" text;

ALTER TABLE public."audio_progress"
  ADD COLUMN "content_revision_id" text,
  ADD CONSTRAINT "audio_progress_content_revision_fk"
    FOREIGN KEY ("content_revision_id") REFERENCES public."content_revisions" ("id") ON DELETE RESTRICT;

ALTER TABLE public."lecture_progress"
  ADD COLUMN "content_revision_id" text,
  ADD CONSTRAINT "lecture_progress_content_revision_fk"
    FOREIGN KEY ("content_revision_id") REFERENCES public."content_revisions" ("id") ON DELETE RESTRICT;

CREATE TABLE public."learning_event_revisions" (
  "id" text PRIMARY KEY,
  "source_type" text NOT NULL,
  "source_event_id" text NOT NULL,
  "sequence" integer NOT NULL,
  "previous_revision_id" text,
  "action" text NOT NULL,
  "reason_code" text NOT NULL,
  "payload_schema_version" integer NOT NULL DEFAULT 1,
  "correction_payload_json" text NOT NULL DEFAULT '{}',
  "semantic_hash" text NOT NULL,
  "actor_user_id" text NOT NULL REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_event_revisions_previous_fk"
    FOREIGN KEY ("previous_revision_id") REFERENCES public."learning_event_revisions" ("id") ON DELETE RESTRICT,
  CONSTRAINT "learning_event_revisions_source_check"
    CHECK ("source_type" IN ('QUESTION_ATTEMPT', 'MOCK_ATTEMPT', 'MOCK_ITEM_RESULT', 'PRACTICAL_ATTEMPT', 'PRACTICAL_EVALUATION', 'LESSON_PROGRESS', 'COURSE_LESSON_PROGRESS', 'LECTURE_PROGRESS', 'AUDIO_PROGRESS')),
  CONSTRAINT "learning_event_revisions_action_check"
    CHECK ("action" IN ('CORRECT', 'INVALIDATE', 'RESTORE_ELIGIBILITY', 'CORRECT_CONCEPT_MAPPING')),
  CONSTRAINT "learning_event_revisions_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "learning_event_revisions_payload_version_check" CHECK ("payload_schema_version" > 0),
  CONSTRAINT "learning_event_revisions_payload_length_check" CHECK (length("correction_payload_json") <= 20000),
  CONSTRAINT "learning_event_revisions_hash_check" CHECK ("semantic_hash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "learning_event_revisions_sequence_unique"
  ON public."learning_event_revisions" ("source_type", "source_event_id", "sequence");
CREATE UNIQUE INDEX "learning_event_revisions_semantic_unique"
  ON public."learning_event_revisions" ("source_type", "source_event_id", "semantic_hash");
CREATE UNIQUE INDEX "learning_event_revisions_predecessor_unique"
  ON public."learning_event_revisions" ("previous_revision_id") WHERE "previous_revision_id" IS NOT NULL;
CREATE INDEX "learning_event_revisions_source_idx"
  ON public."learning_event_revisions" ("source_type", "source_event_id", "created_at");
CREATE INDEX "learning_event_revisions_actor_idx"
  ON public."learning_event_revisions" ("actor_user_id", "created_at");

REVOKE ALL PRIVILEGES ON TABLE public."learning_event_revisions" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."learning_event_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."learning_event_revisions" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0014_learning_event_version_revision_governance', 'pending-sha256')
ON CONFLICT (id) DO NOTHING;

COMMIT;
