import { HTTPException } from "hono/http-exception";
import z from "zod";
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

export class MastodonAuthProvider extends AuthProvider {
  readonly type = "mastodon" as const;
  readonly authorizationUrl = "";
  readonly tokenUrl = "";
  readonly scopes = ["profile", "write:media", "write:statuses"] as const;

  async getAuthorizationUrl(
    input: ProviderAuthorizationUrlInput,
  ): Promise<ProviderAuthorizationUrlResult> {
    const instanceUrl = getMastodonInstanceUrl(this.config.extra);
    const authUrl = new URL(`${instanceUrl}/oauth/authorize`);
    authUrl.searchParams.set("client_id", this.config.clientId);
    authUrl.searchParams.set("redirect_uri", this.config.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", this.scopes.join(" "));
    authUrl.searchParams.set("state", input.state);

    return {
      authorizationUrl: authUrl.toString(),
    };
  }

  async exchangeCodeForToken(
    input: ProviderExchangeCodeInput,
  ): Promise<ProviderExchangeCodeResult> {
    const instanceUrl = getMastodonInstanceUrl(this.config.extra);
    const res = await fetch(`${instanceUrl}/oauth/token`, {
      method: "POST",
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: input.code,
        grant_type: "authorization_code",
        redirect_uri: this.config.redirectUri,
        scope: this.scopes.join("+"),
      }),
    });

    if (!res.ok)
      throw new HTTPException(400, {
        message: `Mastodon token exchange failed: ${res.status}`,
      });

    const body = (await res.json()) as {
      access_token?: string;
    };
    if (!body.access_token)
      throw new HTTPException(400, {
        message: "Mastodon token exchange did not return an access token",
      });

    return {
      accessToken: body.access_token,
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

export class MastodonPublishingProvider extends PublishingProvider {
  readonly supportsImage = true;
  readonly supportsVideo = true;

  async listPublishTargets(): Promise<ProviderPublishTarget[]> {
    const res = await fetch(
      `${getMastodonInstanceUrl(this.extra)}/api/v1/accounts/verify_credentials`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (!res.ok)
      throw new HTTPException(400, {
        message: `Mastodon verify_credentials failed: ${res.status}`,
      });

    const profile = (await res.json()) as {
      id: string;
      username: string;
    };

    return [
      {
        channelTitle: profile.username,
        externalChannelId: profile.id,
      },
    ];
  }

  async publishPost(input: PublishPostInput): Promise<PublishPostResult> {
    const status = [input.title, input.description]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (!status)
      throw new Error(
        "Mastodon publish requires a non-empty title or description",
      );

    if (status.length > 500)
      throw new Error("Mastodon status text cannot exceed 500 characters");

    const mediaIds = await Promise.all(
      input.files.map(async (file) => {
        const form = new FormData();
        form.set("file", new Blob([file.buffer], { type: file.type }));

        const res = await fetch(
          `${getMastodonInstanceUrl(this.extra)}/api/v1/media`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
            body: form,
          },
        );

        if (!res.ok)
          throw new Error(`Mastodon media upload failed: ${res.status}`);

        const body = (await res.json()) as {
          id?: string;
        };
        if (!body.id)
          throw new Error(
            "Mastodon media upload succeeded, but the ID was missing",
          );

        return body.id;
      }),
    );

    const form = new FormData();
    form.set("status", status);
    form.set("visibility", input.privacyStatus);

    for (const mediaId of mediaIds) {
      form.append("media_ids[]", mediaId);
    }

    const res = await fetch(
      `${getMastodonInstanceUrl(this.extra)}/api/v1/statuses`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: form,
      },
    );

    if (!res.ok)
      throw new Error(`Mastodon status publish failed: ${res.status}`);

    const body = (await res.json()) as {
      id?: string;
    };
    if (!body.id)
      throw new Error("Mastodon publish succeeded, but the ID was missing");

    return {
      externalId: body.id,
    };
  }
}

function getMastodonInstanceUrl(value: string) {
  const parsed = z.url().safeParse(value);
  if (!parsed.success) throw new Error("The Mastodon instance URL is invalid");
  return new URL(parsed.data).origin;
}
