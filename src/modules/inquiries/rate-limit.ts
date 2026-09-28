import "server-only";
import { createHash } from "node:crypto";
import { REDIS_PREFIX, redis } from "@/lib/redis";

// Per-IP limit for the inquiry form: 5 per hour. The IP is only used hashed
// as a short-lived Redis key (never stored with the inquiry). Fails open:
// without Redis, or if Redis errors, the request is allowed -- Turnstile is
// still in front of it.

const LIMIT = 5;
const WINDOW_SECONDS = 60 * 60;

/** Visitor IP behind Cloudflare + Traefik: CF-Connecting-IP first. */
export function clientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip");
}

export async function allowInquiry(ip: string | null): Promise<boolean> {
  const client = redis();
  if (!client || !ip) return true;
  const hash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const key = `${REDIS_PREFIX}rl:inquiry:${hash}`;
  try {
    const count = await client.incr(key);
    // Set the window on the first attempt, and again once over the limit:
    // if that first EXPIRE ever failed (e.g. a transient NOPERM), the key
    // would otherwise never expire and block the IP for good. Only
    // INCR/EXPIRE, which the ACL user is known to have.
    if (count === 1 || count > LIMIT) await client.expire(key, WINDOW_SECONDS);
    return count <= LIMIT;
  } catch (error) {
    console.error("[inquiries] rate limit check failed (allowing)", error instanceof Error ? error.name : typeof error);
    return true;
  }
}
