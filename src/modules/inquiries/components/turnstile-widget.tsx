"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Cloudflare Turnstile, rendered explicitly so it can be reset: tokens are
// single-use, so every submit attempt (success or not) needs a fresh one.
// The script is inserted by this (nonced) bundle, which the CSP's
// 'strict-dynamic' allows; the challenge iframe needs frame-src
// challenges.cloudflare.com (src/lib/security/csp.ts).

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "auto" | "light" | "dark";
      language: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(nonce: string | undefined) {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    // Cloudflare's recommended CSP setup: the page nonce on api.js, which
    // Turnstile propagates to everything it loads itself.
    if (nonce) script.nonce = nonce;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type TurnstileHandle = { reset: () => void };

export const TurnstileWidget = forwardRef<
  TurnstileHandle,
  {
    siteKey: string;
    action: string;
    /** CSP nonce of this request (x-nonce), for the api.js script tag. */
    nonce?: string;
    language: string;
    onToken: (token: string | null) => void;
    onLoadError: () => void;
    /** The challenge itself failed (e.g. flagged as automated). */
    onChallengeError: () => void;
  }
>(function TurnstileWidget({ siteKey, action, nonce, language, onToken, onLoadError, onChallengeError }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // Keep the latest callbacks without re-rendering the widget.
  const callbacks = useRef({ onToken, onLoadError, onChallengeError });
  useEffect(() => {
    callbacks.current = { onToken, onLoadError, onChallengeError };
  });

  useImperativeHandle(ref, () => ({
    reset() {
      callbacks.current.onToken(null);
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    const render = () =>
      loadScript(nonce)
        .then(() => {
          if (cancelled || !container.current || !window.turnstile) return;
          widgetId.current = window.turnstile.render(container.current, {
            sitekey: siteKey,
            action,
            theme: "auto",
            language,
            callback: (token) => callbacks.current.onToken(token),
            "expired-callback": () => callbacks.current.onToken(null),
            "error-callback": () => {
              callbacks.current.onToken(null);
              callbacks.current.onChallengeError();
            },
          });
        })
        .catch(() => {
          if (!cancelled) callbacks.current.onLoadError();
        });

    // Load Turnstile (~1 MB with its challenge frame) only once the form is
    // about a screen away: most visitors read the media kit and never reach
    // the form (Lighthouse, 2026-09-29).
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        render();
      },
      { rootMargin: "100% 0px" },
    );
    if (container.current) observer.observe(container.current);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, action, language, nonce]);

  return <div ref={container} className="min-h-[4.125rem]" />;
});
