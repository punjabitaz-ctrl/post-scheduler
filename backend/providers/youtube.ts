import dayjs from "dayjs";
import { HTTPException } from "hono/http-exception";
import {
  AuthProvider,
  PublishingProvider,
  getMissingScopes,
  type ProviderAuthorizationUrlInput,
  type ProviderAuthorizationUrlResult,
  type ProviderExchangeCodeInput,
  type ProviderExchangeCodeResult,
  type ProviderPublishTarget,
  type ProviderRenewTokenInput,
  type ProviderRenewTokenResult,
  type PublishPostInput,
  type PublishPostResult,
} from "./base";

export class YouTubeAuthProvider extends AuthProvider {
  readonly type = "youtube" as const;
  readonly authorizationUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  readonly tokenUrl = "https://oauth2.googleapis.com/token";
  readonly scopes = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.upload",
  ] as const;

  async getAuthorizationUrl(
    input: ProviderAuthorizationUrlInput,
  ): Promise<ProviderAuthorizationUrlResult> {
    const authUrl = new URL(this.authorizationUrl);
    authUrl.searchParams.set("client_id", this.config.clientId);
    authUrl.searchParams.set("redirect_uri", this.config.redirectUri);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", this.scopes.join(" "));
    authUrl.searchParams.set("state", input.state);

    return { authorizationUrl: authUrl.toString() };
  }

  async exchangeCodeForToken(
    input: ProviderExchangeCodeInput,
  ): Promise<ProviderExchangeCodeResult> {
    const tokenRes = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code: input.code,
        grant_type: "authorization_code",
      }),
    });

    const now = dayjs().unix();
    if (!tokenRes.ok)
      throw new HTTPException(400, {
        message: "OAuth token exchange failed",
      });

    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token: string;
      scope: string;
      refresh_token_expires_in: number;
    };

    const missingScopes = getMissingScopes(tokenJson.scope, this.scopes);
    if (missingScopes.length > 0)
      throw new HTTPException(400, {
        message: "The user didn't grant all required scopes",
      });

    return {
      accessToken: tokenJson.access_token,
      accessTokenExpiresAt: now + tokenJson.expires_in,
      refreshToken: tokenJson.refresh_token,
      refreshTokenExpiresAt: now + tokenJson.refresh_token_expires_in,
    };
  }

  async renewToken(
    input: ProviderRenewTokenInput,
  ): Promise<ProviderRenewTokenResult> {
    let now = dayjs().unix();
    const shouldRefresh =
      input.accessTokenExpiresAt > 0 && input.accessTokenExpiresAt <= now + 60;
    const canRefreshToken =
      Boolean(input.refreshToken) &&
      (input.refreshTokenExpiresAt === 0 || input.refreshTokenExpiresAt > now);

    if (!shouldRefresh) return input;

    if (!canRefreshToken) {
      if (input.accessTokenExpiresAt > now) return input;

      throw new Error(
        "YouTube access token has expired, and the refresh token is unavailable or has expired",
      );
    }

    const tokenRes = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: input.refreshToken,
      }),
    });

    now = dayjs().unix();
    if (!tokenRes.ok)
      throw new Error(
        `Token refresh failed: ${tokenRes.status} ${await tokenRes.text()}`,
      );

    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token_expires_in: number;
    };

    return {
      accessToken: tokenJson.access_token,
      accessTokenExpiresAt: now + tokenJson.expires_in,
      refreshToken: input.refreshToken,
      refreshTokenExpiresAt: now + tokenJson.refresh_token_expires_in,
    };
  }
}

export class YouTubePublishingProvider extends PublishingProvider {
  readonly supportsImage = false;
  readonly supportsVideo = true;

  async listPublishTargets(): Promise<ProviderPublishTarget[]> {
    const channelsRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );
    if (!channelsRes.ok)
      throw new HTTPException(400, {
        message: `YouTube channels API failed: ${channelsRes.status} ${await channelsRes.text()}`,
      });

    const channelsJson = (await channelsRes.json()) as {
      items: Array<{ id: string; snippet: { title: string } }>;
    };

    return channelsJson.items.map((item) => ({
      channelTitle: item.snippet.title,
      externalChannelId: item.id,
    }));
  }

  async publishPost(input: PublishPostInput): Promise<PublishPostResult> {
    const file = input.files.find(
      (candidate) => candidate.type === "video/mp4",
    );
    if (!file) throw new Error("YouTube publishing requires a file upload");

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          snippet: {
            title: input.title,
            description: input.description,
          },
          status: {
            privacyStatus: input.privacyStatus,
          },
        }),
      },
    );

    if (!initRes.ok)
      throw new Error(
        `YouTube upload session failed: ${initRes.status} ${await initRes.text()}`,
      );

    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl)
      throw new Error("YouTube upload session did not return an upload URL");

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      body: new Blob([file.buffer], { type: file.type }),
    });

    if (!uploadRes.ok)
      throw new Error(
        `YouTube upload failed: ${uploadRes.status} ${await uploadRes.text()}`,
      );

    const uploadJson = (await uploadRes.json()) as { id: string };
    if (!uploadJson.id)
      throw new Error("YouTube upload succeeded, but the ID was missing");

    return { externalId: uploadJson.id };
  }
}
