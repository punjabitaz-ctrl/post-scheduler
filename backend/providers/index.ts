import { type ProviderType } from "../db";
import {
  type AuthProvider,
  type AuthProviderConfig,
  PublishingProvider,
  type PublishingProviderConfig,
} from "./base";
import { BlueskyAuthProvider, BlueskyPublishingProvider } from "./bluesky";
import { DiscordAuthProvider, DiscordPublishingProvider } from "./discord";
import { LinkedInAuthProvider, LinkedInPublishingProvider } from "./linkedin";
import { MastodonAuthProvider, MastodonPublishingProvider } from "./mastodon";
import { TelegramAuthProvider, TelegramPublishingProvider } from "./telegram";
import { TikTokAuthProvider, TikTokPublishingProvider } from "./tiktok";
import { XAuthProvider, XPublishingProvider } from "./x";
import { YouTubeAuthProvider, YouTubePublishingProvider } from "./youtube";

type ProviderRecord = {
  type: ProviderType;
  clientId: string;
  clientSecret: string;
  extra: string;
};

type AuthProviderFactory = (config: AuthProviderConfig) => AuthProvider;

type PublishingProviderFactory = (
  config: PublishingProviderConfig,
) => PublishingProvider;

const authProviderFactories: Record<ProviderType, AuthProviderFactory> = {
  bluesky: (config) => new BlueskyAuthProvider(config),
  discord: (config) => new DiscordAuthProvider(config),
  linkedin: (config) => new LinkedInAuthProvider(config),
  mastodon: (config) => new MastodonAuthProvider(config),
  telegram: (config) => new TelegramAuthProvider(config),
  tiktok: (config) => new TikTokAuthProvider(config),
  x: (config) => new XAuthProvider(config),
  youtube: (config) => new YouTubeAuthProvider(config),
};

const publishingProviderFactories: Record<
  ProviderType,
  PublishingProviderFactory
> = {
  bluesky: (config) => new BlueskyPublishingProvider(config),
  discord: (config) => new DiscordPublishingProvider(config),
  linkedin: (config) => new LinkedInPublishingProvider(config),
  mastodon: (config) => new MastodonPublishingProvider(config),
  telegram: (config) => new TelegramPublishingProvider(config),
  tiktok: (config) => new TikTokPublishingProvider(config),
  x: (config) => new XPublishingProvider(config),
  youtube: (config) => new YouTubePublishingProvider(config),
};

export function createAuthProviderAdapter(input: {
  provider: ProviderRecord;
  redirectUri: string;
}): AuthProvider {
  const { provider, redirectUri } = input;
  const { type, ...providerConfig } = provider;

  return authProviderFactories[type]({
    ...providerConfig,
    redirectUri,
  });
}

export function createPublishingProviderAdapter(input: {
  accessToken: string;
  extra: string;
  type: ProviderType;
}): PublishingProvider {
  const { accessToken, extra, type } = input;

  return publishingProviderFactories[type]({
    accessToken,
    extra,
  });
}
