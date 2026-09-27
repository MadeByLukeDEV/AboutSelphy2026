import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import {
  getLiveStatus,
  getStatsOverview,
  getSyncStatus,
  SyncNowButton,
} from "@/modules/stats";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("stats") };
}

const METRICS = [
  "twitch/followers",
  "youtube/subscribers",
  "youtube/views",
  "youtube/videos",
  "youtube/recentAverageViews",
] as const;

export default async function AdminStatsPage() {
  await requireStaffPage("/admin/stats");
  const t = await getTranslations("Admin.stats");
  const format = await getFormatter();
  const [status, overview, live] = await Promise.all([
    getSyncStatus(),
    getStatsOverview(),
    getLiveStatus(),
  ]);
  const when = (date: Date) =>
    format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });
  const number = (value: number) =>
    format.number(value, { maximumFractionDigits: 1 });
  const { twitch30d } = overview;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-fluid-3xl font-extrabold tracking-tight">
            {(await getTranslations("Admin.nav"))("stats")}
          </h1>
          <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
        </div>
        <SyncNowButton />
      </header>

      <section aria-labelledby="live-heading" className="flex flex-col gap-2">
        <h2 id="live-heading" className="text-lg font-bold">
          {t("liveHeading")}
        </h2>
        <p className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "size-2.5 rounded-full",
              live.live ? "bg-red-500" : "bg-muted-foreground/40",
            )}
          />
          {live.live ? t("live", { title: live.title }) : t("offline")}
        </p>
      </section>

      <section aria-labelledby="numbers-heading" className="flex flex-col gap-3">
        <h2 id="numbers-heading" className="text-lg font-bold">
          {t("numbersHeading")}
        </h2>
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="px-4 py-2 font-medium">{t("metric")}</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">{t("value")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("asOf")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {METRICS.map((key) => {
                const metric = overview.latest[key];
                return (
                  <tr key={key}>
                    <th scope="row" className="px-4 py-2.5 text-left font-medium">
                      {t(`metrics.${key}`)}
                    </th>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {metric ? number(metric.value) : "–"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {metric ? when(metric.capturedAt) : t("noData")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="twitch-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="twitch-heading" className="text-lg font-bold">
            {t("twitchHeading")}
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t("twitchNote")}
          </p>
        </div>
        {twitch30d.streams === 0 ? (
          <p className="rounded-xl border bg-background p-4 text-sm">
            {t("noStreams")}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
              {[
                [t("streams"), number(twitch30d.streams)],
                [t("hours"), number(twitch30d.hoursStreamed)],
                [t("avgViewers"), twitch30d.averageViewers === null ? "–" : number(twitch30d.averageViewers)],
                [t("peakViewers"), twitch30d.peakViewers === null ? "–" : number(twitch30d.peakViewers)],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1 bg-background px-4 py-3">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-fluid-xl font-bold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {twitch30d.since && (
              <p className="text-sm text-muted-foreground">
                {t("sampledSince", { date: when(twitch30d.since) })}
              </p>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="runs-heading" className="flex flex-col gap-3">
        <h2 id="runs-heading" className="text-lg font-bold">
          {t("runsHeading")}
        </h2>
        {status.runs.length === 0 ? (
          <p className="rounded-xl border bg-background p-4 text-sm">{t("noData")}</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background text-sm">
            {status.runs.map((run) => (
              <li key={run.id} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={cn(
                      "font-semibold",
                      !run.finishedAt
                        ? "text-muted-foreground"
                        : run.ok
                          ? "text-brand-text"
                          : "text-destructive",
                    )}
                  >
                    {!run.finishedAt ? t("running") : run.ok ? t("ok") : t("failed")}
                  </span>
                  <span className="text-muted-foreground">{when(run.startedAt)}</span>
                  <span className="rounded-md border px-1.5 text-xs text-muted-foreground">
                    {run.trigger}
                  </span>
                </div>
                <p className="break-words text-muted-foreground">{run.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="config-heading" className="flex flex-col gap-3">
        <h2 id="config-heading" className="text-lg font-bold">
          {t("configHeading")}
        </h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {(
            [
              ["cronLabel", status.configured.cron],
              ["twitchLabel", status.configured.twitch],
              ["youtubeLabel", status.configured.youtube],
            ] as const
          ).map(([label, ok]) => (
            <li
              key={label}
              className={cn(
                "rounded-lg border px-3 py-1.5",
                ok ? "bg-background" : "border-destructive/40 text-destructive",
              )}
            >
              {t(label)}: {ok ? t("configured") : t("notConfigured")}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
