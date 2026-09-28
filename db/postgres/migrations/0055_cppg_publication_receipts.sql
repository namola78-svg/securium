-- Append-only publication receipt bound to the exact immutable CPPG registration snapshot.
-- publication_semantic_identity is SHA-256 of canonical JSON:
-- { contractVersion: "CPPG_PUBLICATION_RECEIPT_V1", registrationSemanticIdentity }.
BEGIN;

-- The referenced key lets PostgreSQL reject a receipt whose copied snapshot drifts
-- from its canonical registration, including content revisions and authority sequence.
CREATE UNIQUE INDEX "cppg_runtime_registrations_publication_binding_uq"
  ON public."cppg_runtime_registrations" (
    "registration_semantic_identity",
    "course_id",
    "package_key",
    "runtime_revision_id",
    "content_revision_ids",
    "source_manifest_id",
    "source_package_hash",
    "foundation_id",
    "foundation_hash",
    "approval_subject_hash",
    "authority_id",
    "authority_sequence"
  );

CREATE TABLE public."cppg_publication_receipts" (
  "publication_id" text PRIMARY KEY,
  "registration_semantic_identity" text NOT NULL UNIQUE,
  "course_id" text NOT NULL CHECK ("course_id" = 'course-cppg'),
  "package_key" text NOT NULL,
  "runtime_revision_id" text NOT NULL,
  "content_revision_ids" jsonb NOT NULL CHECK (jsonb_typeof("content_revision_ids") = 'array' AND jsonb_array_length("content_revision_ids") > 0),
  "source_manifest_id" text NOT NULL,
  "source_package_hash" text NOT NULL CHECK ("source_package_hash" ~ '^[a-f0-9]{64}$'),
  "foundation_id" text NOT NULL,
  "foundation_hash" text NOT NULL CHECK ("foundation_hash" ~ '^[a-f0-9]{64}$'),
  "approval_subject_hash" text NOT NULL CHECK ("approval_subject_hash" ~ '^[a-f0-9]{64}$'),
  "authority_id" text NOT NULL,
  "authority_sequence" integer NOT NULL CHECK ("authority_sequence" > 0),
  "publication_state" text NOT NULL DEFAULT 'PUBLISHED' CHECK ("publication_state" = 'PUBLISHED'),
  "publication_semantic_identity" text NOT NULL UNIQUE CHECK ("publication_semantic_identity" ~ '^[a-f0-9]{64}$'),
  "published_at" timestamptz NOT NULL DEFAULT now(),
  "published_by" text NOT NULL CHECK (length(trim("published_by")) > 0),
  FOREIGN KEY (
    "registration_semantic_identity",
    "course_id",
    "package_key",
    "runtime_revision_id",
    "content_revision_ids",
    "source_manifest_id",
    "source_package_hash",
    "foundation_id",
    "foundation_hash",
    "approval_subject_hash",
    "authority_id",
    "authority_sequence"
  ) REFERENCES public."cppg_runtime_registrations" (
    "registration_semantic_identity",
    "course_id",
    "package_key",
    "runtime_revision_id",
    "content_revision_ids",
    "source_manifest_id",
    "source_package_hash",
    "foundation_id",
    "foundation_hash",
    "approval_subject_hash",
    "authority_id",
    "authority_sequence"
  )
);

CREATE RULE "cppg_publication_receipts_no_update" AS
ON UPDATE TO public."cppg_publication_receipts"
DO INSTEAD NOTHING;
CREATE RULE "cppg_publication_receipts_no_delete" AS
ON DELETE TO public."cppg_publication_receipts"
DO INSTEAD NOTHING;

REVOKE ALL PRIVILEGES ON TABLE public."cppg_publication_receipts" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."cppg_publication_receipts" ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_schema_migrations (id, checksum)
VALUES ('0055_cppg_publication_receipts', 'cppg-publication-receipts-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
