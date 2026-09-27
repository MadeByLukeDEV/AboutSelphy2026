import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { siteUrl } from "@/lib/env";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { localeAlternates, type Locale } from "@/modules/i18n";
import { CHANNELS, PROFILE_IMAGES } from "@/modules/profile";
import { getUpcomingStreams, type StreamOccurrence } from "@/modules/schedule";
import { JsonLd, streamEventSchema } from "@/modules/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/schedule">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "Schedule" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates(locale, "/schedule"),
    openGraph: {
      title: `${t("metaTitle")} — AboutSelphy`,
      description: t("metaDescription"),
      siteName: "AboutSelphy",
      type: "website",
      locale: locale === "de" ? "de_DE" : "en_US",
    },
    twitter: { card: "summary_large_image" },
  };
}

function groupByDate(streams: StreamOccurrence[]) {
  const groups = new Map<string, StreamOccurrence[]>();
  for (const stream of streams) {
    const key = `${stream.date.year}-${stream.date.month}-${stream.date.day}`;
    groups.set(key, [...(groups.get(key) ?? []), stream]);
  }
  return [...groups.values()];
}

// The next 14 days, from the weekly plan + changes (schedule module). Times
// are formatted in Europe/Vienna (next-intl's timeZone, src/modules/i18n).
export default async function SchedulePage({
  params,
}: PageProps<"/[locale]/schedule">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("Schedule");
  const format = await getFormatter();
  const now = new Date();
  const streams = await getUpcomingStreams(locale, { now });
  const base = siteUrl();

  const todayKey = format.dateTime(now, { dateStyle: "short" });
  const tomorrowKey = format.dateTime(new Date(now.getTime() + 86_400_000), {
    dateStyle: "short",
  });
  const dayLabel = (start: Date) => {
    const key = format.dateTime(start, { dateStyle: "short" });
    const date = format.dateTime(start, { weekday: "long", day: "numeric", month: "long" });
    if (key === todayKey) return `${t("today")}, ${date}`;
    if (key === tomorrowKey) return `${t("tomorrow")}, ${date}`;
    return date;
  };
  const time = (date: Date) => format.dateTime(date, { hour: "2-digit", minute: "2-digit" });
  const name = (stream: StreamOccurrence) =>
    [stream.gameName, stream.title].filter(Boolean).join(": ") || t("defaultTitle");

  return (
    <>
      <JsonLd
        data={streams.map((stream) =>
          streamEventSchema({
            name: `AboutSelphy – ${name(stream)}`,
            description: stream.note || t("metaDescription"),
            start: stream.start,
            end: stream.end,
            cancelled: stream.cancelled,
            twitchUrl: CHANNELS.twitch,
            image: `${base}${PROFILE_IMAGES.banner.src}`,
            siteUrl: base,
          }),
        )}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-gutter pt-fluid pb-section">
        <header className="flex flex-col gap-3">
          <h1 className="text-fluid-4xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="max-w-prose text-fluid-lg text-muted-foreground">
            {t("intro", { zone: locale === "de" ? "MEZ/MESZ" : "CET/CEST" })}
          </p>
        </header>

        {streams.length === 0 ? (
          <section className="flex flex-col items-start gap-4 rounded-2xl border bg-background/60 p-fluid">
            <p className="text-fluid-lg font-semibold">{t("empty")}</p>
            <p className="text-muted-foreground">{t("followHint")}</p>
            <a href={CHANNELS.twitch} className={buttonVariants({ size: "lg" })}>
              {t("followOnTwitch")}
            </a>
          </section>
        ) : (
          <ol className="flex flex-col gap-8">
            {groupByDate(streams).map((day) => (
              <li key={day[0].key} className="flex flex-col gap-3">
                <h2 className="text-fluid-lg font-bold">{dayLabel(day[0].start)}</h2>
                <ul className="flex flex-col divide-y rounded-xl border bg-background/60">
                  {day.map((stream) => {
                    const running = !stream.cancelled && stream.start <= now && now < stream.end;
                    return (
                      <li
                        key={stream.key}
                        className={cn(
                          "flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-6",
                          running && "border-l-4 border-l-red-500",
                        )}
                      >
                        <p
                          className={cn(
                            "shrink-0 font-semibold tabular-nums sm:w-32",
                            stream.cancelled && "text-muted-foreground line-through",
                          )}
                        >
                          <time dateTime={stream.start.toISOString()}>{time(stream.start)}</time>
                          {"–"}
                          <time dateTime={stream.end.toISOString()}>{time(stream.end)}</time>
                        </p>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <p className={cn(stream.cancelled && "text-muted-foreground line-through")}>
                            {stream.gameName && (
                              <span className="font-semibold">{stream.gameName}</span>
                            )}
                            {stream.gameName && stream.title && " – "}
                            {stream.title || (!stream.gameName && t("defaultTitle"))}
                          </p>
                          {stream.note && (
                            <p className="text-sm text-muted-foreground">{stream.note}</p>
                          )}
                        </div>
                        {(running || stream.cancelled || stream.extra) && (
                          <p
                            className={cn(
                              "shrink-0 text-sm font-medium",
                              running && "text-red-600 dark:text-red-400",
                              stream.cancelled && "text-destructive",
                              stream.extra && !stream.cancelled && "text-brand-text",
                            )}
                          >
                            {running ? t("inProgress") : stream.cancelled ? t("cancelled") : t("extra")}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </main>
    </>
  );
}
