-- Harden legacy Concept persistence tables without changing canonical ontology authority.
-- Server-only compatibility readers/writers retain privileged database access.
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public."concepts", public."concept_versions", public."concept_labels" FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public."concepts", public."concept_versions", public."concept_labels" TO service_role;

ALTER TABLE public."concepts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."concept_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."concept_labels" ENABLE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0041_legacy_concept_rls_hardening', 'legacy-concept-rls-hardening-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
