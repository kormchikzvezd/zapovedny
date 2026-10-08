CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`name` text,
	`phone` text NOT NULL,
	`preferred_channel` text NOT NULL,
	`messenger_handle` text,
	`homes` text,
	`consent_at` text NOT NULL
);
