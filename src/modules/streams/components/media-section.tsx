import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { MediaEntry } from "@/modules/stats";
import { cn } from "@/lib/utils";
import { MediaCard } from "./media-card";

// A titled grid of media cards with a "more on <platform>" link.
export async function MediaSection({
  id,
  title,
  headingLevel = 2,
  note,
  items,
  parentHost,
  moreHref,
  platform,
  vertical = false,
}: {
  id: string;
  title: string;
  headingLevel?: 2 | 3;
  note?: ReactNode;
  items: MediaEntry[];
  parentHost: string;
  moreHref: string;
  platform: "Twitch" | "YouTube";
  vertical?: boolean;
}) {
  const t = await getTranslations("Streams");
  if (items.length === 0) return null;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="flex flex-col gap-1">
          <Heading
            id={id}
            className={cn(
              "font-bold tracking-tight",
              headingLevel === 2 ? "text-fluid-2xl" : "text-fluid-lg",
            )}
          >
            {title}
          </Heading>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
        </div>
        <a
          href={moreHref}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("moreOn", { platform })}
        </a>
      </div>
      <div
        className={cn(
          "grid gap-x-5 gap-y-7",
          vertical
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            : "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {items.map((item) => (
          <MediaCard
            key={item.externalId}
            item={item}
            parentHost={parentHost}
            sizes={
              vertical
                ? "(min-width: 64rem) 16rem, (min-width: 40rem) 33vw, 50vw"
                : "(min-width: 64rem) 24rem, (min-width: 40rem) 50vw, 100vw"
            }
          />
        ))}
      </div>
    </section>
  );
}
