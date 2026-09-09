-- Bounded Occupational Role Foundation Wave A. Production execution requires explicit approval.
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
  CONSTRAINT "occupational_roles_identity_check" CHECK (length(trim("role_key")) > 0 AND length(trim("label")) > 0),
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
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE UNIQUE INDEX "occupational_role_aliases_role_normalized_unique" ON public."occupational_role_aliases" ("role_id", "normalized_alias");
CREATE INDEX "occupational_role_aliases_lookup_idx" ON public."occupational_role_aliases" ("normalized_alias");

REVOKE ALL PRIVILEGES ON TABLE public."occupational_roles" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."occupational_role_aliases" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."occupational_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."occupational_roles" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."occupational_role_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."occupational_role_aliases" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0034_occupational_role_foundation', 'occupational-role-foundation-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
