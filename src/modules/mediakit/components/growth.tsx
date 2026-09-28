import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { GrowthSeries } from "@/modules/stats";
import { MIN_GROWTH_DAYS } from "../service";
import { GrowthChart } from "./growth-chart";

// One small chart per metric (never two scales on one chart). A series only
// appears once it has MIN_GROWTH_DAYS daily points; with none ready the
// whole section is left out rather than showing a flat stub.
export async function GrowthSection({ growth }: { growth: GrowthSeries }) {
  const t = await getTranslations("MediaKit.growth");
  const format = await getFormatter();
  const locale = await getLocale();

  const charts = [
    { key: "twitch/followers" as const, label: t("twitchFollowers") },
    { key: "youtube/subscribers" as const, label: t("youtubeSubscribers") },
  ].filter((chart) => growth[chart.key].length >= MIN_GROWTH_DAYS);
  if (charts.length === 0) return null;

  return (
    <section aria-labelledby="growth-heading" className="flex flex-col gap-5">
      <h2 id="growth-heading" className="text-fluid-2xl font-bold tracking-tight">
        {t("heading")}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {charts.map(({ key, label }) => {
          const points = growth[key];
          const first = points[0];
          const last = points[points.length - 1];
          const change = last.value - first.value;
          return (
            <section
              key={key}
              aria-label={label}
              className="reveal flex flex-col gap-3 rounded-2xl border bg-background/60 p-fluid"
            >
              <div className="flex flex-col gap-0.5">
                <h3 className="font-semibold">{label}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("change", {
                    change: format.number(change, { signDisplay: "exceptZero" }),
                    date: format.dateTime(new Date(`${first.day}T12:00:00Z`), {
                      day: "numeric",
                      month: "long",
                    }),
                  })}
                </p>
              </div>
              <GrowthChart
                points={points}
                locale={locale}
                label={label}
                tableLabel={t("showTable")}
                dateLabel={t("date")}
              />
            </section>
          );
        })}
      </div>
    </section>
  );
}
