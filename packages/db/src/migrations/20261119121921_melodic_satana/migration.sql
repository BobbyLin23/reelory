CREATE TABLE `library_entries` (
	`created_at` integer NOT NULL,
	`genres` text DEFAULT '[]' NOT NULL,
	`id` text PRIMARY KEY,
	`media_type` text NOT NULL,
	`poster_path` text,
	`status` text NOT NULL,
	`title` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`user_id` text NOT NULL,
	`year` integer,
	CONSTRAINT "library_entries_media_type_check" CHECK("media_type" in ('movie', 'tv')),
	CONSTRAINT "library_entries_status_check" CHECK("status" in ('want', 'watching', 'watched'))
);
--> statement-breakpoint
CREATE TABLE `list_items` (
	`added_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`list_id` text NOT NULL,
	`media_type` text NOT NULL,
	`position` integer NOT NULL,
	`tmdb_id` integer NOT NULL,
	CONSTRAINT `fk_list_items_list_id_lists_id_fk` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE,
	CONSTRAINT "list_items_media_type_check" CHECK("media_type" in ('movie', 'tv'))
);
--> statement-breakpoint
CREATE TABLE `lists` (
	`created_at` integer NOT NULL,
	`description` text,
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watch_entries` (
	`created_at` integer NOT NULL,
	`episode` integer,
	`id` text PRIMARY KEY,
	`media_type` text NOT NULL,
	`rating` integer,
	`review` text,
	`season` integer,
	`tmdb_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`watched_on` text,
	CONSTRAINT "watch_entries_media_type_check" CHECK("media_type" in ('movie', 'tv')),
	CONSTRAINT "watch_entries_rating_check" CHECK("rating" between 1 and 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_entries_user_title_unique` ON `library_entries` (`user_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE INDEX `library_entries_user_status_idx` ON `library_entries` (`user_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `list_items_list_title_unique` ON `list_items` (`list_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE INDEX `list_items_list_position_idx` ON `list_items` (`list_id`,`position`);--> statement-breakpoint
CREATE INDEX `lists_user_id_idx` ON `lists` (`user_id`);--> statement-breakpoint
CREATE INDEX `watch_entries_user_watched_on_idx` ON `watch_entries` (`user_id`,`watched_on`);