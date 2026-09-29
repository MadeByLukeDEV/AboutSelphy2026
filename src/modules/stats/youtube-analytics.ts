import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { env, siteUrl } from "@/lib/env";
import { errorInfo } from "@/lib/log";
import { PlatformError } from "@/lib/platforms/errors";
import {
  ANALYTICS_SCOPE,
  analyticsPeriod,
  buildAuthorizationUrl,
  exchangeCode,
  getDemographics,
  isYoutubeAnalyticsConfigured,
  refreshAccessToken,
  revokeToken,
  verifyChannelAccess,
} from "@/lib/platforms/youtube-analytics";
import { decryptToken, encryptToken } from "@/lib/security/token-cipher";
import { STATS_CACHE_TAG } from "./cache";
import * as repo from "./repository";

// The owner's YouTube Analytics connection: the one-time OAuth connect
// (GET /api/youtube/connect -> Google -> GET /api/youtube/callback), the
// daily demographics sync step, and the admin status. Route handlers and
// actions check requireAdmin() themselves before calling in here.

/** Days of data behind the demographics (the user's choice, like the growth charts). */
export const DEMOGRAPHICS_DAYS = 90;

/** AAD for the encrypted refresh token (see token-cipher.ts). */
const TOKEN_PURPOSE = "youtube-analytics-refresh-token";

export const OAUTH_COOKIE = "yt_oauth";
export const OAUTH_COOKIE_PATH = "/api/youtube";
export const OAUTH_COOKIE_MAX_AGE = 600;

export function redirectUri() {
  return `${siteUrl()}/api/youtube/callback`;
}

/**
 * Starts the connect flow: the Google URL to send the admin to, and the
 * cookie value (state + PKCE verifier) the callback checks.
 */
export function startConnect() {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return {
    url: buildAuthorizationUrl({ redirectUri: redirectUri(), state, codeChallenge: challenge }),
    cookie: `${state}.${verifier}`,
  };
}

export type ConnectOutcome =
  | "connected"
  | "cancelled"
  | "invalidState"
  | "missingScope"
  | "noRefreshToken"
  | "notOwner"
  | "failed";

function sameString(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Finishes the connect flow. Never throws; the outcome is shown in /admin/stats. */
export async function completeConnect(input: {
  params: URLSearchParams;
  cookie: string | undefined;
  connectedBy: string;
}): Promise<ConnectOutcome> {
  const [expectedState, verifier] = input.cookie?.split(".") ?? [];
  const state = input.params.get("state");
  if (!expectedState || !verifier || !state || !sameString(state, expectedState)) {
    return "invalidState";
  }
  if (input.params.get("error")) return "cancelled";
  const code = input.params.get("code");
  if (!code || code.length > 2048) return "invalidState";

  try {
    const token = await exchangeCode({ code, codeVerifier: verifier, redirectUri: redirectUri() });
    if (!token.scope?.split(" ").includes(ANALYTICS_SCOPE)) {
      await revokeToken(token.access_token);
      return "missingScope";
    }
    if (!token.refresh_token) return "noRefreshToken";
    try {
      await verifyChannelAccess(token.access_token);
    } catch (error) {
      // The account can't read this channel's analytics: don't keep its token.
      await revokeToken(token.refresh_token);
      console.warn("[youtube-analytics] connect: channel check failed", errorInfo(error));
      return "notOwner";
    }

    await repo.saveYoutubeConnection({
      channelId: env().YOUTUBE_CHANNEL_ID,
      encryptedRefreshToken: encryptToken(token.refresh_token, TOKEN_PURPOSE),
      connectedBy: input.connectedBy.slice(0, 100),
    });
    console.info("[youtube-analytics] connected by", input.connectedBy);

    // Fill the admin preview right away; the daily sync keeps it fresh.
    try {
      await syncDemographics(token.access_token);
    } catch (error) {
      console.warn("[youtube-analytics] first sync failed", errorInfo(error));
    }
    revalidateTag(STATS_CACHE_TAG, { expire: 0 });
    return "connected";
  } catch (error) {
    console.error("[youtube-analytics] connect failed", errorInfo(error, { message: true }));
    return "failed";
  }
}

async function accessToken() {
  const connection = await repo.findYoutubeConnection();
  if (!connection) return null;
  if (connection.channelId !== env().YOUTUBE_CHANNEL_ID) {
    throw new PlatformError("youtube", "analytics connected to a different channel (connect again)");
  }
  let refreshToken: string;
  try {
    refreshToken = decryptToken(connection.encryptedRefreshToken, TOKEN_PURPOSE);
  } catch {
    throw new PlatformError("youtube", "stored analytics token unreadable (key changed? connect again)");
  }
  return refreshAccessToken(refreshToken);
}

/**
 * Fetches and stores one demographics set. Returns the number of rows
 * stored (0 = YouTube had no data for the period).
 */
export async function syncDemographics(token?: string): Promise<number> {
  const access = token ?? (await accessToken());
  if (!access) return 0;
  const period = analyticsPeriod(DEMOGRAPHICS_DAYS);
  const data = await getDemographics(access, period);
  const rows = (["age", "gender", "country", "device"] as const).flatMap((dimension) =>
    data[dimension].map((s) => ({
      dimension,
      key: s.key.slice(0, 40),
      // Rounding can push a sum a hair over 100; the DB CHECK caps each share.
      share: Math.min(100, Math.max(0, s.share)),
    })),
  );
  if (rows.length > 0) await repo.insertAudienceSet(rows, period, new Date());
  return rows.length;
}

/** For the sync job: skipped unless configured and connected. */
export async function isYoutubeAnalyticsConnected() {
  return isYoutubeAnalyticsConfigured() && Boolean(await repo.findYoutubeConnection());
}

/** Revokes the grant at Google (best effort) and forgets the token. */
export async function disconnect() {
  const connection = await repo.findYoutubeConnection();
  if (!connection) return;
  try {
    await revokeToken(decryptToken(connection.encryptedRefreshToken, TOKEN_PURPOSE));
  } catch {
    // Unreadable token: nothing to revoke from here; deleting it is enough.
  }
  await repo.deleteYoutubeConnection();
  revalidateTag(STATS_CACHE_TAG, { expire: 0 });
}

export async function setShowDemographics(show: boolean) {
  await repo.setShowInMediaKit(show);
  revalidateTag(STATS_CACHE_TAG, { expire: 0 });
}

/** Uncached, for /admin/stats. */
export async function getYoutubeAnalyticsStatus() {
  const connection = await repo.findYoutubeConnection();
  return {
    configured: isYoutubeAnalyticsConfigured(),
    connection: connection
      ? {
          connectedBy: connection.connectedBy,
          connectedAt: connection.connectedAt,
          showInMediaKit: connection.showInMediaKit,
          channelMatches: connection.channelId === env().YOUTUBE_CHANNEL_ID,
        }
      : null,
  };
}
