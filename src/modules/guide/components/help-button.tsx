"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { CircleHelp, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GUIDE_TOPICS } from "../guide-content";
import { tourForPath } from "../tours";
import { useGuide } from "./guide-provider";

// The "?" button in the admin sidebar and the guide panel it opens: what
// the current page is for, how-tos, and the tour buttons.
export function HelpButton() {
  const t = useTranslations("Guide");
  const guide = useGuide();
  const page = tourForPath(usePathname()) ?? "welcome";
  const base = `pages.${page}` as "pages.welcome";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-tour="help"
        onClick={() => guide.setHelpOpen(true)}
        aria-haspopup="dialog"
      >
        <CircleHelp aria-hidden />
        {t("open")}
      </Button>

      <Sheet open={guide.helpOpen} onOpenChange={guide.setHelpOpen}>
        <SheetContent side="right" showCloseButton={false} className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="gap-1 border-b">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("panelLabel")}</p>
            <SheetTitle className="text-lg font-bold">{t(`${base}.title`)}</SheetTitle>
            <SheetDescription>{t(`${base}.intro`)}</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 px-4">
            {GUIDE_TOPICS[page].map((topic) => {
              const key = `${base}.topics.${topic.id}` as "pages.welcome.topics.roles";
              return (
                <section key={topic.id} className="flex flex-col gap-1.5">
                  <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                    {t(`${key}.title`)}
                    {topic.adminOnly && !guide.admin && <Badge variant="secondary">{t("adminsOnly")}</Badge>}
                  </h3>
                  <p className="text-sm whitespace-pre-line text-muted-foreground">{t(`${key}.body`)}</p>
                </section>
              );
            })}
          </div>

          <SheetFooter className="border-t">
            {guide.pageTour && (
              <Button type="button" onClick={() => guide.startTour(guide.pageTour!)}>
                <Play aria-hidden />
                {t("startTour")}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={guide.resetTours}>
              <RotateCcw aria-hidden />
              {t("resetTours")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => guide.setHelpOpen(false)}>
              {t("close")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
