import "server-only";

// Discord bot client for guild scheduled events (a webhook can't create
// events). The bot token is a credential: it never appears in errors or
// logs, and failures surface as short codes only.
// Docs: https://docs.discord.com/developers/resources/guild-scheduled-event

const API = "https://discord.com/api/v10";
const TIMEOUT_MS = 15_000;

export type DiscordBotErrorCode =
  | "invalidToken"
  | "botNotInServer"
  | "missingPermission"
  | "eventGone"
  | "rateLimited"
  | "failed";

export class DiscordBotError extends Error {
  constructor(
    readonly code: DiscordBotErrorCode,
    readonly status?: number,
    /** The bot's id when known (for an invite link after botNotInServer). */
    readonly botId?: string,
  ) {
    super(`discord-bot: ${code}${status ? ` (${status})` : ""}`);
    this.name = "DiscordBotError";
  }
}

const SNOWFLAKE = /^\d{17,20}$/;
// A bot token: three base64url parts. Only a shape check; Discord decides.
const BOT_TOKEN = /^[A-Za-z0-9_-]{20,40}\.[A-Za-z0-9_-]{4,10}\.[A-Za-z0-9_-]{20,60}$/;

export const isBotTokenShape = (token: string) => BOT_TOKEN.test(token);
export const isSnowflake = (id: string) => SNOWFLAKE.test(id);

async function call(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bot ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new DiscordBotError("failed");
  }
  if (response.ok) return response;
  if (response.status === 401) throw new DiscordBotError("invalidToken", 401);
  if (response.status === 429) throw new DiscordBotError("rateLimited", 429);
  if (response.status === 403) {
    // 50001 Missing Access (not in the server), 50013 Missing Permissions.
    const code = ((await response.json().catch(() => ({}))) as { code?: number }).code;
    throw new DiscordBotError(code === 50001 ? "botNotInServer" : "missingPermission", 403);
  }
  throw new DiscordBotError("failed", response.status);
}

// Permission bits (strings in the API, beyond 2^53: BigInt).
const ADMINISTRATOR = BigInt(1) << BigInt(3);
const MANAGE_EVENTS = BigInt(1) << BigInt(33);
const CREATE_EVENTS = BigInt(1) << BigInt(44);
/** Invite link for the bot, asking for "Create Events" + "Manage Events". */
export function botInviteUrl(botId: string) {
  const permissions = (CREATE_EVENTS | MANAGE_EVENTS).toString();
  return `https://discord.com/oauth2/authorize?client_id=${botId}&scope=bot&permissions=${permissions}`;
}

export type BotCheck = { botId: string; botName: string; guildName: string };

/**
 * Who the token belongs to, and whether that bot is in the server and may
 * create events there. Throws invalidToken / botNotInServer /
 * missingPermission.
 */
export async function checkBot(token: string, guildId: string): Promise<BotCheck> {
  const me = (await (await call(token, "/users/@me")).json()) as { id?: string; username?: string; bot?: boolean };
  const botId = String(me.id ?? "");
  if (!me.bot || !SNOWFLAKE.test(botId)) throw new DiscordBotError("invalidToken");
  if (!SNOWFLAKE.test(guildId)) throw new DiscordBotError("botNotInServer", undefined, botId);

  let guild: { name?: string; owner_id?: string; roles?: Array<{ id: string; permissions: string }> };
  let member: { roles?: string[] };
  try {
    guild = await (await call(token, `/guilds/${guildId}`)).json();
    member = await (await call(token, `/guilds/${guildId}/members/${botId}`)).json();
  } catch (error) {
    // Not a member: Discord answers 403 (Missing Access) or 404.
    if (error instanceof DiscordBotError && (error.status === 403 || error.status === 404)) {
      throw new DiscordBotError("botNotInServer", error.status, botId);
    }
    throw error;
  }
  const roles = new Map((guild.roles ?? []).map((role) => [role.id, BigInt(role.permissions || "0")]));
  let permissions = roles.get(guildId) ?? BigInt(0); // @everyone has the guild's id
  for (const id of member.roles ?? []) permissions |= roles.get(id) ?? BigInt(0);
  const allowed =
    guild.owner_id === botId || (permissions & (ADMINISTRATOR | MANAGE_EVENTS | CREATE_EVENTS)) !== BigInt(0);
  if (!allowed) throw new DiscordBotError("missingPermission", undefined, botId);
  return {
    botId,
    botName: String(me.username ?? "").slice(0, 80),
    guildName: String(guild.name ?? "").slice(0, 100),
  };
}

export type ExternalEvent = {
  /** 1-100 characters. */
  name: string;
  /** 1-1000 characters. */
  description: string;
  /** Where it happens, e.g. the Twitch channel URL (1-100 characters). */
  location: string;
  start: Date;
  end: Date;
  /** PNG cover, sent as a data URI. */
  image?: Uint8Array;
};

function eventBody(event: ExternalEvent) {
  return JSON.stringify({
    name: event.name.slice(0, 100),
    description: event.description.slice(0, 1000),
    privacy_level: 2, // GUILD_ONLY, the only value Discord accepts
    entity_type: 3, // EXTERNAL: starts and ends on its own at these times
    entity_metadata: { location: event.location.slice(0, 100) },
    scheduled_start_time: event.start.toISOString(),
    scheduled_end_time: event.end.toISOString(),
    ...(event.image ? { image: `data:image/png;base64,${Buffer.from(event.image).toString("base64")}` } : {}),
  });
}

/** Creates a one-time external event; returns its id. */
export async function createEvent(token: string, guildId: string, event: ExternalEvent): Promise<string> {
  const response = await call(token, `/guilds/${guildId}/scheduled-events`, {
    method: "POST",
    body: eventBody(event),
  });
  const created = (await response.json()) as { id?: string };
  if (!created.id || !SNOWFLAKE.test(String(created.id))) throw new DiscordBotError("failed");
  return String(created.id);
}

async function eventCall(token: string, guildId: string, eventId: string, init: RequestInit) {
  if (!SNOWFLAKE.test(eventId)) throw new DiscordBotError("eventGone");
  try {
    return await call(token, `/guilds/${guildId}/scheduled-events/${eventId}`, init);
  } catch (error) {
    if (error instanceof DiscordBotError && error.status === 404) throw new DiscordBotError("eventGone", 404);
    throw error;
  }
}

/** Replaces name, times, description and cover. eventGone if deleted in Discord. */
export async function updateEvent(token: string, guildId: string, eventId: string, event: ExternalEvent) {
  await eventCall(token, guildId, eventId, { method: "PATCH", body: eventBody(event) });
}

/** Marks the event cancelled (final: Discord can't reopen it). */
export async function cancelEvent(token: string, guildId: string, eventId: string) {
  await eventCall(token, guildId, eventId, { method: "PATCH", body: JSON.stringify({ status: 4 }) });
}

export async function deleteEvent(token: string, guildId: string, eventId: string) {
  try {
    await eventCall(token, guildId, eventId, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof DiscordBotError && error.code === "eventGone")) throw error;
  }
}
