import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { CountUp } from "@/components/motion/count-up";
import type { StatsOverview } from "@/modules/stats";

// The audience part of the media kit. Every number comes from the stats
// sync's latest snapshot and carries its own "as of" time; nothing here is
// typed in by hand. A figure that hasn't been measured says so instead of
// showing 0. Numbers count up when they scroll into view (CountUp); the
// HTML always holds the real value.

type Format = Awaited<ReturnType<typeof getFormatter>>;

/** A number ready for CountUp: the value, its options and the final text. */
type FigureOptions = { notation?: "compact"; maximumFractionDigits?: number };
type Figure = { value: number; options: FigureOptions; text: string };

function figure(format: Format, value: number, options?: FigureOptions): Figure {
  // Exact below 10,000 (small numbers read as more honest in full), compact
  // above ("86K" / "86.095" would be noise for a sponsor skimming).
  const resolved: FigureOptions =
    options ?? (value >= 10_000 ? { notation: "compact", maximumFractionDigits: 1 } : {});
  return { value, options: resolved, text: format.number(value, resolved) };
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

  // Static on purpose: this sentence is the page's largest paint (LCP).
  // Counting it up meant hiding its numbers until JavaScript ran, which
  // delayed the first paint on phones; the cards below still count up.
  const num = (f: Figure) => <strong className="font-extrabold text-foreground">{f.text}</strong>;
  const f = figure(format, followers.value);
  const s = figure(format, subscribers.value);
  const v = figure(format, Math.round(views.value));

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[34ch] text-fluid-3xl leading-tight font-medium tracking-tight text-muted-foreground">
        {t.rich("summary", {
          followers: f.text,
          subscribers: s.text,
          views: v.text,
          followersTag: () => num(f),
          subscribersTag: () => num(s),
          viewsTag: () => num(v),
        })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("summarySource", { date: asOf(format, oldest) })}
      </p>
    </div>
  );
}

type Row = { label: string; value: Figure | null; asOf: Date | null; note?: string };

function PlatformCard({
  heading,
  rows,
  footnote,
  locale,
}: {
  heading: string;
  rows: Row[];
  footnote?: string;
  locale: string;
}) {
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
            <dd className={row.value ? "text-right text-fluid-xl font-bold" : "shrink-0 text-right text-sm text-muted-foreground"}>
              {row.value ? (
                <CountUp value={row.value.value} text={row.value.text} locale={locale} options={row.value.options} />
              ) : (
                row.note
              )}
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
  const locale = await getLocale();
  const row = (label: string, key: string, round = false): Row => {
    const metric = stats.latest[key];
    return {
      label,
      value: metric ? figure(format, round ? Math.round(metric.value) : metric.value) : null,
      asOf: metric?.capturedAt ?? null,
      note: metric ? t("asOf", { date: asOf(format, metric.capturedAt) }) : t("notYet"),
    };
  };

  const twitch = stats.twitch30d;
  const measured = twitch.streams > 0;
  const liveRow = (label: string, value: number | null): Row => ({
    label,
    value: measured && value !== null ? figure(format, value, { maximumFractionDigits: 1 }) : null,
    asOf: null,
    note: t("notMeasured"),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PlatformCard
        heading="Twitch"
        locale={locale}
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
        locale={locale}
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
