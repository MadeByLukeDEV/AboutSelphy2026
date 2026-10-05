"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Send, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { DiscordStatus } from "../discord/service";
import {
  connectDiscordAction,
  disconnectDiscordAction,
  saveDiscordSettingsAction,
  syncDiscordAction,
  type DiscordActionResult,
} from "../actions";

// The Discord section of /admin/schedule. The webhook URL is typed in once
// and sent to the server; it never comes back (the status only carries the
// webhook's name and channel). Admins connect/configure; staff can update.
export function DiscordPanel({ initial, isAdmin }: { initial: DiscordStatus; isAdmin: boolean }) {
  const t = useTranslations("Admin.schedule.discord");
  const format = useFormatter();
  const [status, setStatus] = useState(initial);
  const [url, setUrl] = useState("");
  const [locale, setLocale] = useState(initial.locale);
  const [replacing, setReplacing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [pending, startTransition] = useTransition();
  // Bumped after every sync so the preview image reloads.
  const [previewVersion, setPreviewVersion] = useState(0);

  const errorText = (code: string) =>
    t.has(`errors.${code}` as "errors.failed") ? t(`errors.${code}` as "errors.failed") : t("errors.failed");

  function run(action: () => Promise<DiscordActionResult>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(errorText(result.error));
        return;
      }
      setStatus(result.status);
      setPreviewVersion((v) => v + 1);
      if (result.syncError) toast.error(errorText(result.syncError));
      else if (result.result && t.has(`results.${result.result}` as "results.posted"))
        toast.success(t(`results.${result.result}` as "results.posted"));
      else if (success) toast.success(success);
    });
  }

  const connectForm = (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => connectDiscordAction({ url, locale }));
        setUrl("");
        setReplacing(false);
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="discord-webhook">{t("webhookLabel")}</FieldLabel>
          <Input
            id="discord-webhook"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://discord.com/api/webhooks/…"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <FieldDescription>{t("webhookHint")}</FieldDescription>
        </Field>
        <LanguageSelect id="discord-locale-new" value={locale} onChange={setLocale} />
      </FieldGroup>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || url.trim().length === 0}>
          {pending ? t("connecting") : t("connect")}
        </Button>
        {replacing && (
          <Button type="button" variant="outline" onClick={() => setReplacing(false)}>
            {t("cancel")}
          </Button>
        )}
      </div>
    </form>
  );

  return (
    <section aria-labelledby="discord-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="discord-heading" className="text-lg font-bold">
          {t("heading")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        {!isAdmin && <p className="text-sm text-muted-foreground">{t("adminOnly")}</p>}
      </div>

      {!status.ready ? (
        <p className="rounded-xl border bg-background p-4">{t("notReady")}</p>
      ) : !status.connected ? (
        isAdmin ? (
          <div className="rounded-xl border bg-background p-4">{connectForm}</div>
        ) : (
          <p className="rounded-xl border bg-background p-4">{t("results.notConnected")}</p>
        )
      ) : (
        <div className="flex flex-col gap-5 rounded-xl border bg-background p-4">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{t("connectedTo", { name: status.webhookName || "Webhook" })}</p>
            {status.channelId && <p className="text-sm text-muted-foreground">{t("channel", { id: status.channelId })}</p>}
            <p className="text-sm text-muted-foreground">
              {status.lastSyncedAt
                ? t("lastSynced", { time: format.relativeTime(new Date(status.lastSyncedAt)) })
                : t("notPosted")}
            </p>
            {status.lastError && <p className="text-sm font-medium text-destructive">{errorText(status.lastError)}</p>}
            {status.messageUrl && (
              <a
                href={status.messageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-text underline-offset-4 hover:underline"
              >
                {t("openMessage")}
                <ExternalLink className="size-4" aria-hidden />
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending} onClick={() => run(() => syncDiscordAction(false))}>
              <RefreshCw aria-hidden />
              {t("updateNow")}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => syncDiscordAction(true))}>
              <Send aria-hidden />
              {t("postNew")}
            </Button>
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">{t("postNewHint")}</p>

          {isAdmin && (
            <div className="flex flex-col gap-4 border-t pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <LanguageSelect
                  id="discord-locale"
                  value={status.locale}
                  onChange={(next) =>
                    run(() => saveDiscordSettingsAction({ locale: next, autoUpdate: status.autoUpdate }), t("results.saved"))
                  }
                />
                <Field orientation="horizontal" className="items-start">
                  <Switch
                    id="discord-auto"
                    checked={status.autoUpdate}
                    disabled={pending}
                    onCheckedChange={(autoUpdate) =>
                      run(() => saveDiscordSettingsAction({ locale: status.locale, autoUpdate }), t("results.saved"))
                    }
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="discord-auto">{t("autoUpdate")}</FieldLabel>
                    <FieldDescription>{t("autoUpdateHint")}</FieldDescription>
                  </div>
                </Field>
              </div>
              {replacing ? (
                connectForm
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setReplacing(true)}>
                    {t("replace")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmDisconnect(true)}>
                    <Unplug aria-hidden />
                    {t("disconnect")}
                  </Button>
                </div>
              )}
            </div>
          )}

          <figure className="flex flex-col gap-2">
            <figcaption className="text-sm font-medium">{t("preview")}</figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element -- generated on our own route, not for the optimizer */}
            <img
              src={`/api/schedule/image?locale=${status.locale}&v=${previewVersion}-${status.lastSyncedAt ?? ""}`}
              alt=""
              className="w-full max-w-2xl rounded-lg border"
            />
          </figure>
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
                run(() => disconnectDiscordAction(), t("results.disconnected"));
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

function LanguageSelect({ id, value, onChange }: { id: string; value: "de" | "en"; onChange: (v: "de" | "en") => void }) {
  const t = useTranslations("Admin.schedule.discord");
  const options = (["de", "en"] as const).map((v) => ({ value: v, label: t(`languages.${v}`) }));
  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("language")}</FieldLabel>
      <Select items={options} value={value} onValueChange={(next) => next && onChange(next as "de" | "en")}>
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
