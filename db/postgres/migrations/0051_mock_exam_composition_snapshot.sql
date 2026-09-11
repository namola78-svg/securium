-- Persist the immutable mock exam composition used by a new attempt.
BEGIN;

ALTER TABLE public."mock_exam_attempts"
  ADD COLUMN "composition_snapshot_json" text;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0051_mock_exam_composition_snapshot', 'mock-exam-composition-snapshot-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
