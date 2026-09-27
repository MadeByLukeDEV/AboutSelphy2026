import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHANNELS } from "../links";

// Name, tagline and channel links. The avatar is a monogram until one is
// uploaded in /admin (next step). Readable without JS: no client code here.
export async function HomeHero({
  displayName,
  tagline,
}: {
  displayName: string;
  tagline: string;
}) {
  const t = await getTranslations("Home");

  return (
    <section className="flex flex-col gap-8 sm:flex-row sm:items-end sm:gap-10">
      <div
        role="img"
        aria-label={t("avatarAlt", { name: displayName })}
        className="flex size-[clamp(6rem,18vw,9rem)] shrink-0 items-center justify-center rounded-full bg-primary text-[clamp(2rem,6vw,3rem)] font-extrabold tracking-tight text-primary-foreground ring-4 ring-background"
      >
        AS
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-3">
          <h1 className="text-fluid-5xl font-extrabold tracking-[-0.04em] break-words">
            {displayName}
          </h1>
          {tagline && (
            <p className="max-w-[40ch] text-fluid-lg text-muted-foreground">
              {tagline}
            </p>
          )}
        </div>

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
