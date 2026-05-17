CREATE TABLE `skipped_day_ranges` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `household_streaks` ADD `skipped` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `streaks` ADD `skipped` integer DEFAULT 0 NOT NULL;