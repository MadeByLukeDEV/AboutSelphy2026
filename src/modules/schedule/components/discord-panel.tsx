"use client";

import { useState, useTransition } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
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
  // An explicit "now" for relativeTime (next-intl warns without one), ticking
  // so "Last synced 2 minutes ago" stays current while the page is open.
  const now = useNow({ updateInterval: 30_000 });
  const [status, setStatus] = useState(initial);
  const [url, setUrl] = useState("");
  const [locale, setLocale] = useState(initial.locale);
  const [replacing, setReplacing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [pending, startTransition] = useTransition();
  // Bumped after every sync so the preview image reloads.
  const [previewVersion, setPreviewVersion] = useState(0);

  const [roleId, setRoleId] = useState(initial.pingRoleId);
  // Manual posts announce the week by default; off for a quiet correction.
  const [pingOnPost, setPingOnPost] = useState(true);

  /** Saves one setting; the others are sent as they are now. */
  const saveSettings = (patch: Partial<Pick<DiscordStatus, "locale" | "autoUpdate" | "weeklyPost" | "pingRoleId">>) =>
    run(
      () =>
        saveDiscordSettingsAction({
          locale: status.locale,
          autoUpdate: status.autoUpdate,
          weeklyPost: status.weeklyPost,
          pingRoleId: status.pingRoleId,
          ...patch,
        }),
      t("results.saved"),
    );

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
            {status.messageUrl ? (
              status.lastSyncedAt && (
                <p className="text-sm text-muted-foreground">
                  {t("lastSynced", { time: format.relativeTime(new Date(status.lastSyncedAt), now) })}
                </p>
              )
            ) : (
              // Automatic updates only edit: without a message they wait for
              // "Post new message" or the Monday post.
              <p className="text-sm font-medium">{t("noMessage")}</p>
            )}
            {status.lastError && status.lastError !== "messageGone" && (
              <p className="text-sm font-medium text-destructive">{errorText(status.lastError)}</p>
            )}
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

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={status.messageUrl ? "default" : "outline"}
                disabled={pending || !status.messageUrl}
                onClick={() => run(() => syncDiscordAction({ mode: "edit" }))}
              >
                <RefreshCw aria-hidden />
                {t("updateNow")}
              </Button>
              <Button
                type="button"
                variant={status.messageUrl ? "outline" : "default"}
                disabled={pending}
                onClick={() => run(() => syncDiscordAction({ mode: "post", ping: pingOnPost && !!status.pingRoleId }))}
              >
                <Send aria-hidden />
                {t("postNew")}
              </Button>
            </div>
            {status.pingRoleId && (
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                <Switch checked={pingOnPost} onCheckedChange={setPingOnPost} />
                {t("pingOnPost")}
              </label>
            )}
            <p className="text-xs text-muted-foreground">{t("postNewHint")}</p>
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-4 border-t pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <LanguageSelect id="discord-locale" value={status.locale} onChange={(locale) => saveSettings({ locale })} />
                <Field orientation="horizontal" className="items-start">
                  <Switch
                    id="discord-auto"
                    checked={status.autoUpdate}
                    disabled={pending}
                    onCheckedChange={(autoUpdate) => saveSettings({ autoUpdate })}
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="discord-auto">{t("autoUpdate")}</FieldLabel>
                    <FieldDescription>{t("autoUpdateHint")}</FieldDescription>
                  </div>
                </Field>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <Field orientation="horizontal" className="items-start">
                  <Switch
                    id="discord-weekly"
                    checked={status.weeklyPost}
                    disabled={pending}
                    onCheckedChange={(weeklyPost) => saveSettings({ weeklyPost })}
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="discord-weekly">{t("weeklyPost")}</FieldLabel>
                    <FieldDescription>{t("weeklyPostHint")}</FieldDescription>
                    {status.nextWeeklyPost && (
                      <p className="text-sm font-medium">
                        {t("nextWeeklyPost", {
                          time: format.dateTime(new Date(status.nextWeeklyPost), {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Europe/Vienna",
                          }),
                        })}
                      </p>
                    )}
                  </div>
                </Field>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveSettings({ pingRoleId: roleId.trim() });
                  }}
                >
                  <Field className="min-w-0 flex-1">
                    <FieldLabel htmlFor="discord-role">{t("pingRole")}</FieldLabel>
                    <Input
                      id="discord-role"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="1400559547642282184"
                      value={roleId}
                      onChange={(event) => setRoleId(event.target.value)}
                    />
                  </Field>
                  <Button type="submit" variant="outline" disabled={pending || roleId.trim() === status.pingRoleId}>
                    {t("saveRole")}
                  </Button>
                </form>
                <FieldDescription>{t("pingRoleHint")}</FieldDescription>
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
