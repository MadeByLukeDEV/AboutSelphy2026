"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

// Loads CustomCursor (and with it Motion) only on devices with a fine
// pointer. Phones and tablets never download that code: Motion was ~130 KB
// of JavaScript on every page, mostly for a cursor touch devices can't use
// (Lighthouse, 2026-09-29).
const CustomCursor = dynamic(() => import("./custom-cursor").then((m) => m.CustomCursor), {
  ssr: false,
});

const noop = () => () => {};

export function CustomCursorLoader() {
  const fine = useSyncExternalStore(
    noop,
    () => window.matchMedia("(pointer: fine)").matches,
    () => false,
  );
  return fine ? <CustomCursor /> : null;
}
