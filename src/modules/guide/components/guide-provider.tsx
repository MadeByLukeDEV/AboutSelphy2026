"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { markTourSeenAction, resetToursAction } from "../actions";
import { stepsFor, tourForPath, type TourId, type TourStep } from "../tours";
import { findTarget } from "./find-target";
import { TourOverlay } from "./tour-overlay";

// Holds the tour state for the whole admin area: which tours this staff
// member has seen (from the DB), the running tour, and the help panel.
// A page's tour starts by itself the first time the page is opened.

type GuideContext = {
  admin: boolean;
  /** The tour of the current page (null: none for this page or role). */
  pageTour: TourId | null;
  startTour: (tour: TourId) => void;
  resetTours: () => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
};

const Context = createContext<GuideContext | null>(null);

export function useGuide() {
  const guide = useContext(Context);
  if (!guide) throw new Error("useGuide outside GuideProvider");
  return guide;
}

/** Wait for the page's content to render before looking for targets. */
const AUTO_START_DELAY_MS = 700;

export function GuideProvider({
  initialSeen,
  admin,
  children,
}: {
  initialSeen: TourId[];
  admin: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("Guide");
  const pathname = usePathname();
  const [seen, setSeen] = useState(() => new Set(initialSeen));
  const [running, setRunning] = useState<{ tour: TourId; steps: TourStep[] } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const route = tourForPath(pathname);
  const pageTour = route && stepsFor(route, admin).length > 0 ? route : null;

  /** The steps whose element is on the page right now. */
  const available = useCallback(
    (tour: TourId) => stepsFor(tour, admin).filter((step) => !step.target || findTarget(step.target)),
    [admin],
  );

  const startTour = useCallback(
    (tour: TourId) => {
      const steps = available(tour);
      if (steps.length === 0) {
        toast.info(t("nothingToShow"));
        return;
      }
      setHelpOpen(false);
      setRunning({ tour, steps });
    },
    [available, t],
  );

  // First visit of a page: start its tour once the content is there.
  useEffect(() => {
    if (!pageTour || seen.has(pageTour) || running || helpOpen) return;
    const timer = setTimeout(() => {
      const steps = available(pageTour);
      // Only the centred intro left (e.g. an empty page): not worth it.
      if (steps.some((step) => step.target)) setRunning({ tour: pageTour, steps });
    }, AUTO_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pageTour, seen, running, helpOpen, available]);

  // Finished or skipped: remember it, so it never starts by itself again.
  const finish = useCallback(() => {
    if (!running) return;
    const tour = running.tour;
    setRunning(null);
    setSeen((previous) => new Set(previous).add(tour));
    void markTourSeenAction(tour);
  }, [running]);

  const resetTours = useCallback(() => {
    void resetToursAction().then((result) => {
      if (!result.ok) {
        toast.error(t("resetFailed"));
        return;
      }
      setSeen(new Set());
      setHelpOpen(false);
      toast.success(t("resetDone"));
    });
  }, [t]);

  const value = useMemo(
    () => ({ admin, pageTour, startTour, resetTours, helpOpen, setHelpOpen }),
    [admin, pageTour, startTour, resetTours, helpOpen],
  );

  return (
    <Context.Provider value={value}>
      {children}
      {running && (
        <TourOverlay key={running.tour} tour={running.tour} steps={running.steps} onClose={finish} />
      )}
    </Context.Provider>
  );
}
