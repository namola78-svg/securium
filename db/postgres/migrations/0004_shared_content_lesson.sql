-- Additive Sprint B shared content and course lesson schema.
-- Production execution requires explicit approval.
BEGIN;

CREATE TABLE IF NOT EXISTS "contents" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "canonical_key" text NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL DEFAULT '',
  "body" text NOT NULL,
  "body_format" text NOT NULL DEFAULT 'MARKDOWN',
  "learning_objectives_json" text NOT NULL DEFAULT '[]',
  "core_concepts_json" text NOT NULL DEFAULT '[]',
  "practical_examples_json" text NOT NULL DEFAULT '[]',
  "diagrams_json" text NOT NULL DEFAULT '[]',
  "media_json" text NOT NULL DEFAULT '[]',
  "version" text NOT NULL DEFAULT '1.0.0',
  "status" text NOT NULL DEFAULT 'DRAFT',
  "created_by" text,
  "deleted_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "contents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "contents_status_check" CHECK ("contents"."status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT "contents_body_format_check" CHECK ("contents"."body_format" IN ('MARKDOWN', 'STRUCTURED_JSON', 'PLAIN_TEXT')),
  CONSTRAINT "contents_body_length_check" CHECK (length("contents"."body") <= 200000)
);

CREATE UNIQUE INDEX IF NOT EXISTS "contents_slug_unique" ON "contents" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "contents_canonical_key_unique" ON "contents" ("canonical_key");
CREATE INDEX IF NOT EXISTS "contents_status_idx" ON "contents" ("status", "updated_at");

CREATE TABLE IF NOT EXISTS "course_lessons" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL,
  "curriculum_node_id" text,
  "content_id" text NOT NULL,
  "display_title" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "difficulty" text,
  "importance" integer,
  "estimated_minutes" integer NOT NULL DEFAULT 10,
  "is_required" integer NOT NULL DEFAULT 1,
  "completion_rule" text NOT NULL DEFAULT 'MANUAL',
  "status" text NOT NULL DEFAULT 'DRAFT',
  "deleted_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "course_lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "course_lessons_curriculum_node_id_curriculum_nodes_id_fk" FOREIGN KEY ("curriculum_node_id") REFERENCES "curriculum_nodes" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "course_lessons_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "contents" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "course_lessons_status_check" CHECK ("course_lessons"."status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT "course_lessons_completion_rule_check" CHECK ("course_lessons"."completion_rule" IN ('MANUAL', 'SCROLL_END', 'MINIMUM_REQUIREMENTS')),
  CONSTRAINT "course_lessons_estimated_minutes_check" CHECK ("course_lessons"."estimated_minutes" > 0 AND "course_lessons"."estimated_minutes" <= 1440),
  CONSTRAINT "course_lessons_importance_check" CHECK ("course_lessons"."importance" IS NULL OR ("course_lessons"."importance" >= 0 AND "course_lessons"."importance" <= 100))
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_lessons_course_node_content_unique" ON "course_lessons" ("course_id", "curriculum_node_id", "content_id");
CREATE UNIQUE INDEX IF NOT EXISTS "course_lessons_node_order_unique" ON "course_lessons" ("course_id", "curriculum_node_id", "sort_order");
CREATE INDEX IF NOT EXISTS "course_lessons_course_listing_idx" ON "course_lessons" ("course_id", "status", "sort_order");
CREATE INDEX IF NOT EXISTS "course_lessons_content_usage_idx" ON "course_lessons" ("content_id", "course_id");

CREATE TABLE IF NOT EXISTS "course_lesson_extensions" (
  "id" text PRIMARY KEY NOT NULL,
  "course_lesson_id" text NOT NULL,
  "learning_objectives_override_json" text,
  "additional_body" text,
  "exam_points_json" text NOT NULL DEFAULT '[]',
  "practical_notes" text NOT NULL DEFAULT '',
  "legal_notes" text NOT NULL DEFAULT '',
  "standard_notes" text NOT NULL DEFAULT '',
  "evidence_notes" text NOT NULL DEFAULT '',
  "common_mistakes" text NOT NULL DEFAULT '',
  "instructor_notes" text NOT NULL DEFAULT '',
  "version" text NOT NULL DEFAULT '1.0.0',
  "status" text NOT NULL DEFAULT 'DRAFT',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "course_lesson_extensions_course_lesson_id_course_lessons_id_fk" FOREIGN KEY ("course_lesson_id") REFERENCES "course_lessons" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "course_lesson_extensions_status_check" CHECK ("course_lesson_extensions"."status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT "course_lesson_extensions_additional_body_length_check" CHECK ("course_lesson_extensions"."additional_body" IS NULL OR length("course_lesson_extensions"."additional_body") <= 100000)
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_lesson_extensions_lesson_unique" ON "course_lesson_extensions" ("course_lesson_id");
CREATE INDEX IF NOT EXISTS "course_lesson_extensions_status_idx" ON "course_lesson_extensions" ("status", "updated_at");

CREATE TABLE IF NOT EXISTS "user_course_lesson_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "course_id" text NOT NULL,
  "course_lesson_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'IN_PROGRESS',
  "progress_percent" integer NOT NULL DEFAULT 0,
  "completed_at" text,
  "last_studied_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "user_course_lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_course_lesson_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_course_lesson_progress_course_lesson_id_course_lessons_id_fk" FOREIGN KEY ("course_lesson_id") REFERENCES "course_lessons" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_course_lesson_progress_status_check" CHECK ("user_course_lesson_progress"."status" IN ('IN_PROGRESS', 'COMPLETED')),
  CONSTRAINT "user_course_lesson_progress_percent_check" CHECK ("user_course_lesson_progress"."progress_percent" >= 0 AND "user_course_lesson_progress"."progress_percent" <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_course_lesson_progress_unique" ON "user_course_lesson_progress" ("user_id", "course_id", "course_lesson_id");
CREATE INDEX IF NOT EXISTS "user_course_lesson_progress_user_course_idx" ON "user_course_lesson_progress" ("user_id", "course_id", "status", "last_studied_at");
CREATE INDEX IF NOT EXISTS "user_course_lesson_progress_lesson_idx" ON "user_course_lesson_progress" ("course_lesson_id", "status");

REVOKE ALL PRIVILEGES ON TABLE public."contents" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."contents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."course_lessons" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."course_lessons" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."course_lesson_extensions" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."course_lesson_extensions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."user_course_lesson_progress" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."user_course_lesson_progress" ENABLE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0004_shared_content_lesson', 'manual-sprint-b-shared-content-lesson')
ON CONFLICT (id) DO NOTHING;

COMMIT;
