"use client";

import { useId, useState } from "react";

// One metric over time as a thin line with a light area underneath (single
// series, so no legend: the heading names it). Hover or arrow keys move a
// crosshair with a tooltip; the same numbers are in the table below the
// chart. Labels come in as props, so no client message namespace is needed.

const W = 600;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 8, left: 8 };

export function GrowthChart({
  points,
  locale,
  label,
  tableLabel,
  dateLabel,
}: {
  /** Oldest first; `day` is "YYYY-MM-DD". */
  points: Array<{ day: string; value: number }>;
  locale: string;
  /** What the value is ("Twitch followers"), for the tooltip and table. */
  label: string;
  tableLabel: string;
  dateLabel: string;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Pad a flat line so it sits mid-chart instead of on the floor.
  const span = max - min || Math.max(1, max * 0.05);
  const low = max === min ? min - span / 2 : min - span * 0.1;
  const high = max === min ? max + span / 2 : max + span * 0.1;

  const x = (i: number) =>
    PAD.left + (points.length === 1 ? 0.5 : i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - low) / (high - low)) * (H - PAD.top - PAD.bottom);

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = `${line}L${x(points.length - 1).toFixed(1)},${H - PAD.bottom}L${x(0).toFixed(1)},${H - PAD.bottom}Z`;

  const number = new Intl.NumberFormat(locale);
  const date = (day: string, style: "short" | "long" = "short") =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: style === "long" ? "long" : "short",
      year: style === "long" ? "numeric" : undefined,
      timeZone: "UTC",
    }).format(new Date(`${day}T00:00:00Z`));

  function pick(clientX: number, rect: DOMRect) {
    const ratio = (clientX - rect.left) / rect.width;
    const svgX = ratio * W;
    const step = (W - PAD.left - PAD.right) / Math.max(1, points.length - 1);
    const index = Math.round((svgX - PAD.left) / step);
    setActive(Math.min(points.length - 1, Math.max(0, index)));
  }

  const current = active === null ? null : points[active];

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-pan-y overflow-visible rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          role="img"
          aria-label={`${label}: ${number.format(values[0])} → ${number.format(values[values.length - 1])}`}
          tabIndex={0}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const next = (active ?? points.length) + (e.key === "ArrowLeft" ? -1 : 1);
              setActive(Math.min(points.length - 1, Math.max(0, next)));
            }
          }}
        >
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Baseline only: one recessive rule, no grid. */}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={H - PAD.bottom}
            y2={H - PAD.bottom}
            stroke="var(--border)"
            strokeWidth="1"
          />
          <path d={area} fill={`url(#${id}-fill)`} />
          <path
            d={line}
            fill="none"
            stroke="var(--chart-line)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* Latest point, direct-labelled by the headline number above. */}
          <circle
            cx={x(points.length - 1)}
            cy={y(values[values.length - 1])}
            r="4"
            fill="var(--chart-line)"
            stroke="var(--background)"
            strokeWidth="2"
          />
          {current && active !== null && (
            <g aria-hidden>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--muted-foreground)"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={x(active)}
                cy={y(current.value)}
                r="5"
                fill="var(--chart-line)"
                stroke="var(--background)"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
        {current && active !== null && (
          <div
            className="pointer-events-none absolute top-0 rounded-md border bg-popover px-2.5 py-1.5 text-sm shadow-md"
            style={{
              left: `${(x(active) / W) * 100}%`,
              transform: `translateX(${active > points.length / 2 ? "-105%" : "5%"})`,
            }}
          >
            <p className="text-muted-foreground">{date(current.day, "long")}</p>
            <p className="font-semibold">
              {number.format(current.value)} <span className="font-normal text-muted-foreground">{label}</span>
            </p>
          </div>
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
        <span>{date(points[0].day)}</span>
        <span>{date(points[points.length - 1].day)}</span>
      </div>
      <details className="text-sm">
        <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">{tableLabel}</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="py-1 font-medium">{dateLabel}</th>
              <th scope="col" className="py-1 text-right font-medium">{label}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {points.map((p) => (
              <tr key={p.day} className="border-b last:border-0">
                <td className="py-1">{date(p.day, "long")}</td>
                <td className="py-1 text-right">{number.format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
