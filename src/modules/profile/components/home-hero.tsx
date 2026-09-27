import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHANNELS } from "../links";
import { PROFILE_IMAGES } from "../images";

// Channel-page layout (banner, avatar overlapping its lower edge, name,
// tagline, channel links) -- the format streamer profiles are known by.
// Server-rendered, readable without JS. The banner is the LCP element, so
// it's preloaded.
export async function HomeHero({
  displayName,
  tagline,
}: {
  displayName: string;
  tagline: string;
}) {
  const t = await getTranslations("Home");
  const { avatar, banner } = PROFILE_IMAGES;

  return (
    <section className="flex flex-col">
      <div className="relative aspect-[16/7] max-h-[22rem] w-full overflow-hidden rounded-2xl bg-muted sm:aspect-[1640/664]">
        {/* Decorative: the avatar below carries the alt text. */}
        <Image
          src={banner.src}
          alt=""
          fill
          preload
          sizes="(min-width: 72rem) 72rem, 100vw"
          className="object-cover object-[50%_30%]"
        />
      </div>

      <div className="flex flex-col gap-5 px-2 sm:flex-row sm:items-end sm:gap-8 sm:px-6">
        <Image
          src={avatar.src}
          alt={t("avatarAlt", { name: displayName })}
          width={avatar.width}
          height={avatar.height}
          sizes="(min-width: 40rem) 9rem, 6.5rem"
          className="relative z-10 -mt-[3.25rem] size-[6.5rem] shrink-0 rounded-full object-cover ring-4 ring-background sm:-mt-[4.5rem] sm:size-36"
        />

        <div className="flex min-w-0 flex-col gap-3 sm:pb-1">
          <h1 className="text-fluid-5xl font-extrabold tracking-[-0.04em] break-words">
            {displayName}
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-2 pt-4 sm:px-6">
        {tagline && (
          <p className="max-w-[48ch] text-fluid-lg text-muted-foreground">
            {tagline}
          </p>
        )}

        <nav aria-label={t("links.label")} className="flex flex-wrap gap-2">
          <a
            href={CHANNELS.twitch}
            rel="me"
            className={cn(buttonVariants({ size: "lg" }), "font-semibold")}
          >
            {t("links.twitch")}
          </a>
          <a
            href={CHANNELS.youtube}
            rel="me"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {t("links.youtube")}
          </a>
          <a
            href={CHANNELS.linkTree}
            rel="me"
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            {t("links.linkTree")}
          </a>
        </nav>
      </div>
    </section>
  );
}
