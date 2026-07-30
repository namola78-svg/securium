-- Additive Sprint A curriculum tree schema.
-- Production execution requires explicit approval.
BEGIN;

CREATE TABLE IF NOT EXISTS "curriculum_trees" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL,
  "title" text NOT NULL,
  "version" text NOT NULL,
  "source_type" text,
  "source_document" text,
  "effective_from" text,
  "effective_to" text,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "curriculum_trees_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "curriculum_trees_status_check" CHECK ("curriculum_trees"."status" IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "curriculum_trees_course_version_unique" ON "curriculum_trees" ("course_id", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "curriculum_trees_course_active_unique" ON "curriculum_trees" ("course_id") WHERE "status" = 'ACTIVE';
CREATE INDEX IF NOT EXISTS "curriculum_trees_course_status_idx" ON "curriculum_trees" ("course_id", "status", "version");

CREATE TABLE IF NOT EXISTS "curriculum_nodes" (
  "id" text PRIMARY KEY NOT NULL,
  "curriculum_tree_id" text NOT NULL,
  "parent_id" text,
  "node_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "official_code" text,
  "official_title" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "depth" integer NOT NULL DEFAULT 0,
  "path" text,
  "is_required" integer NOT NULL DEFAULT 1,
  "is_practical" integer NOT NULL DEFAULT 0,
  "difficulty" text,
  "importance" integer,
  "metadata" text,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "curriculum_nodes_tree_id_curriculum_trees_id_fk" FOREIGN KEY ("curriculum_tree_id") REFERENCES "curriculum_trees" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "curriculum_nodes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "curriculum_nodes" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "curriculum_nodes_status_check" CHECK ("curriculum_nodes"."status" IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  CONSTRAINT "curriculum_nodes_depth_check" CHECK ("curriculum_nodes"."depth" >= 0 AND "curriculum_nodes"."depth" <= 20),
  CONSTRAINT "curriculum_nodes_sort_order_check" CHECK ("curriculum_nodes"."sort_order" >= 0),
  CONSTRAINT "curriculum_nodes_importance_check" CHECK ("curriculum_nodes"."importance" IS NULL OR ("curriculum_nodes"."importance" >= 0 AND "curriculum_nodes"."importance" <= 100)),
  CONSTRAINT "curriculum_nodes_parent_self_check" CHECK ("curriculum_nodes"."parent_id" IS NULL OR "curriculum_nodes"."parent_id" <> "curriculum_nodes"."id"),
  CONSTRAINT "curriculum_nodes_metadata_length_check" CHECK ("curriculum_nodes"."metadata" IS NULL OR length("curriculum_nodes"."metadata") <= 20000)
);

CREATE INDEX IF NOT EXISTS "curriculum_nodes_tree_parent_order_idx" ON "curriculum_nodes" ("curriculum_tree_id", "parent_id", "sort_order", "id");
CREATE INDEX IF NOT EXISTS "curriculum_nodes_tree_path_idx" ON "curriculum_nodes" ("curriculum_tree_id", "path");
CREATE INDEX IF NOT EXISTS "curriculum_nodes_parent_idx" ON "curriculum_nodes" ("parent_id");

REVOKE ALL PRIVILEGES ON TABLE public."curriculum_trees" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."curriculum_trees" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."curriculum_nodes" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."curriculum_nodes" ENABLE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0003_curriculum_tree', 'manual-sprint-a-curriculum-tree')
ON CONFLICT (id) DO NOTHING;

COMMIT;
