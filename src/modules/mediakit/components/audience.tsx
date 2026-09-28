import { getFormatter, getTranslations } from "next-intl/server";
import type { StatsOverview } from "@/modules/stats";

// The audience part of the media kit. Every number comes from the stats
// sync's latest snapshot and carries its own "as of" time; nothing here is
// typed in by hand. A figure that hasn't been measured says so instead of
// showing 0.

type Format = Awaited<ReturnType<typeof getFormatter>>;

function count(format: Format, value: number) {
  // Exact below 10,000 (small numbers read as more honest in full), compact
  // above ("86K" / "86.095" would be noise for a sponsor skimming).
  return format.number(value, value >= 10_000 ? { notation: "compact", maximumFractionDigits: 1 } : {});
}

function asOf(format: Format, date: Date) {
  return format.dateTime(date, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * The opening sentence built from the three headline numbers. Left out
 * when one of them is missing (e.g. an API not configured yet).
 */
export async function AudienceSummary({ stats }: { stats: StatsOverview }) {
  const t = await getTranslations("MediaKit");
  const format = await getFormatter();
  const followers = stats.latest["twitch/followers"];
  const subscribers = stats.latest["youtube/subscribers"];
  const views = stats.latest["youtube/recentAverageViews"];
  if (!followers || !subscribers || !views) return null;

  const oldest = [followers, subscribers, views].reduce((a, b) =>
    a.capturedAt < b.capturedAt ? a : b,
  ).capturedAt;

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[34ch] text-fluid-3xl leading-tight font-medium tracking-tight text-muted-foreground">
        {t.rich("summary", {
          followers: count(format, followers.value),
          subscribers: count(format, subscribers.value),
          views: count(format, Math.round(views.value)),
          num: (chunks) => <strong className="font-extrabold text-foreground">{chunks}</strong>,
        })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("summarySource", { date: asOf(format, oldest) })}
      </p>
    </div>
  );
}

type Row = { label: string; value: string | null; asOf: Date | null; note?: string };

function PlatformCard({ heading, rows, footnote }: { heading: string; rows: Row[]; footnote?: string }) {
  return (
    <section aria-label={heading} className="reveal flex flex-col gap-3 rounded-2xl border bg-background/60 p-fluid">
      <h3 className="text-fluid-xl font-bold">{heading}</h3>
      <dl className="flex flex-col divide-y">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
            <dt className="flex flex-col">
              <span>{row.label}</span>
              {row.asOf && <span className="text-xs text-muted-foreground">{row.note}</span>}
            </dt>
            <dd className={row.value ? "text-fluid-xl font-bold" : "shrink-0 text-right text-sm text-muted-foreground"}>
              {row.value ?? row.note}
            </dd>
          </div>
        ))}
      </dl>
      {footnote && <p className="text-sm text-muted-foreground">{footnote}</p>}
    </section>
  );
}

/** Per-platform figures, each with its "as of" time. */
export async function PlatformStats({ stats }: { stats: StatsOverview }) {
  const t = await getTranslations("MediaKit.platforms");
  const format = await getFormatter();
  const latest = (key: string, round = false): Row["value"] => {
    const metric = stats.latest[key];
    return metric ? count(format, round ? Math.round(metric.value) : metric.value) : null;
  };
  const row = (label: string, key: string, round = false): Row => {
    const metric = stats.latest[key];
    return {
      label,
      value: latest(key, round),
      asOf: metric?.capturedAt ?? null,
      note: metric ? t("asOf", { date: asOf(format, metric.capturedAt) }) : t("notYet"),
    };
  };

  const twitch = stats.twitch30d;
  const measured = twitch.streams > 0;
  const liveRow = (label: string, value: number | null): Row => ({
    label,
    value: measured && value !== null ? format.number(value, { maximumFractionDigits: 1 }) : null,
    asOf: null,
    note: t("notMeasured"),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PlatformCard
        heading="Twitch"
        rows={[
          row(t("followers"), "twitch/followers"),
          liveRow(t("averageViewers"), twitch.averageViewers),
          liveRow(t("peakViewers"), twitch.peakViewers),
          liveRow(t("hoursStreamed"), measured ? twitch.hoursStreamed : null),
        ]}
        footnote={
          measured && twitch.since
            ? t("twitchNote", { date: format.dateTime(twitch.since, { day: "numeric", month: "long" }) })
            : t("twitchNoteEmpty")
        }
      />
      <PlatformCard
        heading="YouTube"
        rows={[
          row(t("subscribers"), "youtube/subscribers"),
          row(t("recentAverageViews"), "youtube/recentAverageViews", true),
          row(t("totalViews"), "youtube/views"),
          row(t("videos"), "youtube/videos"),
        ]}
      />
    </div>
  );
}
