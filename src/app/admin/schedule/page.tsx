import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/modules/i18n";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getScheduleForEdit } from "@/modules/schedule/admin-service";
import { ScheduleManager } from "@/modules/schedule/components/schedule-manager";
import { DiscordPanel } from "@/modules/schedule/components/discord-panel";
import { getDiscordStatus } from "@/modules/schedule/discord/service";
import { DiscordEventsPanel } from "@/modules/schedule/components/discord-events-panel";
import { getDiscordEventsStatus } from "@/modules/schedule/discord/events-service";
import { TwitchPanel } from "@/modules/schedule/components/twitch-panel";
import { getTwitchStatus } from "@/modules/schedule/twitch/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("schedule") };
}

// Staff (admins and moderators) can edit the schedule; the actions enforce
// the same rule server-side.
export default async function AdminSchedulePage({ searchParams }: PageProps<"/admin/schedule">) {
  // ?twitch=<outcome> after the Twitch connect round trip (a short code).
  const twitchOutcome = (await searchParams).twitch;
  const session = await requireStaffPage("/admin/schedule");
  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-fluid-3xl font-extrabold tracking-tight">{t("nav.schedule")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("schedule.intro")}</p>
      </header>
      <ScheduleManager initial={await getScheduleForEdit((await getLocale()) as Locale)} />
      <DiscordPanel initial={await getDiscordStatus()} isAdmin={isAdmin(session.user.role)} />
      <DiscordEventsPanel initial={await getDiscordEventsStatus()} isAdmin={isAdmin(session.user.role)} />
      <TwitchPanel
        initial={await getTwitchStatus()}
        isAdmin={isAdmin(session.user.role)}
        outcome={typeof twitchOutcome === "string" && /^[a-zA-Z]{1,30}$/.test(twitchOutcome) ? twitchOutcome : null}
      />
    </div>
  );
}
