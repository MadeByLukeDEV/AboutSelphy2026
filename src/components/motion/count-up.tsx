"use client";

import { useEffect, useRef } from "react";

// A number that counts up from 0 when it scrolls into view. SEO-safe: the
// server renders the final formatted value, so the HTML, crawlers, link
// previews and screen readers always get the real number; only the
// visible digits animate.
//
// No flash of the final value before hydration: CSS hides [data-count]
// while scripting is on until the count starts, with a fallback that shows
// it after 2.5 s anyway (globals.css, "motion"). The width is locked to
// the final value's first, so surrounding text never shifts.

const DURATION_MS = 1400;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

export function CountUp({
  value,
  text,
  locale,
  options,
  className,
}: {
  value: number;
  /** The final value, formatted on the server (what's rendered first). */
  text: string;
  locale: string;
  options?: Intl.NumberFormatOptions;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const node = el.firstChild;
    const show = () => el.setAttribute("data-count-started", "");

    if (!(node instanceof Text) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      show();
      return;
    }

    let frame = 0;
    const format = new Intl.NumberFormat(locale, options);
    const run = () => {
      // Lock the width to the final value's, in rem, then count.
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      el.style.minWidth = `${el.getBoundingClientRect().width / rem}rem`;
      show();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        const current = value * easeOut(t);
        // Whole numbers stay whole while counting (no "123.456" mid-way).
        const shown = Number.isInteger(value) ? Math.round(current) : current;
        node.nodeValue = t < 1 ? format.format(shown) : text;
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      node.nodeValue = format.format(0);
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          run();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      node.nodeValue = text;
    };
  }, [value, text, locale, options]);

  return (
    <span ref={ref} data-count className={className}>
      {text}
    </span>
  );
}
