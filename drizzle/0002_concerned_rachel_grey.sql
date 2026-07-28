ALTER TABLE `question_attempts` ADD `mode` text DEFAULT 'LEARNING' NOT NULL;
--> statement-breakpoint
ALTER TABLE `question_attempts` ADD `exam_session_id` text;
