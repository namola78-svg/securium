CREATE TABLE `curriculum_trees` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`version` text NOT NULL,
	`source_type` text,
	`source_document` text,
	`effective_from` text,
	`effective_to` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "curriculum_trees_status_check" CHECK("curriculum_trees"."status" IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `curriculum_trees_course_version_unique` ON `curriculum_trees` (`course_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `curriculum_trees_course_active_unique` ON `curriculum_trees` (`course_id`) WHERE "curriculum_trees"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX `curriculum_trees_course_status_idx` ON `curriculum_trees` (`course_id`,`status`,`version`);--> statement-breakpoint
CREATE TABLE `curriculum_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`curriculum_tree_id` text NOT NULL,
	`parent_id` text,
	`node_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`official_code` text,
	`official_title` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`depth` integer DEFAULT 0 NOT NULL,
	`path` text,
	`is_required` integer DEFAULT true NOT NULL,
	`is_practical` integer DEFAULT false NOT NULL,
	`difficulty` text,
	`importance` integer,
	`metadata` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`curriculum_tree_id`) REFERENCES `curriculum_trees`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`parent_id`) REFERENCES `curriculum_nodes`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "curriculum_nodes_status_check" CHECK("curriculum_nodes"."status" IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
	CONSTRAINT "curriculum_nodes_depth_check" CHECK("curriculum_nodes"."depth" >= 0 AND "curriculum_nodes"."depth" <= 20),
	CONSTRAINT "curriculum_nodes_sort_order_check" CHECK("curriculum_nodes"."sort_order" >= 0),
	CONSTRAINT "curriculum_nodes_importance_check" CHECK("curriculum_nodes"."importance" IS NULL OR ("curriculum_nodes"."importance" >= 0 AND "curriculum_nodes"."importance" <= 100)),
	CONSTRAINT "curriculum_nodes_parent_self_check" CHECK("curriculum_nodes"."parent_id" IS NULL OR "curriculum_nodes"."parent_id" <> "curriculum_nodes"."id"),
	CONSTRAINT "curriculum_nodes_metadata_length_check" CHECK("curriculum_nodes"."metadata" IS NULL OR length("curriculum_nodes"."metadata") <= 20000)
);
--> statement-breakpoint
CREATE INDEX `curriculum_nodes_tree_parent_order_idx` ON `curriculum_nodes` (`curriculum_tree_id`,`parent_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `curriculum_nodes_tree_path_idx` ON `curriculum_nodes` (`curriculum_tree_id`,`path`);--> statement-breakpoint
CREATE INDEX `curriculum_nodes_parent_idx` ON `curriculum_nodes` (`parent_id`);
