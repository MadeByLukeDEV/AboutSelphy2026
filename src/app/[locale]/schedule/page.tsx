import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/page-transition";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { siteUrl } from "@/lib/env";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { localeAlternates, type Locale } from "@/modules/i18n";
import { CHANNELS, GameCover, PROFILE_IMAGES } from "@/modules/profile";
import { getUpcomingStreams, type StreamOccurrence } from "@/modules/schedule";
import { StreamTime } from "@/modules/schedule/components/stream-time";
import { WithMentions } from "@/modules/schedule/components/with-mentions";
import { CategoryChip } from "@/modules/schedule/components/category-chip";
import { JsonLd, streamEventSchema, PageBreadcrumbs } from "@/modules/seo";

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

// The next 7 days, from the weekly plan + changes (schedule module). Day
// headings are Vienna dates (next-intl's timeZone); the times themselves
// switch to the visitor's own zone in the browser (StreamTime).
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
      <PageTransition>
        <PageBreadcrumbs locale={locale} path="/schedule" name={t("title")} />
        <main data-enter className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-gutter pt-fluid pb-section">
          <header className="flex flex-col gap-3">
            <h1 className="text-fluid-4xl font-extrabold tracking-tight">{t("title")}</h1>
            <p className="max-w-prose text-fluid-lg text-muted-foreground">
              {t("intro")}
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
                <li key={day[0].key} className="reveal flex flex-col gap-3">
                  <h2 className="text-fluid-lg font-bold">{dayLabel(day[0].start)}</h2>
                  <ul className="flex flex-col divide-y rounded-xl border bg-background/60">
                    {day.map((stream) => {
                      const running = !stream.cancelled && stream.start <= now && now < stream.end;
                      return (
                        <li
                          key={stream.key}
                          className={cn(
                            "flex items-start gap-4 px-4 py-3",
                            running && "border-l-4 border-l-red-500",
                          )}
                        >
                          <GameCover
                            name={stream.gameName ?? stream.title ?? ""}
                            src={stream.gameCoverUrl}
                            muted={stream.cancelled}
                            className="w-12"
                            sizes="3rem"
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
                            <p
                              className={cn(
                                "shrink-0 font-semibold tabular-nums sm:w-44",
                                stream.cancelled && "text-muted-foreground line-through",
                              )}
                            >
                              <StreamTime start={stream.start.toISOString()} end={stream.end.toISOString()} locale={locale} />
                            </p>
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <p className={cn(stream.cancelled && "text-muted-foreground line-through")}>
                                {stream.gameName && (
                                  <span className="font-semibold">{stream.gameName}</span>
                                )}
                                {stream.gameName && stream.title && " – "}
                                {stream.title ? <WithMentions text={stream.title} /> : !stream.gameName && t("defaultTitle")}
                              </p>
                              {stream.categories.length > 0 && (
                                <ul className="flex flex-wrap gap-1.5 pt-0.5" aria-label={t("categoriesLabel")}>
                                  {stream.categories.map((category) => (
                                    <li key={category.id}>
                                      <CategoryChip name={category.name} color={category.color} />
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {stream.note && (
                                <p className="text-sm text-muted-foreground">
                                  <WithMentions text={stream.note} />
                                </p>
                              )}
                            </div>
                            {/* Streams planned on a date are regular streams for
                                viewers: no "extra" label (the user's call). */}
                            {(running || stream.cancelled) && (
                              <p
                                className={cn(
                                  "shrink-0 text-sm font-medium",
                                  running && "text-red-600 dark:text-red-400",
                                  stream.cancelled && "text-destructive",
                                )}
                              >
                                {running ? t("inProgress") : t("cancelled")}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </main>
      </PageTransition>
    </>
  );
}
