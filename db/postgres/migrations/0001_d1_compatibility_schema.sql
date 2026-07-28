-- GENERATED from drizzle/meta/0013_snapshot.json.
-- Review before applying. Production execution requires explicit approval.
BEGIN;

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

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0001_d1_compatibility_schema', 'snapshot-0013')
ON CONFLICT (id) DO NOTHING;

COMMIT;
