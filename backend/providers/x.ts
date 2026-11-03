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

export class XAuthProvider extends AuthProvider {
  readonly type = "x" as const;
  readonly authorizationUrl = "https://twitter.com/i/oauth2/authorize";
  readonly tokenUrl = "https://api.twitter.com/2/oauth2/token";
  readonly scopes = [
    "offline.access",
    "tweet.read",
    "tweet.write",
    "users.read",
  ] as const;

  async getAuthorizationUrl(
    input: ProviderAuthorizationUrlInput,
  ): Promise<ProviderAuthorizationUrlResult> {
    const codeVerifier = input.codeVerifier;
    if (!codeVerifier)
      throw new HTTPException(400, {
        message: "X authorization requires a PKCE code verifier",
      });
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(codeVerifier),
    );
    let binary = "";
    for (const byte of new Uint8Array(digest)) {
      binary += String.fromCharCode(byte);
    }

    const codeChallenge = btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    const authUrl = new URL(this.authorizationUrl);
    authUrl.searchParams.set("client_id", this.config.clientId);
    authUrl.searchParams.set("redirect_uri", this.config.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", this.scopes.join(" "));
    authUrl.searchParams.set("state", input.state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return { authorizationUrl: authUrl.toString() };
  }

  async exchangeCodeForToken(
    input: ProviderExchangeCodeInput,
  ): Promise<ProviderExchangeCodeResult> {
    if (!input.codeVerifier)
      throw new HTTPException(400, {
        message: "OAuth state is missing X PKCE verifier",
      });

    const tokenRes = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${this.config.clientId}:${this.config.clientSecret}`)}`,
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        code: input.code,
        code_verifier: input.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: this.config.redirectUri,
      }),
    });

    const now = dayjs().unix();
    if (!tokenRes.ok)
      throw new HTTPException(400, {
        message: `X token exchange failed: ${tokenRes.status} ${await tokenRes.text()}}`,
      });

    const tokenJson = (await tokenRes.json()) as {
      expires_in: number;
      access_token: string;
      scope: string;
      refresh_token: string;
    };

    const missingScopes = getMissingScopes(tokenJson.scope, this.scopes);
    if (missingScopes.length > 0)
      throw new HTTPException(400, {
        message: `X token exchange did not grant the required scopes: ${missingScopes.join(", ")}`,
      });

    return {
      accessToken: tokenJson.access_token,
      accessTokenExpiresAt: now + tokenJson.expires_in,
      refreshToken: tokenJson.refresh_token,
      refreshTokenExpiresAt: 0,
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
        "X access token expired, and the refresh token is unavailable or has expired",
      );
    }

    const tokenRes = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${this.config.clientId}:${this.config.clientSecret}`)}`,
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
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
      expires_in: number;
      access_token: string;
      refresh_token: string;
    };

    return {
      accessToken: tokenJson.access_token,
      accessTokenExpiresAt: now + tokenJson.expires_in,
      refreshToken: tokenJson.refresh_token,
      refreshTokenExpiresAt: 0,
    };
  }
}

export class XPublishingProvider extends PublishingProvider {
  readonly supportsImage = false;
  readonly supportsVideo = false;

  async listPublishTargets(): Promise<ProviderPublishTarget[]> {
    const meRes = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=id,username",
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (!meRes.ok)
      throw new HTTPException(400, {
        message: `X users API failed: ${meRes.status} ${await meRes.text()}`,
      });

    const meJson = (await meRes.json()) as {
      data: { id: string; username: string };
    };

    return [
      {
        channelTitle: `@${meJson.data.username}`,
        externalChannelId: meJson.data.id,
      },
    ];
  }

  async publishPost(input: PublishPostInput): Promise<PublishPostResult> {
    const text = [input.title.trim(), input.description.trim()]
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text)
      throw new Error("X publish requires a non-empty title or description");

    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok)
      throw new Error(`X post failed: ${res.status} ${await res.text()}`);

    const body = (await res.json()) as { data: { id: string } };

    return {
      externalId: body.data.id,
    };
  }
}
