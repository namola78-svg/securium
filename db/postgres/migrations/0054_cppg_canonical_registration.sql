-- Canonical, unpublished CPPG registration bound to one exact Runtime Authority.
BEGIN;

CREATE TABLE public."cppg_runtime_registrations" (
  "id" text PRIMARY KEY,
  "course_id" text NOT NULL CHECK ("course_id" = 'course-cppg'),
  "course_slug" text NOT NULL CHECK ("course_slug" = 'cppg'),
  "package_key" text NOT NULL CHECK ("package_key" = 'course-cppg:foundation:v1'),
  "runtime_revision_id" text NOT NULL,
  "content_revision_ids" jsonb NOT NULL CHECK (jsonb_typeof("content_revision_ids") = 'array' AND jsonb_array_length("content_revision_ids") > 0),
  "projection_semantic_hash" text NOT NULL CHECK ("projection_semantic_hash" ~ '^[a-f0-9]{64}$'),
  "source_manifest_id" text NOT NULL,
  "source_package_hash" text NOT NULL CHECK ("source_package_hash" ~ '^[a-f0-9]{64}$'),
  "foundation_id" text NOT NULL,
  "foundation_hash" text NOT NULL CHECK ("foundation_hash" ~ '^[a-f0-9]{64}$'),
  "approval_subject_hash" text NOT NULL CHECK ("approval_subject_hash" ~ '^[a-f0-9]{64}$'),
  "authority_id" text NOT NULL,
  "authority_sequence" integer NOT NULL CHECK ("authority_sequence" > 0),
  "registration_semantic_identity" text NOT NULL UNIQUE CHECK ("registration_semantic_identity" ~ '^[a-f0-9]{64}$'),
  "state" text NOT NULL DEFAULT 'REGISTERED_UNPUBLISHED' CHECK ("state" = 'REGISTERED_UNPUBLISHED'),
  "publication_authority" text NOT NULL DEFAULT 'NOT_GRANTED' CHECK ("publication_authority" = 'NOT_GRANTED'),
  "registered_at" timestamptz NOT NULL DEFAULT now(),
  "registered_by" text NOT NULL,
  CHECK ("authority_id" = 'runtime-authority:cppg:' || "approval_subject_hash"),
  UNIQUE ("course_id", "runtime_revision_id"),
  UNIQUE ("authority_id", "approval_subject_hash")
);

CREATE TABLE public."cppg_runtime_projection_records" (
  "projection_semantic_hash" text NOT NULL CHECK ("projection_semantic_hash" ~ '^[a-f0-9]{64}$'),
  "record_id" text NOT NULL,
  "record_kind" text NOT NULL CHECK ("record_kind" IN ('COURSE','CURRICULUM_TREE','SUBJECT','CURRICULUM_NODE','TOPIC','LEARNING_UNIT','CONTENT','LESSON','COURSE_LESSON','CONTENT_REVISION')),
  "semantic_hash" text NOT NULL CHECK ("semantic_hash" ~ '^[a-f0-9]{64}$'),
  "payload_json" jsonb NOT NULL CHECK (jsonb_typeof("payload_json") = 'object'),
  PRIMARY KEY ("projection_semantic_hash", "record_kind", "record_id")
);

CREATE RULE "cppg_runtime_registrations_no_update" AS
ON UPDATE TO public."cppg_runtime_registrations"
DO INSTEAD NOTHING;
CREATE RULE "cppg_runtime_registrations_no_delete" AS
ON DELETE TO public."cppg_runtime_registrations"
DO INSTEAD NOTHING;
CREATE RULE "cppg_runtime_projection_records_no_update" AS
ON UPDATE TO public."cppg_runtime_projection_records"
DO INSTEAD NOTHING;
CREATE RULE "cppg_runtime_projection_records_no_delete" AS
ON DELETE TO public."cppg_runtime_projection_records"
DO INSTEAD NOTHING;

REVOKE ALL PRIVILEGES ON TABLE public."cppg_runtime_registrations" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."cppg_runtime_registrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."cppg_runtime_projection_records" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."cppg_runtime_projection_records" ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_schema_migrations (id, checksum)
VALUES ('0054_cppg_canonical_registration', 'cppg-canonical-registration-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
