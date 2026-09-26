// Content-Security-Policy, built per request with a fresh nonce (see
// src/proxy.ts). Decision (2026-09-26): strict nonce CSP on every page,
// public ones included -- pages render per request, data stays cached.
//
// Add an origin here only together with the feature that needs it, and
// say which one (e.g. Twitch/YouTube embeds → frame-src, their thumbnail
// CDNs → img-src, Cloudflare Turnstile → script-src/frame-src).

const isDev = process.env.NODE_ENV === "development";

export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function buildCsp(nonce: string): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic': scripts loaded by a nonce'd script are trusted too
    // (Next's chunk loading); host allowlists are ignored by CSP3 browsers.
    // Dev needs 'unsafe-eval' for React's debugging/HMR.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Inline styles stay allowed: React/Motion render `style` attributes and
    // sonner injects a <style> tag. A nonce here would make browsers ignore
    // 'unsafe-inline' and break both. Style injection is low-risk compared
    // to script injection, which the nonce blocks.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    // next/font self-hosts fonts.
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
  };

  const policy = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.join(" ")}`,
  );
  if (!isDev) {
    policy.push("upgrade-insecure-requests");
  }
  return policy.join("; ");
}
