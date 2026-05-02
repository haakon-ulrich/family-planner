ALTER TABLE `task_instances` ADD `postponed_from` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `postponable` integer DEFAULT 0 NOT NULL;