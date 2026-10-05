import "server-only";
import { env } from "@/lib/env";

// Twitch with the broadcaster's own login (user access token), for writing
// the channel schedule (scope channel:manage:schedule). The app token in
// twitch.ts can only read. Tokens never appear in errors or logs; failures
// are short codes plus the HTTP status.

const TIMEOUT_MS = 10_000;
export const SCHEDULE_SCOPE = "channel:manage:schedule";

export type TwitchUserErrorCode =
  | "notConfigured"
  | "invalidGrant"
  | "segmentGone"
  | "rateLimited"
  | "rejected"
  | "failed";

export class TwitchUserError extends Error {
  constructor(readonly code: TwitchUserErrorCode, readonly status?: number) {
    super(`twitch: ${code}${status ? ` (${status})` : ""}`);
    this.name = "TwitchUserError";
  }
}

function credentials() {
  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = env();
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) throw new TwitchUserError("notConfigured");
  return { clientId: TWITCH_CLIENT_ID, clientSecret: TWITCH_CLIENT_SECRET };
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new TwitchUserError("failed");
  }
}

// ─── OAuth ───────────────────────────────────────────────────────────────

export function buildAuthorizationUrl(input: { redirectUri: string; state: string }) {
  const params = new URLSearchParams({
    client_id: credentials().clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: SCHEDULE_SCOPE,
    state: input.state,
    // Always show the consent screen, so the right account can be picked.
    force_verify: "true",
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string[] };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = credentials();
  const response = await request("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  if (response.status === 400 || response.status === 401) throw new TwitchUserError("invalidGrant", response.status);
  if (!response.ok) throw new TwitchUserError("failed", response.status);
  return (await response.json()) as TokenResponse;
}

export function exchangeCode(code: string, redirectUri: string) {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri });
}

/** A fresh access token (Twitch may also hand back a new refresh token). */
export function refreshAccessToken(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/** Who the token belongs to, and its scopes. */
export async function validateToken(accessToken: string) {
  const response = await request("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!response.ok) throw new TwitchUserError("invalidGrant", response.status);
  const body = (await response.json()) as { user_id?: string; login?: string; scopes?: string[] };
  return { userId: String(body.user_id ?? ""), login: String(body.login ?? ""), scopes: body.scopes ?? [] };
}

/** Best effort: a revoked grant can't be used even if the DB leaks. */
export async function revokeToken(token: string) {
  try {
    await request("https://id.twitch.tv/oauth2/revoke", {
      method: "POST",
      body: new URLSearchParams({ client_id: credentials().clientId, token }),
    });
  } catch {
    // Revocation is a courtesy; the row is deleted either way.
  }
}

// ─── schedule ────────────────────────────────────────────────────────────

export type SegmentInput = {
  /** RFC 3339. */
  startTime: string;
  /** Minutes; Twitch accepts 30-1380. */
  duration: number;
  /** Twitch category id; empty for none. */
  categoryId: string;
  /** Up to 140 characters. */
  title: string;
};

async function helix(accessToken: string, path: string, init: RequestInit) {
  const response = await request(`https://api.twitch.tv/helix/${path}`, {
    ...init,
    headers: {
      "Client-Id": credentials().clientId,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (response.ok) return response;
  if (response.status === 404) throw new TwitchUserError("segmentGone", 404);
  if (response.status === 429) throw new TwitchUserError("rateLimited", 429);
  if (response.status === 401) throw new TwitchUserError("invalidGrant", 401);
  if (response.status === 400 || response.status === 403) throw new TwitchUserError("rejected", response.status);
  throw new TwitchUserError("failed", response.status);
}

function segmentBody(input: SegmentInput) {
  return {
    start_time: input.startTime,
    timezone: "Europe/Vienna",
    duration: String(Math.min(1380, Math.max(30, Math.round(input.duration)))),
    title: input.title.slice(0, 140),
    ...(input.categoryId ? { category_id: input.categoryId } : {}),
  };
}

/** Creates a one-off segment; returns its id. */
export async function createSegment(accessToken: string, broadcasterId: string, input: SegmentInput) {
  const response = await helix(accessToken, `schedule/segment?broadcaster_id=${encodeURIComponent(broadcasterId)}`, {
    method: "POST",
    body: JSON.stringify({ ...segmentBody(input), is_recurring: false }),
  });
  const body = (await response.json()) as { data?: { segments?: Array<{ id: string; start_time: string }> } };
  const segments = body.data?.segments ?? [];
  // The response lists the new segment; take only the one with our start
  // time. Never guess: a wrong id could later edit or delete a segment the
  // broadcaster made by hand.
  const start = Date.parse(input.startTime);
  const created = segments.find((s) => Date.parse(s.start_time) === start);
  if (!created?.id) throw new TwitchUserError("failed");
  return created.id;
}

export async function updateSegment(
  accessToken: string,
  broadcasterId: string,
  segmentId: string,
  input: SegmentInput & { cancelled: boolean },
) {
  const query = `broadcaster_id=${encodeURIComponent(broadcasterId)}&id=${encodeURIComponent(segmentId)}`;
  await helix(accessToken, `schedule/segment?${query}`, {
    method: "PATCH",
    body: JSON.stringify({ ...segmentBody(input), is_canceled: input.cancelled }),
  });
}

export async function deleteSegment(accessToken: string, broadcasterId: string, segmentId: string) {
  const query = `broadcaster_id=${encodeURIComponent(broadcasterId)}&id=${encodeURIComponent(segmentId)}`;
  try {
    await helix(accessToken, `schedule/segment?${query}`, { method: "DELETE" });
  } catch (error) {
    // Already gone: that's what we wanted.
    if (!(error instanceof TwitchUserError && error.code === "segmentGone")) throw error;
  }
}
