import { getFormatter, getLocale } from "next-intl/server";
import { audienceLabeller, shareText } from "../demographic-labels";
import type { Locale } from "@/modules/i18n";
import type { Audience, AudienceShare } from "../service";

// YouTube audience shares as four bar lists (age, gender, top countries,
// devices). One series per list, so one hue (--chart-line, validated for
// both themes) and no legend: the list title names it. Every bar sits in a
// row with its label and value as text, which doubles as the table view.
// Bars scale to the list's largest share, from a zero baseline.

type Row = { key: string; label: string; share: number };

async function BarList({
  title,
  rows,
  headingLevel,
}: {
  title: string;
  rows: Row[];
  headingLevel: "h3" | "h4";
}) {
  const Heading = headingLevel;
  const format = await getFormatter();
  const max = Math.max(...rows.map((r) => r.share));
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-background/60 p-5">
      <Heading className="font-bold">{title}</Heading>
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {shareText(format, row.share)}
              </span>
            </div>
            <div aria-hidden className="h-1.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-chart-line"
                style={{ width: `${max > 0 ? (row.share / max) * 100 : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function Demographics({
  audience,
  headingLevel = "h2",
  showIntro = true,
}: {
  audience: Audience;
  headingLevel?: "h2" | "h3";
  showIntro?: boolean;
}) {
  const { t, label } = await audienceLabeller((await getLocale()) as Locale);
  const format = await getFormatter();
  const lists = (["age", "gender", "country", "device"] as const)
    .map((dimension) => ({
      dimension,
      rows: audience[dimension].map((s: AudienceShare) => ({
        key: s.key,
        label: label[dimension](s.key),
        share: s.share,
      })),
    }))
    .filter((list) => list.rows.length > 0);
  if (lists.length === 0) return null;

  const Heading = headingLevel;
  const day = (date: Date) => format.dateTime(date, { dateStyle: "medium", timeZone: "UTC" });

  return (
    <section aria-labelledby="demographics-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading
          id="demographics-heading"
          className={headingLevel === "h2" ? "text-fluid-2xl font-bold tracking-tight" : "text-lg font-bold"}
        >
          {t("heading")}
        </Heading>
        {showIntro && <p className="max-w-prose text-muted-foreground">{t("intro")}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {lists.map((list) => (
          <BarList
            key={list.dimension}
            title={t(list.dimension)}
            rows={list.rows}
            headingLevel={headingLevel === "h2" ? "h3" : "h4"}
          />
        ))}
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        {t("period", { start: day(audience.periodStart), end: day(audience.periodEnd) })}{" "}
        {t("asOf", { date: format.dateTime(audience.capturedAt, { dateStyle: "medium" }) })}
      </p>
    </section>
  );
}
