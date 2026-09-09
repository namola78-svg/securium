-- Current-main forward authority for occupational Roles, Skills, and typed relations.
-- Production execution requires explicit approval.
BEGIN;

CREATE TABLE public."occupational_roles" (
  "id" text PRIMARY KEY NOT NULL,
  "role_key" text NOT NULL,
  "label" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'DRAFT',
  "source_type" text NOT NULL DEFAULT 'SECURIUM_AUTHORED',
  "source_id" text,
  "provenance_json" text NOT NULL DEFAULT '{}',
  "reviewed_by" text REFERENCES public."users"("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "reviewed_at" text,
  "review_evidence_json" text NOT NULL DEFAULT '[]',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "occupational_roles_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT "occupational_roles_identity_check" CHECK (length(trim("role_key")) = length("role_key") AND length("role_key") BETWEEN 8 AND 255 AND "role_key" ~ '^role:[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$' AND length(trim("label")) > 0),
  CONSTRAINT "occupational_roles_active_review_check" CHECK ("status" <> 'ACTIVE' OR ("reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL AND length(trim("review_evidence_json")) > 2))
);
CREATE UNIQUE INDEX "occupational_roles_key_unique" ON public."occupational_roles" ("role_key");
CREATE INDEX "occupational_roles_status_idx" ON public."occupational_roles" ("status", "role_key");
CREATE INDEX "occupational_roles_source_idx" ON public."occupational_roles" ("source_type", "source_id");

CREATE TABLE public."occupational_role_aliases" (
  "id" text PRIMARY KEY NOT NULL,
  "role_id" text NOT NULL REFERENCES public."occupational_roles"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  "alias" text NOT NULL,
  "normalized_alias" text NOT NULL,
  "language" text NOT NULL DEFAULT 'und',
  "source" text NOT NULL DEFAULT 'manual',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "occupational_role_aliases_identity_check" CHECK (length(trim("alias")) > 0 AND length("alias") <= 300 AND "alias" = btrim("alias") AND "alias" = lower("alias") AND "alias" !~ E'[^\\x20-\\x7E]' AND "alias" !~ E'[[:space:]][[:space:]]' AND "normalized_alias" = "alias")
);
CREATE UNIQUE INDEX "occupational_role_aliases_normalized_unique" ON public."occupational_role_aliases" ("normalized_alias");
CREATE INDEX "occupational_role_aliases_lookup_idx" ON public."occupational_role_aliases" ("normalized_alias");

CREATE TABLE public."skills" (
  "id" text PRIMARY KEY,
  "skill_key" text NOT NULL,
  "label" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'DRAFT',
  "source_type" text NOT NULL,
  "source_id" text,
  "provenance_json" text NOT NULL,
  "reviewed_by" text REFERENCES public.users(id) ON DELETE RESTRICT,
  "reviewed_at" timestamptz,
  "review_evidence_json" text NOT NULL DEFAULT '[]',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "skills_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT "skills_identity_check" CHECK ("skill_key" = btrim("skill_key") AND length("skill_key") BETWEEN 9 AND 255 AND "skill_key" ~ '^skill:[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$' AND length(btrim("label")) > 0 AND length(btrim("source_type")) > 0 AND length(btrim("provenance_json")) > 2),
  CONSTRAINT "skills_active_review_check" CHECK ("status" <> 'ACTIVE' OR ("reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL AND length(btrim("review_evidence_json")) > 2))
);
CREATE UNIQUE INDEX "skills_key_unique" ON public."skills" ("skill_key");
CREATE INDEX "skills_status_idx" ON public."skills" ("status", "skill_key");
CREATE INDEX "skills_source_idx" ON public."skills" ("source_type", "source_id");

CREATE TABLE public."skill_aliases" (
  "id" text PRIMARY KEY,
  "skill_id" text NOT NULL REFERENCES public."skills"(id) ON DELETE CASCADE,
  "alias" text NOT NULL,
  "normalized_alias" text NOT NULL,
  "language" text NOT NULL DEFAULT 'und',
  "source" text NOT NULL DEFAULT 'manual',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "skill_aliases_identity_check" CHECK (length(btrim("alias")) > 0 AND length("alias") <= 300 AND "alias" = btrim("alias") AND "alias" = lower("alias") AND "alias" ~ '^[ -~]+$' AND "alias" !~ '  +' AND "normalized_alias" = "alias")
);
CREATE UNIQUE INDEX "skill_aliases_normalized_unique" ON public."skill_aliases" ("normalized_alias");
CREATE INDEX "skill_aliases_lookup_idx" ON public."skill_aliases" ("normalized_alias");

CREATE OR REPLACE FUNCTION public.prevent_current_main_skill_key_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."skill_key" IS DISTINCT FROM OLD."skill_key" THEN
    RAISE EXCEPTION 'skill_key is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER current_main_skills_skill_key_immutable
BEFORE UPDATE OF "skill_key" ON public."skills"
FOR EACH ROW EXECUTE FUNCTION public.prevent_current_main_skill_key_mutation();

CREATE TABLE public."role_skill_relations" (
  "id" text PRIMARY KEY NOT NULL,
  "role_id" text NOT NULL REFERENCES public."occupational_roles"("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "skill_id" text NOT NULL REFERENCES public."skills"("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "relation_type" text NOT NULL DEFAULT 'ROLE_REQUIRES_SKILL',
  "relation_version" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "source_type" text NOT NULL DEFAULT 'SECURIUM_AUTHORED',
  "source_id" text,
  "provenance_json" text NOT NULL DEFAULT '{}',
  "reviewed_by" text REFERENCES public."users"("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "reviewed_at" timestamptz,
  "review_evidence_json" text NOT NULL DEFAULT '[]',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "role_skill_relations_type_check" CHECK ("relation_type" = 'ROLE_REQUIRES_SKILL'),
  CONSTRAINT "role_skill_relations_version_check" CHECK ("relation_version" > 0),
  CONSTRAINT "role_skill_relations_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT "role_skill_relations_provenance_check" CHECK (length(btrim("source_type")) > 0 AND length(btrim("provenance_json")) > 2),
  CONSTRAINT "role_skill_relations_active_review_check" CHECK ("status" <> 'ACTIVE' OR ("reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL AND length(btrim("review_evidence_json")) > 2))
);
CREATE UNIQUE INDEX "role_skill_relations_edge_unique" ON public."role_skill_relations" ("role_id", "skill_id", "relation_type");
CREATE INDEX "role_skill_relations_role_status_idx" ON public."role_skill_relations" ("role_id", "status");
CREATE INDEX "role_skill_relations_skill_status_idx" ON public."role_skill_relations" ("skill_id", "status");

CREATE TABLE public."skill_concept_relations" (
  "id" text PRIMARY KEY NOT NULL,
  "skill_id" text NOT NULL REFERENCES public."skills"("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "concept_id" text NOT NULL REFERENCES public."ontology_concepts"("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "relation_type" text NOT NULL DEFAULT 'SKILL_REQUIRES_CONCEPT',
  "relation_version" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "source_type" text NOT NULL DEFAULT 'SECURIUM_AUTHORED',
  "source_id" text,
  "provenance_json" text NOT NULL DEFAULT '{}',
  "reviewed_by" text REFERENCES public."users"("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "reviewed_at" timestamptz,
  "review_evidence_json" text NOT NULL DEFAULT '[]',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "skill_concept_relations_type_check" CHECK ("relation_type" = 'SKILL_REQUIRES_CONCEPT'),
  CONSTRAINT "skill_concept_relations_version_check" CHECK ("relation_version" > 0),
  CONSTRAINT "skill_concept_relations_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT "skill_concept_relations_provenance_check" CHECK (length(btrim("source_type")) > 0 AND length(btrim("provenance_json")) > 2),
  CONSTRAINT "skill_concept_relations_active_review_check" CHECK ("status" <> 'ACTIVE' OR ("reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL AND length(btrim("review_evidence_json")) > 2))
);
CREATE UNIQUE INDEX "skill_concept_relations_edge_unique" ON public."skill_concept_relations" ("skill_id", "concept_id", "relation_type");
CREATE INDEX "skill_concept_relations_skill_status_idx" ON public."skill_concept_relations" ("skill_id", "status");
CREATE INDEX "skill_concept_relations_concept_status_idx" ON public."skill_concept_relations" ("concept_id", "status");

REVOKE ALL PRIVILEGES ON TABLE public."occupational_roles", public."occupational_role_aliases", public."skills", public."skill_aliases", public."role_skill_relations", public."skill_concept_relations" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."occupational_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."occupational_roles" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."occupational_role_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."occupational_role_aliases" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."skills" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."skill_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."skill_aliases" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."role_skill_relations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."role_skill_relations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."skill_concept_relations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."skill_concept_relations" FORCE ROW LEVEL SECURITY;

INSERT INTO public.app_schema_migrations (id, checksum)
VALUES ('0048_typed_relations_wave_b_current_main', 'typed-relations-wave-b-current-main-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
