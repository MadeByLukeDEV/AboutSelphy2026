import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { siteUrl } from "@/lib/env";
import { localeAlternates, type Locale } from "@/modules/i18n";
import { getHomeContent, CHANNELS, PROFILE_IMAGES } from "@/modules/profile";
import { HomeHero } from "@/modules/profile/components/home-hero";
import { AboutSection } from "@/modules/profile/components/about-section";
import { GamesList } from "@/modules/profile/components/games-list";
import {
  JsonLd,
  personSchema,
  profilePageSchema,
  websiteSchema,
} from "@/modules/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates(locale as Locale, "/") };
}

// Home = who AboutSelphy is: hero, bio and the games. Content comes from the
// DB (profile module, cached) and is edited in /admin.
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const content = await getHomeContent(locale);
  const base = siteUrl();
  const url = `${base}/${locale}`;

  return (
    <>
      <JsonLd
        data={[
          websiteSchema({ siteUrl: base, name: "AboutSelphy", locale }),
          personSchema({
            siteUrl: base,
            name: content.displayName,
            description: content.tagline,
            sameAs: Object.values(CHANNELS),
            image: `${base}${PROFILE_IMAGES.avatar.src}`,
            knowsAbout: content.games
              .filter((game) => game.status !== "former")
              .map((game) => game.name),
          }),
          profilePageSchema({
            siteUrl: base,
            url,
            locale,
            dateModified: content.updatedAt,
          }),
        ]}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-section px-gutter pt-fluid pb-section">
        <HomeHero displayName={content.displayName} tagline={content.tagline} />
        <div className="grid gap-section lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <AboutSection bio={content.bio} />
          <GamesList games={content.games} />
        </div>
      </main>
    </>
  );
}
