import "server-only";
import { env } from "@/lib/env";
import { PlatformError } from "./errors";

// Twitch Helix with an app access token (client credentials). Enough for
// everything the stats need: follower total, live stream, user lookup.
// Errors never include the token or the client secret.

const TIMEOUT_MS = 10_000;

type AppToken = { value: string; expiresAt: number };

declare global {
  var _twitchToken: AppToken | undefined;
  var _twitchBroadcasterId: string | undefined;
}

export function isTwitchConfigured() {
  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = env();
  return Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET);
}

async function fetchAppToken(): Promise<AppToken> {
  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = env();
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID!,
      client_secret: TWITCH_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new PlatformError("twitch", `token request failed (${res.status})`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  // Renew a minute early.
  return { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
}

async function token(forceRefresh = false) {
  const cached = globalThis._twitchToken;
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.value;
  globalThis._twitchToken = await fetchAppToken();
  return globalThis._twitchToken.value;
}

async function helix<T>(path: string, retried = false): Promise<T> {
  const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
    headers: {
      "Client-Id": env().TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${await token(retried)}`,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  // An expired/revoked token: fetch a new one once.
  if (res.status === 401 && !retried) return helix<T>(path, true);
  if (!res.ok) {
    throw new PlatformError("twitch", `${path.split("?")[0]} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

async function broadcasterId(): Promise<string> {
  if (globalThis._twitchBroadcasterId) return globalThis._twitchBroadcasterId;
  const login = env().TWITCH_BROADCASTER_LOGIN;
  const body = await helix<{ data: Array<{ id: string }> }>(
    `users?login=${encodeURIComponent(login)}`,
  );
  const id = body.data[0]?.id;
  if (!id) throw new PlatformError("twitch", `user "${login}" not found`);
  globalThis._twitchBroadcasterId = id;
  return id;
}

export async function getFollowerTotal(): Promise<number> {
  const body = await helix<{ total: number }>(
    `channels/followers?broadcaster_id=${await broadcasterId()}&first=1`,
  );
  return body.total;
}

export type LiveStream = {
  id: string;
  startedAt: Date;
  title: string;
  gameName: string;
  viewerCount: number;
};

/** The current broadcast, or null when offline. */
export async function getLiveStream(): Promise<LiveStream | null> {
  const body = await helix<{
    data: Array<{
      id: string;
      type: string;
      started_at: string;
      title: string;
      game_name: string;
      viewer_count: number;
    }>;
  }>(`streams?user_id=${await broadcasterId()}&type=live`);
  const stream = body.data[0];
  if (!stream) return null;
  return {
    id: stream.id,
    startedAt: new Date(stream.started_at),
    title: stream.title.slice(0, 200),
    gameName: stream.game_name.slice(0, 120),
    viewerCount: stream.viewer_count,
  };
}
