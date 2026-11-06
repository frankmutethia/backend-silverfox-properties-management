CREATE TABLE `blogs` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`title` varchar(200) NOT NULL,
	`category` varchar(80),
	`excerpt` varchar(400) NOT NULL,
	`cover_media_id` varchar(36),
	`cover_alt` varchar(150),
	`body_html` mediumtext NOT NULL,
	`author_id` varchar(36),
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`published_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `blogs_id` PRIMARY KEY(`id`),
	CONSTRAINT `blogs_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` varchar(36) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mime` varchar(32) NOT NULL,
	`size` int NOT NULL,
	`uploaded_by` varchar(36),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `media_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_filename_unique` UNIQUE(`filename`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`used_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`reference` varchar(40) NOT NULL,
	`name` varchar(150) NOT NULL,
	`category` enum('sale','rent','managed'),
	`type` enum('Apartment','House') NOT NULL,
	`location` varchar(200),
	`neighbourhood` text,
	`description` text NOT NULL,
	`price_amount` decimal(14,2),
	`price_currency` varchar(3),
	`price_period` varchar(10),
	`bedrooms` int,
	`bathrooms` int,
	`area_sqm` decimal(10,2),
	`amenities` text NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`published_at` datetime(3),
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `properties_id` PRIMARY KEY(`id`),
	CONSTRAINT `properties_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `properties_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `property_images` (
	`id` varchar(36) NOT NULL,
	`property_id` varchar(36) NOT NULL,
	`media_id` varchar(36) NOT NULL,
	`alt` varchar(150) NOT NULL,
	`position` varchar(40),
	`sort_order` int NOT NULL,
	CONSTRAINT `property_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_categories` (
	`id` varchar(36) NOT NULL,
	`number` varchar(2) NOT NULL,
	`title` varchar(150) NOT NULL,
	`description` text NOT NULL,
	`sort_order` int NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `service_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_categories_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` varchar(36) NOT NULL,
	`category_id` varchar(36) NOT NULL,
	`title` varchar(150) NOT NULL,
	`description_html` mediumtext NOT NULL,
	`icon` varchar(40),
	`image_media_id` varchar(36),
	`image_alt` varchar(150),
	`sort_order` int NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`published_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`feedback` text NOT NULL,
	`rating` int NOT NULL,
	`status` enum('pending','draft','published') NOT NULL,
	`source` enum('visitor','admin') NOT NULL,
	`ip_hash` varchar(64),
	`published_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `testimonials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`display_name` varchar(100) NOT NULL,
	`contact_email` varchar(255) NOT NULL DEFAULT '',
	`phone` varchar(30) NOT NULL DEFAULT '',
	`photo_media_id` varchar(36),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `blogs` ADD CONSTRAINT `blogs_cover_media_id_media_id_fk` FOREIGN KEY (`cover_media_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blogs` ADD CONSTRAINT `blogs_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_images` ADD CONSTRAINT `property_images_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_images` ADD CONSTRAINT `property_images_media_id_media_id_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_category_id_service_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `service_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_image_media_id_media_id_fk` FOREIGN KEY (`image_media_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_photo_media_id_media_id_fk` FOREIGN KEY (`photo_media_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `blogs_status_idx` ON `blogs` (`status`);--> statement-breakpoint
CREATE INDEX `reset_tokens_user_idx` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `properties_status_idx` ON `properties` (`status`);--> statement-breakpoint
CREATE INDEX `property_images_property_idx` ON `property_images` (`property_id`);--> statement-breakpoint
CREATE INDEX `services_category_idx` ON `services` (`category_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `testimonials_status_idx` ON `testimonials` (`status`);