import "server-only";

// Discord webhook client: validate a webhook, post a message with one image
// attachment, edit that message later. A webhook URL is a credential (its
// token lets anyone post to the channel): it never appears in errors or
// logs, and failures surface as short codes only.

const API = "https://discord.com/api/v10";
const TIMEOUT_MS = 10_000;

export type DiscordErrorCode =
  | "invalidUrl"
  | "invalidWebhook"
  | "messageGone"
  | "rateLimited"
  | "tooLarge"
  | "failed";

export class DiscordError extends Error {
  constructor(readonly code: DiscordErrorCode, readonly status?: number) {
    super(`discord: ${code}${status ? ` (${status})` : ""}`);
    this.name = "DiscordError";
  }
}

const WEBHOOK_URL =
  /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d{1,2})?\/webhooks\/(\d{17,20})\/([A-Za-z0-9_-]{50,100})\/?$/;

/**
 * The id and token of a pasted webhook URL, or null. Only Discord's own
 * hosts; the stored form is always the canonical discord.com/api/v10 URL.
 */
export function parseWebhookUrl(url: string): { id: string; url: string } | null {
  const match = WEBHOOK_URL.exec(url.trim());
  if (!match) return null;
  return { id: match[1], url: `${API}/webhooks/${match[1]}/${match[2]}` };
}

async function call(url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new DiscordError("failed");
  }
  if (response.ok) return response;
  if (response.status === 429) throw new DiscordError("rateLimited", 429);
  if (response.status === 413) throw new DiscordError("tooLarge", 413);
  throw new DiscordError("failed", response.status);
}

export type WebhookInfo = { id: string; name: string; channelId: string; guildId: string };

/** Asks Discord about the webhook; invalidWebhook if it doesn't exist (any more). */
export async function getWebhookInfo(webhookUrl: string): Promise<WebhookInfo> {
  try {
    const body = (await (await call(webhookUrl, { method: "GET" })).json()) as {
      id?: string;
      name?: string;
      channel_id?: string;
      guild_id?: string;
    };
    return {
      id: String(body.id ?? ""),
      name: String(body.name ?? "").slice(0, 80),
      channelId: String(body.channel_id ?? "").slice(0, 30),
      guildId: String(body.guild_id ?? "").slice(0, 30),
    };
  } catch (error) {
    if (error instanceof DiscordError && (error.status === 401 || error.status === 404)) {
      throw new DiscordError("invalidWebhook", error.status);
    }
    throw error;
  }
}

export type DiscordEmbed = Record<string, unknown>;

type Payload = {
  embeds: DiscordEmbed[];
  /** Plain message text above the embed (e.g. the weekly role ping). */
  content?: string;
  /** The only role ids this message may ping; nothing else ever pings. */
  pingRoleIds?: string[];
};

function form(payload: Payload, image: { name: string; data: Uint8Array }) {
  const { pingRoleIds = [], ...rest } = payload;
  const body = new FormData();
  body.set(
    "payload_json",
    JSON.stringify({
      ...rest,
      // No @everyone/@here/users/roles from schedule text -- only the role
      // explicitly listed for this message (the weekly post's @livestream).
      allowed_mentions: { parse: [], roles: pingRoleIds.filter((id) => /^\d{17,20}$/.test(id)) },
      attachments: [{ id: 0, filename: image.name }],
    }),
  );
  body.set("files[0]", new Blob([image.data as BlobPart], { type: "image/png" }), image.name);
  return body;
}

/** Posts a message with one PNG attachment; returns the message id. */
export async function postWebhookMessage(
  webhookUrl: string,
  payload: Payload,
  image: { name: string; data: Uint8Array },
): Promise<string> {
  const response = await call(`${webhookUrl}?wait=true`, { method: "POST", body: form(payload, image) });
  const message = (await response.json()) as { id?: string };
  if (!message.id) throw new DiscordError("failed");
  return String(message.id);
}

/**
 * Replaces a message's embeds and image (the old attachment is dropped).
 * messageGone if it was deleted in Discord.
 */
export async function editWebhookMessage(
  webhookUrl: string,
  messageId: string,
  payload: Payload,
  image: { name: string; data: Uint8Array },
): Promise<void> {
  if (!/^\d{17,20}$/.test(messageId)) throw new DiscordError("messageGone");
  try {
    await call(`${webhookUrl}/messages/${messageId}`, { method: "PATCH", body: form(payload, image) });
  } catch (error) {
    if (error instanceof DiscordError && error.status === 404) throw new DiscordError("messageGone", 404);
    throw error;
  }
}
