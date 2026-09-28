"use client";

import { useSyncExternalStore } from "react";

// Shared client-side clock for schedule times. Both hooks return a fixed
// server value on the server and during hydration (so the HTML matches),
// then switch to the browser's real value.

/** Every schedule time is planned in this zone (the server's view). */
export const HOME_ZONE = "Europe/Vienna";

const noop = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || HOME_ZONE;

/** The visitor's IANA time zone; HOME_ZONE on the server and first render. */
export function useBrowserZone() {
  return useSyncExternalStore(noop, browserZone, () => HOME_ZONE);
}

// One shared one-second ticker for every countdown on the page.
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function snapshot() {
  // Stable between ticks (useSyncExternalStore requires that).
  if (!now) now = Date.now();
  return now;
}

/** Current time in ms, ticking every second; null on the server. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
