import dayjs from "dayjs";
import { HTTPException } from "hono/http-exception";
import {
  DummyAuthProvider,
  PublishingProvider,
  type ProviderExchangeCodeInput,
  type ProviderExchangeCodeResult,
  type ProviderPublishTarget,
  type ProviderRenewTokenInput,
  type ProviderRenewTokenResult,
  type PublishPostInput,
  type PublishPostResult,
} from "./base";

const BLUESKY_SERVICE_URL = "https://bsky.social";

export class BlueskyAuthProvider extends DummyAuthProvider {
  readonly type = "bluesky" as const;

  async exchangeCodeForToken(
    input: ProviderExchangeCodeInput,
  ): Promise<ProviderExchangeCodeResult> {
    const separatorIndex = input.code.indexOf("|");
    if (separatorIndex <= 0 || separatorIndex === input.code.length - 1)
      throw new HTTPException(400, {
        message: "Bluesky code must be in the format email|password",
      });

    const identifier = input.code.slice(0, separatorIndex).trim();
    const password = input.code.slice(separatorIndex + 1);
    if (!identifier || !password)
      throw new HTTPException(400, {
        message: "Bluesky code must include both an email and a password",
      });

    const res = await fetch(
      `${BLUESKY_SERVICE_URL}/xrpc/com.atproto.server.createSession`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      },
    );

    if (!res.ok)
      throw new HTTPException(400, {
        message: `Bluesky token exchange failed: ${res.status}`,
      });

    const body = (await res.json()) as {
      accessJwt: string;
      refreshJwt: string;
    };
    if (!body.accessJwt || !body.refreshJwt)
      throw new HTTPException(400, {
        message:
          "Bluesky token exchange succeeded, but the tokens were missing",
      });

    return {
      accessToken: body.accessJwt,
      accessTokenExpiresAt: getJwtExpiration(body.accessJwt),
      refreshToken: body.refreshJwt,
      refreshTokenExpiresAt: getJwtExpiration(body.refreshJwt),
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
        "Bluesky access token has expired, and the refresh token is unavailable or has expired",
      );
    }

    const res = await fetch(
      `${BLUESKY_SERVICE_URL}/xrpc/com.atproto.server.refreshSession`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.refreshToken}`,
        },
      },
    );

    if (!res.ok) throw new Error(`Bluesky token refresh failed: ${res.status}`);

    const body = (await res.json()) as {
      accessJwt?: string;
      refreshJwt?: string;
    };
    if (!body.accessJwt || !body.refreshJwt)
      throw new Error(
        "Bluesky token refresh succeeded, but the tokens were missing",
      );

    return {
      accessToken: body.accessJwt,
      accessTokenExpiresAt: getJwtExpiration(body.accessJwt),
      refreshToken: body.refreshJwt,
      refreshTokenExpiresAt: getJwtExpiration(body.refreshJwt),
    };
  }
}

export class BlueskyPublishingProvider extends PublishingProvider {
  readonly supportsImage = true;
  readonly supportsVideo = false;

  async listPublishTargets(): Promise<ProviderPublishTarget[]> {
    const sessionRes = await fetch(
      `${BLUESKY_SERVICE_URL}/xrpc/com.atproto.server.getSession`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (!sessionRes.ok)
      throw new HTTPException(400, {
        message: `Bluesky session lookup failed: ${sessionRes.status}`,
      });

    const session = (await sessionRes.json()) as {
      handle: string;
      did: string;
    };

    return [
      {
        channelTitle: session.handle,
        externalChannelId: session.did,
      },
    ];
  }

  async publishPost(input: PublishPostInput): Promise<PublishPostResult> {
    const text = [input.title.trim(), input.description.trim()]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (!text)
      throw new Error("Bluesky publishing requires non-empty post text");

    if (text.length > 300)
      throw new Error("Bluesky post text must be no more than 300 characters");

    const images = await Promise.all(
      input.files
        .filter((file) => file.type == "image/jpeg" || file.type == "image/png")
        .slice(0, 4)
        .map(async (file) => {
          const res = await fetch(
            `${BLUESKY_SERVICE_URL}/xrpc/com.atproto.repo.uploadBlob`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "Content-Type": file.type,
              },
              body: file.buffer,
            },
          );

          if (!res.ok)
            throw new Error(`Bluesky blob upload failed: ${res.status}`);

          const body = (await res.json()) as {
            blob?: unknown;
          };
          if (!body.blob)
            throw new Error(
              "Bluesky blob upload succeeded, but the blob was missing",
            );

          return {
            alt: "",
            image: body.blob,
          };
        }),
    );

    const res = await fetch(
      `${BLUESKY_SERVICE_URL}/xrpc/com.atproto.repo.createRecord`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: input.externalChannelId,
          collection: "app.bsky.feed.post",
          record: {
            $type: "app.bsky.feed.post",
            text,
            createdAt: new Date().toISOString(),
            ...(images.length > 0 && {
              embed: {
                $type: "app.bsky.embed.images",
                images: images,
              },
            }),
          },
        }),
      },
    );

    if (!res.ok) throw new Error(`Bluesky post creation failed: ${res.status}`);

    const body = (await res.json()) as {
      uri?: string;
    };
    if (!body.uri)
      throw new Error(
        "Bluesky post creation succeeded, but the URI was missing",
      );

    return {
      externalId: body.uri,
    };
  }
}

function getJwtExpiration(token: string): number {
  try {
    const p = token.split(".")[1];
    if (!p) return 0;

    const b64 = p
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(p.length / 4) * 4, "=");

    const { exp } = JSON.parse(atob(b64)) as { exp?: unknown };

    return typeof exp === "number" && Number.isFinite(exp) ? exp : 0;
  } catch {
    return 0;
  }
}
