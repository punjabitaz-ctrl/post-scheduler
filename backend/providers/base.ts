import { type FileContentType, type ProviderType } from "../db";

export type ProviderAuthorizationUrlInput = {
  state: string;
  codeVerifier?: string;
};

export type ProviderAuthorizationUrlResult = {
  authorizationUrl: string;
};

export type ProviderExchangeCodeInput = {
  code: string;
  codeVerifier?: string;
};

export type ProviderExchangeCodeResult = {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
};

export type ProviderRenewTokenInput = ProviderExchangeCodeResult;

export type ProviderRenewTokenResult = ProviderRenewTokenInput;

export type ProviderPublishTarget = {
  channelTitle: string;
  externalChannelId: string;
};

export type AuthProviderConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  extra: string;
};

export type PublishingProviderConfig = {
  accessToken: string;
  extra: string;
};

export abstract class AuthProvider {
  abstract readonly type: ProviderType;
  abstract readonly authorizationUrl: string;
  abstract readonly tokenUrl: string;
  abstract readonly scopes: readonly string[];
  protected readonly config: AuthProviderConfig;

  constructor(config: AuthProviderConfig) {
    this.config = config;
  }

  abstract getAuthorizationUrl(
    input: ProviderAuthorizationUrlInput,
  ): Promise<ProviderAuthorizationUrlResult>;

  abstract exchangeCodeForToken(
    input: ProviderExchangeCodeInput,
  ): Promise<ProviderExchangeCodeResult>;

  abstract renewToken(
    input: ProviderRenewTokenInput,
  ): Promise<ProviderRenewTokenResult>;
}

export abstract class DummyAuthProvider extends AuthProvider {
  readonly authorizationUrl = "";
  readonly tokenUrl = "";
  readonly scopes = [] as const;

  async getAuthorizationUrl(
    _input: ProviderAuthorizationUrlInput,
  ): Promise<ProviderAuthorizationUrlResult> {
    return {
      authorizationUrl: "",
    };
  }

  async exchangeCodeForToken(
    _input: ProviderExchangeCodeInput,
  ): Promise<ProviderExchangeCodeResult> {
    return {
      accessToken: "",
      accessTokenExpiresAt: 0,
      refreshToken: "",
      refreshTokenExpiresAt: 0,
    };
  }

  async renewToken(
    input: ProviderRenewTokenInput,
  ): Promise<ProviderRenewTokenResult> {
    return input;
  }
}

export function getMissingScopes(
  grantedScope: string,
  requiredScopes: readonly string[],
  separator = " ",
) {
  const grantedScopes = new Set(
    grantedScope
      .split(separator)
      .map((scope) => scope.trim())
      .filter(Boolean),
  );

  return requiredScopes.filter((scope) => !grantedScopes.has(scope));
}

export type PublishPostFile = {
  buffer: Uint8Array;
  size: number;
  type: FileContentType;
};

export type PublishPostInput = {
  externalChannelId: string;
  title: string;
  description: string;
  files: PublishPostFile[];
  privacyStatus: "private" | "unlisted" | "public";
};

export type PublishPostResult = {
  externalId: string;
};

export abstract class PublishingProvider<
  TPublishPostInput extends PublishPostInput = PublishPostInput,
> {
  abstract readonly supportsImage: boolean;
  abstract readonly supportsVideo: boolean;

  protected readonly accessToken: string;
  protected readonly extra: string;

  constructor(config: PublishingProviderConfig) {
    this.accessToken = config.accessToken;
    this.extra = config.extra;
  }

  abstract listPublishTargets(): Promise<ProviderPublishTarget[]>;

  abstract publishPost(input: TPublishPostInput): Promise<PublishPostResult>;
}
