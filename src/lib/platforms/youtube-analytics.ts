import "server-only";
import { env } from "@/lib/env";
import { isTokenCipherConfigured } from "@/lib/security/token-cipher";
import { PlatformError } from "./errors";

// Google OAuth (authorization code + PKCE, offline access) and the YouTube
// Analytics API v2 for the channel owner's audience demographics. The only
// scope is yt-analytics.readonly. Errors never include a token or the
// client secret.

const TIMEOUT_MS = 10_000;
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const REPORTS_ENDPOINT = "https://youtubeanalytics.googleapis.com/v2/reports";

export const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/yt-analytics.readonly";

/** Client id/secret plus the key that encrypts the stored refresh token. */
export function isYoutubeAnalyticsConfigured() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env();
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && isTokenCipherConfigured());
}

function client() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new PlatformError("youtube", "analytics not configured");
  }
  return { id: GOOGLE_CLIENT_ID, secret: GOOGLE_CLIENT_SECRET };
}

export function buildAuthorizationUrl(input: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
}) {
  const url = new URL(AUTH_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: client().id,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: ANALYTICS_SCOPE,
    // A refresh token, and a new one on every connect (Google only returns
    // it on the first consent otherwise).
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "false",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  expires_in: number;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { id, secret } = client();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, client_id: id, client_secret: secret }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    // Google's error code ("invalid_grant", ...) is safe to show; the body
    // never echoes the secret or the token.
    const body = (await res.json().catch(() => ({}))) as { error?: unknown };
    const code = typeof body.error === "string" ? body.error.slice(0, 40) : "unknown";
    throw new PlatformError(
      "youtube",
      code === "invalid_grant"
        ? "analytics authorization expired or revoked (connect again)"
        : `token request failed (${res.status} ${code})`,
    );
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }) {
  return tokenRequest({
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: input.codeVerifier,
    redirect_uri: input.redirectUri,
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  return token.access_token;
}

/** Best effort: Google revokes the whole grant. Never throws. */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

type Report = { columnHeaders?: Array<{ name: string }>; rows?: Array<Array<string | number>> };

// `ids=channel==<id>` rather than `channel==MINE`: the query then fails (403)
// unless the authorized account really owns YOUTUBE_CHANNEL_ID, which is how
// the connect flow proves ownership with this one scope.
async function report(
  accessToken: string,
  params: { metrics: string; dimensions?: string; sort?: string; startDate: string; endDate: string },
): Promise<Array<Array<string | number>>> {
  const url = new URL(REPORTS_ENDPOINT);
  url.search = new URLSearchParams({
    ids: `channel==${env().YOUTUBE_CHANNEL_ID}`,
    ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)),
  }).toString();
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new PlatformError(
      "youtube",
      res.status === 403
        ? "analytics access denied (is the connected account the channel owner?)"
        : `analytics report failed (${res.status})`,
    );
  }
  return ((await res.json()) as Report).rows ?? [];
}

/** YYYY-MM-DD in UTC. */
function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * The reporting window: `days` days ending three days ago (YouTube
 * Analytics data arrives with a delay of up to a few days).
 */
export function analyticsPeriod(days: number, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));
  return { start, end, startDate: isoDate(start), endDate: isoDate(end) };
}

/** Proves the token can read this channel's analytics. Throws otherwise. */
export async function verifyChannelAccess(accessToken: string) {
  const { startDate, endDate } = analyticsPeriod(7);
  await report(accessToken, { metrics: "views", startDate, endDate });
}

export type Share = { key: string; share: number };

export type Demographics = {
  age: Share[];
  gender: Share[];
  country: Share[];
  device: Share[];
};

/** Countries shown by name; the rest fold into "other". */
const TOP_COUNTRIES = 8;

function toShares(rows: Array<[string, number]>): Share[] {
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return [];
  return rows
    .map(([key, value]) => ({ key, share: (value / total) * 100 }))
    .sort((a, b) => b.share - a.share);
}

/**
 * Audience shares (percent) over the period, 4 report calls. Age and gender
 * come from YouTube's viewerPercentage (signed-in viewers only); country and
 * device are shares of views. An empty list means YouTube returned no data,
 * e.g. below its privacy thresholds.
 */
export async function getDemographics(
  accessToken: string,
  period: { startDate: string; endDate: string },
): Promise<Demographics> {
  const [ageGender, countries, devices] = await Promise.all([
    report(accessToken, { metrics: "viewerPercentage", dimensions: "ageGroup,gender", ...period }),
    report(accessToken, { metrics: "views", dimensions: "country", sort: "-views", ...period }),
    report(accessToken, { metrics: "views", dimensions: "deviceType", ...period }),
  ]);

  const age = new Map<string, number>();
  const gender = new Map<string, number>();
  for (const [ageGroup, g, percent] of ageGender) {
    // "age25-34" -> "25-34"
    const a = String(ageGroup).replace(/^age/, "");
    age.set(a, (age.get(a) ?? 0) + Number(percent));
    gender.set(String(g), (gender.get(String(g)) ?? 0) + Number(percent));
  }

  const countryShares = toShares(countries.map(([c, v]) => [String(c), Number(v)]));
  const top = countryShares.slice(0, TOP_COUNTRIES);
  const rest = countryShares.slice(TOP_COUNTRIES).reduce((sum, s) => sum + s.share, 0);
  if (rest > 0) top.push({ key: "other", share: rest });

  return {
    // Age groups keep YouTube's order (youngest first), not by size.
    // ("13-17" < "18-24" < ... < "65-" as strings too).
    age: toShares([...age]).sort((a, b) => a.key.localeCompare(b.key)),
    gender: toShares([...gender]),
    country: top,
    device: toShares(devices.map(([d, v]) => [String(d), Number(v)])),
  };
}
