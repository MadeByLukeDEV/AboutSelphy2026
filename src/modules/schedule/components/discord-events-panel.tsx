"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { DiscordEventsStatus } from "../discord/events-service";
import {
  connectDiscordEventsAction,
  disconnectDiscordEventsAction,
  saveDiscordEventsSettingsAction,
  syncDiscordEventsAction,
  type DiscordEventsActionResult,
} from "../actions";

// The "Discord events" section of /admin/schedule: one Discord event per
// stream day, created by a bot. Admins connect (bot token + server id,
// stored encrypted) and configure; all staff can sync.
export function DiscordEventsPanel({ initial, isAdmin }: { initial: DiscordEventsStatus; isAdmin: boolean }) {
  const t = useTranslations("Admin.schedule.discordEvents");
  const format = useFormatter();
  const [status, setStatus] = useState(initial);
  const [token, setToken] = useState("");
  const [guildId, setGuildId] = useState(initial.guildId || initial.suggestedGuildId);
  const [locale, setLocale] = useState(initial.locale);
  const [replacing, setReplacing] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [pending, startTransition] = useTransition();

  const errorText = (code: string) =>
    t.has(`errors.${code}` as "errors.failed") ? t(`errors.${code}` as "errors.failed") : t("errors.failed");

  function run(action: () => Promise<DiscordEventsActionResult>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setInviteUrl(result.inviteUrl ?? null);
        toast.error(errorText(result.error));
        return;
      }
      setInviteUrl(null);
      setStatus(result.status);
      if (result.syncError) toast.error(errorText(result.syncError));
      else if (result.counts) toast.success(t("synced", result.counts));
      else if (success) toast.success(success);
    });
  }

  const dayText = (dayKey: string) =>
    format.dateTime(new Date(`${dayKey}T12:00:00Z`), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  const connectForm = (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => connectDiscordEventsAction({ token, guildId, locale }));
        setToken("");
        setReplacing(false);
      }}
    >
      <ol className="ml-5 list-decimal text-sm text-muted-foreground">
        <li>{t("steps.app")}</li>
        <li>{t("steps.token")}</li>
        <li>{t("steps.invite")}</li>
        <li>{t("steps.server")}</li>
      </ol>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="discord-bot-token">{t("tokenLabel")}</FieldLabel>
          <Input
            id="discord-bot-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <FieldDescription>{t("tokenHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="discord-guild">{t("serverLabel")}</FieldLabel>
          <Input
            id="discord-guild"
            inputMode="numeric"
            autoComplete="off"
            value={guildId}
            onChange={(event) => setGuildId(event.target.value.trim())}
          />
          <FieldDescription>{t("serverHint")}</FieldDescription>
        </Field>
        <LanguageSelect id="discord-events-locale-new" value={locale} onChange={setLocale} />
      </FieldGroup>
      {inviteUrl && (
        <a
          href={inviteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1 text-sm font-semibold text-brand-text underline-offset-4 hover:underline"
        >
          {t("invite")}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || token.trim().length === 0 || !/^\d{17,20}$/.test(guildId)}>
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
    <section aria-labelledby="discord-events-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="discord-events-heading" className="text-lg font-bold">
          {t("heading")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        {!isAdmin && <p className="text-sm text-muted-foreground">{t("adminOnly")}</p>}
      </div>

      {!status.ready ? (
        <p className="rounded-xl border bg-background p-4">{t("notReady")}</p>
      ) : !status.connected ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
          {isAdmin ? connectForm : <p>{t("notConnected")}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-5 rounded-xl border bg-background p-4">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">
              {t("connectedAs", { bot: status.botName || "Bot", server: status.guildName || status.guildId })}
            </p>
            <p className="text-sm text-muted-foreground">
              {status.lastSyncedAt
                ? t("lastSynced", { time: format.relativeTime(new Date(status.lastSyncedAt)) })
                : t("notSynced")}
            </p>
            {status.lastError && <p className="text-sm font-medium text-destructive">{errorText(status.lastError)}</p>}
          </div>

          {status.events.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {status.events.map((event) => (
                <li key={event.dayKey}>
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm font-medium hover:bg-muted"
                  >
                    <span className={event.cancelled ? "line-through opacity-60" : undefined}>{dayText(event.dayKey)}</span>
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
          )}

          <div>
            <Button type="button" disabled={pending || !status.enabled} onClick={() => run(() => syncDiscordEventsAction())}>
              <RefreshCw aria-hidden />
              {t("syncNow")}
            </Button>
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-4 border-t pt-4">
              {replacing ? (
                connectForm
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <LanguageSelect
                      id="discord-events-locale"
                      value={status.locale}
                      onChange={(next) => run(() => saveDiscordEventsSettingsAction({ locale: next, enabled: status.enabled }))}
                    />
                    <Field orientation="horizontal" className="items-start">
                      <Switch
                        id="discord-events-enabled"
                        checked={status.enabled}
                        disabled={pending}
                        onCheckedChange={(enabled) =>
                          run(() => saveDiscordEventsSettingsAction({ locale: status.locale, enabled }))
                        }
                      />
                      <div className="flex flex-col gap-1">
                        <FieldLabel htmlFor="discord-events-enabled">{t("enabled")}</FieldLabel>
                        <FieldDescription>{t("enabledHint")}</FieldDescription>
                      </div>
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => setReplacing(true)}>
                      {t("replace")}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setConfirmDisconnect(true)}>
                      <Unplug aria-hidden />
                      {t("disconnect")}
                    </Button>
                  </div>
                </>
              )}
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
                run(() => disconnectDiscordEventsAction(), t("disconnected"));
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

function LanguageSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: "de" | "en";
  onChange: (locale: "de" | "en") => void;
}) {
  const t = useTranslations("Admin.schedule.discordEvents");
  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("language")}</FieldLabel>
      <Select
        items={[
          { value: "de", label: t("languages.de") },
          { value: "en", label: t("languages.en") },
        ]}
        value={value}
        onValueChange={(next) => next && onChange(next as "de" | "en")}
      >
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="de">{t("languages.de")}</SelectItem>
          <SelectItem value="en">{t("languages.en")}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}
