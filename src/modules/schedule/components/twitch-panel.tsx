"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { RefreshCw, Unplug } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { TwitchStatus } from "../twitch/service";
import {
  disconnectTwitchAction,
  saveTwitchSettingsAction,
  syncTwitchAction,
  type TwitchActionResult,
} from "../actions";

// The Twitch schedule section of /admin/schedule. Connecting is a plain link
// to /api/twitch/connect (the CSP's form-action doesn't allow Twitch); the
// result comes back as ?twitch=<outcome>. Admins connect/configure, staff
// can sync.
export function TwitchPanel({
  initial,
  isAdmin,
  outcome,
}: {
  initial: TwitchStatus;
  isAdmin: boolean;
  /** ?twitch=... after the connect round trip. */
  outcome: string | null;
}) {
  const t = useTranslations("Admin.schedule.twitch");
  const format = useFormatter();
  const [status, setStatus] = useState(initial);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [pending, startTransition] = useTransition();

  const errorText = (code: string) =>
    t.has(`errors.${code}` as "errors.failed") ? t(`errors.${code}` as "errors.failed") : t("errors.failed");

  function run(action: () => Promise<TwitchActionResult>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(errorText(result.error));
        return;
      }
      setStatus(result.status);
      if (result.syncError) toast.error(errorText(result.syncError));
      else if (result.counts)
        toast.success(t("synced", result.counts));
      else if (success) toast.success(success);
    });
  }

  const outcomeText =
    outcome && t.has(`outcomes.${outcome}` as "outcomes.connected") ? t(`outcomes.${outcome}` as "outcomes.connected") : null;

  return (
    <section aria-labelledby="twitch-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="twitch-heading" className="text-lg font-bold">
          {t("heading")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        {!isAdmin && <p className="text-sm text-muted-foreground">{t("adminOnly")}</p>}
      </div>

      {outcomeText && (
        <p
          role="status"
          className={cn(
            "rounded-xl border p-3 text-sm font-medium",
            outcome === "connected" ? "border-brand-text/40 text-brand-text" : "border-destructive/40 text-destructive",
          )}
        >
          {outcomeText}
        </p>
      )}

      {!status.ready ? (
        <p className="rounded-xl border bg-background p-4">{t("notReady")}</p>
      ) : !status.connected ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
          <p className="text-sm text-muted-foreground">{t("connectHint")}</p>
          {isAdmin ? (
            // A plain link: a route handler that redirects to Twitch, not a
            // page (no client-side navigation), and not a form (CSP).
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a href="/api/twitch/connect" className={cn(buttonVariants(), "w-fit")}>
              {t("connect")}
            </a>
          ) : (
            <p>{t("notConnected")}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5 rounded-xl border bg-background p-4">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{t("connectedAs", { login: status.login })}</p>
            <p className="text-sm text-muted-foreground">{t("segments", { count: status.segments })}</p>
            <p className="text-sm text-muted-foreground">
              {status.lastSyncedAt
                ? t("lastSynced", { time: format.relativeTime(new Date(status.lastSyncedAt)) })
                : t("notSynced")}
            </p>
            {status.lastError && <p className="text-sm font-medium text-destructive">{errorText(status.lastError)}</p>}
            <a
              href={`https://www.twitch.tv/${status.login}/schedule`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit text-sm font-semibold text-brand-text underline-offset-4 hover:underline"
            >
              {t("openSchedule")}
            </a>
          </div>

          <div>
            <Button type="button" disabled={pending || !status.enabled} onClick={() => run(() => syncTwitchAction())}>
              <RefreshCw aria-hidden />
              {t("syncNow")}
            </Button>
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-4 border-t pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="twitch-locale">{t("titleLanguage")}</FieldLabel>
                  <Select
                    items={[
                      { value: "de", label: t("languages.de") },
                      { value: "en", label: t("languages.en") },
                    ]}
                    value={status.titleLocale}
                    onValueChange={(next) =>
                      next &&
                      run(() =>
                        saveTwitchSettingsAction({ enabled: status.enabled, titleLocale: next }),
                      )
                    }
                  >
                    <SelectTrigger id="twitch-locale" className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de">{t("languages.de")}</SelectItem>
                      <SelectItem value="en">{t("languages.en")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field orientation="horizontal" className="items-start">
                  <Switch
                    id="twitch-enabled"
                    checked={status.enabled}
                    disabled={pending}
                    onCheckedChange={(enabled) =>
                      run(() => saveTwitchSettingsAction({ enabled, titleLocale: status.titleLocale }))
                    }
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="twitch-enabled">{t("enabled")}</FieldLabel>
                    <FieldDescription>{t("enabledHint")}</FieldDescription>
                  </div>
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler, see above */}
                <a href="/api/twitch/connect" className={buttonVariants({ variant: "outline" })}>
                  {t("reconnect")}
                </a>
                <Button type="button" variant="outline" onClick={() => setConfirmDisconnect(true)}>
                  <Unplug aria-hidden />
                  {t("disconnect")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmDisconnectTitle")}</DialogTitle>
          </DialogHeader>
          <p>{t("confirmDisconnect")}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDisconnect(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setConfirmDisconnect(false);
                run(() => disconnectTwitchAction(), t("disconnected"));
              }}
            >
              {t("disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
