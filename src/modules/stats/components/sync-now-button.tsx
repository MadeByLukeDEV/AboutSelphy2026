"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncNowAction } from "../actions";

export function SyncNowButton() {
  const t = useTranslations("Admin.stats");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await syncNowAction();
      if (result.status === "ok") toast.success(t("synced"));
      else if (result.status === "partial") toast.error(t("syncedWithErrors"));
      else if (result.status === "skipped") toast.info(t("syncSkipped"));
      else toast.error(t("syncForbidden"));
      // The status page is server-rendered: reload it to show the new run.
      router.refresh();
    });
  }

  return (
    <Button type="button" onClick={onClick} disabled={isPending}>
      <RefreshCw className={isPending ? "animate-spin" : undefined} aria-hidden />
      {isPending ? t("syncing") : t("syncNow")}
    </Button>
  );
}
