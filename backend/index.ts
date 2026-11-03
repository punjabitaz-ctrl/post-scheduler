import jwt from "@tsndr/cloudflare-worker-jwt";
import dayjs from "dayjs";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import type { ZodType } from "zod";
import z from "zod";
import * as s from "./db";
import { initDb } from "./db";
import { FileStorage, MAX_FILE_SIZE_BYTES } from "./file-storage";
import {
  createAuthProviderAdapter,
  createPublishingProviderAdapter,
} from "./providers";
import { DummyAuthProvider, ProviderPublishTarget } from "./providers/base";

export function parseWithSchema<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  throw new HTTPException(400, {
    message: "Invalid input",
  });
}

type Bindings = {
  BASE_URL?: string;
  DISABLE_REGISTRATION?: string;
  JWT_SECRET?: string;
  DB: D1Database;
  PUBLISH_SCHEDULER: DurableObjectNamespace;
};

type Variables = {
  db: ReturnType<typeof initDb>;
  user: typeof s.users.$inferSelect;
};

type AppType = { Bindings: Bindings; Variables: Variables };

const app = new Hono<AppType>();
const publicApp = new Hono<AppType>();
const protectedApp = new Hono<AppType>();

const signupBodySchema = z.object({
  email: z.email(),
  password: z.string().trim().min(8).max(100),
});

const providerCredentialsSchema = z.object({
  clientId: z.string().trim().max(100),
  clientSecret: z.string().trim().max(100),
  extra: z.string().trim().max(100),
});

const providerCreateBodySchema = providerCredentialsSchema.extend({
  isGlobal: z.boolean(),
  type: s.providerTypeSchema,
});

app.use("*", async (c, next) => {
  c.set("db", initDb(c.env.DB));
  await next();
});

publicApp.post("/auth/signup", async (c) => {
  const db = c.get("db");
  const { email, password } = parseWithSchema(
    signupBodySchema,
    await c.req.json(),
  );

  const normalizedDisableReg = c.env.DISABLE_REGISTRATION?.trim().toLowerCase();
  const disableReg =
    normalizedDisableReg === "false" || normalizedDisableReg === "0"
      ? false
      : true;

  const existing = await db
    .select({ id: s.users.id })
    .from(s.users)
    .where(eq(s.users.email, email))
    .get();
  if (existing)
    throw new HTTPException(409, { message: "Email is already registered" });

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  const generatedJwtSecret = c.env.JWT_SECRET
    ? null
    : Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
  const derivedBaseUrl = c.env.BASE_URL ? null : new URL(c.req.url).origin;
  const firstUserBatch = [
    c.env.DB.prepare(
      "INSERT INTO users (id, email, passwordHash, emailVerified, isAdmin) SELECT ?, ?, ?, 1, 1 WHERE NOT EXISTS (SELECT 1 FROM users)",
    ).bind(id, email, passwordHash),
  ];

  if (generatedJwtSecret) {
    firstUserBatch.push(
      c.env.DB.prepare(
        'INSERT INTO appSettings ("key", "value") SELECT ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?) ON CONFLICT("key") DO NOTHING',
      ).bind("jwtSecret", generatedJwtSecret, id),
    );
  }

  if (derivedBaseUrl) {
    firstUserBatch.push(
      c.env.DB.prepare(
        'INSERT INTO appSettings ("key", "value") SELECT ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?) ON CONFLICT("key") DO NOTHING',
      ).bind("baseUrl", derivedBaseUrl, id),
    );
  }

  const firstUserResults = await c.env.DB.batch(firstUserBatch);
  const isFirstUser = (firstUserResults[0]?.meta?.changes ?? 0) > 0;

  if (!isFirstUser) {
    if (disableReg)
      throw new HTTPException(403, { message: "Registration is disabled" });

    try {
      await db.insert(s.users).values({
        id,
        email,
        passwordHash,
        emailVerified: false,
        isAdmin: false,
      });
    } catch {
      throw new HTTPException(409, { message: "Email is already registered" });
    }
  }

  const now = dayjs().unix();
  const jwtSecret = await resolveJwtSecret(c.env.DB, c.env.JWT_SECRET);
  const token = await jwt.sign(
    {
      sub: id,
      iat: now,
      exp: now + 86400,
    },
    jwtSecret,
  );
  return c.json({ token }, 201);
});

publicApp.post("/auth/signin", async (c) => {
  const db = c.get("db");
  const { email, password } = parseWithSchema(
    signupBodySchema,
    await c.req.json(),
  );

  const [user] = await db
    .select()
    .from(s.users)
    .where(eq(s.users.email, email));
  if (!user)
    throw new HTTPException(401, { message: "Invalid email or password" });

  const hash = await hashPassword(password);
  if (hash !== user.passwordHash)
    throw new HTTPException(401, { message: "Invalid email or password" });

  const now = dayjs().unix();
  const jwtSecret = await resolveJwtSecret(c.env.DB, c.env.JWT_SECRET);
  const token = await jwt.sign(
    {
      sub: user.id,
      iat: now,
      exp: now + 86400,
    },
    jwtSecret,
  );
  return c.json({ token });
});

protectedApp.use("*", async (c, next) => {
  const db = c.get("db");
  const authHeader = c.req.header("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const jwtSecret = await resolveJwtSecret(c.env.DB, c.env.JWT_SECRET);
    const valid = await jwt.verify(token, jwtSecret);
    if (!valid)
      throw new HTTPException(401, { message: "Invalid or expired token" });

    const sub = valid.payload.sub;
    if (!sub)
      throw new HTTPException(401, { message: "Invalid token payload" });

    const [user] = await db.select().from(s.users).where(eq(s.users.id, sub));
    if (!user) throw new HTTPException(401, { message: "User not found" });

    c.set("user", user);
    return next();
  }

  throw new HTTPException(401, { message: "Authorization is required" });
});

protectedApp.post(
  "/files",
  bodyLimit({
    maxSize: MAX_FILE_SIZE_BYTES,
    onError: (c) => c.json({ message: "File is too large" }, 413),
  }),
  async (c) => {
    const form = await c.req.formData();
    const filePart = form.get("file");

    if (!(filePart instanceof File))
      throw new HTTPException(400, {
        message: "File is required (multipart file)",
      });

    const fileStorage = new FileStorage(c.env.DB);
    const user = c.get("user");
    const buffer = new Uint8Array(await filePart.arrayBuffer());

    const file = await fileStorage.put(user.id, filePart.name.trim(), buffer);

    return c.json({ file }, 201);
  },
);

protectedApp.get("/files", async (c) => {
  const fileStorage = new FileStorage(c.env.DB);
  const user = c.get("user");
  const files = await fileStorage.list(user.id);
  return c.json({ files });
});

protectedApp.get("/files/:id", async (c) => {
  const fileStorage = new FileStorage(c.env.DB);
  const user = c.get("user");
  const file = await fileStorage.get(c.req.param("id"), user.id);

  if (!file) throw new HTTPException(404, { message: "File not found" });

  return new Response(file.buffer, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `inline; filename="${file.fileName}"`,
    },
  });
});

protectedApp.get("/users/me", async (c) => {
  const user = c.get("user");
  const { passwordHash: _, ...safeUser } = user;
  return c.json({
    user: safeUser,
  });
});

protectedApp.post("/providers", async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const { isGlobal, ...providerInput } = parseWithSchema(
    providerCreateBodySchema,
    await c.req.json(),
  );

  if (
    createAuthProviderAdapter({
      provider: providerInput,
      redirectUri: c.req.url,
    }) instanceof DummyAuthProvider
  )
    throw new HTTPException(400, {
      message: `Providers with type ${providerInput.type} must be connected through POST /channels`,
    });

  const id = crypto.randomUUID();
  const userId = isGlobal ? null : user.id;
  if (isGlobal && !user.isAdmin)
    throw new HTTPException(403, {
      message: "Only admins can create global providers",
    });

  await db.insert(s.providers).values({
    id,
    userId,
    ...providerInput,
  });

  const [provider] = await db
    .select()
    .from(s.providers)
    .where(eq(s.providers.id, id));
  return c.json({ provider: sanitizeProvider(provider, user) }, 201);
});

protectedApp.get("/providers/media-capabilities", async (c) => {
  const capabilities = s.providerTypeSchema.options.map((type) => {
    const provider = createPublishingProviderAdapter({
      accessToken: "",
      extra: "",
      type,
    });

    return {
      providerType: type,
      image: provider.supportsImage,
      video: provider.supportsVideo,
    };
  });

  return c.json({ capabilities });
});

protectedApp.get("/providers", async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const providers = await db
    .select()
    .from(s.providers)
    .where(or(isNull(s.providers.userId), eq(s.providers.userId, user.id)));

  return c.json({
    providers: providers.map((provider) => sanitizeProvider(provider, user)),
  });
});

protectedApp.patch("/providers/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const id = parseWithSchema(z.uuid(), c.req.param("id"));
  const { clientId, clientSecret, extra } = parseWithSchema(
    providerCredentialsSchema,
    await c.req.json(),
  );
  const [current] = await db
    .select()
    .from(s.providers)
    .where(eq(s.providers.id, id));
  if (!current) throw new HTTPException(404, { message: "Provider not found" });
  assertProviderWritableByUser(current, user);

  await db
    .update(s.providers)
    .set({ clientId, clientSecret, extra })
    .where(eq(s.providers.id, id));

  const [updated] = await db
    .select()
    .from(s.providers)
    .where(eq(s.providers.id, id));
  return c.json({ provider: sanitizeProvider(updated, user) });
});

protectedApp.delete("/providers/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const id = parseWithSchema(z.uuid(), c.req.param("id"));
  const [provider] = await db
    .select()
    .from(s.providers)
    .where(eq(s.providers.id, id));
  if (!provider)
    throw new HTTPException(404, { message: "Provider not found" });
  assertProviderWritableByUser(provider, user);
  const result = await db.delete(s.providers).where(eq(s.providers.id, id));
  if ((result.meta?.changes ?? 0) === 0)
    throw new HTTPException(404, { message: "Provider not found" });
  return c.body(null, 200);
});

protectedApp.get("/providers/:id/authorization-url", async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const id = parseWithSchema(z.uuid(), c.req.param("id"));
  const [provider] = await db
    .select()
    .from(s.providers)
    .where(eq(s.providers.id, id));
  if (!provider)
    throw new HTTPException(404, { message: "Provider not found" });
  assertProviderReadableByUser(provider, user);

  if (
    createAuthProviderAdapter({
      provider,
      redirectUri: c.req.url,
    }) instanceof DummyAuthProvider
  )
    throw new HTTPException(400, {
      message: `Provider type ${provider.type} does not support authorization URLs`,
    });

  const baseUrl = await resolveBaseUrl({
    d1: c.env.DB,
    envBaseUrl: c.env.BASE_URL,
    requestUrl: c.req.url,
  });
  const state = crypto.randomUUID();
  const codeVerifier =
    provider.type === "x"
      ? Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("")
      : null;

  const adapter = createAuthProviderAdapter({
    provider,
    redirectUri: buildProviderRedirectUri(baseUrl, provider.type),
  });
  const { authorizationUrl } = await adapter.getAuthorizationUrl({
    state,
    codeVerifier: codeVerifier ?? undefined,
  });

  await db.insert(s.oauthStates).values({
    state,
    userId: user.id,
    providerId: provider.id,
    codeVerifier,
    expiresAt: dayjs().unix() + 10 * 60,
  });

  return c.json({
    authorizationUrl,
  });
});

publicApp.get("/oauth/:providerType/callback", async (c) => {
  const db = c.get("db");
  const providerType = parseWithSchema(
    s.providerTypeSchema,
    c.req.param("providerType"),
  );

  const { code, error, state } = parseWithSchema(
    z.object({
      code: z.string().trim(),
      error: z.string().trim().optional(),
      state: z.string().trim().min(36).max(36),
    }),
    c.req.query(),
  );

  if (error)
    throw new HTTPException(400, { message: `OAuth failed: ${error}` });

  const [stateRecord] = await db
    .select()
    .from(s.oauthStates)
    .where(eq(s.oauthStates.state, state));
  if (!stateRecord)
    throw new HTTPException(400, { message: "Invalid OAuth state" });
  if (stateRecord.expiresAt < dayjs().unix()) {
    await db.delete(s.oauthStates).where(eq(s.oauthStates.state, state));
    throw new HTTPException(400, { message: "OAuth state has expired" });
  }

  const [provider] = await db
    .select()
    .from(s.providers)
    .where(eq(s.providers.id, stateRecord.providerId));
  if (!provider)
    throw new HTTPException(400, {
      message: "Provider not valid for callback",
    });
  if (provider.type !== providerType)
    throw new HTTPException(400, { message: "Provider type mismatch" });

  if (
    createAuthProviderAdapter({
      provider,
      redirectUri: c.req.url,
    }) instanceof DummyAuthProvider
  )
    throw new HTTPException(400, {
      message: `Provider type ${provider.type} does not support OAuth callbacks`,
    });

  const baseUrl = await resolveBaseUrl({
    d1: c.env.DB,
    envBaseUrl: c.env.BASE_URL,
    requestUrl: c.req.url,
  });

  const adapter = createAuthProviderAdapter({
    provider,
    redirectUri: buildProviderRedirectUri(baseUrl, provider.type),
  });
  try {
    const tokenData = await adapter.exchangeCodeForToken({
      code,
      codeVerifier: stateRecord.codeVerifier ?? undefined,
    });
    const publishingProvider = createPublishingProviderAdapter({
      accessToken: tokenData.accessToken,
      extra: provider.extra,
      type: provider.type,
    });
    const targets = await publishingProvider.listPublishTargets();

    if (targets.length === 0)
      throw new HTTPException(400, {
        message: "No publish targets were found for this account",
      });

    const channels: Array<
      {
        id: string;
        providerId: string;
      } & ProviderPublishTarget
    > = [];
    for (const target of targets) {
      const [existing] = await db
        .select({ id: s.channels.id })
        .from(s.channels)
        .where(
          and(
            eq(s.channels.userId, stateRecord.userId),
            eq(s.channels.providerId, provider.id),
            eq(s.channels.externalChannelId, target.externalChannelId),
          ),
        );

      const channelId = existing?.id ?? crypto.randomUUID();

      if (existing) {
        await db
          .update(s.channels)
          .set({
            channelTitle: target.channelTitle,
            providerType: provider.type,
            ...tokenData,
          })
          .where(
            and(
              eq(s.channels.id, channelId),
              eq(s.channels.userId, stateRecord.userId),
            ),
          );
      } else {
        await db.insert(s.channels).values({
          id: channelId,
          userId: stateRecord.userId,
          providerId: provider.id,
          channelTitle: target.channelTitle,
          externalChannelId: target.externalChannelId,
          providerType: provider.type,
          ...tokenData,
        });
      }

      channels.push({
        id: channelId,
        providerId: provider.id,
        channelTitle: target.channelTitle,
        externalChannelId: target.externalChannelId,
      });
    }

    return c.json({
      channels,
    });
  } finally {
    await db.delete(s.oauthStates).where(eq(s.oauthStates.state, state));
  }
});

protectedApp.get("/channels", async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const channels = await db
    .select()
    .from(s.channels)
    .where(eq(s.channels.userId, user.id));

  return c.json({
    channels: channels.map((channel) => ({
      ...channel,
      accessToken: "**********",
      refreshToken: "**********",
    })),
  });
});

protectedApp.post("/channels", async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const { accessToken, providerType } = parseWithSchema(
    z.object({
      // For Telegram, use the bot token; for Discord, use the Discord webhook URL; for Bluesky, use the email and password separated by |.
      accessToken: z.string().trim().max(1000),
      providerType: s.providerTypeSchema,
    }),
    await c.req.json(),
  );
  const authProvider = createAuthProviderAdapter({
    provider: {
      type: providerType,
      clientId: "",
      clientSecret: "",
      extra: "",
    },
    redirectUri: c.req.url,
  });

  if (!(authProvider instanceof DummyAuthProvider))
    throw new HTTPException(400, {
      message: `Provider type ${providerType} cannot be connected through POST /channels`,
    });

  const tokenData =
    providerType === "bluesky"
      ? await authProvider.exchangeCodeForToken({
          code: accessToken,
        })
      : {
          accessToken,
          accessTokenExpiresAt: 0,
          refreshToken: "",
          refreshTokenExpiresAt: 0,
        };

  const publishingProvider = createPublishingProviderAdapter({
    accessToken: tokenData.accessToken,
    extra: "",
    type: providerType,
  });
  const targets = await publishingProvider.listPublishTargets();

  if (targets.length === 0)
    throw new HTTPException(400, {
      message: "No publish targets were found for this account",
    });

  const channels: Array<
    {
      id: string;
      providerId: string;
    } & ProviderPublishTarget
  > = [];

  for (const target of targets) {
    const [existing] = await db
      .select({ id: s.channels.id })
      .from(s.channels)
      .where(
        and(
          eq(s.channels.userId, user.id),
          isNull(s.channels.providerId),
          eq(s.channels.providerType, providerType),
          eq(s.channels.externalChannelId, target.externalChannelId),
        ),
      );

    const channelId = existing?.id ?? crypto.randomUUID();

    if (existing) {
      await db
        .update(s.channels)
        .set({
          channelTitle: target.channelTitle,
          ...tokenData,
        })
        .where(
          and(eq(s.channels.id, channelId), eq(s.channels.userId, user.id)),
        );
    } else {
      await db.insert(s.channels).values({
        id: channelId,
        userId: user.id,
        providerId: null,
        channelTitle: target.channelTitle,
        externalChannelId: target.externalChannelId,
        providerType,
        ...tokenData,
      });
    }

    channels.push({
      id: channelId,
      providerId: "",
      channelTitle: target.channelTitle,
      externalChannelId: target.externalChannelId,
    });
  }

  return c.json({ channels }, 201);
});

protectedApp.delete("/channels/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const channelId = parseWithSchema(z.uuid(), c.req.param("id"));
  const result = await db
    .delete(s.channels)
    .where(and(eq(s.channels.id, channelId), eq(s.channels.userId, user.id)));
  if ((result.meta?.changes ?? 0) === 0)
    throw new HTTPException(404, { message: "Channel not found" });
  return c.body(null, 200);
});

protectedApp.post("/posts", async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const body = parseWithSchema(
    z.object({
      channelIds: z.array(z.uuid()),
      title: z.string().trim(),
      description: z.string().trim(),
      fileIds: z.array(z.uuid()),
      privacy: s.targetPrivacySchema,
      scheduledAt: s.unixTimestampSchema,
    }),
    await c.req.json(),
  );

  const fileStorage = new FileStorage(c.env.DB);
  const uniqueChannelIds = Array.from(new Set(body.channelIds));
  const uniqueFileIds = Array.from(new Set(body.fileIds));

  if (uniqueChannelIds.length === 0)
    throw new HTTPException(400, {
      message: "Channel IDs are required",
    });

  const channelRows = await db
    .select({
      channelId: s.channels.id,
      providerType: s.channels.providerType,
    })
    .from(s.channels)
    .where(
      and(
        inArray(s.channels.id, uniqueChannelIds),
        eq(s.channels.userId, user.id),
      ),
    );

  const channelMap = new Map(channelRows.map((row) => [row.channelId, row]));
  for (const channelId of uniqueChannelIds) {
    const channel = channelMap.get(channelId);
    if (!channel)
      throw new HTTPException(404, {
        message: `Channel not found: ${channelId}`,
      });
  }

  const channelProviderTypes = new Set(
    channelRows.map((channel) => channel.providerType),
  );

  if (channelProviderTypes.has("youtube") && uniqueFileIds.length === 0)
    throw new HTTPException(400, {
      message: "At least one fileId is required for publishing to YouTube",
    });
  if (channelProviderTypes.has("x") && uniqueFileIds.length > 0)
    throw new HTTPException(400, {
      message: "Files are not currently supported for X",
    });

  const postId = crypto.randomUUID();

  const fileMetas = await Promise.all(
    uniqueFileIds.map(async (fileId) => {
      const meta = await fileStorage.getMeta(fileId, user.id);
      if (!meta)
        throw new HTTPException(400, {
          message: `File not found: ${fileId}`,
        });
      return meta;
    }),
  );

  const destinationIds = uniqueChannelIds.map(() => crypto.randomUUID());

  await db.batch([
    db.insert(s.posts).values({
      id: postId,
      title: body.title,
      description: body.description,
      scheduledPublishAt: body.scheduledAt,
      status: "scheduled",
      targetPrivacy: body.privacy,
    }),
    ...(fileMetas.length > 0
      ? [
          db.insert(s.postFiles).values(
            fileMetas.map((f) => ({
              postId,
              fileId: f.id,
            })),
          ),
        ]
      : []),
    db.insert(s.postDestinations).values(
      uniqueChannelIds.map((channelId, i) => ({
        id: destinationIds[i],
        postId,
        channelId,
        errorMessage: null,
        externalPostId: null,
        publishedAt: null,
        status: "scheduled" as const,
      })),
    ),
  ]);

  await Promise.all(
    destinationIds.map(async (destinationId) => {
      try {
        await schedulePublishAlarm(c.env, destinationId, body.scheduledAt);
      } catch {
        await db
          .update(s.postDestinations)
          .set({
            errorMessage: "Failed to schedule",
            status: "failed",
          })
          .where(eq(s.postDestinations.id, destinationId));
      }
    }),
  );

  await refreshPostStatus(db, postId);

  const [post] = await db.select().from(s.posts).where(eq(s.posts.id, postId));
  if (!post)
    throw new HTTPException(500, {
      message: "Failed to load the created post",
    });
  const destinations = await db
    .select()
    .from(s.postDestinations)
    .where(eq(s.postDestinations.postId, postId));

  return c.json({ post: post, destinations: destinations }, 201);
});

protectedApp.get("/posts", async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const rows = await db
    .select({
      post: s.posts,
      destination: s.postDestinations,
      channelTitle: s.channels.channelTitle,
      providerType: s.channels.providerType,
    })
    .from(s.postDestinations)
    .innerJoin(s.posts, eq(s.postDestinations.postId, s.posts.id))
    .innerJoin(s.channels, eq(s.postDestinations.channelId, s.channels.id))
    .where(eq(s.channels.userId, user.id));

  type Destination = typeof s.postDestinations.$inferSelect & {
    channelTitle: string | null;
    providerType: s.ProviderType;
  };

  type PostWithDestinations = typeof s.posts.$inferSelect & {
    destinations: Destination[];
  };

  const postsMap = new Map<string, PostWithDestinations>();

  for (const row of rows) {
    const destination: Destination = {
      ...row.destination,
      providerType: row.providerType,
      channelTitle: row.channelTitle,
    };

    const existing = postsMap.get(row.post.id);
    if (existing) {
      existing.destinations.push(destination);
    } else {
      postsMap.set(row.post.id, {
        ...row.post,
        destinations: [destination],
      });
    }
  }

  return c.json({ posts: [...postsMap.values()] });
});

protectedApp.delete("/posts/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const postId = parseWithSchema(z.uuid(), c.req.param("id"));

  const post = await db
    .select({
      id: s.posts.id,
      scheduledPublishAt: s.posts.scheduledPublishAt,
    })
    .from(s.posts)
    .innerJoin(s.postDestinations, eq(s.postDestinations.postId, s.posts.id))
    .innerJoin(s.channels, eq(s.postDestinations.channelId, s.channels.id))
    .where(and(eq(s.posts.id, postId), eq(s.channels.userId, user.id)))
    .get();
  if (!post) throw new HTTPException(404, { message: "Post not found" });
  if (post.scheduledPublishAt === null)
    throw new HTTPException(409, { message: "The post is not scheduled" });

  const destinations = await db
    .select({ id: s.postDestinations.id })
    .from(s.postDestinations)
    .innerJoin(s.channels, eq(s.postDestinations.channelId, s.channels.id))
    .where(
      and(
        eq(s.postDestinations.postId, postId),
        eq(s.channels.userId, user.id),
      ),
    );

  await Promise.all(
    destinations.map((destination) =>
      cancelPublishAlarm(c.env, destination.id),
    ),
  );

  await db.delete(s.posts).where(eq(s.posts.id, postId));
  return c.body(null, 200);
});

async function sha256Hex(buffer: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string) {
  return sha256Hex(new TextEncoder().encode(password));
}

async function resolveJwtSecret(
  d1: D1Database,
  envJwtSecret: string | undefined,
) {
  if (envJwtSecret) return envJwtSecret;

  const db = initDb(d1);
  const setting = await db
    .select()
    .from(s.appSettings)
    .where(eq(s.appSettings.key, "jwtSecret"))
    .get();

  if (!setting?.value) throw new Error("JWT_SECRET is required");

  return setting.value;
}

async function resolveBaseUrl(input: {
  d1: D1Database;
  envBaseUrl: string | undefined;
  requestUrl?: string;
}) {
  if (input.envBaseUrl) return new URL(input.envBaseUrl).origin;

  const db = initDb(input.d1);
  const setting = await db
    .select()
    .from(s.appSettings)
    .where(eq(s.appSettings.key, "baseUrl"))
    .get();

  if (setting?.value) return new URL(setting.value).origin;

  if (input.requestUrl) return new URL(input.requestUrl).origin;

  throw new Error("BASE_URL is required for media publishing");
}

function buildProviderRedirectUri(
  baseUrl: string,
  providerType: s.ProviderType,
) {
  const url = new URL(baseUrl);
  url.pathname = `/api/oauth/${providerType}/callback`;
  url.search = "";
  return url.toString();
}

async function getValidAccessToken(
  db: ReturnType<typeof initDb>,
  channel: {
    clientId: string;
    clientSecret: string;
    providerExtra: string;
    providerType: s.ProviderType;
    channelId: string;
    accessToken: string;
    accessTokenExpiresAt: number;
    refreshToken: string;
    refreshTokenExpiresAt: number;
  },
): Promise<string> {
  const adapter = createAuthProviderAdapter({
    provider: {
      type: channel.providerType,
      clientId: channel.clientId,
      clientSecret: channel.clientSecret,
      extra: channel.providerExtra,
    },
    redirectUri: "",
  });
  const renewed = await adapter.renewToken({
    accessToken: channel.accessToken,
    accessTokenExpiresAt: channel.accessTokenExpiresAt,
    refreshToken: channel.refreshToken,
    refreshTokenExpiresAt: channel.refreshTokenExpiresAt,
  });

  const tokenChanged =
    renewed.accessToken !== channel.accessToken ||
    renewed.accessTokenExpiresAt !== channel.accessTokenExpiresAt ||
    renewed.refreshToken !== channel.refreshToken ||
    renewed.refreshTokenExpiresAt !== channel.refreshTokenExpiresAt;

  if (tokenChanged)
    await db
      .update(s.channels)
      .set({
        accessToken: renewed.accessToken,
        accessTokenExpiresAt: renewed.accessTokenExpiresAt,
        refreshToken: renewed.refreshToken,
        refreshTokenExpiresAt: renewed.refreshTokenExpiresAt,
      })
      .where(eq(s.channels.id, channel.channelId));

  return renewed.accessToken;
}

async function refreshPostStatus(
  db: ReturnType<typeof initDb>,
  postId: string,
) {
  const destinations = await db
    .select({
      status: s.postDestinations.status,
    })
    .from(s.postDestinations)
    .where(eq(s.postDestinations.postId, postId));

  if (destinations.length === 0) {
    await db.delete(s.posts).where(eq(s.posts.id, postId));
    return;
  }

  let status: s.PostStatus = "failed";
  if (destinations.every((row) => row.status === "scheduled"))
    status = "scheduled";
  else if (destinations.every((row) => row.status === "published"))
    status = "published";
  else if (destinations.every((row) => row.status === "failed"))
    status = "failed";
  else if (
    destinations.some((row) => row.status === "published") &&
    destinations.some((row) => row.status !== "published")
  )
    status = "partiallyPublished";

  await db
    .update(s.posts)
    .set({
      status,
    })
    .where(eq(s.posts.id, postId));
}

function sanitizeProvider(
  provider: typeof s.providers.$inferSelect,
  user: typeof s.users.$inferSelect,
) {
  return {
    ...provider,
    clientSecret:
      provider.userId === user.id ? provider.clientSecret : "**********",
  };
}

function assertProviderReadableByUser(
  provider: typeof s.providers.$inferSelect,
  user: typeof s.users.$inferSelect,
) {
  if (provider.userId && provider.userId !== user.id)
    throw new HTTPException(404, { message: "Provider not found" });
}

function assertProviderWritableByUser(
  provider: typeof s.providers.$inferSelect,
  user: typeof s.users.$inferSelect,
) {
  if (provider.userId === null) {
    if (!user.isAdmin)
      throw new HTTPException(403, {
        message: "Only admins can modify global providers",
      });
    return;
  }

  if (provider.userId !== user.id)
    throw new HTTPException(404, { message: "Provider not found" });
}

async function schedulePublishAlarm(
  env: Bindings,
  destinationId: string,
  scheduledAt: number,
) {
  const doId = env.PUBLISH_SCHEDULER.idFromName(destinationId);
  const stub = env.PUBLISH_SCHEDULER.get(doId);
  const response = await stub.fetch(
    "https://publish-scheduler.internal/schedule",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinationId, scheduledAt }),
    },
  );
  if (!response.ok) throw new Error(await response.text());
}

async function cancelPublishAlarm(env: Bindings, destinationId: string) {
  const doId = env.PUBLISH_SCHEDULER.idFromName(destinationId);
  const stub = env.PUBLISH_SCHEDULER.get(doId);
  await stub.fetch("https://publish-scheduler.internal/cancel", {
    method: "POST",
  });
}

export class PublishSchedulerDO {
  private state: DurableObjectState;
  private env: Bindings;

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/schedule") {
      const body = parseWithSchema(
        z.object({
          destinationId: z.uuid(),
          scheduledAt: s.unixTimestampSchema,
        }),
        await request.json(),
      );

      await this.state.storage.put("destinationId", body.destinationId);
      await this.state.storage.setAlarm(body.scheduledAt * 1000);
      return Response.json({ scheduled: true });
    }

    if (request.method === "POST" && url.pathname === "/cancel") {
      await this.state.storage.deleteAlarm();
      await this.state.storage.delete("destinationId");
      return Response.json({ cancelled: true });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }

  async alarm() {
    const destinationId = await this.state.storage.get<string>("destinationId");
    if (!destinationId) return;

    try {
      const db = initDb(this.env.DB);
      const row = await db
        .select({
          channel: s.channels,
          destination: s.postDestinations,
          post: s.posts,
          provider: s.providers,
        })
        .from(s.postDestinations)
        .innerJoin(s.posts, eq(s.postDestinations.postId, s.posts.id))
        .innerJoin(s.channels, eq(s.postDestinations.channelId, s.channels.id))
        .leftJoin(s.providers, eq(s.channels.providerId, s.providers.id))
        .where(eq(s.postDestinations.id, destinationId))
        .get();

      if (!row || row.destination.status !== "scheduled") return;

      const fileRows = await db
        .select({
          fileId: s.postFiles.fileId,
          fileOwnerId: s.files.userId,
        })
        .from(s.postFiles)
        .innerJoin(s.files, eq(s.postFiles.fileId, s.files.id))
        .where(eq(s.postFiles.postId, row.destination.postId));

      const fileStorage = new FileStorage(this.env.DB);
      const files = await Promise.all(
        fileRows.map(async (fileRow) => {
          const file = await fileStorage.get(
            fileRow.fileId,
            fileRow.fileOwnerId,
          );
          if (!file)
            throw new HTTPException(404, {
              message: `File not found for post: ${fileRow.fileId}`,
            });

          return {
            buffer: file.buffer,
            size: file.sizeBytes,
            type: file.contentType,
          };
        }),
      );

      const accessToken =
        row.provider && row.channel.providerId
          ? await getValidAccessToken(db, {
              clientId: row.provider.clientId,
              clientSecret: row.provider.clientSecret,
              providerExtra: row.provider.extra,
              providerType: row.channel.providerType,

              channelId: row.channel.id,
              accessToken: row.channel.accessToken,
              accessTokenExpiresAt: row.channel.accessTokenExpiresAt,
              refreshToken: row.channel.refreshToken,
              refreshTokenExpiresAt: row.channel.refreshTokenExpiresAt,
            })
          : row.channel.accessToken;

      const publishingProvider = createPublishingProviderAdapter({
        accessToken,
        extra: row.provider?.extra ?? "",
        type: row.channel.providerType,
      });

      const publishResult = await publishingProvider.publishPost({
        externalChannelId: row.channel.externalChannelId,
        title: row.post.title,
        description: row.post.description ?? "",
        files,
        privacyStatus: row.post.targetPrivacy,
      });

      const now = dayjs().unix();
      await db
        .update(s.postDestinations)
        .set({
          errorMessage: null,
          externalPostId: publishResult.externalId,
          publishedAt: now,
          status: "published",
        })
        .where(eq(s.postDestinations.id, row.destination.id));

      await refreshPostStatus(db, row.destination.postId);
    } catch (error) {
      const db = initDb(this.env.DB);
      const message =
        error instanceof Error ? error.message : "Scheduled publish failed";
      await db
        .update(s.postDestinations)
        .set({
          errorMessage: message,
          status: "failed",
        })
        .where(eq(s.postDestinations.id, destinationId));

      const row = await db
        .select({ postId: s.postDestinations.postId })
        .from(s.postDestinations)
        .where(eq(s.postDestinations.id, destinationId))
        .get();

      if (row) await refreshPostStatus(db, row.postId);
    } finally {
      await this.state.storage.delete("destinationId");
    }
  }
}

app.route("/api", publicApp);
app.route("/api", protectedApp);

export default app;
