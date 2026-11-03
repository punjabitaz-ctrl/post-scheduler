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

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

export class TikTokAuthProvider extends AuthProvider {
  readonly type = "tiktok" as const;
  readonly authorizationUrl = "https://www.tiktok.com/v2/auth/authorize/";
  readonly tokenUrl = `${TIKTOK_API_BASE}/oauth/token/`;
  readonly scopes = [
    "user.info.basic",
    "video.publish",
    "video.upload",
  ] as const;

  async getAuthorizationUrl(
    input: ProviderAuthorizationUrlInput,
  ): Promise<ProviderAuthorizationUrlResult> {
    const authUrl = new URL(this.authorizationUrl);
    authUrl.searchParams.set("client_key", this.config.clientId);
    authUrl.searchParams.set("redirect_uri", this.config.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", this.scopes.join(","));
    authUrl.searchParams.set("state", input.state);

    return { authorizationUrl: authUrl.toString() };
  }

  async exchangeCodeForToken(
    input: ProviderExchangeCodeInput,
  ): Promise<ProviderExchangeCodeResult> {
    const tokenRes = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_key: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code: input.code,
        grant_type: "authorization_code",
      }),
    });

    const now = dayjs().unix();
    if (!tokenRes.ok)
      throw new HTTPException(400, {
        message: `TikTok token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`,
      });

    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
      refresh_expires_in: number;
      refresh_token: string;
      scope: string;
      error?: {
        code?: string;
      };
    };

    if (tokenJson.error?.code && tokenJson.error.code !== "ok")
      throw new HTTPException(400, {
        message: `TikTok token exchange failed: ${JSON.stringify(tokenJson)}`,
      });

    const missingScopes = getMissingScopes(tokenJson.scope, this.scopes, ",");
    if (missingScopes.length > 0)
      throw new HTTPException(400, {
        message: `TikTok token exchange did not grant the required scopes: ${missingScopes.join(", ")}`,
      });

    return {
      accessToken: tokenJson.access_token,
      accessTokenExpiresAt: now + tokenJson.expires_in,
      refreshToken: tokenJson.refresh_token,
      refreshTokenExpiresAt: now + tokenJson.refresh_expires_in,
    };
  }

  async renewToken(
    input: ProviderRenewTokenInput,
  ): Promise<ProviderRenewTokenResult> {
    const now = dayjs().unix();
    const shouldRefresh =
      input.accessTokenExpiresAt > 0 && input.accessTokenExpiresAt <= now + 60;
    const canRefreshToken =
      Boolean(input.refreshToken) &&
      (input.refreshTokenExpiresAt === 0 || input.refreshTokenExpiresAt > now);

    if (!shouldRefresh) return input;

    if (!canRefreshToken) {
      if (input.accessTokenExpiresAt > now) return input;

      throw new Error(
        "TikTok access token has expired, and the refresh token is unavailable or expired",
      );
    }

    const tokenRes = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_key: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: input.refreshToken,
      }),
    });

    if (!tokenRes.ok)
      throw new Error(
        `TikTok token refresh failed: ${tokenRes.status} ${await tokenRes.text()}`,
      );

    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
      refresh_expires_in: number;
      refresh_token: string;
      error?: {
        code?: string;
      };
    };

    if (tokenJson.error?.code && tokenJson.error.code !== "ok")
      throw new Error(
        `TikTok token refresh failed: ${JSON.stringify(tokenJson)}`,
      );

    return {
      accessToken: tokenJson.access_token,
      accessTokenExpiresAt: now + tokenJson.expires_in,
      refreshToken: tokenJson.refresh_token,
      refreshTokenExpiresAt: now + tokenJson.refresh_expires_in,
    };
  }
}

export class TikTokPublishingProvider extends PublishingProvider {
  readonly supportsImage = false;
  readonly supportsVideo = true;

  async listPublishTargets(): Promise<ProviderPublishTarget[]> {
    const res = await fetch(
      `${TIKTOK_API_BASE}/user/info/?fields=open_id,username`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (!res.ok)
      throw new HTTPException(400, {
        message: `TikTok user info failed: ${res.status} ${await res.text()}`,
      });

    const json = (await res.json()) as {
      data: {
        user: {
          open_id: string;
          username: string;
        };
      };
      error?: {
        code?: string;
      };
    };

    if (json.error?.code && json.error.code !== "ok")
      throw new HTTPException(400, {
        message: `TikTok user info failed: ${JSON.stringify(json)}`,
      });

    return [
      {
        channelTitle: json.data.user.username,
        externalChannelId: json.data.user.open_id,
      },
    ];
  }

  async publishPost(input: PublishPostInput): Promise<PublishPostResult> {
    const file = input.files.find(
      (candidate) => candidate.type === "video/mp4",
    );
    if (!file)
      throw new Error(
        "TikTok publishing currently requires exactly one MP4 video file",
      );

    const fileSize = file.size ?? file.buffer.byteLength;
    const chunkSize = fileSize;
    const totalChunkCount = 1;
    const privacyLevel =
      input.privacyStatus === "public" ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY";

    const text = [input.title.trim(), input.description?.trim() ?? ""]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (!text)
      throw new Error("TikTok publishing requires non-empty post text");

    const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: text,
          privacy_level: privacyLevel,
          brand_organic_toggle: false,
          brand_content_toggle: false,
        },
        source_info: {
          chunk_size: chunkSize,
          source: "FILE_UPLOAD",
          total_chunk_count: totalChunkCount,
          video_size: fileSize,
        },
      }),
    });

    if (!initRes.ok)
      throw new Error(
        `TikTok upload initialization failed: ${initRes.status} ${await initRes.text()}`,
      );

    const initJson = (await initRes.json()) as {
      data: {
        publish_id: string;
        upload_url: string;
      };
      error?: {
        code?: string;
      };
    };

    if (initJson.error?.code && initJson.error.code !== "ok")
      throw new Error(`TikTok upload init failed`);

    for (let chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex += 1) {
      const start = chunkIndex * chunkSize;
      const endExclusive =
        chunkIndex === totalChunkCount - 1 ? fileSize : start + chunkSize;
      const uploadRes = await fetch(initJson.data.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
          "Content-Length": String(endExclusive - start),
          "Content-Range": `bytes ${start}-${endExclusive - 1}/${fileSize}`,
        },
        body: file.buffer.slice(start, endExclusive),
      });

      if (!uploadRes.ok)
        throw new Error(`TikTok upload failed: ${uploadRes.status}`);
    }

    const TIKTOK_POLL_DELAY_MS = 5000;
    const TIKTOK_POLL_ATTEMPTS = 100;

    for (let attempt = 0; attempt < TIKTOK_POLL_ATTEMPTS; attempt += 1) {
      const statusRes = await fetch(
        `${TIKTOK_API_BASE}/post/publish/status/fetch/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            publish_id: initJson.data.publish_id,
          }),
        },
      );

      if (!statusRes.ok)
        throw new Error(
          `TikTok publish status failed: ${statusRes.status} ${await statusRes.text()}`,
        );

      const statusJson = (await statusRes.json()) as {
        data: {
          status: string;
          publicaly_available_post_id: number[];
        };
        error?: {
          code?: string;
        };
      };

      if (statusJson.error?.code && statusJson.error.code !== "ok")
        throw new Error("TikTok publish status failed");

      if (statusJson.data.status === "PUBLISH_COMPLETE") {
        const postId = statusJson.data.publicaly_available_post_id[0];

        return {
          externalId: String(postId),
        };
      }

      if (statusJson.data?.status === "FAILED")
        throw new Error("TikTok publish failed");

      await scheduler.wait(TIKTOK_POLL_DELAY_MS);
    }

    throw new Error("TikTok publishing did not complete before timing out");
  }
}
