"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useBrowserZone, useNow } from "./browser-clock";

/** Date and time of a stream in the visitor's time zone, with the zone name. */
export function LocalDateTime({
  start,
  locale,
  long = false,
  className,
}: {
  /** ISO timestamp. */
  start: string;
  locale: string;
  /** Long weekday and month ("Tuesday, September 29") instead of short. */
  long?: boolean;
  className?: string;
}) {
  const timeZone = useBrowserZone();
  const text = new Intl.DateTimeFormat(locale, {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(start));
  return (
    <time dateTime={start} className={className}>
      {text}
    </time>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "in 2d 4h" further out, a ticking "in 03:12:45" within a day, "starting
 * soon" once the start has passed. Nothing on the server: the value depends
 * on the current second, so it only appears after hydration.
 */
export function Countdown({ start, className }: { start: string; className?: string }) {
  const t = useTranslations("Countdown");
  const now = useNow();
  if (now === null) return null;

  const seconds = Math.floor((new Date(start).getTime() - now) / 1000);
  let text: string;
  if (seconds <= 0) {
    text = t("soon");
  } else if (seconds >= 86_400) {
    text = t("in", {
      time: t("days", { d: Math.floor(seconds / 86_400), h: Math.floor((seconds % 86_400) / 3600) }),
    });
  } else {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    text = t("in", { time: `${pad(h)}:${pad(m)}:${pad(seconds % 60)}` });
  }

  return (
    <span className={cn("tabular-nums", className)} role="timer" aria-live="off">
      {text}
    </span>
  );
}
