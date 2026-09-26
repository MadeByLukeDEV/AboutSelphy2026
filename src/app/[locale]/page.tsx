import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ThemeToggle } from "@/modules/theme";
import { LocaleSwitcher, localeAlternates, type Locale } from "@/modules/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates(locale as Locale, "/") };
}

// Placeholder until the Home / About phase replaces it.
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Home");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-fluid px-gutter py-section text-center">
      <h1 className="text-fluid-5xl font-extrabold tracking-tight">
        About<span className="text-brand-text">Selphy</span>
      </h1>
      <p className="max-w-prose text-fluid-lg text-muted-foreground">
        {t("tagline")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </main>
  );
}
