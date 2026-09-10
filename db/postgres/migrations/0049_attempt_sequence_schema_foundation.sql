-- Establish nullable AttemptSequence storage and assigned-ordinal invariants.
-- Existing question_attempts rows remain NULL; allocation/backfill is governed elsewhere.
BEGIN;

ALTER TABLE public."question_attempts"
  ADD COLUMN "attempt_sequence" bigint;

ALTER TABLE public."question_attempts"
  ADD CONSTRAINT "question_attempts_attempt_sequence_check"
  CHECK ("attempt_sequence" IS NULL OR "attempt_sequence" >= 1);

CREATE UNIQUE INDEX "question_attempts_partition_sequence_unique"
  ON public."question_attempts" ("user_id", "course_id", "question_id", "attempt_sequence")
  WHERE "attempt_sequence" IS NOT NULL;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0049_attempt_sequence_schema_foundation', 'attempt-sequence-schema-foundation-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
