-- Bounded Canonical Skill Foundation Wave A. Production execution requires explicit approval.
BEGIN;

CREATE TABLE IF NOT EXISTS public.skills (
  id text PRIMARY KEY,
  skill_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'DRAFT',
  source_type text NOT NULL,
  source_id text,
  provenance_json text NOT NULL,
  reviewed_by text REFERENCES public.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_evidence_json text NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skills_status_check CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT skills_identity_check CHECK (
    skill_key = btrim(skill_key)
    AND length(skill_key) BETWEEN 9 AND 255
    AND skill_key ~ '^skill:[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$'
    AND length(btrim(label)) > 0
    AND length(btrim(source_type)) > 0
    AND length(btrim(provenance_json)) > 2
  ),
  CONSTRAINT skills_active_review_check CHECK (
    status <> 'ACTIVE'
    OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND length(btrim(review_evidence_json)) > 2)
  )
);

CREATE TABLE IF NOT EXISTS public.skill_aliases (
  id text PRIMARY KEY,
  skill_id text NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL UNIQUE,
  language text NOT NULL DEFAULT 'und',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_aliases_identity_check CHECK (
    length(btrim(alias)) > 0
    AND length(alias) <= 300
    AND alias = btrim(alias)
    AND alias = lower(alias)
    AND alias ~ '^[ -~]+$'
    AND alias !~ '  +'
    AND normalized_alias = alias
  )
);

CREATE INDEX IF NOT EXISTS skills_status_idx ON public.skills(status, skill_key);
CREATE INDEX IF NOT EXISTS skill_aliases_lookup_idx ON public.skill_aliases(normalized_alias);

CREATE OR REPLACE FUNCTION public.prevent_skill_key_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.skill_key IS DISTINCT FROM OLD.skill_key THEN
    RAISE EXCEPTION 'skill_key is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS skills_skill_key_immutable ON public.skills;
CREATE TRIGGER skills_skill_key_immutable
BEFORE UPDATE OF skill_key ON public.skills
FOR EACH ROW EXECUTE FUNCTION public.prevent_skill_key_mutation();

REVOKE ALL ON TABLE public.skills, public.skill_aliases FROM PUBLIC, anon, authenticated;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills FORCE ROW LEVEL SECURITY;
ALTER TABLE public.skill_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_aliases FORCE ROW LEVEL SECURITY;

INSERT INTO public.app_schema_migrations (id, checksum)
VALUES ('0038_skill_foundation', 'skill-foundation-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
