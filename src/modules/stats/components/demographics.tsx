import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { Audience, AudienceShare } from "../service";

// YouTube audience shares as four bar lists (age, gender, top countries,
// devices). One series per list, so one hue (--chart-line, validated for
// both themes) and no legend: the list title names it. Every bar sits in a
// row with its label and value as text, which doubles as the table view.
// Bars scale to the list's largest share, from a zero baseline.

const DEVICES = ["MOBILE", "DESKTOP", "TABLET", "TV", "GAME_CONSOLE", "UNKNOWN_PLATFORM"] as const;
const GENDERS = ["female", "male", "user_specified"] as const;

type Row = { key: string; label: string; share: number };

async function labeller() {
  const t = await getTranslations("Demographics");
  const regions = new Intl.DisplayNames([await getLocale()], { type: "region" });
  return {
    age(key: string) {
      const [from, to] = key.split("-");
      return to ? t("ageGroup", { from, to }) : t("ageOpen", { from });
    },
    gender(key: string) {
      return (GENDERS as readonly string[]).includes(key)
        ? t(`genders.${key as (typeof GENDERS)[number]}`)
        : key;
    },
    country(key: string) {
      if (key === "other") return t("otherCountries");
      try {
        return regions.of(key) ?? key;
      } catch {
        return key;
      }
    },
    device(key: string) {
      return (DEVICES as readonly string[]).includes(key)
        ? t(`devices.${key as (typeof DEVICES)[number]}`)
        : key;
    },
  };
}

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
                {row.share > 0 && row.share < 1
                  ? `<${format.number(0.01, { style: "percent" })}`
                  : format.number(row.share / 100, {
                      style: "percent",
                      maximumFractionDigits: row.share < 10 ? 1 : 0,
                    })}
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
  const t = await getTranslations("Demographics");
  const format = await getFormatter();
  const label = await labeller();
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
