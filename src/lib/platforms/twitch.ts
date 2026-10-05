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

export type TwitchMedia = {
  externalId: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: Date;
  durationSeconds: number;
  views: number;
};

/**
 * Only https links on Twitch's own domains end up in an href. Twitch builds
 * these URLs itself; this is defense in depth against anything unexpected.
 */
function isTwitchUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "twitch.tv" || url.hostname.endsWith(".twitch.tv"))
    );
  } catch {
    return false;
  }
}

/** "5h8m28s" -> seconds. */
function parseTwitchDuration(value: string) {
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!match) return 0;
  const [, h = "0", m = "0", s = "0"] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** Latest past broadcasts (VODs). VODs still processing have no thumbnail and are skipped. */
export async function getRecentVods(count: number): Promise<TwitchMedia[]> {
  const body = await helix<{
    data: Array<{
      id: string;
      title: string;
      url: string;
      thumbnail_url: string;
      created_at: string;
      duration: string;
      view_count: number;
    }>;
  }>(`videos?user_id=${await broadcasterId()}&type=archive&first=${count}`);
  return body.data
    .filter(
      (v) =>
        isTwitchUrl(v.url) &&
        v.thumbnail_url &&
        !v.thumbnail_url.includes("404_processing"),
    )
    .map((v) => ({
      externalId: v.id,
      title: v.title.slice(0, 200) || "Twitch broadcast",
      url: v.url,
      thumbnailUrl: v.thumbnail_url
        .replace("%{width}", "640")
        .replace("%{height}", "360"),
      publishedAt: new Date(v.created_at),
      durationSeconds: parseTwitchDuration(v.duration),
      views: v.view_count,
    }));
}

/** Most-viewed clips of all time (Helix returns clips sorted by views). */
export async function getTopClips(count: number): Promise<TwitchMedia[]> {
  const body = await helix<{
    data: Array<{
      id: string;
      title: string;
      url: string;
      thumbnail_url: string;
      created_at: string;
      duration: number;
      view_count: number;
    }>;
  }>(`clips?broadcaster_id=${await broadcasterId()}&first=${count}`);
  return body.data.filter((c) => isTwitchUrl(c.url)).map((c) => ({
    externalId: c.id,
    title: c.title.slice(0, 200) || "Twitch clip",
    url: c.url,
    thumbnailUrl: c.thumbnail_url,
    publishedAt: new Date(c.created_at),
    durationSeconds: Math.round(c.duration),
    views: c.view_count,
  }));
}

export type TwitchGame = { id: string; name: string; boxArtUrl: string };

/**
 * A Twitch category by its exact name (case-insensitive on Twitch's side),
 * with its box art sized 285x380 (Twitch's standard 3:4 cover). null when
 * no category has that name.
 */
export async function findTwitchGame(name: string): Promise<TwitchGame | null> {
  const body = await helix<{
    data: Array<{ id: string; name: string; box_art_url: string }>;
  }>(`games?name=${encodeURIComponent(name)}`);
  const game = body.data[0];
  // Only Twitch's own CDN (also the only host images.remotePatterns allows).
  if (!game?.box_art_url?.startsWith("https://static-cdn.jtvnw.net/")) return null;
  return {
    id: game.id,
    name: game.name,
    boxArtUrl: game.box_art_url.replace("{width}", "285").replace("{height}", "380"),
  };
}

/**
 * Twitch categories matching a search (Helix search/categories), best
 * matches first, for picking a schedule game without adding it to the
 * Games section. Search results carry a fixed 52x72 cover; it's rewritten
 * to the same 285x380 as findTwitchGame. Only covers on Twitch's own CDN.
 */
/** 285x380 box art on Twitch's CDN box-art path, or "" for anything else. */
function sizedBoxArt(url: string | undefined) {
  const sized = (url ?? "").replace(/-\d+x\d+(\.\w+)$/, "-285x380$1");
  return /^https:\/\/static-cdn\.jtvnw\.net\/ttv-boxart\/[A-Za-z0-9_.%-]+$/.test(sized) ? sized : "";
}

export async function searchTwitchCategories(query: string, limit = 8): Promise<TwitchGame[]> {
  const body = await helix<{
    data: Array<{ id: string; name: string; box_art_url: string }>;
  }>(`search/categories?query=${encodeURIComponent(query)}&first=${limit}`);
  return body.data
    .filter((c) => /^\d{1,20}$/.test(c.id) && c.name)
    .map((c) => ({
      id: c.id,
      name: c.name.slice(0, 120),
      boxArtUrl: sizedBoxArt(c.box_art_url),
    }));
}
