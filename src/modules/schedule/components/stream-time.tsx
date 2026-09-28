"use client";

import { useBrowserZone } from "@/components/time/browser-clock";

// A stream's start–end in the visitor's own time zone, with the zone's short
// name ("CEST", "EDT", "GMT+9"). The server (and crawlers, and the first
// client render) use Vienna time, then the browser switches to its own zone.

export function StreamTime({
  start,
  end,
  locale,
  className,
}: {
  /** ISO timestamps. */
  start: string;
  end: string;
  locale: string;
  className?: string;
}) {
  const timeZone = useBrowserZone();
  const time = (iso: string, zoneName?: "short") =>
    new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
      timeZoneName: zoneName,
    }).format(new Date(iso));

  return (
    <span className={className}>
      <time dateTime={start}>{time(start)}</time>
      {"–"}
      <time dateTime={end}>{time(end, "short")}</time>
    </span>
  );
}
