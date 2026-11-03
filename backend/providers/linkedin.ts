import dayjs from "dayjs";
import { HTTPException } from "hono/http-exception";
import {
  AuthProvider,
  PublishingProvider,
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

export class LinkedInAuthProvider extends AuthProvider {
  readonly type = "linkedin" as const;
  readonly authorizationUrl = "https://www.linkedin.com/oauth/v2/authorization";
  readonly tokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";
  readonly scopes = ["email", "openid", "profile", "w_member_social"] as const;

  async getAuthorizationUrl(
    input: ProviderAuthorizationUrlInput,
  ): Promise<ProviderAuthorizationUrlResult> {
    const authUrl = new URL(this.authorizationUrl);
    authUrl.searchParams.set("client_id", this.config.clientId);
    authUrl.searchParams.set("redirect_uri", this.config.redirectUri);
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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
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
        message: `LinkedIn token exchange failed: ${tokenRes.status}`,
      });

    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
    };

    return {
      accessToken: tokenJson.access_token,
      accessTokenExpiresAt: now + tokenJson.expires_in,
      refreshToken: "",
      refreshTokenExpiresAt: 0,
    };
  }

  async renewToken(
    input: ProviderRenewTokenInput,
  ): Promise<ProviderRenewTokenResult> {
    // https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens
    const now = dayjs().unix();
    const shouldRefresh =
      input.accessTokenExpiresAt > 0 && input.accessTokenExpiresAt <= now + 60;

    if (!shouldRefresh) return input;

    if (input.accessTokenExpiresAt > now) return input;

    throw new Error(
      "LinkedIn access token has expired, and automatic renewal is not supported",
    );
  }
}

export class LinkedInPublishingProvider extends PublishingProvider {
  readonly supportsImage = false;
  readonly supportsVideo = false;

  async listPublishTargets(): Promise<ProviderPublishTarget[]> {
    const profile = await this.getLinkedInUserInfo(this.accessToken);

    return [
      {
        channelTitle: profile.name,
        externalChannelId: profile.sub,
      },
    ];
  }

  async publishPost(input: PublishPostInput): Promise<PublishPostResult> {
    const profile = await this.getLinkedInUserInfo(this.accessToken);

    const author = `urn:li:person:${profile.sub}`;
    const commentary = [input.title.trim(), input.description.trim()]
      .filter(Boolean)
      .join("\n\n")
      .trim();
    if (!commentary)
      throw new Error("LinkedIn publishing requires non-empty post text");

    const res = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": "202602",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author,
        commentary,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
        },
        lifecycleState: "PUBLISHED",
      }),
    });

    if (!res.ok) throw new Error(`LinkedIn post failed: ${res.status}`);

    const externalId = res.headers.get("x-restli-id");
    if (!externalId)
      throw new Error("LinkedIn post succeeded, but the ID was missing");

    return {
      externalId: externalId,
    };
  }

  private async getLinkedInUserInfo(accessToken: string) {
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok)
      throw new HTTPException(400, {
        message: `LinkedIn user info failed: ${res.status}`,
      });

    return (await res.json()) as { sub: string; name: string };
  }
}
