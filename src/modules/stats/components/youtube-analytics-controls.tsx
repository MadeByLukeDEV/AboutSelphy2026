"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { disconnectYoutubeAction, setShowDemographicsAction } from "../actions";

// Admin-only controls for a connected YouTube Analytics grant: the media kit
// switch and "Disconnect". The actions re-check requireAdmin() themselves.
export function YoutubeAnalyticsControls({ showInMediaKit }: { showInMediaKit: boolean }) {
  const t = useTranslations("Admin.stats.youtube");
  const router = useRouter();
  const [shown, setShown] = useState(showInMediaKit);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function fail(error: "forbidden" | "invalid" | "failed") {
    toast.error(error === "forbidden" ? t("forbiddenAction") : t("failed"));
  }

  function toggle(checked: boolean) {
    startTransition(async () => {
      const result = await setShowDemographicsAction(checked);
      if (!result.ok) return fail(result.error);
      setShown(checked);
      toast.success(checked ? t("showOn") : t("showOff"));
    });
  }

  function disconnect() {
    startTransition(async () => {
      const result = await disconnectYoutubeAction();
      if (!result.ok) return fail(result.error);
      setConfirming(false);
      toast.success(t("disconnected"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <Switch checked={shown} disabled={isPending} onCheckedChange={toggle} />
        {t("showInMediaKit")}
      </label>
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
        {t("disconnect")}
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("disconnect")}</DialogTitle>
            <DialogDescription>{t("disconnectConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="destructive" disabled={isPending} onClick={disconnect}>
              {isPending ? t("disconnecting") : t("disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
