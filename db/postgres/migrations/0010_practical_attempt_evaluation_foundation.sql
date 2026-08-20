-- Add immutable Practical versions, user-owned attempts, and append-only evaluations.
-- Production execution requires explicit approval.
BEGIN;

CREATE TABLE IF NOT EXISTS "practical_rubric_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "rubric_id" text NOT NULL,
  "version" integer NOT NULL,
  "snapshot_format_version" integer NOT NULL DEFAULT 1,
  "snapshot_json" text NOT NULL,
  "snapshot_digest" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "effective_from" text,
  "withdrawn_at" text,
  CONSTRAINT "practical_rubric_versions_version_check" CHECK ("version" > 0),
  CONSTRAINT "practical_rubric_versions_format_check" CHECK ("snapshot_format_version" > 0),
  CONSTRAINT "practical_rubric_versions_snapshot_length_check" CHECK (length("snapshot_json") <= 100000),
  CONSTRAINT "practical_rubric_versions_digest_check" CHECK ("snapshot_digest" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "practical_rubric_versions_identity_unique"
ON "practical_rubric_versions" ("rubric_id", "version");

CREATE TABLE IF NOT EXISTS "practical_definition_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "practical_id" text NOT NULL,
  "version" integer NOT NULL,
  "rubric_version_id" text NOT NULL REFERENCES "practical_rubric_versions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "snapshot_format_version" integer NOT NULL DEFAULT 1,
  "snapshot_json" text NOT NULL,
  "snapshot_digest" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "effective_from" text,
  "withdrawn_at" text,
  CONSTRAINT "practical_definition_versions_version_check" CHECK ("version" > 0),
  CONSTRAINT "practical_definition_versions_format_check" CHECK ("snapshot_format_version" > 0),
  CONSTRAINT "practical_definition_versions_snapshot_length_check" CHECK (length("snapshot_json") <= 100000),
  CONSTRAINT "practical_definition_versions_digest_check" CHECK ("snapshot_digest" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "practical_definition_versions_identity_unique"
ON "practical_definition_versions" ("practical_id", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "practical_definition_versions_rubric_binding_unique"
ON "practical_definition_versions" ("id", "rubric_version_id");

CREATE TABLE IF NOT EXISTS "practical_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "practical_id" text NOT NULL,
  "practical_definition_version_id" text NOT NULL,
  "rubric_version_id" text NOT NULL,
  "course_id" text NOT NULL REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "curriculum_tree_id" text NOT NULL REFERENCES "curriculum_trees" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "curriculum_tree_version_reference" text NOT NULL,
  "curriculum_node_id" text NOT NULL REFERENCES "curriculum_nodes" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "objective_placement_id" text NOT NULL,
  "practical_placement_id" text NOT NULL,
  "state" text NOT NULL DEFAULT 'IN_PROGRESS',
  "responses_json" text NOT NULL DEFAULT '[]',
  "artifact_manifest_json" text NOT NULL DEFAULT '[]',
  "submission_digest" text,
  "creation_idempotency_key" text NOT NULL,
  "submission_idempotency_key" text,
  "draft_revision" integer NOT NULL DEFAULT 0,
  "started_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "submitted_at" text,
  "expires_at" text,
  "expired_at" text,
  "voided_at" text,
  "void_reason_code" text,
  "eligibility_decision_reference" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "practical_attempts_definition_rubric_fk"
    FOREIGN KEY ("practical_definition_version_id", "rubric_version_id")
    REFERENCES "practical_definition_versions" ("id", "rubric_version_id")
    ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "practical_attempts_state_check" CHECK ("state" IN ('IN_PROGRESS', 'SUBMITTED', 'EVALUATED', 'EXPIRED', 'VOIDED')),
  CONSTRAINT "practical_attempts_responses_length_check" CHECK (length("responses_json") <= 100000),
  CONSTRAINT "practical_attempts_artifact_manifest_length_check" CHECK (length("artifact_manifest_json") <= 20000),
  CONSTRAINT "practical_attempts_submission_digest_check" CHECK ("submission_digest" IS NULL OR "submission_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "practical_attempts_draft_revision_check" CHECK ("draft_revision" >= 0),
  CONSTRAINT "practical_attempts_void_reason_length_check" CHECK ("void_reason_code" IS NULL OR length("void_reason_code") <= 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS "practical_attempts_creation_idempotency_unique"
ON "practical_attempts" ("user_id", "creation_idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "practical_attempts_submission_idempotency_unique"
ON "practical_attempts" ("user_id", "submission_idempotency_key")
WHERE "submission_idempotency_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "practical_attempts_version_binding_unique"
ON "practical_attempts" ("id", "practical_definition_version_id", "rubric_version_id");
CREATE INDEX IF NOT EXISTS "practical_attempts_user_history_idx"
ON "practical_attempts" ("user_id", "practical_id", "started_at");
CREATE INDEX IF NOT EXISTS "practical_attempts_user_state_idx"
ON "practical_attempts" ("user_id", "state", "updated_at");
CREATE INDEX IF NOT EXISTS "practical_attempts_expiration_idx"
ON "practical_attempts" ("state", "expires_at");

CREATE TABLE IF NOT EXISTS "practical_evaluations" (
  "id" text PRIMARY KEY NOT NULL,
  "attempt_id" text NOT NULL,
  "sequence" integer NOT NULL,
  "previous_evaluation_id" text,
  "practical_definition_version_id" text NOT NULL,
  "rubric_version_id" text NOT NULL,
  "method" text NOT NULL,
  "dimension_results_json" text NOT NULL,
  "raw_score" double precision,
  "maximum_score" double precision,
  "qualification" text NOT NULL,
  "review_status" text NOT NULL DEFAULT 'NOT_REQUIRED',
  "provenance_json" text NOT NULL,
  "reviewer_id" text REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "reviewed_at" text,
  "review_reason" text,
  "evaluation_payload_digest" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "evaluator_job_id" text,
  "evaluator_result_id" text,
  "evaluated_at" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "practical_evaluations_attempt_version_fk"
    FOREIGN KEY ("attempt_id", "practical_definition_version_id", "rubric_version_id")
    REFERENCES "practical_attempts" ("id", "practical_definition_version_id", "rubric_version_id")
    ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "practical_evaluations_previous_fk"
    FOREIGN KEY ("previous_evaluation_id") REFERENCES "practical_evaluations" ("id")
    ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "practical_evaluations_sequence_check" CHECK ("sequence" >= 1),
  CONSTRAINT "practical_evaluations_method_check" CHECK ("method" IN ('DETERMINISTIC', 'RUBRIC', 'AI_ASSISTED', 'HUMAN_REVIEWED', 'HYBRID')),
  CONSTRAINT "practical_evaluations_qualification_check" CHECK ("qualification" IN ('QUALIFIED', 'NOT_QUALIFIED', 'PENDING_REVIEW')),
  CONSTRAINT "practical_evaluations_review_status_check" CHECK ("review_status" IN ('NOT_REQUIRED', 'PENDING', 'COMPLETED')),
  CONSTRAINT "practical_evaluations_dimension_results_length_check" CHECK (length("dimension_results_json") <= 100000),
  CONSTRAINT "practical_evaluations_provenance_length_check" CHECK (length("provenance_json") <= 10000),
  CONSTRAINT "practical_evaluations_review_reason_length_check" CHECK ("review_reason" IS NULL OR length("review_reason") <= 2000),
  CONSTRAINT "practical_evaluations_score_pair_check" CHECK (
    ("raw_score" IS NULL AND "maximum_score" IS NULL)
    OR (
      "raw_score" IS NOT NULL AND "maximum_score" IS NOT NULL
      AND "raw_score" >= 0 AND "maximum_score" > 0 AND "raw_score" <= "maximum_score"
      AND "raw_score" NOT IN ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)
      AND "maximum_score" NOT IN ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)
    )
  ),
  CONSTRAINT "practical_evaluations_ai_qualification_check" CHECK (NOT ("method" = 'AI_ASSISTED' AND "qualification" = 'QUALIFIED')),
  CONSTRAINT "practical_evaluations_evaluator_identity_check" CHECK (
    ("evaluator_job_id" IS NULL AND "evaluator_result_id" IS NULL)
    OR ("evaluator_job_id" IS NOT NULL AND "evaluator_result_id" IS NOT NULL)
  ),
  CONSTRAINT "practical_evaluations_digest_check" CHECK ("evaluation_payload_digest" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "practical_evaluations_sequence_unique"
ON "practical_evaluations" ("attempt_id", "sequence");
CREATE UNIQUE INDEX IF NOT EXISTS "practical_evaluations_operation_unique"
ON "practical_evaluations" ("attempt_id", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "practical_evaluations_predecessor_unique"
ON "practical_evaluations" ("previous_evaluation_id")
WHERE "previous_evaluation_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "practical_evaluations_evaluator_result_unique"
ON "practical_evaluations" ("attempt_id", "evaluator_job_id", "evaluator_result_id")
WHERE "evaluator_job_id" IS NOT NULL AND "evaluator_result_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "practical_evaluations_review_queue_idx"
ON "practical_evaluations" ("review_status", "created_at");

REVOKE ALL PRIVILEGES ON TABLE public."practical_rubric_versions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."practical_definition_versions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."practical_attempts" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."practical_evaluations" FROM PUBLIC, anon, authenticated;

ALTER TABLE public."practical_rubric_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_rubric_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."practical_definition_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_definition_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."practical_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_attempts" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."practical_evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_evaluations" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0010_practical_attempt_evaluation_foundation', 'manual-practical-attempt-evaluation-foundation')
ON CONFLICT (id) DO NOTHING;

COMMIT;
