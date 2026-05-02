CREATE TABLE `calendar_events_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`title` text NOT NULL,
	`location` text,
	`all_day` integer DEFAULT 0 NOT NULL,
	`member_hint` text,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar_kind` text NOT NULL,
	`avatar_value` text NOT NULL,
	`color` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `household_streaks` (
	`date` text PRIMARY KEY NOT NULL,
	`all_completed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`timezone` text DEFAULT 'Europe/Vienna' NOT NULL,
	`quiet_hours_start` text,
	`quiet_hours_end` text,
	`gcal_credentials` text,
	`gcal_calendar_id` text,
	`gdrive_folder_id` text,
	`last_backup_at` text,
	`last_calendar_sync_at` text,
	`last_rollover_date` text,
	CONSTRAINT "settings_singleton" CHECK("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `streaks` (
	`member_id` text NOT NULL,
	`date` text NOT NULL,
	`all_completed` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `streaks_member_date_idx` ON `streaks` (`member_id`,`date`);--> statement-breakpoint
CREATE TABLE `task_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_instances_task_date_idx` ON `task_instances` (`task_id`,`date`);--> statement-breakpoint
CREATE TABLE `task_step_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`task_step_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_step_id`) REFERENCES `task_steps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_step_instances_step_date_idx` ON `task_step_instances` (`task_step_id`,`date`);--> statement-breakpoint
CREATE TABLE `task_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`icon_kind` text NOT NULL,
	`icon_value` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text,
	`title` text NOT NULL,
	`kind` text DEFAULT 'single' NOT NULL,
	`icon_kind` text,
	`icon_value` text,
	`bucket` text NOT NULL,
	`due_by_time` text,
	`recurrence_kind` text DEFAULT 'none' NOT NULL,
	`recurrence_config` text DEFAULT '{}' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`carry_over_if_incomplete` integer DEFAULT 0 NOT NULL,
	`sound_id` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE no action
);
