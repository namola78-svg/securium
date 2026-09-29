-- Canonical Python 8H question registration receipt. Content rows remain in
-- the shared question tables; this record binds their exact projection to the
-- current Runtime Authority without duplicating authority event history.
BEGIN;

CREATE TABLE public."secure_coding_8h_runtime_registrations" (
  "id" text PRIMARY KEY,
  "course_id" text NOT NULL UNIQUE CHECK ("course_id" = 'developer-secure-coding-8h-python-vibe'),
  "course_slug" text NOT NULL CHECK ("course_slug" = 'secure-coding-8h-python-vibe'),
  "package_key" text NOT NULL CHECK (length("package_key") > 0),
  "source_manifest_id" text NOT NULL,
  "source_package_hash" text NOT NULL CHECK ("source_package_hash" ~ '^[a-f0-9]{64}$'),
  "foundation_id" text NOT NULL,
  "foundation_hash" text NOT NULL CHECK ("foundation_hash" ~ '^[a-f0-9]{64}$'),
  "materialization_hash" text NOT NULL CHECK ("materialization_hash" ~ '^[a-f0-9]{64}$'),
  "revision_binding_hash" text NOT NULL CHECK ("revision_binding_hash" ~ '^[a-f0-9]{64}$'),
  "approval_subject_hash" text NOT NULL CHECK ("approval_subject_hash" ~ '^[a-f0-9]{64}$'),
  "authority_id" text NOT NULL,
  "authority_sequence" integer NOT NULL CHECK ("authority_sequence" > 0),
  "question_projection_hash" text NOT NULL CHECK ("question_projection_hash" ~ '^[a-f0-9]{64}$'),
  "questions_count" integer NOT NULL CHECK ("questions_count" = 40),
  "choices_count" integer NOT NULL CHECK ("choices_count" = 160),
  "versions_count" integer NOT NULL CHECK ("versions_count" = 40),
  "mappings_count" integer NOT NULL CHECK ("mappings_count" = 40),
  "registration_semantic_identity" text NOT NULL UNIQUE CHECK ("registration_semantic_identity" ~ '^[a-f0-9]{64}$'),
  "state" text NOT NULL DEFAULT 'REGISTERED_UNPUBLISHED' CHECK ("state" = 'REGISTERED_UNPUBLISHED'),
  "publication_authority" text NOT NULL DEFAULT 'NOT_GRANTED' CHECK ("publication_authority" = 'NOT_GRANTED'),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "registered_by" text NOT NULL,
  CHECK ("authority_id" = 'runtime-authority-python8h-' || "approval_subject_hash"),
  UNIQUE ("authority_id", "approval_subject_hash")
);

CREATE RULE "secure_coding_8h_runtime_registrations_no_update" AS
ON UPDATE TO public."secure_coding_8h_runtime_registrations"
DO INSTEAD NOTHING;
CREATE RULE "secure_coding_8h_runtime_registrations_no_delete" AS
ON DELETE TO public."secure_coding_8h_runtime_registrations"
DO INSTEAD NOTHING;

REVOKE ALL PRIVILEGES ON TABLE public."secure_coding_8h_runtime_registrations" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."secure_coding_8h_runtime_registrations" ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_schema_migrations (id, checksum)
VALUES ('0056_secure_coding_8h_runtime_registration', 'secure-coding-8h-runtime-registration-v2')
ON CONFLICT (id) DO NOTHING;

COMMIT;
