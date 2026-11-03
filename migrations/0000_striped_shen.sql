CREATE TABLE `appSettings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`providerId` text,
	`channelTitle` text,
	`externalChannelId` text NOT NULL,
	`providerType` text NOT NULL,
	`accessToken` text NOT NULL,
	`accessTokenExpiresAt` integer DEFAULT 0 NOT NULL,
	`refreshToken` text NOT NULL,
	`refreshTokenExpiresAt` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`providerId`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_channels_userId` ON `channels` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_channels_userId_providerId_externalChannelId` ON `channels` (`userId`,`providerId`,`externalChannelId`);--> statement-breakpoint
CREATE TABLE `fileChunks` (
	`fileId` text NOT NULL,
	`chunkId` integer NOT NULL,
	`content` blob NOT NULL,
	PRIMARY KEY(`fileId`, `chunkId`),
	FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`sha256` text NOT NULL,
	`contentType` text NOT NULL,
	`fileName` text NOT NULL,
	`sizeBytes` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_files_userId_sha256` ON `files` (`userId`,`sha256`);--> statement-breakpoint
CREATE TABLE `oauthStates` (
	`state` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`providerId` text NOT NULL,
	`codeVerifier` text,
	`expiresAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`providerId`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `postDestinations` (
	`id` text PRIMARY KEY NOT NULL,
	`postId` text NOT NULL,
	`channelId` text NOT NULL,
	`errorMessage` text,
	`externalPostId` text,
	`publishedAt` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `postDestinations_postId_channelId_unique` ON `postDestinations` (`postId`,`channelId`);--> statement-breakpoint
CREATE TABLE `postFiles` (
	`postId` text NOT NULL,
	`fileId` text NOT NULL,
	FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `postFiles_postId_fileId_unique` ON `postFiles` (`postId`,`fileId`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`scheduledPublishAt` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`targetPrivacy` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`userId` text,
	`clientId` text NOT NULL,
	`clientSecret` text NOT NULL,
	`extra` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_providers_userId` ON `providers` (`userId`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`isAdmin` integer DEFAULT false NOT NULL,
	`passwordHash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);