-- ISMS-P profile applicability foundation; requirement rows remain canonical.
BEGIN;

CREATE TABLE public."isms_profiles" (
  "id" text PRIMARY KEY NOT NULL,
  "profile_key" text NOT NULL,
  "profile_type" text NOT NULL,
  "official_identifier" text,
  "canonical_label" text NOT NULL,
  "criteria_state" text NOT NULL,
  "lifecycle_state" text NOT NULL DEFAULT 'CURRENT',
  "effective_from" text,
  "effective_to" text,
  "criteria_assertion_id" text REFERENCES public."temporal_assertions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "eligibility_assertion_id" text REFERENCES public."temporal_assertions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "version" integer NOT NULL DEFAULT 1,
  "supersedes_profile_id" text REFERENCES public."isms_profiles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "created_by" text REFERENCES public."users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "isms_profiles_type_check" CHECK ("profile_type" IN ('GENERAL', 'SIMPLIFIED', 'STRENGTHENED', 'OTHER')),
  CONSTRAINT "isms_profiles_criteria_state_check" CHECK ("criteria_state" IN ('CURRENT_EFFECTIVE', 'PENDING_OFFICIAL_CRITERIA', 'SUPERSEDED', 'NOT_APPLICABLE', 'UNRESOLVED')),
  CONSTRAINT "isms_profiles_lifecycle_check" CHECK ("lifecycle_state" IN ('CURRENT', 'SUPERSEDED', 'INACTIVE')),
  CONSTRAINT "isms_profiles_interval_check" CHECK ("effective_to" IS NULL OR ("effective_from" IS NOT NULL AND "effective_to" > "effective_from")),
  CONSTRAINT "isms_profiles_version_check" CHECK ("version" > 0),
  CONSTRAINT "isms_profiles_pending_has_no_criteria_authority_check" CHECK ("criteria_state" != 'PENDING_OFFICIAL_CRITERIA' OR "criteria_assertion_id" IS NULL),
  CONSTRAINT "isms_profiles_current_has_criteria_authority_check" CHECK ("criteria_state" != 'CURRENT_EFFECTIVE' OR "criteria_assertion_id" IS NOT NULL)
);
CREATE UNIQUE INDEX "isms_profiles_key_unique" ON public."isms_profiles" ("profile_key");
CREATE INDEX "isms_profiles_state_idx" ON public."isms_profiles" ("lifecycle_state", "criteria_state", "effective_from", "effective_to");

CREATE TABLE public."isms_profile_requirement_mappings" (
  "id" text PRIMARY KEY NOT NULL,
  "profile_id" text NOT NULL REFERENCES public."isms_profiles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "standard_id" text NOT NULL REFERENCES public."isms_standards" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "profile_requirement_code" text,
  "applicability_state" text NOT NULL,
  "mapping_state" text NOT NULL,
  "effective_from" text,
  "effective_to" text,
  "rationale" text NOT NULL DEFAULT '',
  "version" integer NOT NULL DEFAULT 1,
  "authority_assertion_id" text REFERENCES public."temporal_assertions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "supersedes_mapping_id" text REFERENCES public."isms_profile_requirement_mappings" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "created_by" text REFERENCES public."users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "reviewed_by" text REFERENCES public."users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "reviewed_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "isms_profile_mappings_applicability_check" CHECK ("applicability_state" IN ('APPLIES', 'NOT_APPLICABLE', 'VARIANT', 'UNRESOLVED')),
  CONSTRAINT "isms_profile_mappings_state_check" CHECK ("mapping_state" IN ('CURRENT', 'PENDING', 'SUPERSEDED')),
  CONSTRAINT "isms_profile_mappings_interval_check" CHECK ("effective_to" IS NULL OR ("effective_from" IS NOT NULL AND "effective_to" > "effective_from")),
  CONSTRAINT "isms_profile_mappings_version_check" CHECK ("version" > 0),
  CONSTRAINT "isms_profile_mappings_current_has_authority_check" CHECK ("mapping_state" != 'CURRENT' OR "authority_assertion_id" IS NOT NULL),
  CONSTRAINT "isms_profile_mappings_current_is_resolved_check" CHECK ("mapping_state" != 'CURRENT' OR "applicability_state" != 'UNRESOLVED'),
  CONSTRAINT "isms_profile_mappings_variant_has_profile_code_check" CHECK ("applicability_state" != 'VARIANT' OR "profile_requirement_code" IS NOT NULL)
);
CREATE INDEX "isms_profile_requirement_mappings_profile_idx" ON public."isms_profile_requirement_mappings" ("profile_id", "mapping_state", "effective_from", "effective_to");
CREATE INDEX "isms_profile_requirement_mappings_standard_idx" ON public."isms_profile_requirement_mappings" ("standard_id", "profile_id");
CREATE UNIQUE INDEX "isms_profile_mappings_active_identity_unique" ON public."isms_profile_requirement_mappings" ("profile_id", "standard_id", "profile_requirement_code") WHERE "mapping_state" IN ('CURRENT', 'PENDING');
CREATE UNIQUE INDEX "isms_profile_mappings_active_null_code_unique" ON public."isms_profile_requirement_mappings" ("profile_id", "standard_id") WHERE "profile_requirement_code" IS NULL AND "mapping_state" IN ('CURRENT', 'PENDING');

CREATE RULE "isms_profiles_no_delete" AS ON DELETE TO public."isms_profiles" DO INSTEAD NOTHING;
CREATE RULE "isms_profile_requirement_mappings_no_delete" AS ON DELETE TO public."isms_profile_requirement_mappings" DO INSTEAD NOTHING;
REVOKE ALL PRIVILEGES ON TABLE public."isms_profiles" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."isms_profile_requirement_mappings" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."isms_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isms_profile_requirement_mappings" ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_schema_migrations (id, checksum)
VALUES ('0060_isms_profile_mapping_foundation', 'isms-profile-mapping-foundation-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
