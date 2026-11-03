import z from "zod";
import {
  DummyAuthProvider,
  PublishingProvider,
  type ProviderPublishTarget,
  type PublishPostInput,
  type PublishPostResult,
} from "./base";

export class DiscordAuthProvider extends DummyAuthProvider {
  readonly type = "discord" as const;
}

export class DiscordPublishingProvider extends PublishingProvider {
  readonly supportsImage = true;
  readonly supportsVideo = true;

  async listPublishTargets(): Promise<ProviderPublishTarget[]> {
    const webhookUrl = getDiscordWebhookUrl(this.accessToken);
    const res = await fetch(webhookUrl, {
      method: "GET",
    });

    if (!res.ok)
      throw new Error(`Discord webhook lookup failed: ${res.status}`);

    const webhook = (await res.json()) as {
      id: string;
      name: string;
    };

    return [
      {
        channelTitle: webhook.name,
        externalChannelId: webhook.id,
      },
    ];
  }

  async publishPost(input: PublishPostInput): Promise<PublishPostResult> {
    const webhookUrl = getDiscordWebhookUrl(this.accessToken);
    webhookUrl.searchParams.set("wait", "true");

    const content = [input.title, input.description]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (content.length > 2000)
      throw new Error("Discord message content cannot exceed 2000 characters");

    const files = input.files.map((file, index) => {
      return {
        name: `file-${index}${
          file.type === "image/jpeg"
            ? ".jpg"
            : file.type === "image/png"
              ? ".png"
              : ".mp4"
        }`,
        type: file.type,
        buffer: file.buffer,
      };
    });

    if (!content && files.length === 0)
      throw new Error(
        "Discord publish requires a non-empty title or description, or at least one file",
      );

    const form = new FormData();
    const payload: {
      content?: string;
      attachments: Array<{ id: number; filename: string }>;
    } = {
      attachments: files.map((file, index) => ({
        id: index,
        filename: file.name,
      })),
    };

    if (content) payload.content = content;

    form.set("payload_json", JSON.stringify(payload));

    for (const [index, file] of files.entries()) {
      form.set(
        `files[${index}]`,
        new Blob([file.buffer], { type: file.type }),
        file.name,
      );
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      body: form,
    });

    if (!res.ok)
      throw new Error(`Discord webhook upload failed: ${res.status}`);

    const message = (await res.json()) as { id?: string };
    if (!message.id)
      throw new Error(
        "Discord publish succeeded, but the message ID was missing",
      );

    return {
      externalId: message.id,
    };
  }
}

function getDiscordWebhookUrl(value: string) {
  const parsed = z.url().safeParse(value);
  if (!parsed.success) throw new Error("The Discord webhook URL is invalid");
  return new URL(parsed.data);
}
