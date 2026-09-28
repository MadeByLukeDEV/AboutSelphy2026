import "server-only";
import { env, siteUrl } from "@/lib/env";

// Server-side Turnstile check (Cloudflare's canonical siteverify). Tokens are
// single-use; the widget is reset after every attempt. Requires success, the
// expected action and one of our own hostnames.

export const TURNSTILE_ACTION = "inquiry";

export function isTurnstileConfigured() {
  const { TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY } = env();
  return Boolean(TURNSTILE_SITE_KEY && TURNSTILE_SECRET_KEY);
}

function expectedHostnames() {
  const configured = (env().TURNSTILE_HOSTNAMES ?? "")
    .split(",")
    .map((hostname) => hostname.trim())
    .filter(Boolean);
  return new Set(configured.length ? configured : [new URL(siteUrl()).hostname]);
}

export async function verifyTurnstile(token: unknown, remoteIp: string | null) {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret || typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return false;
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error(`siteverify ${response.status}`);
    const result = (await response.json()) as {
      success: boolean;
      action?: string;
      hostname?: string;
      "error-codes"?: string[];
    };
    const ok =
      result.success === true &&
      result.action === TURNSTILE_ACTION &&
      typeof result.hostname === "string" &&
      expectedHostnames().has(result.hostname);
    if (!ok) {
      // Codes and hostname only -- never the token or the secret.
      console.warn("[turnstile] rejected", {
        success: result.success,
        action: result.action,
        hostname: result.hostname,
        errors: result["error-codes"],
      });
    }
    return ok;
  } catch (error) {
    console.error("[turnstile] siteverify failed", error);
    return false;
  }
}
