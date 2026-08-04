-- Add reusable ontology graph storage for concepts, aliases and edges.
-- Production execution requires explicit approval.
BEGIN;

CREATE TABLE IF NOT EXISTS "ontology_concepts" (
  "id" text PRIMARY KEY NOT NULL,
  "concept_key" text NOT NULL,
  "namespace" text NOT NULL DEFAULT 'securium',
  "label" text NOT NULL,
  "normalized_label" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "description" text NOT NULL DEFAULT '',
  "source_type" text,
  "source_id" text,
  "weight" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "metadata_json" text NOT NULL DEFAULT '{}',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "ontology_concepts_status_check" CHECK ("status" IN ('ACTIVE', 'DRAFT', 'ARCHIVED')),
  CONSTRAINT "ontology_concepts_weight_check" CHECK ("weight" >= 0 AND "weight" <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS "ontology_concepts_key_unique"
ON "ontology_concepts" ("concept_key");

CREATE INDEX IF NOT EXISTS "ontology_concepts_namespace_idx"
ON "ontology_concepts" ("namespace", "status", "weight");

CREATE INDEX IF NOT EXISTS "ontology_concepts_normalized_idx"
ON "ontology_concepts" ("normalized_label");

CREATE INDEX IF NOT EXISTS "ontology_concepts_source_idx"
ON "ontology_concepts" ("source_type", "source_id");

CREATE TABLE IF NOT EXISTS "ontology_aliases" (
  "id" text PRIMARY KEY NOT NULL,
  "concept_id" text NOT NULL REFERENCES "ontology_concepts" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  "alias" text NOT NULL,
  "normalized_alias" text NOT NULL,
  "language" text NOT NULL DEFAULT 'und',
  "source" text NOT NULL DEFAULT 'manual',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE UNIQUE INDEX IF NOT EXISTS "ontology_aliases_concept_normalized_unique"
ON "ontology_aliases" ("concept_id", "normalized_alias");

CREATE INDEX IF NOT EXISTS "ontology_aliases_lookup_idx"
ON "ontology_aliases" ("normalized_alias");

CREATE TABLE IF NOT EXISTS "ontology_edges" (
  "id" text PRIMARY KEY NOT NULL,
  "edge_key" text NOT NULL,
  "course_id" text REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "from_type" text NOT NULL,
  "from_id" text NOT NULL,
  "to_type" text NOT NULL,
  "to_id" text NOT NULL,
  "relation" text NOT NULL,
  "confidence" integer NOT NULL DEFAULT 10000,
  "evidence_json" text NOT NULL DEFAULT '[]',
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "metadata_json" text NOT NULL DEFAULT '{}',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "ontology_edges_status_check" CHECK ("status" IN ('ACTIVE', 'DRAFT', 'ARCHIVED')),
  CONSTRAINT "ontology_edges_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 10000),
  CONSTRAINT "ontology_edges_relation_check" CHECK ("relation" IN ('COVERS', 'EXPLAINS', 'TESTS', 'REUSES_CONTENT', 'ASSESSED_BY', 'PREREQUISITE_OF', 'RELATED_TO', 'DERIVED_FROM', 'PARENT_OF', 'CHILD_OF', 'SYNONYM_OF', 'CROSS_COURSE_EQUIVALENT'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "ontology_edges_key_unique"
ON "ontology_edges" ("edge_key");

CREATE INDEX IF NOT EXISTS "ontology_edges_course_relation_idx"
ON "ontology_edges" ("course_id", "relation", "status");

CREATE INDEX IF NOT EXISTS "ontology_edges_from_idx"
ON "ontology_edges" ("from_type", "from_id", "relation");

CREATE INDEX IF NOT EXISTS "ontology_edges_to_idx"
ON "ontology_edges" ("to_type", "to_id", "relation");

REVOKE ALL PRIVILEGES ON TABLE public."ontology_concepts" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."ontology_aliases" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."ontology_edges" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."ontology_concepts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ontology_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ontology_edges" ENABLE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0008_ontology_graph_storage', 'manual-ontology-graph-storage')
ON CONFLICT (id) DO NOTHING;

COMMIT;
