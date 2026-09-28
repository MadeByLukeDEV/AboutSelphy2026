import "server-only";
import Redis from "ioredis";
import { env } from "@/lib/env";

// Shared Redis (the AboutSelphy instance). Lazy like src/lib/prisma.ts (no
// env during `next build`). Settings from the Social app: no ready check
// (the ACL user may lack INFO), few retries so a dead Redis degrades fast.
// Every caller must fail soft -- Redis is never required for a request.
// Keys are prefixed "aboutselphy:main:" to stay apart from the other apps.

declare global {
  var _redis: Redis | null | undefined;
}

export const REDIS_PREFIX = "aboutselphy:main:";

/** The client, or null when REDIS_URL isn't configured. */
export function redis(): Redis | null {
  if (globalThis._redis === undefined) {
    const url = env().REDIS_URL;
    globalThis._redis = url
      ? new Redis(url, {
          enableReadyCheck: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
          retryStrategy: (times) => Math.min(times * 500, 10_000),
          lazyConnect: false,
        })
      : null;
    globalThis._redis?.on("error", (error) => {
      console.error("[redis] connection error:", error.message);
    });
  }
  return globalThis._redis;
}
