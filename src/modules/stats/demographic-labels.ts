import "server-only";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/modules/i18n";

// Display labels for audience keys, shared by the media kit page
// (components/demographics.tsx) and the PDF, which renders outside a
// request locale and so passes `locale` explicitly.

const DEVICES = ["MOBILE", "DESKTOP", "TABLET", "TV", "GAME_CONSOLE", "UNKNOWN_PLATFORM"] as const;
const GENDERS = ["female", "male", "user_specified"] as const;

export type AudienceDimensionKey = "age" | "gender" | "country" | "device";

export async function audienceLabeller(locale: Locale) {
  const t = await getTranslations({ locale, namespace: "Demographics" });
  const regions = new Intl.DisplayNames([locale], { type: "region" });
  const labels: Record<AudienceDimensionKey, (key: string) => string> = {
    age(key) {
      // "25-34" -> "25–34", "65-" -> "65+"
      const [from, to] = key.split("-");
      return to ? t("ageGroup", { from, to }) : t("ageOpen", { from });
    },
    gender(key) {
      return (GENDERS as readonly string[]).includes(key)
        ? t(`genders.${key as (typeof GENDERS)[number]}`)
        : key;
    },
    country(key) {
      if (key === "other") return t("otherCountries");
      try {
        return regions.of(key) ?? key;
      } catch {
        return key;
      }
    },
    device(key) {
      return (DEVICES as readonly string[]).includes(key)
        ? t(`devices.${key as (typeof DEVICES)[number]}`)
        : key;
    },
  };
  return { t, label: labels };
}

type NumberFormatter = { number(value: number, options?: Intl.NumberFormatOptions): string };

/** "53%", "9.3%", "<1%": one decimal below 10 %, never a misleading 0 %. */
export function shareText(format: NumberFormatter, share: number) {
  if (share > 0 && share < 1) return `<${format.number(0.01, { style: "percent" })}`;
  return format.number(share / 100, {
    style: "percent",
    maximumFractionDigits: share < 10 ? 1 : 0,
  });
}
