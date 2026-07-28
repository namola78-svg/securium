CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_role` text DEFAULT 'UNKNOWN' NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`result` text DEFAULT 'SUCCESS' NOT NULL,
	`ip_hash` text,
	`user_agent_summary` text,
	`request_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "admin_audit_logs_result_check" CHECK("admin_audit_logs"."result" IN ('SUCCESS', 'FAILURE', 'DENIED')),
	CONSTRAINT "admin_audit_logs_metadata_length_check" CHECK(length("admin_audit_logs"."metadata_json") <= 10000)
);
--> statement-breakpoint
CREATE INDEX `admin_audit_logs_actor_idx` ON `admin_audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_audit_logs_period_action_idx` ON `admin_audit_logs` (`created_at`,`action`,`result`);--> statement-breakpoint
CREATE INDEX `admin_audit_logs_resource_idx` ON `admin_audit_logs` (`resource_type`,`resource_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_audit_logs_request_idx` ON `admin_audit_logs` (`request_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `admin_audit_logs`
  (`id`, `actor_user_id`, `actor_role`, `action`, `resource_type`,
   `resource_id`, `result`, `request_id`, `metadata_json`, `created_at`)
SELECT `id`, `actor_user_id`, 'UNKNOWN', `action`, `target_type`,
       `target_id`, 'SUCCESS', `request_id`, `metadata_json`, `created_at`
FROM `audit_logs`;
