CREATE TABLE `content_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`content_type` text NOT NULL,
	`content_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_bookmarks_unique` ON `content_bookmarks` (`user_id`,`course_id`,`content_type`,`content_id`);--> statement-breakpoint
CREATE INDEX `content_bookmarks_user_idx` ON `content_bookmarks` (`user_id`,`course_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `content_course_links` (
	`id` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`content_id` text NOT NULL,
	`course_id` text NOT NULL,
	`relation_type` text DEFAULT 'RELATED' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_course_links_unique` ON `content_course_links` (`content_type`,`content_id`,`course_id`,`relation_type`);--> statement-breakpoint
CREATE INDEX `content_course_links_course_idx` ON `content_course_links` (`course_id`,`content_type`,`display_order`);--> statement-breakpoint
CREATE TABLE `content_question_links` (
	`id` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`content_id` text NOT NULL,
	`question_id` text NOT NULL,
	`relation_type` text DEFAULT 'RELATED' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_question_links_unique` ON `content_question_links` (`content_type`,`content_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `content_question_links_question_idx` ON `content_question_links` (`question_id`);--> statement-breakpoint
CREATE TABLE `course_specializations` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`feature_type` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`configuration_json` text DEFAULT '{}' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_specializations_unique` ON `course_specializations` (`course_id`,`feature_type`);--> statement-breakpoint
CREATE INDEX `course_specializations_listing_idx` ON `course_specializations` (`course_id`,`active`,`display_order`);--> statement-breakpoint
CREATE TABLE `isms_defect_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`situation` text NOT NULL,
	`defect_description` text NOT NULL,
	`related_standard_id` text NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`corrective_action` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`source_date` text NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`related_standard_id`) REFERENCES `isms_standards`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `isms_defect_cases_standard_idx` ON `isms_defect_cases` (`related_standard_id`,`source_date`);--> statement-breakpoint
CREATE TABLE `isms_standards` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`major_category` text NOT NULL,
	`middle_category` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`key_points` text DEFAULT '' NOT NULL,
	`evidence_examples` text DEFAULT '' NOT NULL,
	`defect_examples` text DEFAULT '' NOT NULL,
	`audit_points` text DEFAULT '' NOT NULL,
	`version` text NOT NULL,
	`effective_date` text NOT NULL,
	`source_url` text,
	`active` integer DEFAULT true NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `isms_standards_code_version_unique` ON `isms_standards` (`code`,`version`);--> statement-breakpoint
CREATE INDEX `isms_standards_listing_idx` ON `isms_standards` (`active`,`major_category`,`middle_category`,`code`);--> statement-breakpoint
CREATE TABLE `legal_article_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_article_id` text NOT NULL,
	`version` text NOT NULL,
	`content` text NOT NULL,
	`effective_date` text NOT NULL,
	`revision_date` text NOT NULL,
	`change_summary` text DEFAULT '' NOT NULL,
	`source_url` text,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`legal_article_id`) REFERENCES `legal_articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legal_article_versions_unique` ON `legal_article_versions` (`legal_article_id`,`version`);--> statement-breakpoint
CREATE INDEX `legal_article_versions_date_idx` ON `legal_article_versions` (`legal_article_id`,`effective_date`);--> statement-breakpoint
CREATE TABLE `legal_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`law_name` text NOT NULL,
	`article_number` text NOT NULL,
	`article_title` text NOT NULL,
	`content` text NOT NULL,
	`effective_date` text NOT NULL,
	`revision_date` text NOT NULL,
	`source_url` text,
	`version` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legal_articles_identity_unique` ON `legal_articles` (`law_name`,`article_number`,`version`);--> statement-breakpoint
CREATE INDEX `legal_articles_listing_idx` ON `legal_articles` (`active`,`law_name`,`article_number`);--> statement-breakpoint
CREATE TABLE `risk_calculation_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`formula_type` text NOT NULL,
	`configuration_json` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "risk_calculation_methods_formula_check" CHECK("risk_calculation_methods"."formula_type" IN ('MULTIPLY', 'ADD', 'WEIGHTED', 'MATRIX'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `risk_calculation_methods_name_unique` ON `risk_calculation_methods` (`name`);--> statement-breakpoint
CREATE TABLE `risk_grade_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`calculation_method_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`min_value` integer NOT NULL,
	`max_value` integer NOT NULL,
	`treatment_guidance` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`calculation_method_id`) REFERENCES `risk_calculation_methods`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "risk_grade_criteria_range_check" CHECK("risk_grade_criteria"."min_value" <= "risk_grade_criteria"."max_value")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `risk_grade_criteria_unique` ON `risk_grade_criteria` (`calculation_method_id`,`code`);--> statement-breakpoint
CREATE INDEX `risk_grade_criteria_range_idx` ON `risk_grade_criteria` (`calculation_method_id`,`min_value`,`max_value`);--> statement-breakpoint
CREATE TABLE `risk_register_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scenario_id` text NOT NULL,
	`asset` text NOT NULL,
	`threat` text NOT NULL,
	`vulnerability` text NOT NULL,
	`likelihood` integer NOT NULL,
	`impact` integer NOT NULL,
	`risk_value` integer NOT NULL,
	`treatment` text NOT NULL,
	`owner` text NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`scenario_id`) REFERENCES `risk_scenarios`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "risk_register_items_status_check" CHECK("risk_register_items"."status" IN ('OPEN', 'TREATING', 'ACCEPTED', 'CLOSED'))
);
--> statement-breakpoint
CREATE INDEX `risk_register_items_user_idx` ON `risk_register_items` (`user_id`,`status`,`due_date`);--> statement-breakpoint
CREATE TABLE `risk_scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`calculation_method_id` text,
	`title` text NOT NULL,
	`asset` text NOT NULL,
	`threat` text NOT NULL,
	`vulnerability` text NOT NULL,
	`existing_controls` text DEFAULT '' NOT NULL,
	`likelihood` integer NOT NULL,
	`impact` integer NOT NULL,
	`risk_value` integer NOT NULL,
	`risk_level` text NOT NULL,
	`treatment_option` text NOT NULL,
	`residual_risk` integer DEFAULT 0 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`reference_date` text NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`calculation_method_id`) REFERENCES `risk_calculation_methods`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `risk_scenarios_course_idx` ON `risk_scenarios` (`course_id`,`risk_level`,`created_at`);--> statement-breakpoint
CREATE TABLE `written_answer_rules` (
	`question_id` text PRIMARY KEY NOT NULL,
	`model_answer` text NOT NULL,
	`required_keywords_json` text DEFAULT '[]' NOT NULL,
	`optional_keywords_json` text DEFAULT '[]' NOT NULL,
	`maximum_score` integer DEFAULT 100 NOT NULL,
	`partial_score_rules_json` text DEFAULT '[]' NOT NULL,
	`guidance` text DEFAULT '' NOT NULL,
	`reference_date` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "written_answer_rules_score_check" CHECK("written_answer_rules"."maximum_score" > 0)
);
