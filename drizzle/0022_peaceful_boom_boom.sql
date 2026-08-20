CREATE TABLE `practical_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`practical_id` text NOT NULL,
	`practical_definition_version_id` text NOT NULL,
	`rubric_version_id` text NOT NULL,
	`course_id` text NOT NULL,
	`curriculum_tree_id` text NOT NULL,
	`curriculum_tree_version_reference` text NOT NULL,
	`curriculum_node_id` text NOT NULL,
	`objective_placement_id` text NOT NULL,
	`practical_placement_id` text NOT NULL,
	`state` text DEFAULT 'IN_PROGRESS' NOT NULL,
	`responses_json` text DEFAULT '[]' NOT NULL,
	`artifact_manifest_json` text DEFAULT '[]' NOT NULL,
	`submission_digest` text,
	`creation_idempotency_key` text NOT NULL,
	`submission_idempotency_key` text,
	`draft_revision` integer DEFAULT 0 NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`submitted_at` text,
	`expires_at` text,
	`expired_at` text,
	`voided_at` text,
	`void_reason_code` text,
	`eligibility_decision_reference` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`curriculum_tree_id`) REFERENCES `curriculum_trees`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`curriculum_node_id`) REFERENCES `curriculum_nodes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`practical_definition_version_id`,`rubric_version_id`) REFERENCES `practical_definition_versions`(`id`,`rubric_version_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "practical_attempts_state_check" CHECK("practical_attempts"."state" IN ('IN_PROGRESS', 'SUBMITTED', 'EVALUATED', 'EXPIRED', 'VOIDED')),
	CONSTRAINT "practical_attempts_responses_length_check" CHECK(length("practical_attempts"."responses_json") <= 100000),
	CONSTRAINT "practical_attempts_artifact_manifest_length_check" CHECK(length("practical_attempts"."artifact_manifest_json") <= 20000),
	CONSTRAINT "practical_attempts_submission_digest_check" CHECK("practical_attempts"."submission_digest" IS NULL OR (length("practical_attempts"."submission_digest") = 64 AND "practical_attempts"."submission_digest" NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "practical_attempts_draft_revision_check" CHECK("practical_attempts"."draft_revision" >= 0),
	CONSTRAINT "practical_attempts_void_reason_length_check" CHECK("practical_attempts"."void_reason_code" IS NULL OR length("practical_attempts"."void_reason_code") <= 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practical_attempts_creation_idempotency_unique` ON `practical_attempts` (`user_id`,`creation_idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `practical_attempts_submission_idempotency_unique` ON `practical_attempts` (`user_id`,`submission_idempotency_key`) WHERE "practical_attempts"."submission_idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `practical_attempts_version_binding_unique` ON `practical_attempts` (`id`,`practical_definition_version_id`,`rubric_version_id`);--> statement-breakpoint
CREATE INDEX `practical_attempts_user_history_idx` ON `practical_attempts` (`user_id`,`practical_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `practical_attempts_user_state_idx` ON `practical_attempts` (`user_id`,`state`,`updated_at`);--> statement-breakpoint
CREATE INDEX `practical_attempts_expiration_idx` ON `practical_attempts` (`state`,`expires_at`);--> statement-breakpoint
CREATE TABLE `practical_definition_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`practical_id` text NOT NULL,
	`version` integer NOT NULL,
	`rubric_version_id` text NOT NULL,
	`snapshot_format_version` integer DEFAULT 1 NOT NULL,
	`snapshot_json` text NOT NULL,
	`snapshot_digest` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`effective_from` text,
	`withdrawn_at` text,
	FOREIGN KEY (`rubric_version_id`) REFERENCES `practical_rubric_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "practical_definition_versions_version_check" CHECK("practical_definition_versions"."version" > 0),
	CONSTRAINT "practical_definition_versions_format_check" CHECK("practical_definition_versions"."snapshot_format_version" > 0),
	CONSTRAINT "practical_definition_versions_snapshot_length_check" CHECK(length("practical_definition_versions"."snapshot_json") <= 100000),
	CONSTRAINT "practical_definition_versions_digest_check" CHECK(length("practical_definition_versions"."snapshot_digest") = 64 AND "practical_definition_versions"."snapshot_digest" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practical_definition_versions_identity_unique` ON `practical_definition_versions` (`practical_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `practical_definition_versions_rubric_binding_unique` ON `practical_definition_versions` (`id`,`rubric_version_id`);--> statement-breakpoint
CREATE TABLE `practical_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`previous_evaluation_id` text,
	`practical_definition_version_id` text NOT NULL,
	`rubric_version_id` text NOT NULL,
	`method` text NOT NULL,
	`dimension_results_json` text NOT NULL,
	`raw_score` real,
	`maximum_score` real,
	`qualification` text NOT NULL,
	`review_status` text DEFAULT 'NOT_REQUIRED' NOT NULL,
	`provenance_json` text NOT NULL,
	`reviewer_id` text,
	`reviewed_at` text,
	`review_reason` text,
	`evaluation_payload_digest` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`evaluator_job_id` text,
	`evaluator_result_id` text,
	`evaluated_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`attempt_id`,`practical_definition_version_id`,`rubric_version_id`) REFERENCES `practical_attempts`(`id`,`practical_definition_version_id`,`rubric_version_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`previous_evaluation_id`) REFERENCES `practical_evaluations`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "practical_evaluations_sequence_check" CHECK("practical_evaluations"."sequence" >= 1),
	CONSTRAINT "practical_evaluations_method_check" CHECK("practical_evaluations"."method" IN ('DETERMINISTIC', 'RUBRIC', 'AI_ASSISTED', 'HUMAN_REVIEWED', 'HYBRID')),
	CONSTRAINT "practical_evaluations_qualification_check" CHECK("practical_evaluations"."qualification" IN ('QUALIFIED', 'NOT_QUALIFIED', 'PENDING_REVIEW')),
	CONSTRAINT "practical_evaluations_review_status_check" CHECK("practical_evaluations"."review_status" IN ('NOT_REQUIRED', 'PENDING', 'COMPLETED')),
	CONSTRAINT "practical_evaluations_dimension_results_length_check" CHECK(length("practical_evaluations"."dimension_results_json") <= 100000),
	CONSTRAINT "practical_evaluations_provenance_length_check" CHECK(length("practical_evaluations"."provenance_json") <= 10000),
	CONSTRAINT "practical_evaluations_review_reason_length_check" CHECK("practical_evaluations"."review_reason" IS NULL OR length("practical_evaluations"."review_reason") <= 2000),
	CONSTRAINT "practical_evaluations_score_pair_check" CHECK(("practical_evaluations"."raw_score" IS NULL AND "practical_evaluations"."maximum_score" IS NULL) OR ("practical_evaluations"."raw_score" IS NOT NULL AND "practical_evaluations"."maximum_score" IS NOT NULL AND "practical_evaluations"."raw_score" >= 0 AND "practical_evaluations"."maximum_score" > 0 AND "practical_evaluations"."raw_score" <= "practical_evaluations"."maximum_score" AND "practical_evaluations"."raw_score" <= 1.7976931348623157e308 AND "practical_evaluations"."maximum_score" <= 1.7976931348623157e308)),
	CONSTRAINT "practical_evaluations_ai_qualification_check" CHECK(NOT ("practical_evaluations"."method" = 'AI_ASSISTED' AND "practical_evaluations"."qualification" = 'QUALIFIED')),
	CONSTRAINT "practical_evaluations_evaluator_identity_check" CHECK(("practical_evaluations"."evaluator_job_id" IS NULL AND "practical_evaluations"."evaluator_result_id" IS NULL) OR ("practical_evaluations"."evaluator_job_id" IS NOT NULL AND "practical_evaluations"."evaluator_result_id" IS NOT NULL)),
	CONSTRAINT "practical_evaluations_digest_check" CHECK(length("practical_evaluations"."evaluation_payload_digest") = 64 AND "practical_evaluations"."evaluation_payload_digest" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practical_evaluations_sequence_unique` ON `practical_evaluations` (`attempt_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `practical_evaluations_operation_unique` ON `practical_evaluations` (`attempt_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `practical_evaluations_predecessor_unique` ON `practical_evaluations` (`previous_evaluation_id`) WHERE "practical_evaluations"."previous_evaluation_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `practical_evaluations_evaluator_result_unique` ON `practical_evaluations` (`attempt_id`,`evaluator_job_id`,`evaluator_result_id`) WHERE "practical_evaluations"."evaluator_job_id" IS NOT NULL AND "practical_evaluations"."evaluator_result_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `practical_evaluations_review_queue_idx` ON `practical_evaluations` (`review_status`,`created_at`);--> statement-breakpoint
CREATE TABLE `practical_rubric_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`rubric_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot_format_version` integer DEFAULT 1 NOT NULL,
	`snapshot_json` text NOT NULL,
	`snapshot_digest` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`effective_from` text,
	`withdrawn_at` text,
	CONSTRAINT "practical_rubric_versions_version_check" CHECK("practical_rubric_versions"."version" > 0),
	CONSTRAINT "practical_rubric_versions_format_check" CHECK("practical_rubric_versions"."snapshot_format_version" > 0),
	CONSTRAINT "practical_rubric_versions_snapshot_length_check" CHECK(length("practical_rubric_versions"."snapshot_json") <= 100000),
	CONSTRAINT "practical_rubric_versions_digest_check" CHECK(length("practical_rubric_versions"."snapshot_digest") = 64 AND "practical_rubric_versions"."snapshot_digest" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practical_rubric_versions_identity_unique` ON `practical_rubric_versions` (`rubric_id`,`version`);