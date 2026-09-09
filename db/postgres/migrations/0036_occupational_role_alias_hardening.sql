-- Occupational Role alias normalization and collision hardening. Production execution requires explicit approval.
BEGIN;

ALTER TABLE public."occupational_role_aliases"
  DROP CONSTRAINT "occupational_role_aliases_identity_check",
  ADD CONSTRAINT "occupational_role_aliases_identity_check" CHECK (
    length(trim("alias")) > 0
    AND length("alias") <= 300
    AND "alias" = btrim("alias")
    AND "alias" = lower("alias")
    AND "alias" !~ E'[^\\x20-\\x7E]'
    AND "alias" !~ E'[[:space:]][[:space:]]'
    AND "alias" !~ E'[\\t\\n\\r\\f\\v]'
    AND "normalized_alias" = "alias"
  );

DROP INDEX IF EXISTS public."occupational_role_aliases_role_normalized_unique";
CREATE UNIQUE INDEX "occupational_role_aliases_normalized_unique"
  ON public."occupational_role_aliases" ("normalized_alias");

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0036_occupational_role_alias_hardening', 'occupational-role-alias-hardening-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
