import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { Pool } from "pg";
import { env } from "@/lib/env";
import { errorInfo } from "@/lib/log";
import type { StaffRole } from "./roles";

// Sessions are issued by the central auth service (auth.aboutselphy.com --
// Discord login gated by Discord server roles) and validated here by reading
// its tables straight from the shared Postgres instance, as the read-only
// aboutselphy_auth_reader role. Adapted from ../Auth/consumer/
// validate-session.ts (via the Social app's copy) -- keep them in sync.
// Differences: env comes from env() (validated), not process.env.

export type StaffSession = {
  sessionId: string;
  expiresAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: StaffRole;
  };
};

declare global {
  var _authSessionPool: Pool | undefined;
}

// Constructed lazily, on first real use -- same reason as src/lib/prisma.ts
// (no env available during `next build`).
function pool() {
  const { AUTH_DATABASE_URL, AUTH_DATABASE_SCHEMA } = env();
  globalThis._authSessionPool ??= new Pool({
    connectionString: AUTH_DATABASE_URL,
    max: 3,
    // Schema is validated as a plain identifier in env.ts.
    options: `-c search_path=${AUTH_DATABASE_SCHEMA}`,
  });
  return globalThis._authSessionPool;
}

function sessionCookieNames() {
  const prefix = env().AUTH_COOKIE_PREFIX;
  // __Secure- in production (HTTPS), plain on http://localhost.
  return [`__Secure-${prefix}.session_token`, `${prefix}.session_token`];
}

/** Extracts the raw session token from BetterAuth's signed cookie ("<token>.<base64 HMAC-SHA256>"). */
function verifySignedToken(raw: string | undefined): string | null {
  if (!raw) return null;
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const token = value.slice(0, dot);
  const signature = Buffer.from(value.slice(dot + 1), "base64");
  const expected = createHmac("sha256", env().BETTER_AUTH_SECRET)
    .update(token)
    .digest();
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(signature, expected)
  ) {
    return null;
  }
  return token;
}

async function lookupSession(token: string): Promise<StaffSession | null> {
  // The *session's* role: the auth service only grants staff roles to Discord
  // sign-ins, so a Twitch/YouTube session of a mod is still just a viewer
  // here. Sessions from before per-session roles existed (all Discord
  // sign-ins) fall back to the user's Discord-derived role.
  const { rows } = await pool().query(
    `select s.id as "sessionId", s."expiresAt", u.id, u.name, u.email, u.image,
            coalesce(s.role, u.role) as role
       from "session" s
       join "user" u on u.id = s."userId"
      where s.token = $1
        and s."expiresAt" > now()
        and not (coalesce(u.banned, false) and (u."banExpires" is null or u."banExpires" > now()))`,
    [token],
  );
  const row = rows[0];
  if (!row || (row.role !== "admin" && row.role !== "moderator")) return null;

  return {
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      image: row.image,
      role: row.role,
    },
  };
}

type CookieJar = { get(name: string): { value: string } | undefined };

/**
 * The staff session for a cookie jar (a request's cookies in the proxy, or
 * next/headers' cookies() by default), or null if signed out / expired /
 * banned / not staff. Fails closed: an unreachable auth DB is logged and
 * treated as signed out.
 */
export async function getStaffSession(
  jar?: CookieJar,
): Promise<StaffSession | null> {
  const store = jar ?? (await cookies());
  const raw = sessionCookieNames()
    .map((name) => store.get(name)?.value)
    .find(Boolean);
  const token = verifySignedToken(raw);
  if (!token) return null;

  try {
    return await lookupSession(token);
  } catch (error) {
    // Name and code only: a whole pg error can carry query details and
    // connection info.
    console.error("[auth] session lookup against the auth database failed", errorInfo(error));
    return null;
  }
}

function authUrl(path: string, returnTo?: string) {
  const url = new URL(path, env().AUTH_URL);
  if (returnTo) url.searchParams.set("redirect", returnTo);
  return url.toString();
}

/**
 * Central login page; sends the user back to `returnTo` afterwards (the auth
 * service only honors origins in its TRUSTED_ORIGINS). Build `returnTo` from
 * siteUrl(), never request.url -- behind Traefik that's the container's
 * internal address.
 */
export function loginUrl(returnTo?: string) {
  return authUrl("/login", returnTo);
}

/**
 * Central sign-out endpoint. POST a form here with a `redirect` field: it ends
 * the session on every aboutselphy admin surface at once and 303s back.
 */
export function signOutEndpoint() {
  return authUrl("/api/sign-out");
}
