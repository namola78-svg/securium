CREATE TABLE `code_analysis_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`sample_id` text NOT NULL,
	`selected_lines_json` text DEFAULT '[]' NOT NULL,
	`weakness_id` text NOT NULL,
	`selected_cwe_code` text NOT NULL,
	`true_positive` integer NOT NULL,
	`user_explanation` text DEFAULT '' NOT NULL,
	`remediation_code` text DEFAULT '' NOT NULL,
	`matched_criteria_json` text DEFAULT '[]' NOT NULL,
	`is_correct` integer NOT NULL,
	`score` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `question_attempts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sample_id`) REFERENCES `secure_code_samples`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`weakness_id`) REFERENCES `secure_coding_weaknesses`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `code_analysis_answers_attempt_unique` ON `code_analysis_answers` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `code_analysis_answers_sample_idx` ON `code_analysis_answers` (`sample_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `privacy_assessment_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scenario_id` text NOT NULL,
	`target_decision` text NOT NULL,
	`selected_assessment_items_json` text DEFAULT '[]' NOT NULL,
	`identified_risks` text DEFAULT '' NOT NULL,
	`improvement_plan` text DEFAULT '' NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`feedback_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`scenario_id`) REFERENCES `privacy_assessment_scenarios`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "privacy_assessment_answers_decision_check" CHECK("privacy_assessment_answers"."target_decision" IN ('REQUIRED', 'NOT_REQUIRED', 'REVIEW_NEEDED')),
	CONSTRAINT "privacy_assessment_answers_score_check" CHECK("privacy_assessment_answers"."score" >= 0 AND "privacy_assessment_answers"."score" <= 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `privacy_assessment_answers_user_scenario_unique` ON `privacy_assessment_answers` (`user_id`,`scenario_id`);--> statement-breakpoint
CREATE INDEX `privacy_assessment_answers_user_idx` ON `privacy_assessment_answers` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `privacy_assessment_scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`organization_type` text NOT NULL,
	`system_type` text NOT NULL,
	`processed_data` text NOT NULL,
	`data_subjects` text NOT NULL,
	`processing_purpose` text NOT NULL,
	`track` text DEFAULT 'PRACTICE' NOT NULL,
	`correct_target_decision` text NOT NULL,
	`expected_assessment_items_json` text DEFAULT '[]' NOT NULL,
	`model_improvement_plan` text DEFAULT '' NOT NULL,
	`scoring_rules_json` text DEFAULT '{}' NOT NULL,
	`sample_only` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "privacy_assessment_scenarios_track_check" CHECK("privacy_assessment_scenarios"."track" IN ('EXAM_PREP', 'PRACTICE')),
	CONSTRAINT "privacy_assessment_scenarios_decision_check" CHECK("privacy_assessment_scenarios"."correct_target_decision" IN ('REQUIRED', 'NOT_REQUIRED', 'REVIEW_NEEDED'))
);
--> statement-breakpoint
CREATE INDEX `privacy_assessment_scenarios_course_idx` ON `privacy_assessment_scenarios` (`course_id`,`active`,`track`);--> statement-breakpoint
CREATE TABLE `privacy_flow_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`data_types` text NOT NULL,
	`transfer_method` text NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`protection_measures` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `privacy_assessment_scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scenario_id`,`source_node_id`) REFERENCES `privacy_flow_nodes`(`scenario_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scenario_id`,`target_node_id`) REFERENCES `privacy_flow_nodes`(`scenario_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "privacy_flow_edges_self_check" CHECK("privacy_flow_edges"."source_node_id" <> "privacy_flow_edges"."target_node_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `privacy_flow_edges_unique` ON `privacy_flow_edges` (`scenario_id`,`source_node_id`,`target_node_id`,`data_types`);--> statement-breakpoint
CREATE INDEX `privacy_flow_edges_scenario_idx` ON `privacy_flow_edges` (`scenario_id`);--> statement-breakpoint
CREATE TABLE `privacy_flow_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`node_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`system_name` text DEFAULT '' NOT NULL,
	`organization_name` text DEFAULT '' NOT NULL,
	`display_x` integer DEFAULT 0 NOT NULL,
	`display_y` integer DEFAULT 0 NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `privacy_assessment_scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "privacy_flow_nodes_type_check" CHECK("privacy_flow_nodes"."node_type" IN ('DATA_SUBJECT', 'COLLECTION', 'PROCESSING', 'STORAGE', 'TRANSFER', 'DESTRUCTION', 'EXTERNAL'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `privacy_flow_nodes_scenario_id_unique` ON `privacy_flow_nodes` (`scenario_id`,`id`);--> statement-breakpoint
CREATE INDEX `privacy_flow_nodes_order_idx` ON `privacy_flow_nodes` (`scenario_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `privacy_impact_assessment_items` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`check_points` text DEFAULT '' NOT NULL,
	`evidence_examples` text DEFAULT '' NOT NULL,
	`risk_examples` text DEFAULT '' NOT NULL,
	`improvement_examples` text DEFAULT '' NOT NULL,
	`version` text NOT NULL,
	`effective_date` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `privacy_impact_items_code_version_unique` ON `privacy_impact_assessment_items` (`code`,`version`);--> statement-breakpoint
CREATE INDEX `privacy_impact_items_listing_idx` ON `privacy_impact_assessment_items` (`active`,`category`,`code`);--> statement-breakpoint
CREATE TABLE `secure_code_grading_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`sample_id` text NOT NULL,
	`line_score` integer DEFAULT 30 NOT NULL,
	`weakness_score` integer DEFAULT 20 NOT NULL,
	`cwe_score` integer DEFAULT 15 NOT NULL,
	`judgment_score` integer DEFAULT 15 NOT NULL,
	`keyword_score` integer DEFAULT 15 NOT NULL,
	`remediation_code_score` integer DEFAULT 5 NOT NULL,
	`maximum_score` integer DEFAULT 100 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sample_id`) REFERENCES `secure_code_samples`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "secure_code_grading_rules_score_check" CHECK("secure_code_grading_rules"."line_score" >= 0 AND "secure_code_grading_rules"."weakness_score" >= 0 AND "secure_code_grading_rules"."cwe_score" >= 0 AND "secure_code_grading_rules"."judgment_score" >= 0 AND "secure_code_grading_rules"."keyword_score" >= 0 AND "secure_code_grading_rules"."remediation_code_score" >= 0 AND "secure_code_grading_rules"."maximum_score" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `secure_code_grading_rules_sample_unique` ON `secure_code_grading_rules` (`sample_id`);--> statement-breakpoint
CREATE TABLE `secure_code_samples` (
	`id` text PRIMARY KEY NOT NULL,
	`weakness_id` text NOT NULL,
	`question_id` text,
	`language` text NOT NULL,
	`title` text NOT NULL,
	`vulnerable_code` text NOT NULL,
	`secure_code` text NOT NULL,
	`vulnerable_lines_json` text DEFAULT '[]' NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	`false_positive_possible` integer DEFAULT false NOT NULL,
	`expected_true_positive` integer DEFAULT true NOT NULL,
	`call_relation` text DEFAULT '' NOT NULL,
	`execution_flow` text DEFAULT '' NOT NULL,
	`remediation_keywords_json` text DEFAULT '[]' NOT NULL,
	`source_date` text NOT NULL,
	`sample_only` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`weakness_id`) REFERENCES `secure_coding_weaknesses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "secure_code_samples_language_check" CHECK("secure_code_samples"."language" IN ('Java', 'C', 'C++', 'Python', 'JavaScript'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `secure_code_samples_question_unique` ON `secure_code_samples` (`question_id`);--> statement-breakpoint
CREATE INDEX `secure_code_samples_listing_idx` ON `secure_code_samples` (`active`,`language`,`weakness_id`);--> statement-breakpoint
CREATE TABLE `secure_coding_weaknesses` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`language` text NOT NULL,
	`cwe_code` text NOT NULL,
	`risk` text NOT NULL,
	`detection_guide` text DEFAULT '' NOT NULL,
	`remediation_guide` text DEFAULT '' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`version` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "secure_coding_weaknesses_language_check" CHECK("secure_coding_weaknesses"."language" IN ('Java', 'C', 'C++', 'Python', 'JavaScript', 'COMMON')),
	CONSTRAINT "secure_coding_weaknesses_risk_check" CHECK("secure_coding_weaknesses"."risk" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `secure_coding_weaknesses_code_version_unique` ON `secure_coding_weaknesses` (`code`,`version`);--> statement-breakpoint
CREATE INDEX `secure_coding_weaknesses_listing_idx` ON `secure_coding_weaknesses` (`active`,`language`,`category`,`code`);