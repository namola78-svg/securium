-- Environment-scoped auth identity bindings; the exact external tuple is historical and immutable.
-- Revocation reasons are optional: terminal timestamp and actor establish attribution, while detail may be unavailable or sensitive.
BEGIN;

CREATE TABLE public."user_auth_identity_bindings" (
  "id" text PRIMARY KEY,
  "auth_system" text NOT NULL,
  "auth_provider" text NOT NULL,
  "auth_issuer" text NOT NULL,
  "auth_project_ref" text NOT NULL,
  "environment_class" text NOT NULL,
  "auth_subject" text NOT NULL,
  "application_user_id" text NOT NULL REFERENCES public."users"("id") ON DELETE RESTRICT,
  "status" text NOT NULL CHECK ("status" IN ('PENDING', 'ACTIVE', 'REVOKED', 'SUPERSEDED')),
  "revoked_at" timestamptz,
  "revoked_by" text,
  "revocation_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" text NOT NULL,
  CONSTRAINT "user_auth_identity_bindings_revocation_check" CHECK (
    ("status" IN ('REVOKED', 'SUPERSEDED') AND "revoked_at" IS NOT NULL AND "revoked_by" IS NOT NULL)
    OR ("status" IN ('PENDING', 'ACTIVE') AND "revoked_at" IS NULL AND "revoked_by" IS NULL AND "revocation_reason" IS NULL)
  )
);

CREATE UNIQUE INDEX "user_auth_identity_bindings_tuple_unique"
  ON public."user_auth_identity_bindings" (
    "auth_system", "auth_provider", "auth_issuer", "auth_project_ref", "environment_class", "auth_subject"
  );
CREATE INDEX "user_auth_identity_bindings_user_status_idx"
  ON public."user_auth_identity_bindings" ("application_user_id", "status");

CREATE FUNCTION public.reject_user_auth_identity_binding_rewrite() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD."id", OLD."auth_system", OLD."auth_provider", OLD."auth_issuer", OLD."auth_project_ref", OLD."environment_class", OLD."auth_subject", OLD."application_user_id", OLD."created_at", OLD."created_by")
     IS DISTINCT FROM
     ROW(NEW."id", NEW."auth_system", NEW."auth_provider", NEW."auth_issuer", NEW."auth_project_ref", NEW."environment_class", NEW."auth_subject", NEW."application_user_id", NEW."created_at", NEW."created_by") THEN
    RAISE EXCEPTION 'AUTH_IDENTITY_BINDING_TUPLE_IMMUTABLE';
  END IF;
  IF OLD."status" IN ('REVOKED', 'SUPERSEDED') THEN
    RAISE EXCEPTION 'AUTH_IDENTITY_BINDING_TERMINAL_STATE_IMMUTABLE';
  END IF;
  IF (OLD."status" = 'PENDING' AND NEW."status" NOT IN ('PENDING', 'ACTIVE', 'REVOKED', 'SUPERSEDED'))
     OR (OLD."status" = 'ACTIVE' AND NEW."status" NOT IN ('ACTIVE', 'REVOKED', 'SUPERSEDED')) THEN
    RAISE EXCEPTION 'AUTH_IDENTITY_BINDING_STATUS_TRANSITION_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "user_auth_identity_bindings_identity_immutable"
BEFORE UPDATE ON public."user_auth_identity_bindings"
FOR EACH ROW EXECUTE FUNCTION public.reject_user_auth_identity_binding_rewrite();

CREATE RULE "user_auth_identity_bindings_no_delete" AS
ON DELETE TO public."user_auth_identity_bindings" DO INSTEAD NOTHING;

REVOKE ALL PRIVILEGES ON TABLE public."user_auth_identity_bindings" FROM PUBLIC, anon, authenticated, service_role;
REVOKE DELETE, TRUNCATE ON TABLE public."user_auth_identity_bindings" FROM service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public."user_auth_identity_bindings" TO service_role;
ALTER TABLE public."user_auth_identity_bindings" ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_schema_migrations (id, checksum)
VALUES ('0059_auth_identity_binding_contract', 'auth-identity-binding-contract-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
