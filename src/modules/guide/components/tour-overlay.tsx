"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TourId, TourStep } from "../tours";
import { findTarget } from "./find-target";

// The running tour: the page is dimmed except for the highlighted element,
// and a card explains it. Back/Next/Skip, arrow keys and Escape; focus
// stays in the card and returns where it was afterwards. Nothing on the
// page can be clicked while a tour runs.

type Layout = {
  rect: { top: number; left: number; width: number; height: number } | null;
  vw: number;
  vh: number;
  cardW: number;
  cardH: number;
};

/** Space around the highlight and between highlight, card and edges (px, measured layout). */
const PAD = 6;
const GAP = 12;
const EDGE = 16;

function sameLayout(a: Layout, b: Layout) {
  return (
    a.vw === b.vw &&
    a.vh === b.vh &&
    a.cardW === b.cardW &&
    a.cardH === b.cardH &&
    a.rect?.top === b.rect?.top &&
    a.rect?.left === b.rect?.left &&
    a.rect?.width === b.rect?.width &&
    a.rect?.height === b.rect?.height
  );
}

export function TourOverlay({ tour, steps, onClose }: { tour: TourId; steps: TourStep[]; onClose: () => void }) {
  const t = useTranslations("Guide");
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<Layout>({ rect: null, vw: 0, vh: 0, cardW: 0, cardH: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const step = steps[index];
  const last = index === steps.length - 1;
  const key = `tours.${tour}.${step.id}` as "tours.welcome.hello";

  // Back to where focus was before the tour.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);

  // Bring the step's element into view, then follow it every frame (smooth
  // scrolling, resizes, content that moves) until the step changes.
  useLayoutEffect(() => {
    const target = step.target ? findTarget(step.target) : null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
    // Focus "Next", so Enter/Space moves on.
    cardRef.current?.querySelector<HTMLElement>("[data-primary]")?.focus({ preventScroll: true });

    let frame = 0;
    const measure = () => {
      const box = target?.getBoundingClientRect();
      const next: Layout = {
        rect: box ? { top: box.top, left: box.left, width: box.width, height: box.height } : null,
        vw: window.innerWidth,
        vh: window.innerHeight,
        cardW: cardRef.current?.offsetWidth ?? 0,
        cardH: cardRef.current?.offsetHeight ?? 0,
      };
      setLayout((current) => (sameLayout(current, next) ? current : next));
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const next = () => (last ? onClose() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      back();
    } else if (event.key === "Tab") {
      // Keep focus inside the card.
      const focusable = cardRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const lastButton = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === cardRef.current)) {
        event.preventDefault();
        lastButton.focus();
      } else if (!event.shiftKey && active === lastButton) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const { rect, vw, vh, cardW, cardH } = layout;
  const spot = rect && {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
  // Below the element if it fits, else above, else pinned to the bottom.
  let cardStyle: React.CSSProperties;
  if (!spot) {
    cardStyle = { top: Math.max(EDGE, (vh - cardH) / 2), left: Math.max(EDGE, (vw - cardW) / 2) };
  } else {
    const left = Math.min(Math.max(spot.left, EDGE), Math.max(EDGE, vw - cardW - EDGE));
    const below = spot.top + spot.height + GAP;
    const above = spot.top - GAP - cardH;
    const top = below + cardH <= vh - EDGE ? below : above >= EDGE ? above : vh - cardH - EDGE;
    cardStyle = { top, left };
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]" onKeyDown={onKeyDown}>
      {/* Catches clicks: the page is "behind glass" during the tour. */}
      <div className="absolute inset-0" aria-hidden onClick={(event) => event.stopPropagation()} />
      {spot ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl outline-2 outline-primary outline-solid transition-[top,left,width,height] duration-200 motion-reduce:transition-none"
          style={{ ...spot, boxShadow: "0 0 0 100vmax rgb(0 0 0 / 0.7)" }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/70" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className={cn(
          "absolute flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl outline-none",
          // Transparent until measured, so it never flashes at the corner
          // (not "invisible": that would make it unfocusable).
          cardW === 0 && "opacity-0",
        )}
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("stepOf", { step: index + 1, total: steps.length })}
          </p>
          <Button type="button" variant="ghost" size="icon-sm" className="-mt-1 -mr-1" onClick={onClose} aria-label={t("skip")}>
            <X aria-hidden />
          </Button>
        </div>
        <h2 id={titleId} className="text-base font-bold">
          {t(`${key}.title`)}
        </h2>
        <p id={bodyId} className="text-sm whitespace-pre-line text-muted-foreground">
          {t(`${key}.body`)}
        </p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t("skip")}
          </Button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={back}>
                <ArrowLeft aria-hidden />
                {t("back")}
              </Button>
            )}
            <Button type="button" size="sm" onClick={next} data-primary>
              {last ? t("done") : t("next")}
              {!last && <ArrowRight aria-hidden />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
