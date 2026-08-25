-- SECURIUM GENERATED POSTGRES FRESH BASELINE V1.
-- Source: immutable published migrations plus canonical reference-state generation.
-- This artifact is not a historical migration receipt replay.
BEGIN;

-- SOURCE MIGRATION 0001
-- GENERATED from drizzle/meta/0013_snapshot.json.
-- Review before applying. Production execution requires explicit approval.
CREATE TABLE IF NOT EXISTS app_schema_migrations (
  "id" text PRIMARY KEY,
  "checksum" text NOT NULL,
  "applied_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "course_groups" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "display_order" integer NOT NULL DEFAULT 0,
  "active" integer NOT NULL DEFAULT 1,
  "is_sample" integer NOT NULL DEFAULT 0,
  "deleted_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE UNIQUE INDEX "course_groups_code_unique" ON "course_groups" ("code");
CREATE INDEX "course_groups_listing_idx" ON "course_groups" ("active", "deleted_at", "display_order");
CREATE TABLE "isms_standards" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "title" text NOT NULL,
  "major_category" text NOT NULL,
  "middle_category" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "key_points" text NOT NULL DEFAULT '',
  "evidence_examples" text NOT NULL DEFAULT '',
  "defect_examples" text NOT NULL DEFAULT '',
  "audit_points" text NOT NULL DEFAULT '',
  "version" text NOT NULL,
  "effective_date" text NOT NULL,
  "source_url" text,
  "active" integer NOT NULL DEFAULT 1,
  "is_sample" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE UNIQUE INDEX "isms_standards_code_version_unique" ON "isms_standards" ("code", "version");
CREATE INDEX "isms_standards_listing_idx" ON "isms_standards" ("active", "major_category", "middle_category", "code");
CREATE TABLE "legal_articles" (
  "id" text PRIMARY KEY NOT NULL,
  "law_name" text NOT NULL,
  "article_number" text NOT NULL,
  "article_title" text NOT NULL,
  "content" text NOT NULL,
  "effective_date" text NOT NULL,
  "revision_date" text NOT NULL,
  "source_url" text,
  "version" text NOT NULL,
  "active" integer NOT NULL DEFAULT 1,
  "is_sample" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE UNIQUE INDEX "legal_articles_identity_unique" ON "legal_articles" ("law_name", "article_number", "version");
CREATE INDEX "legal_articles_listing_idx" ON "legal_articles" ("active", "law_name", "article_number");
CREATE TABLE "privacy_impact_assessment_items" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "check_points" text NOT NULL DEFAULT '',
  "evidence_examples" text NOT NULL DEFAULT '',
  "risk_examples" text NOT NULL DEFAULT '',
  "improvement_examples" text NOT NULL DEFAULT '',
  "version" text NOT NULL,
  "effective_date" text NOT NULL,
  "active" integer NOT NULL DEFAULT 1,
  "is_sample" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE UNIQUE INDEX "privacy_impact_items_code_version_unique" ON "privacy_impact_assessment_items" ("code", "version");
CREATE INDEX "privacy_impact_items_listing_idx" ON "privacy_impact_assessment_items" ("active", "category", "code");
CREATE TABLE "risk_calculation_methods" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "formula_type" text NOT NULL,
  "configuration_json" text NOT NULL DEFAULT '{}',
  "active" integer NOT NULL DEFAULT 1,
  "is_sample" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "risk_calculation_methods_formula_check" CHECK ("risk_calculation_methods"."formula_type" IN ('MULTIPLY', 'ADD', 'WEIGHTED', 'MATRIX'))
);

CREATE UNIQUE INDEX "risk_calculation_methods_name_unique" ON "risk_calculation_methods" ("name");
CREATE TABLE "roles" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE UNIQUE INDEX "roles_code_unique" ON "roles" ("code");
CREATE TABLE "secure_coding_weaknesses" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "language" text NOT NULL,
  "cwe_code" text NOT NULL,
  "risk" text NOT NULL,
  "detection_guide" text NOT NULL DEFAULT '',
  "remediation_guide" text NOT NULL DEFAULT '',
  "reference" text NOT NULL DEFAULT '',
  "version" text NOT NULL,
  "active" integer NOT NULL DEFAULT 1,
  "is_sample" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "secure_coding_weaknesses_language_check" CHECK ("secure_coding_weaknesses"."language" IN ('Java', 'C', 'C++', 'Python', 'JavaScript', 'COMMON')),
  CONSTRAINT "secure_coding_weaknesses_risk_check" CHECK ("secure_coding_weaknesses"."risk" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

CREATE UNIQUE INDEX "secure_coding_weaknesses_code_version_unique" ON "secure_coding_weaknesses" ("code", "version");
CREATE INDEX "secure_coding_weaknesses_listing_idx" ON "secure_coding_weaknesses" ("active", "language", "category", "code");
CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "display_name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "last_signed_in_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");
CREATE INDEX "users_status_idx" ON "users" ("status");
CREATE TABLE "admin_audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "actor_user_id" text NOT NULL,
  "actor_role" text NOT NULL DEFAULT 'UNKNOWN',
  "action" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "result" text NOT NULL DEFAULT 'SUCCESS',
  "ip_hash" text,
  "user_agent_summary" text,
  "request_id" text,
  "metadata_json" text NOT NULL DEFAULT '{}',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "admin_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "admin_audit_logs_result_check" CHECK ("admin_audit_logs"."result" IN ('SUCCESS', 'FAILURE', 'DENIED')),
  CONSTRAINT "admin_audit_logs_metadata_length_check" CHECK (length("admin_audit_logs"."metadata_json") <= 10000)
);

CREATE INDEX "admin_audit_logs_actor_idx" ON "admin_audit_logs" ("actor_user_id", "created_at");
CREATE INDEX "admin_audit_logs_period_action_idx" ON "admin_audit_logs" ("created_at", "action", "result");
CREATE INDEX "admin_audit_logs_resource_idx" ON "admin_audit_logs" ("resource_type", "resource_id", "created_at");
CREATE INDEX "admin_audit_logs_request_idx" ON "admin_audit_logs" ("request_id");
CREATE TABLE "courses" (
  "id" text PRIMARY KEY NOT NULL,
  "course_group_id" text NOT NULL,
  "code" text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "short_name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "thumbnail_url" text,
  "total_levels" integer NOT NULL DEFAULT 1,
  "passing_score" integer NOT NULL DEFAULT 60,
  "difficulty" text NOT NULL DEFAULT 'BEGINNER',
  "active" integer NOT NULL DEFAULT 1,
  "published" integer NOT NULL DEFAULT 0,
  "display_order" integer NOT NULL DEFAULT 0,
  "is_sample" integer NOT NULL DEFAULT 0,
  "deleted_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "courses_course_group_id_course_groups_id_fk" FOREIGN KEY ("course_group_id") REFERENCES "course_groups" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "courses_passing_score_check" CHECK ("courses"."passing_score" >= 0 AND "courses"."passing_score" <= 100),
  CONSTRAINT "courses_total_levels_check" CHECK ("courses"."total_levels" > 0)
);

CREATE UNIQUE INDEX "courses_code_unique" ON "courses" ("code");
CREATE UNIQUE INDEX "courses_slug_unique" ON "courses" ("slug");
CREATE INDEX "courses_group_idx" ON "courses" ("course_group_id", "active", "display_order");
CREATE INDEX "courses_public_listing_idx" ON "courses" ("active", "published", "deleted_at", "display_order");
CREATE TABLE "isms_defect_cases" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "situation" text NOT NULL,
  "defect_description" text NOT NULL,
  "related_standard_id" text NOT NULL,
  "evidence" text NOT NULL DEFAULT '',
  "corrective_action" text NOT NULL DEFAULT '',
  "source" text NOT NULL,
  "source_date" text NOT NULL,
  "is_sample" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "isms_defect_cases_related_standard_id_isms_standards_id_fk" FOREIGN KEY ("related_standard_id") REFERENCES "isms_standards" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE INDEX "isms_defect_cases_standard_idx" ON "isms_defect_cases" ("related_standard_id", "source_date");
CREATE TABLE "legal_article_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "legal_article_id" text NOT NULL,
  "version" text NOT NULL,
  "content" text NOT NULL,
  "effective_date" text NOT NULL,
  "revision_date" text NOT NULL,
  "change_summary" text NOT NULL DEFAULT '',
  "source_url" text,
  "created_by" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "legal_article_versions_legal_article_id_legal_articles_id_fk" FOREIGN KEY ("legal_article_id") REFERENCES "legal_articles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "legal_article_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "legal_article_versions_unique" ON "legal_article_versions" ("legal_article_id", "version");
CREATE INDEX "legal_article_versions_date_idx" ON "legal_article_versions" ("legal_article_id", "effective_date");
CREATE TABLE "questions" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "type" text NOT NULL,
  "difficulty" text NOT NULL DEFAULT 'MEDIUM',
  "explanation" text NOT NULL DEFAULT '',
  "wrong_answer_explanation" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'DRAFT',
  "source" text,
  "source_date" text,
  "version" integer NOT NULL DEFAULT 1,
  "answer_config_json" text NOT NULL DEFAULT '{}',
  "is_sample" integer NOT NULL DEFAULT 0,
  "created_by" text NOT NULL,
  "reviewed_by" text,
  "published_at" text,
  "archived_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "questions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "questions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "questions_type_check" CHECK ("questions"."type" IN ('TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ESSAY', 'ORDERING', 'FILL_BLANK', 'CASE_ANALYSIS', 'CODE_ANALYSIS', 'LOG_ANALYSIS', 'CALCULATION')),
  CONSTRAINT "questions_status_check" CHECK ("questions"."status" IN ('DRAFT', 'REVIEW_REQUESTED', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED')),
  CONSTRAINT "questions_difficulty_check" CHECK ("questions"."difficulty" IN ('EASY', 'MEDIUM', 'HARD')),
  CONSTRAINT "questions_version_check" CHECK ("questions"."version" > 0)
);

CREATE INDEX "questions_public_idx" ON "questions" ("status", "difficulty", "published_at");
CREATE INDEX "questions_author_idx" ON "questions" ("created_by", "status");
CREATE INDEX "questions_reviewer_idx" ON "questions" ("reviewed_by", "status");
CREATE TABLE "risk_grade_criteria" (
  "id" text PRIMARY KEY NOT NULL,
  "calculation_method_id" text NOT NULL,
  "code" text NOT NULL,
  "label" text NOT NULL,
  "min_value" integer NOT NULL,
  "max_value" integer NOT NULL,
  "treatment_guidance" text NOT NULL DEFAULT '',
  "display_order" integer NOT NULL DEFAULT 0,
  CONSTRAINT "risk_grade_criteria_calculation_method_id_risk_calculation_methods_id_fk" FOREIGN KEY ("calculation_method_id") REFERENCES "risk_calculation_methods" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "risk_grade_criteria_range_check" CHECK ("risk_grade_criteria"."min_value" <= "risk_grade_criteria"."max_value")
);

CREATE UNIQUE INDEX "risk_grade_criteria_unique" ON "risk_grade_criteria" ("calculation_method_id", "code");
CREATE INDEX "risk_grade_criteria_range_idx" ON "risk_grade_criteria" ("calculation_method_id", "min_value", "max_value");
CREATE TABLE "user_learning_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "daily_question_goal" integer NOT NULL DEFAULT 20,
  "daily_study_minutes" integer NOT NULL DEFAULT 30,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "user_learning_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_learning_settings_goal_check" CHECK ("user_learning_settings"."daily_question_goal" > 0 AND "user_learning_settings"."daily_question_goal" <= 500 AND "user_learning_settings"."daily_study_minutes" > 0 AND "user_learning_settings"."daily_study_minutes" <= 1440)
);

CREATE UNIQUE INDEX "user_learning_settings_user_unique" ON "user_learning_settings" ("user_id");
CREATE TABLE "ai_generation_records" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "course_id" text NOT NULL,
  "question_id" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "generated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "source_context_ids_json" text NOT NULL DEFAULT '[]',
  "disclaimer" text NOT NULL,
  "reviewed" integer NOT NULL DEFAULT 0,
  "reviewed_by" text,
  "reviewed_at" text,
  "request_id" text NOT NULL,
  "latency_ms" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL,
  "result_json" text NOT NULL DEFAULT '{}',
  "error_code" text,
  "prompt_fingerprint" text NOT NULL,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "estimated_cost_micros" integer NOT NULL DEFAULT 0,
  "retention_until" text,
  CONSTRAINT "ai_generation_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "ai_generation_records_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "ai_generation_records_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "ai_generation_records_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "ai_generation_records_provider_check" CHECK ("ai_generation_records"."provider" IN ('mock', 'openai')),
  CONSTRAINT "ai_generation_records_status_check" CHECK ("ai_generation_records"."status" IN ('generated', 'failed', 'insufficient_context', 'reviewed', 'rejected')),
  CONSTRAINT "ai_generation_records_nonnegative_check" CHECK ("ai_generation_records"."latency_ms" >= 0 AND "ai_generation_records"."input_tokens" >= 0 AND "ai_generation_records"."output_tokens" >= 0 AND "ai_generation_records"."estimated_cost_micros" >= 0)
);

CREATE UNIQUE INDEX "ai_generation_records_request_unique" ON "ai_generation_records" ("request_id");
CREATE INDEX "ai_generation_records_user_course_idx" ON "ai_generation_records" ("user_id", "course_id", "generated_at");
CREATE INDEX "ai_generation_records_question_idx" ON "ai_generation_records" ("question_id", "generated_at");
CREATE INDEX "ai_generation_records_status_idx" ON "ai_generation_records" ("status", "generated_at");
CREATE TABLE "ai_specialized_generation_records" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "course_id" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "generated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "source_context_ids_json" text NOT NULL DEFAULT '[]',
  "disclaimer" text NOT NULL,
  "request_id" text NOT NULL,
  "latency_ms" integer NOT NULL DEFAULT 0,
  "generation_status" text NOT NULL,
  "review_status" text NOT NULL DEFAULT 'PENDING',
  "original_result_json" text NOT NULL DEFAULT '{}',
  "error_code" text,
  "input_fingerprint" text NOT NULL,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "estimated_cost_micros" integer NOT NULL DEFAULT 0,
  "retention_until" text,
  "deleted_at" text,
  CONSTRAINT "ai_specialized_generation_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "ai_specialized_generation_records_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "ai_specialized_records_target_check" CHECK ("ai_specialized_generation_records"."target_type" IN ('WRITTEN_ANSWER', 'RISK_SCENARIO', 'PRIVACY_ASSESSMENT', 'SECURE_CODE')),
  CONSTRAINT "ai_specialized_records_provider_check" CHECK ("ai_specialized_generation_records"."provider" IN ('mock', 'openai')),
  CONSTRAINT "ai_specialized_records_generation_status_check" CHECK ("ai_specialized_generation_records"."generation_status" IN ('generated', 'failed', 'insufficient_context', 'reviewed', 'rejected')),
  CONSTRAINT "ai_specialized_records_review_status_check" CHECK ("ai_specialized_generation_records"."review_status" IN ('PENDING', 'REVIEWED', 'APPROVED_WITH_EDITS', 'REJECTED', 'DELETED', 'COPIED')),
  CONSTRAINT "ai_specialized_records_nonnegative_check" CHECK ("ai_specialized_generation_records"."latency_ms" >= 0 AND "ai_specialized_generation_records"."input_tokens" >= 0 AND "ai_specialized_generation_records"."output_tokens" >= 0 AND "ai_specialized_generation_records"."estimated_cost_micros" >= 0)
);

CREATE UNIQUE INDEX "ai_specialized_records_request_unique" ON "ai_specialized_generation_records" ("request_id");
CREATE INDEX "ai_specialized_records_user_idx" ON "ai_specialized_generation_records" ("user_id", "course_id", "generated_at");
CREATE INDEX "ai_specialized_records_target_idx" ON "ai_specialized_generation_records" ("target_type", "target_id", "generated_at");
CREATE INDEX "ai_specialized_records_review_idx" ON "ai_specialized_generation_records" ("review_status", "deleted_at", "generated_at");
CREATE TABLE "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "actor_user_id" text NOT NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "course_id" text,
  "request_id" text,
  "metadata_json" text NOT NULL DEFAULT '{}',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "audit_logs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" ("actor_user_id", "created_at");
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" ("target_type", "target_id", "created_at");
CREATE TABLE "bookmarks" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "course_id" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "bookmarks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "bookmarks_target_type_check" CHECK ("bookmarks"."target_type" IN ('QUESTION', 'TOPIC', 'SUBJECT'))
);

CREATE UNIQUE INDEX "bookmarks_user_target_course_unique" ON "bookmarks" ("user_id", "target_type", "target_id", "course_id");
CREATE INDEX "bookmarks_user_course_idx" ON "bookmarks" ("user_id", "course_id", "created_at");
CREATE TABLE "content_bookmarks" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "course_id" text NOT NULL,
  "content_type" text NOT NULL,
  "content_id" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "content_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "content_bookmarks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX "content_bookmarks_unique" ON "content_bookmarks" ("user_id", "course_id", "content_type", "content_id");
CREATE INDEX "content_bookmarks_user_idx" ON "content_bookmarks" ("user_id", "course_id", "created_at");
CREATE TABLE "content_course_links" (
  "id" text PRIMARY KEY NOT NULL,
  "content_type" text NOT NULL,
  "content_id" text NOT NULL,
  "course_id" text NOT NULL,
  "relation_type" text NOT NULL DEFAULT 'RELATED',
  "display_order" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "content_course_links_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX "content_course_links_unique" ON "content_course_links" ("content_type", "content_id", "course_id", "relation_type");
CREATE INDEX "content_course_links_course_idx" ON "content_course_links" ("course_id", "content_type", "display_order");
CREATE TABLE "content_question_links" (
  "id" text PRIMARY KEY NOT NULL,
  "content_type" text NOT NULL,
  "content_id" text NOT NULL,
  "question_id" text NOT NULL,
  "relation_type" text NOT NULL DEFAULT 'RELATED',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "content_question_links_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX "content_question_links_unique" ON "content_question_links" ("content_type", "content_id", "question_id");
CREATE INDEX "content_question_links_question_idx" ON "content_question_links" ("question_id");
CREATE TABLE "content_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "content_type" text NOT NULL,
  "content_id" text NOT NULL,
  "course_id" text,
  "title" text NOT NULL,
  "content_date" text NOT NULL,
  "version" text NOT NULL,
  "revision_status" text NOT NULL DEFAULT 'draft',
  "snapshot_json" text NOT NULL,
  "reviewed_at" text,
  "reviewed_by" text,
  "published_at" text,
  "superseded_at" text,
  "change_summary" text NOT NULL DEFAULT '',
  "previous_version_id" text,
  "is_latest" integer NOT NULL DEFAULT 0,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "content_revisions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "content_revisions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "content_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "content_revisions_previous_fk" FOREIGN KEY ("previous_version_id") REFERENCES "content_revisions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "content_revisions_type_check" CHECK ("content_revisions"."content_type" IN ('LEGAL_ARTICLE', 'ISMS_STANDARD', 'PRIVACY_IMPACT_ITEM', 'SUBJECT', 'SECURE_CODING_WEAKNESS', 'LEARNING_UNIT', 'LESSON', 'QUESTION_EXPLANATION', 'AUDIO_CONTENT', 'LECTURE')),
  CONSTRAINT "content_revisions_status_check" CHECK ("content_revisions"."revision_status" IN ('draft', 'review', 'published', 'superseded', 'archived')),
  CONSTRAINT "content_revisions_latest_status_check" CHECK ("content_revisions"."is_latest" = 0 OR "content_revisions"."revision_status" = 'published'),
  CONSTRAINT "content_revisions_snapshot_length_check" CHECK (length("content_revisions"."snapshot_json") <= 100000)
);

CREATE UNIQUE INDEX "content_revisions_identity_version_unique" ON "content_revisions" ("content_type", "content_id", "version");
CREATE UNIQUE INDEX "content_revisions_single_latest_unique" ON "content_revisions" ("content_type", "content_id") WHERE "content_revisions"."is_latest" = 1;
CREATE INDEX "content_revisions_public_idx" ON "content_revisions" ("content_type", "content_id", "revision_status", "is_latest");
CREATE INDEX "content_revisions_course_idx" ON "content_revisions" ("course_id", "revision_status", "content_date");
CREATE INDEX "content_revisions_previous_idx" ON "content_revisions" ("previous_version_id");
CREATE TABLE "course_specializations" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL,
  "feature_type" text NOT NULL,
  "display_name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "configuration_json" text NOT NULL DEFAULT '{}',
  "display_order" integer NOT NULL DEFAULT 0,
  "active" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "course_specializations_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX "course_specializations_unique" ON "course_specializations" ("course_id", "feature_type");
CREATE INDEX "course_specializations_listing_idx" ON "course_specializations" ("course_id", "active", "display_order");
CREATE TABLE "learning_activities" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "course_id" text NOT NULL,
  "activity_type" text NOT NULL,
  "target_id" text NOT NULL,
  "metadata_json" text NOT NULL DEFAULT '{}',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "learning_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "learning_activities_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE INDEX "learning_activities_user_course_idx" ON "learning_activities" ("user_id", "course_id", "created_at");
CREATE TABLE "levels" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL,
  "code" text NOT NULL,
  "number" integer NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "passing_score" integer NOT NULL DEFAULT 60,
  "required_level_id" text,
  "display_order" integer NOT NULL DEFAULT 0,
  "active" integer NOT NULL DEFAULT 1,
  "published" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "levels_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "levels_required_level_fk" FOREIGN KEY ("required_level_id") REFERENCES "levels" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "levels_number_check" CHECK ("levels"."number" > 0),
  CONSTRAINT "levels_passing_score_check" CHECK ("levels"."passing_score" >= 0 AND "levels"."passing_score" <= 100)
);

CREATE UNIQUE INDEX "levels_course_code_unique" ON "levels" ("course_id", "code");
CREATE UNIQUE INDEX "levels_course_number_unique" ON "levels" ("course_id", "number");
CREATE INDEX "levels_course_listing_idx" ON "levels" ("course_id", "active", "published", "display_order");
CREATE TABLE "mock_exams" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "exam_type" text NOT NULL DEFAULT 'QUICK',
  "question_count" integer NOT NULL,
  "time_limit_minutes" integer NOT NULL,
  "passing_score" integer NOT NULL DEFAULT 60,
  "start_at" text,
  "end_at" text,
  "result_open_at" text,
  "max_attempts" integer NOT NULL DEFAULT 1,
  "randomize_questions" integer NOT NULL DEFAULT 1,
  "randomize_choices" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "published" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "mock_exams_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "mock_exams_type_check" CHECK ("mock_exams"."exam_type" IN ('QUICK', 'SUBJECT', 'REALISTIC', 'WRONG_ANSWER', 'WEAK_AREA', 'MANAGED')),
  CONSTRAINT "mock_exams_status_check" CHECK ("mock_exams"."status" IN ('DRAFT', 'READY', 'OPEN', 'CLOSED', 'ARCHIVED')),
  CONSTRAINT "mock_exams_score_check" CHECK ("mock_exams"."passing_score" >= 0 AND "mock_exams"."passing_score" <= 100),
  CONSTRAINT "mock_exams_limits_check" CHECK ("mock_exams"."question_count" > 0 AND "mock_exams"."time_limit_minutes" > 0 AND "mock_exams"."max_attempts" > 0)
);

CREATE INDEX "mock_exams_course_public_idx" ON "mock_exams" ("course_id", "published", "status", "start_at", "end_at");
CREATE TABLE "privacy_assessment_scenarios" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "organization_type" text NOT NULL,
  "system_type" text NOT NULL,
  "processed_data" text NOT NULL,
  "data_subjects" text NOT NULL,
  "processing_purpose" text NOT NULL,
  "track" text NOT NULL DEFAULT 'PRACTICE',
  "correct_target_decision" text NOT NULL,
  "expected_assessment_items_json" text NOT NULL DEFAULT '[]',
  "model_improvement_plan" text NOT NULL DEFAULT '',
  "scoring_rules_json" text NOT NULL DEFAULT '{}',
  "sample_only" integer NOT NULL DEFAULT 1,
  "active" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "privacy_assessment_scenarios_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "privacy_assessment_scenarios_track_check" CHECK ("privacy_assessment_scenarios"."track" IN ('EXAM_PREP', 'PRACTICE')),
  CONSTRAINT "privacy_assessment_scenarios_decision_check" CHECK ("privacy_assessment_scenarios"."correct_target_decision" IN ('REQUIRED', 'NOT_REQUIRED', 'REVIEW_NEEDED'))
);

CREATE INDEX "privacy_assessment_scenarios_course_idx" ON "privacy_assessment_scenarios" ("course_id", "active", "track");
CREATE TABLE "question_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "idempotency_key" text NOT NULL,
  "user_id" text NOT NULL,
  "question_id" text NOT NULL,
  "course_id" text NOT NULL,
  "mode" text NOT NULL DEFAULT 'LEARNING',
  "exam_session_id" text,
  "selected_answer" text NOT NULL,
  "is_correct" integer NOT NULL,
  "score" integer NOT NULL DEFAULT 0,
  "response_time" integer NOT NULL DEFAULT 0,
  "attempted_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "question_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "question_attempts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "question_attempts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "question_attempts_score_check" CHECK ("question_attempts"."score" >= 0 AND "question_attempts"."score" <= 100),
  CONSTRAINT "question_attempts_response_time_check" CHECK ("question_attempts"."response_time" >= 0),
  CONSTRAINT "question_attempts_mode_check" CHECK ("question_attempts"."mode" IN ('LEARNING', 'EXAM'))
);

CREATE UNIQUE INDEX "question_attempts_idempotency_unique" ON "question_attempts" ("user_id", "idempotency_key");
CREATE INDEX "question_attempts_user_course_idx" ON "question_attempts" ("user_id", "course_id", "attempted_at");
CREATE INDEX "question_attempts_question_idx" ON "question_attempts" ("question_id", "attempted_at");
CREATE TABLE "question_choices" (
  "id" text PRIMARY KEY NOT NULL,
  "question_id" text NOT NULL,
  "content" text NOT NULL,
  "display_order" integer NOT NULL DEFAULT 0,
  "is_correct" integer NOT NULL DEFAULT 0,
  "explanation" text NOT NULL DEFAULT '',
  CONSTRAINT "question_choices_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX "question_choices_order_unique" ON "question_choices" ("question_id", "display_order");
CREATE INDEX "question_choices_question_idx" ON "question_choices" ("question_id", "display_order");
CREATE TABLE "question_courses" (
  "question_id" text NOT NULL,
  "course_id" text NOT NULL,
  "weight" integer NOT NULL DEFAULT 100,
  CONSTRAINT "question_courses_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "question_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "question_courses_weight_check" CHECK ("question_courses"."weight" >= 0 AND "question_courses"."weight" <= 1000)
);

CREATE UNIQUE INDEX "question_courses_unique" ON "question_courses" ("question_id", "course_id");
CREATE INDEX "question_courses_course_idx" ON "question_courses" ("course_id", "question_id");
CREATE TABLE "question_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "question_id" text NOT NULL,
  "reason" text NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'OPEN',
  "resolution_note" text NOT NULL DEFAULT '',
  "handled_by" text,
  "handled_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "question_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "question_reports_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "question_reports_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "question_reports_reason_check" CHECK ("question_reports"."reason" IN ('WRONG_ANSWER', 'WRONG_EXPLANATION', 'TYPO', 'OUTDATED_STANDARD', 'DUPLICATE', 'OTHER')),
  CONSTRAINT "question_reports_status_check" CHECK ("question_reports"."status" IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'))
);

CREATE INDEX "question_reports_status_idx" ON "question_reports" ("status", "created_at");
CREATE INDEX "question_reports_question_idx" ON "question_reports" ("question_id", "created_at");
CREATE TABLE "question_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "question_id" text NOT NULL,
  "version" integer NOT NULL,
  "snapshot_json" text NOT NULL,
  "review_comment" text NOT NULL DEFAULT '',
  "created_by" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "question_versions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "question_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "question_versions_unique" ON "question_versions" ("question_id", "version");
CREATE INDEX "question_versions_history_idx" ON "question_versions" ("question_id", "created_at");
CREATE TABLE "review_schedules" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "course_id" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "last_reviewed_at" text,
  "next_review_at" text NOT NULL,
  "interval_days" integer NOT NULL DEFAULT 0,
  "ease_factor" integer NOT NULL DEFAULT 250,
  "consecutive_correct" integer NOT NULL DEFAULT 0,
  "consecutive_wrong" integer NOT NULL DEFAULT 0,
  "review_count" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'DUE',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "review_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "review_schedules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "review_schedules_target_check" CHECK ("review_schedules"."target_type" IN ('QUESTION', 'TOPIC', 'CONTENT', 'MOCK_EXAM_QUESTION')),
  CONSTRAINT "review_schedules_status_check" CHECK ("review_schedules"."status" IN ('DUE', 'SCHEDULED', 'PAUSED', 'MASTERED')),
  CONSTRAINT "review_schedules_interval_check" CHECK ("review_schedules"."interval_days" >= 0)
);

CREATE UNIQUE INDEX "review_schedules_user_target_course_unique" ON "review_schedules" ("user_id", "course_id", "target_type", "target_id");
CREATE INDEX "review_schedules_due_idx" ON "review_schedules" ("user_id", "status", "next_review_at");
CREATE INDEX "review_schedules_course_idx" ON "review_schedules" ("user_id", "course_id", "next_review_at");
CREATE TABLE "risk_scenarios" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL,
  "calculation_method_id" text,
  "title" text NOT NULL,
  "asset" text NOT NULL,
  "threat" text NOT NULL,
  "vulnerability" text NOT NULL,
  "existing_controls" text NOT NULL DEFAULT '',
  "likelihood" integer NOT NULL,
  "impact" integer NOT NULL,
  "risk_value" integer NOT NULL,
  "risk_level" text NOT NULL,
  "treatment_option" text NOT NULL,
  "residual_risk" integer NOT NULL DEFAULT 0,
  "description" text NOT NULL DEFAULT '',
  "reference_date" text NOT NULL,
  "is_sample" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "risk_scenarios_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "risk_scenarios_calculation_method_id_risk_calculation_methods_id_fk" FOREIGN KEY ("calculation_method_id") REFERENCES "risk_calculation_methods" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE INDEX "risk_scenarios_course_idx" ON "risk_scenarios" ("course_id", "risk_level", "created_at");
CREATE TABLE "secure_code_samples" (
  "id" text PRIMARY KEY NOT NULL,
  "weakness_id" text NOT NULL,
  "question_id" text,
  "language" text NOT NULL,
  "title" text NOT NULL,
  "vulnerable_code" text NOT NULL,
  "secure_code" text NOT NULL,
  "vulnerable_lines_json" text NOT NULL DEFAULT '[]',
  "explanation" text NOT NULL DEFAULT '',
  "false_positive_possible" integer NOT NULL DEFAULT 0,
  "expected_true_positive" integer NOT NULL DEFAULT 1,
  "call_relation" text NOT NULL DEFAULT '',
  "execution_flow" text NOT NULL DEFAULT '',
  "remediation_keywords_json" text NOT NULL DEFAULT '[]',
  "source_date" text NOT NULL,
  "sample_only" integer NOT NULL DEFAULT 1,
  "active" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "secure_code_samples_weakness_id_secure_coding_weaknesses_id_fk" FOREIGN KEY ("weakness_id") REFERENCES "secure_coding_weaknesses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "secure_code_samples_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "secure_code_samples_language_check" CHECK ("secure_code_samples"."language" IN ('Java', 'C', 'C++', 'Python', 'JavaScript'))
);

CREATE UNIQUE INDEX "secure_code_samples_question_unique" ON "secure_code_samples" ("question_id");
CREATE INDEX "secure_code_samples_listing_idx" ON "secure_code_samples" ("active", "language", "weakness_id");
CREATE TABLE "subjects" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "display_order" integer NOT NULL DEFAULT 0,
  "active" integer NOT NULL DEFAULT 1,
  "is_sample" integer NOT NULL DEFAULT 0,
  "deleted_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "subjects_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "subjects_course_code_unique" ON "subjects" ("course_id", "code");
CREATE INDEX "subjects_course_listing_idx" ON "subjects" ("course_id", "active", "deleted_at", "display_order");
CREATE TABLE "user_course_enrollments" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "course_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "enrolled_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "completed_at" text,
  "current_level" integer NOT NULL DEFAULT 1,
  "progress_percent" integer NOT NULL DEFAULT 0,
  "total_xp" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "user_course_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_course_enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "enrollments_progress_check" CHECK ("user_course_enrollments"."progress_percent" >= 0 AND "user_course_enrollments"."progress_percent" <= 100),
  CONSTRAINT "enrollments_status_check" CHECK ("user_course_enrollments"."status" IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'))
);

CREATE UNIQUE INDEX "enrollments_user_course_unique" ON "user_course_enrollments" ("user_id", "course_id");
CREATE INDEX "enrollments_user_status_idx" ON "user_course_enrollments" ("user_id", "status");
CREATE INDEX "enrollments_course_status_idx" ON "user_course_enrollments" ("course_id", "status");
CREATE TABLE "user_roles" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "role_id" text NOT NULL,
  "course_id" text,
  "granted_by" text,
  "granted_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_roles_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "user_roles_scope_unique" ON "user_roles" ("user_id", "role_id", "course_id");
CREATE INDEX "user_roles_course_idx" ON "user_roles" ("course_id", "role_id");
CREATE TABLE "written_answer_rules" (
  "question_id" text PRIMARY KEY NOT NULL,
  "model_answer" text NOT NULL,
  "required_keywords_json" text NOT NULL DEFAULT '[]',
  "optional_keywords_json" text NOT NULL DEFAULT '[]',
  "maximum_score" integer NOT NULL DEFAULT 100,
  "partial_score_rules_json" text NOT NULL DEFAULT '[]',
  "guidance" text NOT NULL DEFAULT '',
  "reference_date" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "written_answer_rules_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "written_answer_rules_score_check" CHECK ("written_answer_rules"."maximum_score" > 0)
);

CREATE TABLE "ai_reviewed_contents" (
  "id" text PRIMARY KEY NOT NULL,
  "generation_id" text NOT NULL,
  "course_id" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "title" text NOT NULL,
  "content_json" text NOT NULL,
  "created_by" text NOT NULL,
  "active" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "ai_reviewed_contents_generation_id_ai_specialized_generation_records_id_fk" FOREIGN KEY ("generation_id") REFERENCES "ai_specialized_generation_records" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "ai_reviewed_contents_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "ai_reviewed_contents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "ai_reviewed_contents_generation_unique" ON "ai_reviewed_contents" ("generation_id");
CREATE INDEX "ai_reviewed_contents_course_idx" ON "ai_reviewed_contents" ("course_id", "active", "updated_at");
CREATE TABLE "ai_specialized_reviews" (
  "id" text PRIMARY KEY NOT NULL,
  "generation_id" text NOT NULL,
  "reviewer_id" text NOT NULL,
  "revision" integer NOT NULL,
  "action" text NOT NULL,
  "edited_result_json" text NOT NULL DEFAULT '{}',
  "review_note" text NOT NULL DEFAULT '',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "ai_specialized_reviews_generation_id_ai_specialized_generation_records_id_fk" FOREIGN KEY ("generation_id") REFERENCES "ai_specialized_generation_records" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "ai_specialized_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "ai_specialized_reviews_action_check" CHECK ("ai_specialized_reviews"."action" IN ('REVIEWED', 'APPROVED_WITH_EDITS', 'REJECTED', 'DELETED', 'COPIED')),
  CONSTRAINT "ai_specialized_reviews_revision_check" CHECK ("ai_specialized_reviews"."revision" > 0)
);

CREATE UNIQUE INDEX "ai_specialized_reviews_revision_unique" ON "ai_specialized_reviews" ("generation_id", "revision");
CREATE INDEX "ai_specialized_reviews_reviewer_idx" ON "ai_specialized_reviews" ("reviewer_id", "created_at");
CREATE TABLE "code_analysis_answers" (
  "id" text PRIMARY KEY NOT NULL,
  "attempt_id" text NOT NULL,
  "sample_id" text NOT NULL,
  "selected_lines_json" text NOT NULL DEFAULT '[]',
  "weakness_id" text NOT NULL,
  "selected_cwe_code" text NOT NULL,
  "true_positive" integer NOT NULL,
  "user_explanation" text NOT NULL DEFAULT '',
  "remediation_code" text NOT NULL DEFAULT '',
  "matched_criteria_json" text NOT NULL DEFAULT '[]',
  "is_correct" integer NOT NULL,
  "score" integer NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "code_analysis_answers_attempt_id_question_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "question_attempts" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "code_analysis_answers_sample_id_secure_code_samples_id_fk" FOREIGN KEY ("sample_id") REFERENCES "secure_code_samples" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "code_analysis_answers_weakness_id_secure_coding_weaknesses_id_fk" FOREIGN KEY ("weakness_id") REFERENCES "secure_coding_weaknesses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "code_analysis_answers_attempt_unique" ON "code_analysis_answers" ("attempt_id");
CREATE INDEX "code_analysis_answers_sample_idx" ON "code_analysis_answers" ("sample_id", "created_at");
CREATE TABLE "level_contents" (
  "id" text PRIMARY KEY NOT NULL,
  "level_id" text NOT NULL,
  "content_type" text NOT NULL,
  "content_id" text NOT NULL,
  "display_order" integer NOT NULL DEFAULT 0,
  "required" integer NOT NULL DEFAULT 1,
  CONSTRAINT "level_contents_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "levels" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "level_contents_type_check" CHECK ("level_contents"."content_type" IN ('QUESTION', 'SUBJECT', 'TOPIC', 'CONTENT'))
);

CREATE UNIQUE INDEX "level_contents_unique" ON "level_contents" ("level_id", "content_type", "content_id");
CREATE INDEX "level_contents_level_idx" ON "level_contents" ("level_id", "display_order");
CREATE TABLE "mock_exam_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "mock_exam_id" text NOT NULL,
  "user_id" text NOT NULL,
  "started_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "expires_at" text NOT NULL,
  "submitted_at" text,
  "status" text NOT NULL DEFAULT 'IN_PROGRESS',
  "score" integer NOT NULL DEFAULT 0,
  "correct_count" integer NOT NULL DEFAULT 0,
  "wrong_count" integer NOT NULL DEFAULT 0,
  "unanswered_count" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "mock_exam_attempts_mock_exam_id_mock_exams_id_fk" FOREIGN KEY ("mock_exam_id") REFERENCES "mock_exams" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "mock_exam_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "mock_exam_attempts_status_check" CHECK ("mock_exam_attempts"."status" IN ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'CANCELLED')),
  CONSTRAINT "mock_exam_attempts_score_check" CHECK ("mock_exam_attempts"."score" >= 0 AND "mock_exam_attempts"."score" <= 100)
);

CREATE INDEX "mock_exam_attempts_user_exam_idx" ON "mock_exam_attempts" ("user_id", "mock_exam_id", "started_at");
CREATE INDEX "mock_exam_attempts_status_expiry_idx" ON "mock_exam_attempts" ("status", "expires_at");
CREATE TABLE "mock_exam_sections" (
  "id" text PRIMARY KEY NOT NULL,
  "mock_exam_id" text NOT NULL,
  "subject_id" text,
  "title" text NOT NULL,
  "question_count" integer NOT NULL,
  "score_weight" integer NOT NULL DEFAULT 100,
  "display_order" integer NOT NULL DEFAULT 0,
  CONSTRAINT "mock_exam_sections_mock_exam_id_mock_exams_id_fk" FOREIGN KEY ("mock_exam_id") REFERENCES "mock_exams" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "mock_exam_sections_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "mock_exam_sections_order_unique" ON "mock_exam_sections" ("mock_exam_id", "display_order");
CREATE INDEX "mock_exam_sections_exam_idx" ON "mock_exam_sections" ("mock_exam_id", "display_order");
CREATE TABLE "privacy_assessment_answers" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "scenario_id" text NOT NULL,
  "target_decision" text NOT NULL,
  "selected_assessment_items_json" text NOT NULL DEFAULT '[]',
  "identified_risks" text NOT NULL DEFAULT '',
  "improvement_plan" text NOT NULL DEFAULT '',
  "score" integer NOT NULL DEFAULT 0,
  "feedback_json" text NOT NULL DEFAULT '{}',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "privacy_assessment_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "privacy_assessment_answers_scenario_id_privacy_assessment_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "privacy_assessment_scenarios" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "privacy_assessment_answers_decision_check" CHECK ("privacy_assessment_answers"."target_decision" IN ('REQUIRED', 'NOT_REQUIRED', 'REVIEW_NEEDED')),
  CONSTRAINT "privacy_assessment_answers_score_check" CHECK ("privacy_assessment_answers"."score" >= 0 AND "privacy_assessment_answers"."score" <= 100)
);

CREATE UNIQUE INDEX "privacy_assessment_answers_user_scenario_unique" ON "privacy_assessment_answers" ("user_id", "scenario_id");
CREATE INDEX "privacy_assessment_answers_user_idx" ON "privacy_assessment_answers" ("user_id", "updated_at");
CREATE TABLE "privacy_flow_nodes" (
  "id" text PRIMARY KEY NOT NULL,
  "scenario_id" text NOT NULL,
  "node_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "system_name" text NOT NULL DEFAULT '',
  "organization_name" text NOT NULL DEFAULT '',
  "display_x" integer NOT NULL DEFAULT 0,
  "display_y" integer NOT NULL DEFAULT 0,
  "display_order" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "privacy_flow_nodes_scenario_id_privacy_assessment_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "privacy_assessment_scenarios" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "privacy_flow_nodes_type_check" CHECK ("privacy_flow_nodes"."node_type" IN ('DATA_SUBJECT', 'COLLECTION', 'PROCESSING', 'STORAGE', 'TRANSFER', 'DESTRUCTION', 'EXTERNAL'))
);

CREATE UNIQUE INDEX "privacy_flow_nodes_scenario_id_unique" ON "privacy_flow_nodes" ("scenario_id", "id");
CREATE INDEX "privacy_flow_nodes_order_idx" ON "privacy_flow_nodes" ("scenario_id", "display_order");
CREATE TABLE "question_subjects" (
  "question_id" text NOT NULL,
  "subject_id" text NOT NULL,
  CONSTRAINT "question_subjects_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "question_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "question_subjects_unique" ON "question_subjects" ("question_id", "subject_id");
CREATE INDEX "question_subjects_subject_idx" ON "question_subjects" ("subject_id", "question_id");
CREATE TABLE "risk_register_items" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "scenario_id" text NOT NULL,
  "asset" text NOT NULL,
  "threat" text NOT NULL,
  "vulnerability" text NOT NULL,
  "likelihood" integer NOT NULL,
  "impact" integer NOT NULL,
  "risk_value" integer NOT NULL,
  "treatment" text NOT NULL,
  "owner" text NOT NULL,
  "due_date" text,
  "status" text NOT NULL DEFAULT 'OPEN',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "risk_register_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "risk_register_items_scenario_id_risk_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "risk_scenarios" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "risk_register_items_status_check" CHECK ("risk_register_items"."status" IN ('OPEN', 'TREATING', 'ACCEPTED', 'CLOSED'))
);

CREATE INDEX "risk_register_items_user_idx" ON "risk_register_items" ("user_id", "status", "due_date");
CREATE TABLE "secure_code_grading_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "sample_id" text NOT NULL,
  "line_score" integer NOT NULL DEFAULT 30,
  "weakness_score" integer NOT NULL DEFAULT 20,
  "cwe_score" integer NOT NULL DEFAULT 15,
  "judgment_score" integer NOT NULL DEFAULT 15,
  "keyword_score" integer NOT NULL DEFAULT 15,
  "remediation_code_score" integer NOT NULL DEFAULT 5,
  "maximum_score" integer NOT NULL DEFAULT 100,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "secure_code_grading_rules_sample_id_secure_code_samples_id_fk" FOREIGN KEY ("sample_id") REFERENCES "secure_code_samples" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "secure_code_grading_rules_score_check" CHECK ("secure_code_grading_rules"."line_score" >= 0 AND "secure_code_grading_rules"."weakness_score" >= 0 AND "secure_code_grading_rules"."cwe_score" >= 0 AND "secure_code_grading_rules"."judgment_score" >= 0 AND "secure_code_grading_rules"."keyword_score" >= 0 AND "secure_code_grading_rules"."remediation_code_score" >= 0 AND "secure_code_grading_rules"."maximum_score" > 0)
);

CREATE UNIQUE INDEX "secure_code_grading_rules_sample_unique" ON "secure_code_grading_rules" ("sample_id");
CREATE TABLE "topics" (
  "id" text PRIMARY KEY NOT NULL,
  "subject_id" text NOT NULL,
  "parent_topic_id" text,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "display_order" integer NOT NULL DEFAULT 0,
  "active" integer NOT NULL DEFAULT 1,
  "is_sample" integer NOT NULL DEFAULT 0,
  "deleted_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "topics_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "topics_parent_topic_fk" FOREIGN KEY ("parent_topic_id") REFERENCES "topics" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "topics_subject_code_unique" ON "topics" ("subject_id", "code");
CREATE INDEX "topics_subject_listing_idx" ON "topics" ("subject_id", "active", "deleted_at", "display_order");
CREATE INDEX "topics_parent_idx" ON "topics" ("parent_topic_id");
CREATE TABLE "user_level_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "course_id" text NOT NULL,
  "level_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'LOCKED',
  "best_score" integer NOT NULL DEFAULT 0,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "completed_at" text,
  "mastered_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "user_level_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_level_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_level_progress_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "levels" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_level_progress_status_check" CHECK ("user_level_progress"."status" IN ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'MASTERED')),
  CONSTRAINT "user_level_progress_score_check" CHECK ("user_level_progress"."best_score" >= 0 AND "user_level_progress"."best_score" <= 100)
);

CREATE UNIQUE INDEX "user_level_progress_unique" ON "user_level_progress" ("user_id", "course_id", "level_id");
CREATE INDEX "user_level_progress_user_course_idx" ON "user_level_progress" ("user_id", "course_id", "status");
CREATE TABLE "wrong_notes" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "question_id" text NOT NULL,
  "course_id" text NOT NULL,
  "last_attempt_id" text NOT NULL,
  "wrong_count" integer NOT NULL DEFAULT 1,
  "mastered" integer NOT NULL DEFAULT 0,
  "user_memo" text NOT NULL DEFAULT '',
  "last_reviewed_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "wrong_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "wrong_notes_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "wrong_notes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "wrong_notes_last_attempt_id_question_attempts_id_fk" FOREIGN KEY ("last_attempt_id") REFERENCES "question_attempts" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "wrong_notes_count_check" CHECK ("wrong_notes"."wrong_count" > 0)
);

CREATE UNIQUE INDEX "wrong_notes_user_question_course_unique" ON "wrong_notes" ("user_id", "question_id", "course_id");
CREATE INDEX "wrong_notes_user_course_idx" ON "wrong_notes" ("user_id", "course_id", "mastered", "updated_at");
CREATE TABLE "learning_units" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL,
  "subject_id" text NOT NULL,
  "topic_id" text,
  "code" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "display_order" integer NOT NULL DEFAULT 0,
  "active" integer NOT NULL DEFAULT 1,
  "published" integer NOT NULL DEFAULT 0,
  "completion_policy" text NOT NULL DEFAULT 'MANUAL',
  "minimum_progress_percent" integer NOT NULL DEFAULT 100,
  "minimum_study_seconds" integer NOT NULL DEFAULT 0,
  "is_sample" integer NOT NULL DEFAULT 0,
  "deleted_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "learning_units_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "learning_units_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "learning_units_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "topics" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "learning_units_completion_policy_check" CHECK ("learning_units"."completion_policy" IN ('MANUAL', 'SCROLL_END', 'MINIMUM_REQUIREMENTS')),
  CONSTRAINT "learning_units_minimum_progress_check" CHECK ("learning_units"."minimum_progress_percent" >= 0 AND "learning_units"."minimum_progress_percent" <= 100),
  CONSTRAINT "learning_units_minimum_study_seconds_check" CHECK ("learning_units"."minimum_study_seconds" >= 0 AND "learning_units"."minimum_study_seconds" <= 86400)
);

CREATE UNIQUE INDEX "learning_units_subject_code_unique" ON "learning_units" ("subject_id", "code");
CREATE INDEX "learning_units_course_listing_idx" ON "learning_units" ("course_id", "active", "published", "deleted_at", "display_order");
CREATE INDEX "learning_units_subject_listing_idx" ON "learning_units" ("subject_id", "active", "published", "display_order");
CREATE INDEX "learning_units_topic_idx" ON "learning_units" ("topic_id", "display_order");
CREATE TABLE "lectures" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL,
  "subject_id" text NOT NULL,
  "topic_id" text NOT NULL,
  "title" text NOT NULL,
  "instructor_name" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "video_provider" text NOT NULL,
  "video_url" text NOT NULL,
  "thumbnail_url" text NOT NULL DEFAULT '',
  "duration_seconds" integer NOT NULL,
  "free" integer NOT NULL DEFAULT 0,
  "published" integer NOT NULL DEFAULT 0,
  "display_order" integer NOT NULL DEFAULT 0,
  "is_sample" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "lectures_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "lectures_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "lectures_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "topics" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "lectures_duration_check" CHECK ("lectures"."duration_seconds" > 0 AND "lectures"."duration_seconds" <= 86400),
  CONSTRAINT "lectures_display_order_check" CHECK ("lectures"."display_order" >= 0)
);

CREATE UNIQUE INDEX "lectures_topic_order_unique" ON "lectures" ("topic_id", "display_order");
CREATE INDEX "lectures_course_listing_idx" ON "lectures" ("course_id", "published", "display_order");
CREATE INDEX "lectures_subject_listing_idx" ON "lectures" ("subject_id", "published", "display_order");
CREATE INDEX "lectures_topic_listing_idx" ON "lectures" ("topic_id", "published", "display_order");
CREATE TABLE "mock_exam_answers" (
  "id" text PRIMARY KEY NOT NULL,
  "attempt_id" text NOT NULL,
  "question_id" text NOT NULL,
  "answer_data" text NOT NULL DEFAULT '',
  "is_correct" integer,
  "score" integer,
  "answered_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "mock_exam_answers_attempt_id_mock_exam_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "mock_exam_attempts" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "mock_exam_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "mock_exam_answers_attempt_question_unique" ON "mock_exam_answers" ("attempt_id", "question_id");
CREATE INDEX "mock_exam_answers_attempt_idx" ON "mock_exam_answers" ("attempt_id", "answered_at");
CREATE TABLE "mock_exam_questions" (
  "mock_exam_id" text NOT NULL,
  "question_id" text NOT NULL,
  "section_id" text,
  "score" integer NOT NULL DEFAULT 10,
  "display_order" integer NOT NULL DEFAULT 0,
  CONSTRAINT "mock_exam_questions_mock_exam_id_mock_exams_id_fk" FOREIGN KEY ("mock_exam_id") REFERENCES "mock_exams" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "mock_exam_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "mock_exam_questions_section_id_mock_exam_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "mock_exam_sections" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "mock_exam_questions_unique" ON "mock_exam_questions" ("mock_exam_id", "question_id");
CREATE UNIQUE INDEX "mock_exam_questions_order_unique" ON "mock_exam_questions" ("mock_exam_id", "display_order");
CREATE INDEX "mock_exam_questions_section_idx" ON "mock_exam_questions" ("section_id", "display_order");
CREATE TABLE "privacy_flow_edges" (
  "id" text PRIMARY KEY NOT NULL,
  "scenario_id" text NOT NULL,
  "source_node_id" text NOT NULL,
  "target_node_id" text NOT NULL,
  "data_types" text NOT NULL,
  "transfer_method" text NOT NULL,
  "purpose" text NOT NULL DEFAULT '',
  "protection_measures" text NOT NULL DEFAULT '',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "privacy_flow_edges_scenario_id_privacy_assessment_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "privacy_assessment_scenarios" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "privacy_flow_edges_source_fk" FOREIGN KEY ("scenario_id", "source_node_id") REFERENCES "privacy_flow_nodes" ("scenario_id", "id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "privacy_flow_edges_target_fk" FOREIGN KEY ("scenario_id", "target_node_id") REFERENCES "privacy_flow_nodes" ("scenario_id", "id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "privacy_flow_edges_self_check" CHECK ("privacy_flow_edges"."source_node_id" <> "privacy_flow_edges"."target_node_id")
);

CREATE UNIQUE INDEX "privacy_flow_edges_unique" ON "privacy_flow_edges" ("scenario_id", "source_node_id", "target_node_id", "data_types");
CREATE INDEX "privacy_flow_edges_scenario_idx" ON "privacy_flow_edges" ("scenario_id");
CREATE TABLE "question_topics" (
  "question_id" text NOT NULL,
  "topic_id" text NOT NULL,
  CONSTRAINT "question_topics_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "question_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "topics" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "question_topics_unique" ON "question_topics" ("question_id", "topic_id");
CREATE INDEX "question_topics_topic_idx" ON "question_topics" ("topic_id", "question_id");
CREATE TABLE "user_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "course_id" text NOT NULL,
  "subject_id" text NOT NULL,
  "topic_id" text NOT NULL,
  "progress_percent" integer NOT NULL DEFAULT 0,
  "completed_lessons" integer NOT NULL DEFAULT 0,
  "completed_questions" integer NOT NULL DEFAULT 0,
  "correct_answers" integer NOT NULL DEFAULT 0,
  "total_answers" integer NOT NULL DEFAULT 0,
  "last_studied_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_progress_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_progress_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "topics" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_progress_percent_check" CHECK ("user_progress"."progress_percent" >= 0 AND "user_progress"."progress_percent" <= 100)
);

CREATE UNIQUE INDEX "user_progress_scope_unique" ON "user_progress" ("user_id", "course_id", "subject_id", "topic_id");
CREATE INDEX "user_progress_user_course_idx" ON "user_progress" ("user_id", "course_id", "last_studied_at");
CREATE TABLE "lecture_bookmarks" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "lecture_id" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "lecture_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "lecture_bookmarks_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "lectures" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "lecture_bookmarks_user_lecture_unique" ON "lecture_bookmarks" ("user_id", "lecture_id");
CREATE INDEX "lecture_bookmarks_user_recent_idx" ON "lecture_bookmarks" ("user_id", "created_at");
CREATE TABLE "lecture_notes" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "lecture_id" text NOT NULL,
  "content" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "lecture_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "lecture_notes_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "lectures" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "lecture_notes_content_length_check" CHECK (length("lecture_notes"."content") <= 4000)
);

CREATE UNIQUE INDEX "lecture_notes_user_lecture_unique" ON "lecture_notes" ("user_id", "lecture_id");
CREATE INDEX "lecture_notes_user_updated_idx" ON "lecture_notes" ("user_id", "updated_at");
CREATE TABLE "lecture_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "lecture_id" text NOT NULL,
  "current_position_seconds" integer NOT NULL DEFAULT 0,
  "completed" integer NOT NULL DEFAULT 0,
  "completed_at" text,
  "last_played_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "lecture_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "lecture_progress_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "lectures" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "lecture_progress_position_check" CHECK ("lecture_progress"."current_position_seconds" >= 0)
);

CREATE UNIQUE INDEX "lecture_progress_user_lecture_unique" ON "lecture_progress" ("user_id", "lecture_id");
CREATE INDEX "lecture_progress_user_recent_idx" ON "lecture_progress" ("user_id", "last_played_at");
CREATE INDEX "lecture_progress_lecture_completed_idx" ON "lecture_progress" ("lecture_id", "completed");
CREATE TABLE "lessons" (
  "id" text PRIMARY KEY NOT NULL,
  "learning_unit_id" text,
  "course_id" text NOT NULL,
  "subject_id" text NOT NULL,
  "topic_id" text NOT NULL,
  "code" text NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL DEFAULT '',
  "content" text NOT NULL,
  "content_format" text NOT NULL DEFAULT 'PLAIN_TEXT',
  "estimated_minutes" integer NOT NULL DEFAULT 10,
  "display_order" integer NOT NULL DEFAULT 0,
  "active" integer NOT NULL DEFAULT 1,
  "published" integer NOT NULL DEFAULT 0,
  "is_sample" integer NOT NULL DEFAULT 0,
  "version" integer NOT NULL DEFAULT 1,
  "deleted_at" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "lessons_learning_unit_id_learning_units_id_fk" FOREIGN KEY ("learning_unit_id") REFERENCES "learning_units" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "lessons_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "lessons_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "topics" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "lessons_content_format_check" CHECK ("lessons"."content_format" IN ('PLAIN_TEXT', 'MARKDOWN')),
  CONSTRAINT "lessons_estimated_minutes_check" CHECK ("lessons"."estimated_minutes" > 0 AND "lessons"."estimated_minutes" <= 1440),
  CONSTRAINT "lessons_version_check" CHECK ("lessons"."version" > 0)
);

CREATE UNIQUE INDEX "lessons_topic_code_unique" ON "lessons" ("topic_id", "code");
CREATE UNIQUE INDEX "lessons_learning_unit_code_unique" ON "lessons" ("learning_unit_id", "code");
CREATE INDEX "lessons_learning_unit_listing_idx" ON "lessons" ("learning_unit_id", "active", "published", "display_order");
CREATE INDEX "lessons_course_listing_idx" ON "lessons" ("course_id", "active", "published", "deleted_at", "display_order");
CREATE INDEX "lessons_subject_listing_idx" ON "lessons" ("subject_id", "active", "published", "display_order");
CREATE INDEX "lessons_topic_listing_idx" ON "lessons" ("topic_id", "active", "published", "display_order");
CREATE TABLE "audio_contents" (
  "id" text PRIMARY KEY NOT NULL,
  "lesson_id" text NOT NULL,
  "title" text NOT NULL,
  "audio_url" text NOT NULL DEFAULT '',
  "transcript" text NOT NULL DEFAULT '',
  "transcript_segments_json" text NOT NULL DEFAULT '[]',
  "duration_seconds" integer NOT NULL,
  "voice_provider" text NOT NULL DEFAULT '',
  "voice_name" text NOT NULL DEFAULT '',
  "speed_options_json" text NOT NULL DEFAULT '[0.75,1,1.25,1.5,2]',
  "published" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "audio_contents_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "lessons" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "audio_contents_duration_check" CHECK ("audio_contents"."duration_seconds" > 0 AND "audio_contents"."duration_seconds" <= 86400)
);

CREATE INDEX "audio_contents_lesson_listing_idx" ON "audio_contents" ("lesson_id", "published", "created_at");
CREATE TABLE "user_lesson_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "course_id" text NOT NULL,
  "lesson_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'IN_PROGRESS',
  "progress_percent" integer NOT NULL DEFAULT 0,
  "started_at" text,
  "completed_at" text,
  "last_viewed_at" text NOT NULL DEFAULT '',
  "last_position" integer NOT NULL DEFAULT 0,
  "study_seconds" integer NOT NULL DEFAULT 0,
  "last_studied_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "user_lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_lesson_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "lessons" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_lesson_progress_status_check" CHECK ("user_lesson_progress"."status" IN ('IN_PROGRESS', 'COMPLETED')),
  CONSTRAINT "user_lesson_progress_percent_check" CHECK ("user_lesson_progress"."progress_percent" >= 0 AND "user_lesson_progress"."progress_percent" <= 100)
);

CREATE UNIQUE INDEX "user_lesson_progress_unique" ON "user_lesson_progress" ("user_id", "lesson_id");
CREATE INDEX "user_lesson_progress_user_course_idx" ON "user_lesson_progress" ("user_id", "course_id", "status", "last_studied_at");
CREATE INDEX "user_lesson_progress_lesson_idx" ON "user_lesson_progress" ("lesson_id", "status");
CREATE TABLE "audio_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "audio_content_id" text NOT NULL,
  "current_position_seconds" integer NOT NULL DEFAULT 0,
  "completed" integer NOT NULL DEFAULT 0,
  "completed_at" text,
  "last_played_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "audio_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "audio_progress_audio_content_id_audio_contents_id_fk" FOREIGN KEY ("audio_content_id") REFERENCES "audio_contents" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "audio_progress_position_check" CHECK ("audio_progress"."current_position_seconds" >= 0)
);

CREATE UNIQUE INDEX "audio_progress_user_content_unique" ON "audio_progress" ("user_id", "audio_content_id");
CREATE INDEX "audio_progress_user_recent_idx" ON "audio_progress" ("user_id", "last_played_at");
CREATE INDEX "audio_progress_content_completed_idx" ON "audio_progress" ("audio_content_id", "completed");

-- SOURCE MIGRATION 0003
-- Additive Sprint A curriculum tree schema.
-- Production execution requires explicit approval.
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

-- SOURCE MIGRATION 0004
-- Additive Sprint B shared content and course lesson schema.
-- Production execution requires explicit approval.
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

-- SOURCE MIGRATION 0005
-- Additive Sprint F CourseLesson to Lesson bridge and progress backfill.
-- Production execution requires explicit approval.
ALTER TABLE "course_lessons"
  ADD COLUMN IF NOT EXISTS "lesson_id" text;

ALTER TABLE "course_lessons"
  ADD COLUMN IF NOT EXISTS "unlock_condition" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'course_lessons_lesson_id_lessons_id_fk'
  ) THEN
    ALTER TABLE "course_lessons"
      ADD CONSTRAINT "course_lessons_lesson_id_lessons_id_fk"
      FOREIGN KEY ("lesson_id") REFERENCES "lessons" ("id")
      ON UPDATE NO ACTION ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE "user_course_lesson_progress"
  ADD COLUMN IF NOT EXISTS "last_viewed_at" text;

ALTER TABLE "user_course_lesson_progress"
  ADD COLUMN IF NOT EXISTS "time_spent_seconds" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "course_lessons_lesson_usage_idx"
  ON "course_lessons" ("lesson_id", "course_id");

CREATE UNIQUE INDEX IF NOT EXISTS "course_lessons_course_lesson_unique"
  ON "course_lessons" ("course_id", "lesson_id")
  WHERE "lesson_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "user_course_lesson_progress_viewed_idx"
  ON "user_course_lesson_progress" ("user_id", "course_id", "last_viewed_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_course_lesson_progress_time_spent_check'
  ) THEN
    ALTER TABLE "user_course_lesson_progress"
      ADD CONSTRAINT "user_course_lesson_progress_time_spent_check"
      CHECK ("time_spent_seconds" >= 0 AND "time_spent_seconds" <= 31536000);
  END IF;
END $$;

INSERT INTO contents
  (id, slug, canonical_key, title, summary, body, body_format,
   learning_objectives_json, core_concepts_json, practical_examples_json,
   diagrams_json, media_json, version, status, created_by, deleted_at,
   created_at, updated_at)
SELECT
  'content-from-lesson-' || l.id,
  'lesson-' || lower(replace(l.id, '_', '-')),
  'lesson.' || l.id,
  l.title,
  l.summary,
  l.content,
  CASE WHEN l.content_format = 'MARKDOWN' THEN 'MARKDOWN' ELSE 'PLAIN_TEXT' END,
  '[]',
  '[]',
  '[]',
  '[]',
  '[]',
  cast(l.version AS text),
  CASE WHEN l.active = 1 AND l.published = 1 AND l.deleted_at IS NULL THEN 'PUBLISHED' ELSE 'DRAFT' END,
  NULL,
  l.deleted_at,
  l.created_at,
  l.updated_at
FROM lessons l
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_lessons
  (id, course_id, curriculum_node_id, content_id, lesson_id, display_title,
   sort_order, difficulty, importance, estimated_minutes, is_required,
   unlock_condition, completion_rule, status, deleted_at, created_at, updated_at)
SELECT
  'course-lesson-from-' || l.id,
  l.course_id,
  NULL,
  'content-from-lesson-' || l.id,
  l.id,
  l.title,
  l.display_order,
  NULL,
  NULL,
  l.estimated_minutes,
  1,
  NULL,
  'MANUAL',
  CASE WHEN l.active = 1 AND l.published = 1 AND l.deleted_at IS NULL THEN 'PUBLISHED' ELSE 'DRAFT' END,
  l.deleted_at,
  l.created_at,
  l.updated_at
FROM lessons l
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_course_lesson_progress
  (id, user_id, course_id, course_lesson_id, status, progress_percent,
   completed_at, last_viewed_at, time_spent_seconds, last_studied_at,
   created_at, updated_at)
SELECT
  'course-lesson-progress-from-' || ulp.id,
  ulp.user_id,
  ulp.course_id,
  'course-lesson-from-' || ulp.lesson_id,
  ulp.status,
  ulp.progress_percent,
  ulp.completed_at,
  ulp.last_viewed_at,
  ulp.study_seconds,
  ulp.last_studied_at,
  ulp.created_at,
  ulp.updated_at
FROM user_lesson_progress ulp
WHERE EXISTS (
  SELECT 1
  FROM course_lessons cl
  WHERE cl.id = 'course-lesson-from-' || ulp.lesson_id
)
ON CONFLICT (id) DO NOTHING;

-- SOURCE MIGRATION 0006
-- Add a lookup index for dashboard recommendation anti-joins.
-- Production execution requires explicit approval.
CREATE INDEX IF NOT EXISTS "question_attempts_user_course_question_idx"
ON "question_attempts" ("user_id", "course_id", "question_id");

-- SOURCE MIGRATION 0007
-- Add administrator feedback storage for AI explainability traces.
-- Production execution requires explicit approval.
CREATE TABLE IF NOT EXISTS "ai_explainability_feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "trace_source" text NOT NULL,
  "question_generation_id" text REFERENCES "ai_generation_records" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "specialized_generation_id" text REFERENCES "ai_specialized_generation_records" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "reviewer_id" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "rating" text NOT NULL,
  "issue_type" text NOT NULL,
  "note" text NOT NULL DEFAULT '',
  "metadata_json" text NOT NULL DEFAULT '{}',
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "ai_explainability_feedback_trace_source_check" CHECK ("trace_source" IN ('QUESTION_EXPLANATION', 'SPECIALIZED_REVIEW')),
  CONSTRAINT "ai_explainability_feedback_rating_check" CHECK ("rating" IN ('HELPFUL', 'NOT_HELPFUL', 'NEEDS_REVIEW')),
  CONSTRAINT "ai_explainability_feedback_issue_type_check" CHECK ("issue_type" IN ('NONE', 'LOW_QUALITY_CONTEXT', 'MISSING_CITATION', 'WRONG_CONCEPT', 'PROMPT_ISSUE', 'SENSITIVE_CONTENT_RISK', 'OTHER')),
  CONSTRAINT "ai_explainability_feedback_target_check" CHECK (
    ("trace_source" = 'QUESTION_EXPLANATION' AND "question_generation_id" IS NOT NULL AND "specialized_generation_id" IS NULL)
    OR
    ("trace_source" = 'SPECIALIZED_REVIEW' AND "specialized_generation_id" IS NOT NULL AND "question_generation_id" IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS "ai_explainability_feedback_trace_idx"
ON "ai_explainability_feedback" ("trace_source", "created_at");

CREATE INDEX IF NOT EXISTS "ai_explainability_feedback_reviewer_idx"
ON "ai_explainability_feedback" ("reviewer_id", "created_at");

CREATE INDEX IF NOT EXISTS "ai_explainability_feedback_question_idx"
ON "ai_explainability_feedback" ("question_generation_id");

CREATE INDEX IF NOT EXISTS "ai_explainability_feedback_specialized_idx"
ON "ai_explainability_feedback" ("specialized_generation_id");

REVOKE ALL PRIVILEGES ON TABLE public."ai_explainability_feedback" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."ai_explainability_feedback" ENABLE ROW LEVEL SECURITY;

-- SOURCE MIGRATION 0008
-- Add reusable ontology graph storage for concepts, aliases and edges.
-- Production execution requires explicit approval.
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

-- SOURCE MIGRATION 0010
-- Add immutable Practical versions, user-owned attempts, and append-only evaluations.
-- Production execution requires explicit approval.
CREATE TABLE IF NOT EXISTS "practical_rubric_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "rubric_id" text NOT NULL,
  "version" integer NOT NULL,
  "snapshot_format_version" integer NOT NULL DEFAULT 1,
  "snapshot_json" text NOT NULL,
  "snapshot_digest" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "effective_from" text,
  "withdrawn_at" text,
  CONSTRAINT "practical_rubric_versions_version_check" CHECK ("version" > 0),
  CONSTRAINT "practical_rubric_versions_format_check" CHECK ("snapshot_format_version" > 0),
  CONSTRAINT "practical_rubric_versions_snapshot_length_check" CHECK (length("snapshot_json") <= 100000),
  CONSTRAINT "practical_rubric_versions_digest_check" CHECK ("snapshot_digest" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "practical_rubric_versions_identity_unique"
ON "practical_rubric_versions" ("rubric_id", "version");

CREATE TABLE IF NOT EXISTS "practical_definition_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "practical_id" text NOT NULL,
  "version" integer NOT NULL,
  "rubric_version_id" text NOT NULL REFERENCES "practical_rubric_versions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "snapshot_format_version" integer NOT NULL DEFAULT 1,
  "snapshot_json" text NOT NULL,
  "snapshot_digest" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "effective_from" text,
  "withdrawn_at" text,
  CONSTRAINT "practical_definition_versions_version_check" CHECK ("version" > 0),
  CONSTRAINT "practical_definition_versions_format_check" CHECK ("snapshot_format_version" > 0),
  CONSTRAINT "practical_definition_versions_snapshot_length_check" CHECK (length("snapshot_json") <= 100000),
  CONSTRAINT "practical_definition_versions_digest_check" CHECK ("snapshot_digest" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "practical_definition_versions_identity_unique"
ON "practical_definition_versions" ("practical_id", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "practical_definition_versions_rubric_binding_unique"
ON "practical_definition_versions" ("id", "rubric_version_id");

CREATE TABLE IF NOT EXISTS "practical_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "practical_id" text NOT NULL,
  "practical_definition_version_id" text NOT NULL,
  "rubric_version_id" text NOT NULL,
  "course_id" text NOT NULL REFERENCES "courses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "curriculum_tree_id" text NOT NULL REFERENCES "curriculum_trees" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "curriculum_tree_version_reference" text NOT NULL,
  "curriculum_node_id" text NOT NULL REFERENCES "curriculum_nodes" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "objective_placement_id" text NOT NULL,
  "practical_placement_id" text NOT NULL,
  "state" text NOT NULL DEFAULT 'IN_PROGRESS',
  "responses_json" text NOT NULL DEFAULT '[]',
  "artifact_manifest_json" text NOT NULL DEFAULT '[]',
  "submission_digest" text,
  "creation_idempotency_key" text NOT NULL,
  "submission_idempotency_key" text,
  "draft_revision" integer NOT NULL DEFAULT 0,
  "started_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "submitted_at" text,
  "expires_at" text,
  "expired_at" text,
  "voided_at" text,
  "void_reason_code" text,
  "eligibility_decision_reference" text,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "updated_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "practical_attempts_definition_rubric_fk"
    FOREIGN KEY ("practical_definition_version_id", "rubric_version_id")
    REFERENCES "practical_definition_versions" ("id", "rubric_version_id")
    ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "practical_attempts_state_check" CHECK ("state" IN ('IN_PROGRESS', 'SUBMITTED', 'EVALUATED', 'EXPIRED', 'VOIDED')),
  CONSTRAINT "practical_attempts_responses_length_check" CHECK (length("responses_json") <= 100000),
  CONSTRAINT "practical_attempts_artifact_manifest_length_check" CHECK (length("artifact_manifest_json") <= 20000),
  CONSTRAINT "practical_attempts_submission_digest_check" CHECK ("submission_digest" IS NULL OR "submission_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "practical_attempts_draft_revision_check" CHECK ("draft_revision" >= 0),
  CONSTRAINT "practical_attempts_void_reason_length_check" CHECK ("void_reason_code" IS NULL OR length("void_reason_code") <= 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS "practical_attempts_creation_idempotency_unique"
ON "practical_attempts" ("user_id", "creation_idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "practical_attempts_submission_idempotency_unique"
ON "practical_attempts" ("user_id", "submission_idempotency_key")
WHERE "submission_idempotency_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "practical_attempts_version_binding_unique"
ON "practical_attempts" ("id", "practical_definition_version_id", "rubric_version_id");
CREATE INDEX IF NOT EXISTS "practical_attempts_user_history_idx"
ON "practical_attempts" ("user_id", "practical_id", "started_at");
CREATE INDEX IF NOT EXISTS "practical_attempts_user_state_idx"
ON "practical_attempts" ("user_id", "state", "updated_at");
CREATE INDEX IF NOT EXISTS "practical_attempts_expiration_idx"
ON "practical_attempts" ("state", "expires_at");

CREATE TABLE IF NOT EXISTS "practical_evaluations" (
  "id" text PRIMARY KEY NOT NULL,
  "attempt_id" text NOT NULL,
  "sequence" integer NOT NULL,
  "previous_evaluation_id" text,
  "practical_definition_version_id" text NOT NULL,
  "rubric_version_id" text NOT NULL,
  "method" text NOT NULL,
  "dimension_results_json" text NOT NULL,
  "raw_score" double precision,
  "maximum_score" double precision,
  "qualification" text NOT NULL,
  "review_status" text NOT NULL DEFAULT 'NOT_REQUIRED',
  "provenance_json" text NOT NULL,
  "reviewer_id" text REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "reviewed_at" text,
  "review_reason" text,
  "evaluation_payload_digest" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "evaluator_job_id" text,
  "evaluator_result_id" text,
  "evaluated_at" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "practical_evaluations_attempt_version_fk"
    FOREIGN KEY ("attempt_id", "practical_definition_version_id", "rubric_version_id")
    REFERENCES "practical_attempts" ("id", "practical_definition_version_id", "rubric_version_id")
    ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "practical_evaluations_previous_fk"
    FOREIGN KEY ("previous_evaluation_id") REFERENCES "practical_evaluations" ("id")
    ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "practical_evaluations_sequence_check" CHECK ("sequence" >= 1),
  CONSTRAINT "practical_evaluations_method_check" CHECK ("method" IN ('DETERMINISTIC', 'RUBRIC', 'AI_ASSISTED', 'HUMAN_REVIEWED', 'HYBRID')),
  CONSTRAINT "practical_evaluations_qualification_check" CHECK ("qualification" IN ('QUALIFIED', 'NOT_QUALIFIED', 'PENDING_REVIEW')),
  CONSTRAINT "practical_evaluations_review_status_check" CHECK ("review_status" IN ('NOT_REQUIRED', 'PENDING', 'COMPLETED')),
  CONSTRAINT "practical_evaluations_dimension_results_length_check" CHECK (length("dimension_results_json") <= 100000),
  CONSTRAINT "practical_evaluations_provenance_length_check" CHECK (length("provenance_json") <= 10000),
  CONSTRAINT "practical_evaluations_review_reason_length_check" CHECK ("review_reason" IS NULL OR length("review_reason") <= 2000),
  CONSTRAINT "practical_evaluations_score_pair_check" CHECK (
    ("raw_score" IS NULL AND "maximum_score" IS NULL)
    OR (
      "raw_score" IS NOT NULL AND "maximum_score" IS NOT NULL
      AND "raw_score" >= 0 AND "maximum_score" > 0 AND "raw_score" <= "maximum_score"
      AND "raw_score" NOT IN ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)
      AND "maximum_score" NOT IN ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)
    )
  ),
  CONSTRAINT "practical_evaluations_ai_qualification_check" CHECK (NOT ("method" = 'AI_ASSISTED' AND "qualification" = 'QUALIFIED')),
  CONSTRAINT "practical_evaluations_evaluator_identity_check" CHECK (
    ("evaluator_job_id" IS NULL AND "evaluator_result_id" IS NULL)
    OR ("evaluator_job_id" IS NOT NULL AND "evaluator_result_id" IS NOT NULL)
  ),
  CONSTRAINT "practical_evaluations_digest_check" CHECK ("evaluation_payload_digest" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "practical_evaluations_sequence_unique"
ON "practical_evaluations" ("attempt_id", "sequence");
CREATE UNIQUE INDEX IF NOT EXISTS "practical_evaluations_operation_unique"
ON "practical_evaluations" ("attempt_id", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "practical_evaluations_predecessor_unique"
ON "practical_evaluations" ("previous_evaluation_id")
WHERE "previous_evaluation_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "practical_evaluations_evaluator_result_unique"
ON "practical_evaluations" ("attempt_id", "evaluator_job_id", "evaluator_result_id")
WHERE "evaluator_job_id" IS NOT NULL AND "evaluator_result_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "practical_evaluations_review_queue_idx"
ON "practical_evaluations" ("review_status", "created_at");

REVOKE ALL PRIVILEGES ON TABLE public."practical_rubric_versions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."practical_definition_versions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."practical_attempts" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."practical_evaluations" FROM PUBLIC, anon, authenticated;

ALTER TABLE public."practical_rubric_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_rubric_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."practical_definition_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_definition_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."practical_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_attempts" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."practical_evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_evaluations" FORCE ROW LEVEL SECURITY;

-- SOURCE MIGRATION 0011
-- FR-1A canonical Fact repository foundation (PostgreSQL parity migration).
CREATE TABLE IF NOT EXISTS "fact_identities" (
  "id" text PRIMARY KEY NOT NULL,
  "canonical_key" text NOT NULL,
  "domain" text NOT NULL,
  "canonical_label" text NOT NULL,
  "normalized_semantic_identity" text NOT NULL,
  "scope_discriminator" text NOT NULL,
  "lifecycle_state" text NOT NULL DEFAULT 'DRAFT',
  "created_by" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  "retired_at" text,
  CONSTRAINT "fact_identities_scope_check" CHECK (length(trim("scope_discriminator")) > 0 AND length("scope_discriminator") <= 300),
  CONSTRAINT "fact_identities_lifecycle_check" CHECK ("lifecycle_state" IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  CONSTRAINT "fact_identities_semantic_identity_check" CHECK (length(trim("normalized_semantic_identity")) > 0 AND length("normalized_semantic_identity") <= 300)
);

CREATE UNIQUE INDEX IF NOT EXISTS "fact_identities_canonical_key_unique"
ON "fact_identities" ("canonical_key");
CREATE INDEX IF NOT EXISTS "fact_identities_domain_lifecycle_idx"
ON "fact_identities" ("domain", "lifecycle_state", "created_at");

CREATE TABLE IF NOT EXISTS "temporal_assertions" (
  "id" text PRIMARY KEY NOT NULL,
  "fact_identity_id" text NOT NULL REFERENCES "fact_identities" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "normalized_proposition" text NOT NULL,
  "effective_from" text NOT NULL,
  "effective_to" text,
  "currentness_state" text NOT NULL,
  "qualification" text NOT NULL DEFAULT '',
  "normative_strength" text NOT NULL,
  "payload_json" text NOT NULL,
  "provenance_json" text NOT NULL,
  "payload_hash" text NOT NULL,
  "provenance_hash" text NOT NULL,
  "lifecycle_state" text NOT NULL DEFAULT 'DRAFT',
  "created_by" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "temporal_assertions_interval_check" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
  CONSTRAINT "temporal_assertions_currentness_check" CHECK ("currentness_state" IN ('CURRENT_VERIFIED', 'CURRENT_WITH_QUALIFICATION', 'FUTURE_CHANGE_PENDING', 'UNVERIFIED', 'SUPERSEDED', 'CONFLICTING')),
  CONSTRAINT "temporal_assertions_normative_strength_check" CHECK ("normative_strength" IN ('STATUTORY_REQUIREMENT', 'REGULATORY_REQUIREMENT', 'OFFICIAL_INTERPRETATION', 'OFFICIAL_GUIDANCE', 'BEST_PRACTICE_REFERENCE', 'EXAM_IDENTITY_FACT', 'NEUTRAL_DEFINITION')),
  CONSTRAINT "temporal_assertions_lifecycle_check" CHECK ("lifecycle_state" IN ('DRAFT', 'PUBLISHED', 'SUPERSEDED')),
  CONSTRAINT "temporal_assertions_payload_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "temporal_assertions_provenance_hash_check" CHECK ("provenance_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "temporal_assertions_payload_length_check" CHECK (length("payload_json") <= 100000 AND length("provenance_json") <= 100000 AND length("qualification") <= 2000)
);

CREATE UNIQUE INDEX IF NOT EXISTS "temporal_assertions_semantic_digest_unique"
ON "temporal_assertions" ("fact_identity_id", "payload_hash", "provenance_hash");
CREATE INDEX IF NOT EXISTS "temporal_assertions_fact_history_idx"
ON "temporal_assertions" ("fact_identity_id", "effective_from", "created_at");
CREATE INDEX IF NOT EXISTS "temporal_assertions_currentness_idx"
ON "temporal_assertions" ("currentness_state", "effective_from", "effective_to");
CREATE INDEX IF NOT EXISTS "temporal_assertions_lifecycle_idx"
ON "temporal_assertions" ("lifecycle_state", "created_at");

CREATE TABLE IF NOT EXISTS "source_identities" (
  "id" text PRIMARY KEY NOT NULL,
  "canonical_key" text NOT NULL,
  "source_type" text NOT NULL,
  "canonical_label" text NOT NULL,
  "normalized_identity" text NOT NULL,
  "publisher" text NOT NULL DEFAULT '',
  "jurisdiction" text NOT NULL DEFAULT '',
  "lifecycle_state" text NOT NULL DEFAULT 'ACTIVE',
  "created_by" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "source_identities_lifecycle_check" CHECK ("lifecycle_state" IN ('ACTIVE', 'RETIRED')),
  CONSTRAINT "source_identities_identity_check" CHECK (length(trim("normalized_identity")) > 0 AND length("normalized_identity") <= 300)
);

CREATE UNIQUE INDEX IF NOT EXISTS "source_identities_canonical_key_unique"
ON "source_identities" ("canonical_key");
CREATE UNIQUE INDEX IF NOT EXISTS "source_identities_normalized_unique"
ON "source_identities" ("source_type", "normalized_identity");
CREATE INDEX IF NOT EXISTS "source_identities_type_lifecycle_idx"
ON "source_identities" ("source_type", "lifecycle_state", "created_at");

CREATE TABLE IF NOT EXISTS "assertion_source_bindings" (
  "id" text PRIMARY KEY NOT NULL,
  "temporal_assertion_id" text NOT NULL REFERENCES "temporal_assertions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "source_identity_id" text NOT NULL REFERENCES "source_identities" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "source_role" text NOT NULL,
  "source_version" text NOT NULL DEFAULT '',
  "source_hash" text NOT NULL DEFAULT '',
  "locator" text NOT NULL,
  "verification_metadata_json" text NOT NULL DEFAULT '{}',
  "created_by" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "assertion_source_bindings_role_check" CHECK ("source_role" IN ('PRIMARY_AUTHORITY', 'SUPPORTING_AUTHORITY', 'CONTEXT_SOURCE')),
  CONSTRAINT "assertion_source_bindings_hash_check" CHECK ("source_hash" = '' OR "source_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "assertion_source_bindings_metadata_length_check" CHECK (length("verification_metadata_json") <= 100000)
);

CREATE UNIQUE INDEX IF NOT EXISTS "assertion_source_bindings_identity_unique"
ON "assertion_source_bindings" ("temporal_assertion_id", "source_identity_id", "source_role", "locator");
CREATE UNIQUE INDEX IF NOT EXISTS "assertion_source_bindings_primary_unique"
ON "assertion_source_bindings" ("temporal_assertion_id") WHERE "source_role" = 'PRIMARY_AUTHORITY';
CREATE INDEX IF NOT EXISTS "assertion_source_bindings_assertion_role_idx"
ON "assertion_source_bindings" ("temporal_assertion_id", "source_role", "created_at");
CREATE INDEX IF NOT EXISTS "assertion_source_bindings_source_idx"
ON "assertion_source_bindings" ("source_identity_id", "created_at");

CREATE TABLE IF NOT EXISTS "fact_concept_bindings" (
  "id" text PRIMARY KEY NOT NULL,
  "fact_identity_id" text NOT NULL REFERENCES "fact_identities" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "concept_id" text NOT NULL REFERENCES "ontology_concepts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  "created_by" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE UNIQUE INDEX IF NOT EXISTS "fact_concept_bindings_identity_unique"
ON "fact_concept_bindings" ("fact_identity_id", "concept_id");
CREATE INDEX IF NOT EXISTS "fact_concept_bindings_concept_idx"
ON "fact_concept_bindings" ("concept_id", "created_at");

CREATE TABLE IF NOT EXISTS "fact_track_bindings" (
  "id" text PRIMARY KEY NOT NULL,
  "fact_identity_id" text NOT NULL REFERENCES "fact_identities" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  "track_key" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  "created_at" text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CONSTRAINT "fact_track_bindings_track_check" CHECK (length(trim("track_key")) > 0 AND length("track_key") <= 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS "fact_track_bindings_identity_unique"
ON "fact_track_bindings" ("fact_identity_id", "track_key");
CREATE INDEX IF NOT EXISTS "fact_track_bindings_track_idx"
ON "fact_track_bindings" ("track_key", "created_at");

REVOKE ALL PRIVILEGES ON TABLE public."fact_identities" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."temporal_assertions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."source_identities" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."assertion_source_bindings" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."fact_concept_bindings" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."fact_track_bindings" FROM PUBLIC, anon, authenticated;

ALTER TABLE public."fact_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fact_identities" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."temporal_assertions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."temporal_assertions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."source_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."source_identities" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."assertion_source_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."assertion_source_bindings" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fact_concept_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fact_concept_bindings" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fact_track_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fact_track_bindings" FORCE ROW LEVEL SECURITY;

-- SOURCE MIGRATION 0012
-- Add governed metadata to the reusable Fact -> Concept binding.
-- Non-production implementation migration; production apply requires a separate preflight.
ALTER TABLE public."fact_concept_bindings"
  ADD COLUMN IF NOT EXISTS "relation_type" text NOT NULL DEFAULT 'MAPS_TO',
  ADD COLUMN IF NOT EXISTS "qualification_json" text,
  ADD COLUMN IF NOT EXISTS "mapping_basis" text,
  ADD COLUMN IF NOT EXISTS "provenance_json" text,
  ADD COLUMN IF NOT EXISTS "mapping_status" text NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
  ADD COLUMN IF NOT EXISTS "mapping_version" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "reviewed_by" text,
  ADD COLUMN IF NOT EXISTS "reviewed_at" text;

ALTER TABLE public."fact_concept_bindings"
  ADD CONSTRAINT "fact_concept_bindings_relation_check"
    CHECK ("relation_type" = 'MAPS_TO'),
  ADD CONSTRAINT "fact_concept_bindings_status_check"
    CHECK ("mapping_status" IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  ADD CONSTRAINT "fact_concept_bindings_version_check"
    CHECK ("mapping_version" > 0),
  ADD CONSTRAINT "fact_concept_bindings_review_check"
    CHECK ("mapping_status" <> 'APPROVED' OR ("reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL));

ALTER TABLE public."fact_concept_bindings"
  ADD CONSTRAINT "fact_concept_bindings_reviewed_by_fk"
  FOREIGN KEY ("reviewed_by") REFERENCES public."users" ("id")
  ON UPDATE NO ACTION ON DELETE NO ACTION;

DROP INDEX IF EXISTS public."fact_concept_bindings_identity_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "fact_concept_bindings_current_unique"
ON public."fact_concept_bindings" ("fact_identity_id", "concept_id")
WHERE "mapping_status" IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED');
CREATE INDEX IF NOT EXISTS "fact_concept_bindings_fact_status_idx"
ON public."fact_concept_bindings" ("fact_identity_id", "mapping_status", "created_at");
CREATE INDEX IF NOT EXISTS "fact_concept_bindings_concept_status_idx"
ON public."fact_concept_bindings" ("concept_id", "mapping_status", "created_at");
CREATE INDEX IF NOT EXISTS "fact_concept_bindings_semantic_version_idx"
ON public."fact_concept_bindings" ("fact_identity_id", "concept_id", "mapping_version");

REVOKE ALL PRIVILEGES ON TABLE public."fact_concept_bindings" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."fact_concept_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fact_concept_bindings" FORCE ROW LEVEL SECURITY;

-- SOURCE MIGRATION 0013
-- Additive canonical question governance foundation.
-- Production application requires a separate migration authorization.
ALTER TABLE public."question_versions"
  ADD COLUMN "semantic_hash" text,
  ADD COLUMN "blueprint_id" text,
  ADD COLUMN "qualification_json" text,
  ADD COLUMN "provenance_json" text,
  ADD COLUMN "governance_json" text,
  ADD COLUMN "human_review_hash" text,
  ADD COLUMN "human_reviewed_by" text,
  ADD COLUMN "human_reviewed_at" text;

ALTER TABLE public."question_versions"
  ADD CONSTRAINT "question_versions_review_binding_check"
    CHECK ("human_review_hash" IS NULL OR ("semantic_hash" IS NOT NULL AND "human_reviewed_by" IS NOT NULL AND "human_reviewed_at" IS NOT NULL)),
  ADD CONSTRAINT "question_versions_reviewed_by_fk"
    FOREIGN KEY ("human_reviewed_by") REFERENCES public."users" ("id")
    ON UPDATE NO ACTION ON DELETE NO ACTION;

CREATE UNIQUE INDEX IF NOT EXISTS "question_versions_semantic_hash_unique"
ON public."question_versions" ("question_id", "version", "semantic_hash");

CREATE TABLE public."question_concepts" (
  "id" text PRIMARY KEY,
  "question_version_id" text NOT NULL REFERENCES public."question_versions" ("id") ON DELETE RESTRICT,
  "concept_id" text NOT NULL REFERENCES public."ontology_concepts" ("id") ON DELETE RESTRICT,
  "created_by" text NOT NULL REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "relation_type" text NOT NULL DEFAULT 'MAPS_TO',
  "qualification_json" text,
  "provenance_json" text,
  "mapping_status" text NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
  "mapping_version" integer NOT NULL DEFAULT 1,
  "reviewed_by" text REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "reviewed_at" text,
  CONSTRAINT "question_concepts_relation_check" CHECK ("relation_type" = 'MAPS_TO'),
  CONSTRAINT "question_concepts_status_check" CHECK ("mapping_status" IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  CONSTRAINT "question_concepts_version_check" CHECK ("mapping_version" > 0),
  CONSTRAINT "question_concepts_review_check" CHECK ("mapping_status" <> 'APPROVED' OR ("reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL))
);

CREATE UNIQUE INDEX "question_concepts_current_unique"
ON public."question_concepts" ("question_version_id", "concept_id")
WHERE "mapping_status" IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED');
CREATE INDEX "question_concepts_version_status_idx"
ON public."question_concepts" ("question_version_id", "mapping_status", "created_at");
CREATE INDEX "question_concepts_concept_status_idx"
ON public."question_concepts" ("concept_id", "mapping_status", "created_at");

REVOKE ALL PRIVILEGES ON TABLE public."question_concepts" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."question_concepts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."question_concepts" FORCE ROW LEVEL SECURITY;

-- SOURCE MIGRATION 0014
-- Additive learning-event version and revision governance.
-- Production application requires a separate migration authorization.
ALTER TABLE public."question_attempts"
  ADD COLUMN "question_version_id" text,
  ADD COLUMN "concept_mapping_set_hash" text,
  ADD CONSTRAINT "question_attempts_question_version_fk"
    FOREIGN KEY ("question_version_id") REFERENCES public."question_versions" ("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "question_attempts_version_binding_check"
    CHECK (("question_version_id" IS NULL AND "concept_mapping_set_hash" IS NULL)
      OR ("question_version_id" IS NOT NULL AND "concept_mapping_set_hash" ~ '^[0-9a-f]{64}$'));

ALTER TABLE public."mock_exam_attempts"
  ADD COLUMN "composition_semantic_hash" text,
  ADD CONSTRAINT "mock_exam_attempts_composition_hash_check"
    CHECK ("composition_semantic_hash" IS NULL OR "composition_semantic_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE public."mock_exam_answers"
  ADD COLUMN "question_version_id" text,
  ADD COLUMN "concept_mapping_set_hash" text,
  ADD CONSTRAINT "mock_exam_answers_question_version_fk"
    FOREIGN KEY ("question_version_id") REFERENCES public."question_versions" ("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "mock_exam_answers_version_binding_check"
    CHECK (("question_version_id" IS NULL AND "concept_mapping_set_hash" IS NULL)
      OR ("question_version_id" IS NOT NULL AND "concept_mapping_set_hash" ~ '^[0-9a-f]{64}$'));

ALTER TABLE public."user_lesson_progress"
  ADD COLUMN "content_version" integer;

ALTER TABLE public."user_course_lesson_progress"
  ADD COLUMN "content_version" text;

ALTER TABLE public."audio_progress"
  ADD COLUMN "content_revision_id" text,
  ADD CONSTRAINT "audio_progress_content_revision_fk"
    FOREIGN KEY ("content_revision_id") REFERENCES public."content_revisions" ("id") ON DELETE RESTRICT;

ALTER TABLE public."lecture_progress"
  ADD COLUMN "content_revision_id" text,
  ADD CONSTRAINT "lecture_progress_content_revision_fk"
    FOREIGN KEY ("content_revision_id") REFERENCES public."content_revisions" ("id") ON DELETE RESTRICT;

CREATE TABLE public."learning_event_revisions" (
  "id" text PRIMARY KEY,
  "source_type" text NOT NULL,
  "source_event_id" text NOT NULL,
  "sequence" integer NOT NULL,
  "previous_revision_id" text,
  "action" text NOT NULL,
  "reason_code" text NOT NULL,
  "payload_schema_version" integer NOT NULL DEFAULT 1,
  "correction_payload_json" text NOT NULL DEFAULT '{}',
  "semantic_hash" text NOT NULL,
  "actor_user_id" text NOT NULL REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_event_revisions_previous_fk"
    FOREIGN KEY ("previous_revision_id") REFERENCES public."learning_event_revisions" ("id") ON DELETE RESTRICT,
  CONSTRAINT "learning_event_revisions_source_check"
    CHECK ("source_type" IN ('QUESTION_ATTEMPT', 'MOCK_ATTEMPT', 'MOCK_ITEM_RESULT', 'PRACTICAL_ATTEMPT', 'PRACTICAL_EVALUATION', 'LESSON_PROGRESS', 'COURSE_LESSON_PROGRESS', 'LECTURE_PROGRESS', 'AUDIO_PROGRESS')),
  CONSTRAINT "learning_event_revisions_action_check"
    CHECK ("action" IN ('CORRECT', 'INVALIDATE', 'RESTORE_ELIGIBILITY', 'CORRECT_CONCEPT_MAPPING')),
  CONSTRAINT "learning_event_revisions_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "learning_event_revisions_payload_version_check" CHECK ("payload_schema_version" > 0),
  CONSTRAINT "learning_event_revisions_payload_length_check" CHECK (length("correction_payload_json") <= 20000),
  CONSTRAINT "learning_event_revisions_hash_check" CHECK ("semantic_hash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "learning_event_revisions_sequence_unique"
  ON public."learning_event_revisions" ("source_type", "source_event_id", "sequence");
CREATE UNIQUE INDEX "learning_event_revisions_semantic_unique"
  ON public."learning_event_revisions" ("source_type", "source_event_id", "semantic_hash");
CREATE UNIQUE INDEX "learning_event_revisions_predecessor_unique"
  ON public."learning_event_revisions" ("previous_revision_id") WHERE "previous_revision_id" IS NOT NULL;
CREATE INDEX "learning_event_revisions_source_idx"
  ON public."learning_event_revisions" ("source_type", "source_event_id", "created_at");
CREATE INDEX "learning_event_revisions_actor_idx"
  ON public."learning_event_revisions" ("actor_user_id", "created_at");

REVOKE ALL PRIVILEGES ON TABLE public."learning_event_revisions" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."learning_event_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."learning_event_revisions" FORCE ROW LEVEL SECURITY;

-- SOURCE MIGRATION 0015
-- Additive, rebuildable Evidence projection foundation. Production application requires separate authorization.
CREATE TABLE public."evidence_projections" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "source_type" text NOT NULL,
  "source_event_id" text NOT NULL,
  "source_revision_identity" text NOT NULL,
  "evidence_type" text NOT NULL,
  "concept_id" text NOT NULL REFERENCES public."ontology_concepts" ("id") ON DELETE RESTRICT,
  "concept_mapping_set_hash" text NOT NULL,
  "projection_version" text NOT NULL,
  "source_semantic_hash" text NOT NULL,
  "semantic_hash" text NOT NULL,
  "result_summary_json" text NOT NULL DEFAULT '{}',
  "quality" text NOT NULL,
  "lifecycle" text NOT NULL DEFAULT 'ACTIVE',
  "superseded_by_id" text REFERENCES public."evidence_projections" ("id") ON DELETE RESTRICT,
  "invalidation_reason" text,
  "occurred_at" text NOT NULL,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_projections_source_check" CHECK ("source_type" IN ('QUESTION_ATTEMPT', 'MOCK_ATTEMPT', 'MOCK_ITEM_RESULT', 'PRACTICAL_EVALUATION', 'LESSON_PROGRESS', 'COURSE_LESSON_PROGRESS', 'LECTURE_PROGRESS', 'AUDIO_PROGRESS')),
  CONSTRAINT "evidence_projections_type_check" CHECK ("evidence_type" IN ('PERFORMANCE_RESULT', 'PRACTICAL_PERFORMANCE', 'LEARNING_ACTIVITY')),
  CONSTRAINT "evidence_projections_lifecycle_check" CHECK ("lifecycle" IN ('ACTIVE', 'SUPERSEDED', 'INVALIDATED')),
  CONSTRAINT "evidence_projections_quality_check" CHECK ("quality" IN ('DIRECT_PERFORMANCE', 'HUMAN_EVALUATED', 'SUPPORTING_ACTIVITY')),
  CONSTRAINT "evidence_projections_hashes_check" CHECK ("concept_mapping_set_hash" ~ '^[0-9a-f]{64}$' AND "source_semantic_hash" ~ '^[0-9a-f]{64}$' AND "semantic_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "evidence_projections_payload_length_check" CHECK (length("result_summary_json") <= 4000)
);
CREATE INDEX "evidence_projections_source_idx" ON public."evidence_projections" ("source_type", "source_event_id", "lifecycle");
CREATE INDEX "evidence_projections_user_idx" ON public."evidence_projections" ("user_id", "lifecycle", "occurred_at");
CREATE INDEX "evidence_projections_concept_idx" ON public."evidence_projections" ("concept_id", "lifecycle", "occurred_at");

CREATE TABLE public."evidence_recompute_requests" (
  "id" text PRIMARY KEY,
  "request_type" text NOT NULL DEFAULT 'EVIDENCE_RECOMPUTE_REQUIRED',
  "scope_type" text NOT NULL,
  "source_type" text,
  "source_event_id" text,
  "source_revision_identity" text,
  "user_id" text REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "concept_id" text REFERENCES public."ontology_concepts" ("id") ON DELETE RESTRICT,
  "projection_version" text NOT NULL,
  "reason_code" text NOT NULL,
  "input_semantic_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "cursor" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "claimed_at" text,
  "completed_at" text,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_recompute_requests_type_check" CHECK ("request_type" IN ('EVIDENCE_RECOMPUTE_REQUIRED', 'MASTERY_RECOMPUTE_REQUIRED')),
  CONSTRAINT "evidence_recompute_requests_scope_check" CHECK ("scope_type" IN ('EVENT', 'USER', 'CONCEPT', 'FULL')),
  CONSTRAINT "evidence_recompute_requests_status_check" CHECK ("status" IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  CONSTRAINT "evidence_recompute_requests_hash_check" CHECK ("input_semantic_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "evidence_recompute_requests_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "evidence_recompute_requests_scope_values_check" CHECK (("scope_type" <> 'EVENT' OR ("source_type" IS NOT NULL AND "source_event_id" IS NOT NULL AND "source_revision_identity" IS NOT NULL)) AND ("scope_type" <> 'USER' OR "user_id" IS NOT NULL) AND ("scope_type" <> 'CONCEPT' OR "concept_id" IS NOT NULL))
);
CREATE UNIQUE INDEX "evidence_recompute_requests_semantic_unique" ON public."evidence_recompute_requests" ("request_type", "input_semantic_hash");
CREATE INDEX "evidence_recompute_requests_work_idx" ON public."evidence_recompute_requests" ("status", "request_type", "created_at");
CREATE INDEX "evidence_recompute_requests_user_idx" ON public."evidence_recompute_requests" ("user_id", "status", "created_at");
CREATE INDEX "evidence_recompute_requests_concept_idx" ON public."evidence_recompute_requests" ("concept_id", "status", "created_at");

REVOKE ALL PRIVILEGES ON TABLE public."evidence_projections", public."evidence_recompute_requests" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."evidence_projections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."evidence_projections" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."evidence_recompute_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."evidence_recompute_requests" FORCE ROW LEVEL SECURITY;

-- SOURCE MIGRATION 0016
-- Bounded Theory revision governance extension. Production deployment requires separate authorization.
ALTER TABLE public."content_revisions"
  ADD COLUMN "semantic_hash" text,
  ADD COLUMN "human_review_hash" text,
  ADD CONSTRAINT "content_revisions_review_binding_check"
    CHECK ("human_review_hash" IS NULL OR ("semantic_hash" IS NOT NULL AND "reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL));

CREATE UNIQUE INDEX "content_revisions_semantic_hash_unique"
ON public."content_revisions" ("content_type", "content_id", "semantic_hash");

CREATE TABLE public."content_revision_concepts" (
  "id" text PRIMARY KEY,
  "revision_id" text NOT NULL REFERENCES public."content_revisions" ("id") ON DELETE RESTRICT,
  "concept_id" text REFERENCES public."ontology_concepts" ("id") ON DELETE RESTRICT,
  "created_by" text NOT NULL REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "relation_type" text NOT NULL DEFAULT 'MAPS_TO',
  "qualification_json" text NOT NULL,
  "provenance_json" text NOT NULL,
  "mapping_status" text NOT NULL DEFAULT 'SUGGESTED',
  "mapping_version" integer NOT NULL DEFAULT 1,
  "reviewed_by" text REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "reviewed_at" text,
  CONSTRAINT "content_revision_concepts_relation_check" CHECK ("relation_type" = 'MAPS_TO'),
  CONSTRAINT "content_revision_concepts_status_check" CHECK ("mapping_status" IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  CONSTRAINT "content_revision_concepts_version_check" CHECK ("mapping_version" > 0),
  CONSTRAINT "content_revision_concepts_review_check" CHECK ("mapping_status" <> 'APPROVED' OR ("reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  CONSTRAINT "content_revision_concepts_identity_check" CHECK ("concept_id" IS NOT NULL OR length("qualification_json") > 0)
);

CREATE UNIQUE INDEX "content_revision_concepts_current_unique"
ON public."content_revision_concepts" ("revision_id", "concept_id", "mapping_version")
WHERE "mapping_status" IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED');
CREATE INDEX "content_revision_concepts_version_status_idx"
ON public."content_revision_concepts" ("revision_id", "mapping_status", "mapping_version");
CREATE INDEX "content_revision_concepts_concept_status_idx"
ON public."content_revision_concepts" ("concept_id", "mapping_status");

REVOKE ALL PRIVILEGES ON TABLE public."content_revision_concepts" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."content_revision_concepts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_revision_concepts" FORCE ROW LEVEL SECURITY;

-- SOURCE MIGRATION 0017
-- Bounded Evidence E1 correctness remediation. Production deployment requires separate authorization.
-- Evidence materialization has not been authorized. Fail closed rather than
-- guessing a Practical evaluation lineage for any unexpected historical row.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."evidence_projections" LIMIT 1) THEN
    RAISE EXCEPTION 'EVIDENCE_E1_EXISTING_PROJECTIONS_REQUIRE_EXPLICIT_REVIEW';
  END IF;
END
$$;

ALTER TABLE public."evidence_projections"
  ADD COLUMN "source_lineage_identity" text NOT NULL;

CREATE UNIQUE INDEX "evidence_projections_active_lineage_unique"
ON public."evidence_projections" (
  "user_id",
  "source_type",
  "source_lineage_identity",
  "evidence_type",
  "concept_id",
  "projection_version"
)
WHERE "lifecycle" = 'ACTIVE';

CREATE INDEX "evidence_projections_lineage_idx"
ON public."evidence_projections" (
  "user_id",
  "source_type",
  "source_lineage_identity",
  "lifecycle"
);

-- SOURCE MIGRATION 0018
-- Bounded Practical Governance PR A foundation. Canonical activation requires separate authorization.
ALTER TABLE public."practical_rubric_versions"
  ADD COLUMN "evaluation_semantic_hash" text,
  ADD COLUMN "evaluation_method" text,
  ADD COLUMN "human_review_hash" text,
  ADD COLUMN "evidence_classification" text,
  ADD CONSTRAINT "practical_rubric_versions_evaluation_method_check"
    CHECK ("evaluation_method" IS NULL OR "evaluation_method" IN ('RULE_BASED', 'STRUCTURED_HUMAN_REVIEW', 'HYBRID')),
  ADD CONSTRAINT "practical_rubric_versions_evidence_check"
    CHECK ("evidence_classification" IS NULL OR "evidence_classification" IN ('ELIGIBLE_PERFORMANCE_EVIDENCE', 'ELIGIBLE_AFTER_HUMAN_EVALUATION', 'SUPPORTING_ACTIVITY_ONLY')),
  ADD CONSTRAINT "practical_rubric_versions_evaluation_hash_check"
    CHECK ("evaluation_semantic_hash" IS NULL OR "evaluation_semantic_hash" ~ '^[0-9a-f]{64}$');

CREATE TABLE public."canonical_practicals" (
  "id" text PRIMARY KEY,
  "semantic_key" text NOT NULL UNIQUE,
  "lifecycle" text NOT NULL DEFAULT 'DRAFT',
  "created_by" text NOT NULL,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canonical_practicals_lifecycle_check" CHECK ("lifecycle" IN ('DRAFT', 'HUMAN_APPROVED', 'CANONICAL_UNPUBLISHED', 'SUPERSEDED'))
);

CREATE TABLE public."practical_governance_versions" (
  "id" text PRIMARY KEY,
  "practical_id" text NOT NULL REFERENCES public."canonical_practicals" ("id") ON DELETE RESTRICT,
  "version" integer NOT NULL,
  "semantic_hash" text NOT NULL,
  "human_review_hash" text NOT NULL,
  "safety_review_hash" text NOT NULL,
  "rights_binding" text NOT NULL,
  "provenance_binding" text NOT NULL,
  "concept_mapping_hash" text NOT NULL,
  "theory_dependency_json" text NOT NULL,
  "currentness_reference" text NOT NULL,
  "lifecycle" text NOT NULL DEFAULT 'DRAFT',
  "superseded_by_id" text REFERENCES public."practical_governance_versions" ("id") ON DELETE RESTRICT,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "practical_governance_versions_identity_unique" UNIQUE ("practical_id", "version"),
  CONSTRAINT "practical_governance_versions_semantic_unique" UNIQUE ("practical_id", "semantic_hash"),
  CONSTRAINT "practical_governance_versions_hash_check" CHECK ("semantic_hash" ~ '^[0-9a-f]{64}$' AND "human_review_hash" ~ '^[0-9a-f]{64}$' AND "safety_review_hash" ~ '^[0-9a-f]{64}$' AND "concept_mapping_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "practical_governance_versions_lifecycle_check" CHECK ("lifecycle" IN ('DRAFT', 'HUMAN_APPROVED', 'CANONICAL_UNPUBLISHED', 'SUPERSEDED'))
);
CREATE INDEX "practical_governance_versions_lifecycle_idx" ON public."practical_governance_versions" ("lifecycle", "created_at");

CREATE TABLE public."practical_reviewer_material_versions" (
  "id" text PRIMARY KEY,
  "practical_version_id" text NOT NULL REFERENCES public."practical_governance_versions" ("id") ON DELETE RESTRICT,
  "rubric_version_id" text NOT NULL REFERENCES public."practical_rubric_versions" ("id") ON DELETE RESTRICT,
  "payload_json" text NOT NULL,
  "payload_digest" text NOT NULL,
  "visibility" text NOT NULL DEFAULT 'REVIEWER_ONLY',
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "practical_reviewer_material_versions_identity_unique" UNIQUE ("practical_version_id", "rubric_version_id"),
  CONSTRAINT "practical_reviewer_material_versions_visibility_check" CHECK ("visibility" = 'REVIEWER_ONLY'),
  CONSTRAINT "practical_reviewer_material_versions_digest_check" CHECK ("payload_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "practical_reviewer_material_versions_payload_length_check" CHECK (length("payload_json") <= 200000)
);

CREATE TABLE public."practical_version_concept_bindings" (
  "id" text PRIMARY KEY,
  "practical_version_id" text NOT NULL REFERENCES public."practical_governance_versions" ("id") ON DELETE RESTRICT,
  "concept_key" text NOT NULL,
  "concept_id" text,
  "mapping_semantic_hash" text NOT NULL,
  "qualification_json" text NOT NULL,
  "mapping_status" text NOT NULL DEFAULT 'PENDING',
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "practical_version_concept_bindings_identity_unique" UNIQUE ("practical_version_id", "concept_key"),
  CONSTRAINT "practical_version_concept_bindings_hash_check" CHECK ("mapping_semantic_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "practical_version_concept_bindings_status_check" CHECK ("mapping_status" IN ('PENDING', 'APPROVED', 'SUPERSEDED', 'LEGACY_UNVERIFIED')),
  CONSTRAINT "practical_version_concept_bindings_identity_check" CHECK ("concept_id" IS NOT NULL OR length("concept_key") > 0)
);

ALTER TABLE public."practical_attempts"
  ADD COLUMN "practical_governance_version_id" text REFERENCES public."practical_governance_versions" ("id") ON DELETE RESTRICT;

REVOKE ALL PRIVILEGES ON TABLE public."canonical_practicals", public."practical_governance_versions", public."practical_reviewer_material_versions", public."practical_version_concept_bindings" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."canonical_practicals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."canonical_practicals" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."practical_governance_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_governance_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."practical_reviewer_material_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_reviewer_material_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."practical_version_concept_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practical_version_concept_bindings" FORCE ROW LEVEL SECURITY;

-- SOURCE MIGRATION 0019
-- E2-A lifecycle foundation only. No Evidence rows are materialized.
ALTER TABLE public."evidence_projections"
  ADD COLUMN "generation_id" text;

ALTER TABLE public."evidence_recompute_requests"
  ADD COLUMN "generation_id" text,
  ADD COLUMN "claimed_by" text,
  ADD COLUMN "claim_token" text,
  ADD COLUMN "lease_expires_at" text,
  ADD COLUMN "next_attempt_at" text,
  ADD COLUMN "checkpoint" text,
  ADD COLUMN "error_class" text,
  ADD COLUMN "cancelled_at" text,
  ADD COLUMN "superseded_by_id" text;

ALTER TABLE public."evidence_recompute_requests"
  DROP CONSTRAINT "evidence_recompute_requests_status_check";
ALTER TABLE public."evidence_recompute_requests"
  ADD CONSTRAINT "evidence_recompute_requests_status_check"
  CHECK ("status" IN ('PENDING', 'PROCESSING', 'RETRYABLE', 'COMPLETED', 'FAILED', 'CANCELLED', 'SUPERSEDED'));

CREATE INDEX "evidence_projections_generation_idx"
  ON public."evidence_projections" ("generation_id", "lifecycle");
CREATE INDEX "evidence_recompute_requests_claim_idx"
  ON public."evidence_recompute_requests" ("status", "next_attempt_at", "lease_expires_at", "created_at");
CREATE INDEX "evidence_recompute_requests_generation_idx"
  ON public."evidence_recompute_requests" ("generation_id", "status");

CREATE TABLE public."evidence_rebuild_generations" (
  "id" text PRIMARY KEY,
  "scope_key" text NOT NULL DEFAULT 'EVIDENCE_V1',
  "projection_version" text NOT NULL,
  "mapping_snapshot_hash" text NOT NULL,
  "source_cutoff" text,
  "status" text NOT NULL DEFAULT 'PENDING',
  "checkpoint" text,
  "active" integer NOT NULL DEFAULT 0,
  "started_at" text,
  "completed_at" text,
  "failure_class" text,
  "superseded_by_id" text,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_rebuild_generations_status_check" CHECK ("status" IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SUPERSEDED')),
  CONSTRAINT "evidence_rebuild_generations_active_check" CHECK ("active" IN (0, 1))
);

CREATE UNIQUE INDEX "evidence_rebuild_generations_active_unique"
  ON public."evidence_rebuild_generations" ("scope_key") WHERE "active" = 1;
CREATE INDEX "evidence_rebuild_generations_status_idx"
  ON public."evidence_rebuild_generations" ("status", "created_at");

REVOKE ALL PRIVILEGES ON TABLE public."evidence_rebuild_generations" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."evidence_rebuild_generations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."evidence_rebuild_generations" FORCE ROW LEVEL SECURITY;

-- SOURCE SECURITY STATE FROM 0002, APPLIED AFTER ALL CREATOR MIGRATIONS.
-- GENERATED from db/postgres/schema-manifest.json.
-- Server-only access lockdown. Production execution requires explicit approval.
-- Browser clients must not access application tables through the Data API.
REVOKE ALL PRIVILEGES ON TABLE public."app_schema_migrations" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."app_schema_migrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."course_groups" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."course_groups" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."isms_standards" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."isms_standards" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."legal_articles" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."legal_articles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."privacy_impact_assessment_items" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."privacy_impact_assessment_items" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."risk_calculation_methods" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."risk_calculation_methods" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."roles" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."secure_coding_weaknesses" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."secure_coding_weaknesses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."users" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."admin_audit_logs" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."admin_audit_logs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."courses" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."courses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."isms_defect_cases" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."isms_defect_cases" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."legal_article_versions" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."legal_article_versions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."questions" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."questions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."risk_grade_criteria" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."risk_grade_criteria" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."user_learning_settings" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."user_learning_settings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."ai_generation_records" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."ai_generation_records" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."ai_specialized_generation_records" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."ai_specialized_generation_records" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."audit_logs" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."audit_logs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."bookmarks" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."bookmarks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."content_bookmarks" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."content_bookmarks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."content_course_links" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."content_course_links" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."content_question_links" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."content_question_links" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."content_revisions" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."content_revisions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."course_specializations" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."course_specializations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."curriculum_trees" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."curriculum_trees" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."learning_activities" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."learning_activities" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."levels" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."levels" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."mock_exams" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."mock_exams" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."privacy_assessment_scenarios" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."privacy_assessment_scenarios" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."question_attempts" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."question_attempts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."question_choices" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."question_choices" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."question_courses" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."question_courses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."question_reports" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."question_reports" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."question_versions" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."question_versions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."review_schedules" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."review_schedules" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."risk_scenarios" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."risk_scenarios" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."secure_code_samples" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."secure_code_samples" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."subjects" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."subjects" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."user_course_enrollments" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."user_course_enrollments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."user_roles" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."user_roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."written_answer_rules" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."written_answer_rules" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."ai_reviewed_contents" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."ai_reviewed_contents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."ai_specialized_reviews" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."ai_specialized_reviews" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."code_analysis_answers" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."code_analysis_answers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."curriculum_nodes" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."curriculum_nodes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."level_contents" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."level_contents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."mock_exam_attempts" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."mock_exam_attempts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."mock_exam_sections" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."mock_exam_sections" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."privacy_assessment_answers" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."privacy_assessment_answers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."privacy_flow_nodes" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."privacy_flow_nodes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."question_subjects" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."question_subjects" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."risk_register_items" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."risk_register_items" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."secure_code_grading_rules" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."secure_code_grading_rules" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."topics" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."topics" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."user_level_progress" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."user_level_progress" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."wrong_notes" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."wrong_notes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."learning_units" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."learning_units" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."lectures" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."lectures" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."mock_exam_answers" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."mock_exam_answers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."mock_exam_questions" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."mock_exam_questions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."privacy_flow_edges" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."privacy_flow_edges" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."question_topics" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."question_topics" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."user_progress" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."user_progress" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."lecture_bookmarks" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."lecture_bookmarks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."lecture_notes" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."lecture_notes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."lecture_progress" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."lecture_progress" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."lessons" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."lessons" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."audio_contents" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."audio_contents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."user_lesson_progress" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."user_lesson_progress" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."audio_progress" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."audio_progress" ENABLE ROW LEVEL SECURITY;

-- Keep future postgres-owned objects closed unless a reviewed migration grants access.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

CREATE TABLE app_schema_baseline_receipts (
  baseline_id text PRIMARY KEY,
  baseline_version text NOT NULL,
  schema_boundary text NOT NULL,
  artifact_sha256 text NOT NULL,
  schema_sha256 text NOT NULL,
  security_sha256 text NOT NULL,
  created_from_main_sha text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_schema_baseline_receipts
  (baseline_id, baseline_version, schema_boundary, artifact_sha256, schema_sha256, security_sha256, created_from_main_sha)
VALUES ('POSTGRES_FRESH_BASELINE_V1', '1', '0019',
  current_setting('securium.baseline_artifact_sha256'),
  current_setting('securium.baseline_schema_sha256'),
  current_setting('securium.baseline_security_sha256'),
  'f1f364ec95343e03118ebb699f70773940b95411');

COMMIT;
