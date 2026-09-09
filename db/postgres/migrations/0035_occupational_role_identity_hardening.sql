-- Occupational Role identity hardening. Production execution requires explicit approval.
BEGIN;

ALTER TABLE public."occupational_roles"
  DROP CONSTRAINT "occupational_roles_identity_check",
  ADD CONSTRAINT "occupational_roles_identity_check" CHECK (
    length(trim("role_key")) = length("role_key")
    AND length("role_key") BETWEEN 8 AND 255
    AND "role_key" ~ '^role:[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$'
    AND length(trim("label")) > 0
  );

ALTER TABLE public."occupational_role_aliases"
  ADD CONSTRAINT "occupational_role_aliases_identity_check" CHECK (
    length(trim("alias")) > 0
    AND length("alias") <= 300
    AND "alias" = btrim("alias")
    AND "alias" = lower("alias")
    AND "alias" !~ E'[[:space:]][[:space:]]'
    AND "alias" !~ E'[\\t\\n\\r\\f\\v]'
    AND "normalized_alias" = "alias"
  );

CREATE OR REPLACE FUNCTION public.occupational_roles_role_key_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."role_key" IS DISTINCT FROM OLD."role_key" THEN
    RAISE EXCEPTION 'Occupational Role semantic key is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER occupational_roles_role_key_immutable
BEFORE UPDATE OF "role_key" ON public."occupational_roles"
FOR EACH ROW EXECUTE FUNCTION public.occupational_roles_role_key_immutable();

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0035_occupational_role_identity_hardening', 'occupational-role-identity-hardening-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
