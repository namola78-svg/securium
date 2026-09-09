-- Typed Role -> Skill -> Concept Relations Wave B. Production execution requires explicit approval.
BEGIN;

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

REVOKE ALL PRIVILEGES ON TABLE public."role_skill_relations", public."skill_concept_relations" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."role_skill_relations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."role_skill_relations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."skill_concept_relations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."skill_concept_relations" FORCE ROW LEVEL SECURITY;

INSERT INTO public.app_schema_migrations (id, checksum)
VALUES ('0042_typed_role_skill_concept_relations', 'typed-role-skill-concept-relations-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
