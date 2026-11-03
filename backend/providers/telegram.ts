import {
  DummyAuthProvider,
  PublishingProvider,
  type ProviderPublishTarget,
  type PublishPostInput,
  type PublishPostResult,
} from "./base";

const TELEGRAM_API_BASE = "https://api.telegram.org";

export class TelegramAuthProvider extends DummyAuthProvider {
  readonly type = "telegram" as const;
}

export class TelegramPublishingProvider extends PublishingProvider {
  readonly supportsImage = false;
  readonly supportsVideo = false;

  async listPublishTargets(): Promise<ProviderPublishTarget[]> {
    const res = await fetch(
      `${TELEGRAM_API_BASE}/bot${this.accessToken}/getUpdates`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allowed_updates: ["message", "channel_post"],
        }),
      },
    );

    type Chat = {
      id: number;
      first_name?: string;
      last_name?: string;
      title?: string;
      username?: string;
    };

    const body = (await res.json()) as {
      ok: boolean;
      result: {
        channel_post?: {
          chat: Chat;
        };
        message?: {
          chat: Chat;
        };
      }[];
    };
    if (!res.ok || !body.ok || !body.result)
      throw new Error(`Telegram getUpdates failed: ${res.status}`);

    const targets = new Map<string, string>();

    for (const update of body.result) {
      const chat = update.channel_post?.chat || update.message?.chat;

      if (!chat) continue;

      const externalChannelId = String(chat.id);
      if (targets.has(externalChannelId)) continue;

      if (chat.title) targets.set(externalChannelId, chat.title);
      else if (chat.username)
        targets.set(externalChannelId, `@${chat.username}`);
      else if (chat.first_name || chat.last_name)
        targets.set(
          externalChannelId,
          [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim(),
        );
    }

    return [...targets].map(([externalChannelId, channelTitle]) => ({
      channelTitle,
      externalChannelId,
    }));
  }

  async publishPost(input: PublishPostInput): Promise<PublishPostResult> {
    const text = [input.title.trim(), input.description.trim()]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (!text)
      throw new Error(
        "Telegram publishing requires a non-empty title or description",
      );

    const res = await fetch(
      `${TELEGRAM_API_BASE}/bot${this.accessToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: input.externalChannelId,
          text,
        }),
      },
    );

    const body = (await res.json()) as {
      ok?: boolean;
      result?: { message_id?: number };
    };
    if (!res.ok || !body.ok || !body.result?.message_id)
      throw new Error(`Telegram sendMessage failed: ${res.status}`);

    return {
      externalId: String(body.result.message_id),
    };
  }
}
