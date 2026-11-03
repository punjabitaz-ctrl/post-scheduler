import dayjs from "dayjs";
import { drizzle } from "drizzle-orm/d1";
import {
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import z from "zod";

const PROVIDER_TYPES = [
  "bluesky",
  "discord",
  "linkedin",
  "mastodon",
  "telegram",
  "tiktok",
  "x",
  "youtube",
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const providerTypeSchema = z.enum(PROVIDER_TYPES);

const POST_STATUSES = [
  "failed",
  "partiallyPublished",
  "published",
  "scheduled",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

type PostDestinationStatus = Exclude<PostStatus, "partiallyPublished">;

const TARGET_PRIVACY_TYPES = ["private", "public", "unlisted"] as const;

export type TargetPrivacy = (typeof TARGET_PRIVACY_TYPES)[number];

export const targetPrivacySchema = z.enum(TARGET_PRIVACY_TYPES);

const FILE_CONTENT_TYPES = ["image/jpeg", "image/png", "video/mp4"] as const;

export type FileContentType = (typeof FILE_CONTENT_TYPES)[number];

export const unixTimestampSchema = z
  .number()
  .int()
  .positive()
  .refine(
    (timestamp) => timestamp > dayjs().unix(),
    "Timestamp must be in the future",
  );

const APP_SETTING_KEYS = ["baseUrl", "jwtSecret"] as const;

type AppSettingKey = (typeof APP_SETTING_KEYS)[number];

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    emailVerified: integer("emailVerified", { mode: "boolean" })
      .notNull()
      .default(false),
    isAdmin: integer("isAdmin", { mode: "boolean" }).notNull().default(false),
    passwordHash: text("passwordHash").notNull(),
  },
  () => [],
);

export const appSettings = sqliteTable(
  "appSettings",
  {
    key: text("key").$type<AppSettingKey>().primaryKey(),
    value: text("value").notNull(),
  },
  () => [],
);

export const providers = sqliteTable(
  "providers",
  {
    id: text("id").primaryKey(),
    type: text("type").$type<ProviderType>().notNull(),
    // Providers have a userId field that indicates the owner. The absence of a userId indicates that the provider is a global provider. Only admins can perform CRUD operations on providers. Each provider created by a non-admin user must be assigned the creator's userId. Global providers can be read by everyone, whereas providers with a userId can only be managed by the user indicated by the userId field for that provider.
    userId: text("userId").references(() => users.id, { onDelete: "cascade" }),
    clientId: text("clientId").notNull(),
    clientSecret: text("clientSecret").notNull(),
    // The extra field stores optional provider-specific configuration beyond the client ID and client secret. Some providers require additional values, such as a custom base URL and/or other credentials. It holds that extra data as a string, and the interpretation, serialization, and deserialization of this string are completely provider-specific. A provider has the final say on how this variable is used. It could be a JSON string, a plain string, or comma-separated values. That's up to the provider.
    extra: text("extra").notNull(),
  },
  (table) => [index("idx_providers_userId").on(table.userId)],
);

export const oauthStates = sqliteTable(
  "oauthStates",
  {
    state: text("state").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: text("providerId")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    codeVerifier: text("codeVerifier"),
    expiresAt: integer("expiresAt").notNull(),
  },
  () => [],
);

export const channels = sqliteTable(
  "channels",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: text("providerId").references(() => providers.id, {
      onDelete: "cascade",
    }),
    // The channel title is the human-readable, human-identifiable name for that channel. For someone on YouTube, it would be their YouTube channel name; for someone on LinkedIn, it would be their name, and so on.
    channelTitle: text("channelTitle"),
    // The external channel ID is the unique identifier used to identify the channel on that platform. This could be the unique YouTube channel ID, the user ID for a Twitter account, the URN for a LinkedIn account, or any other identifier that does not change when the username or account name changes.
    externalChannelId: text("externalChannelId").notNull(),
    providerType: text("providerType").$type<ProviderType>().notNull(),
    accessToken: text("accessToken").notNull(),
    accessTokenExpiresAt: integer("accessTokenExpiresAt").notNull().default(0),
    refreshToken: text("refreshToken").notNull(),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt")
      .notNull()
      .default(0),
  },
  (table) => [
    index("idx_channels_userId").on(table.userId),
    index("idx_channels_userId_providerId_externalChannelId").on(
      table.userId,
      table.providerId,
      table.externalChannelId,
    ),
  ],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    scheduledPublishAt: integer("scheduledPublishAt"),
    status: text("status").$type<PostStatus>().notNull().default("scheduled"),
    targetPrivacy: text("targetPrivacy").$type<TargetPrivacy>().notNull(),
  },
  () => [],
);

export const postDestinations = sqliteTable(
  "postDestinations",
  {
    id: text("id").primaryKey(),
    postId: text("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    channelId: text("channelId")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    errorMessage: text("errorMessage"),
    externalPostId: text("externalPostId"),
    publishedAt: integer("publishedAt"),
    status: text("status")
      .$type<PostDestinationStatus>()
      .notNull()
      .default("scheduled"),
  },
  (table) => [
    uniqueIndex("postDestinations_postId_channelId_unique").on(
      table.postId,
      table.channelId,
    ),
  ],
);

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sha256: text("sha256").notNull(),
    contentType: text("contentType").$type<FileContentType>().notNull(),
    fileName: text("fileName").notNull(),
    sizeBytes: integer("sizeBytes").notNull(),
  },
  (table) => [index("idx_files_userId_sha256").on(table.userId, table.sha256)],
);

export const postFiles = sqliteTable(
  "postFiles",
  {
    postId: text("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    fileId: text("fileId")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("postFiles_postId_fileId_unique").on(
      table.postId,
      table.fileId,
    ),
  ],
);

export const fileChunks = sqliteTable(
  "fileChunks",
  {
    fileId: text("fileId")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    chunkId: integer("chunkId").notNull(),
    content: blob("content", { mode: "buffer" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.fileId, table.chunkId] })],
);

export function initDb(d1: D1Database) {
  return drizzle(d1, {
    schema: {
      users,
      appSettings,
      providers,
      oauthStates,
      channels,
      posts,
      postDestinations,
      files,
      postFiles,
      fileChunks,
    },
  });
}
