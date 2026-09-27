import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import type { HomeContent } from "../service";

// One row per game, not a card grid. The main game gets the only brand
// accent (a left rule); former games are muted.
export async function GamesList({ games }: { games: HomeContent["games"] }) {
  const t = await getTranslations("Home");
  if (games.length === 0) return null;

  return (
    <section aria-labelledby="games-heading" className="flex flex-col gap-5">
      <h2 id="games-heading" className="text-fluid-2xl font-bold tracking-tight">
        {t("gamesHeading")}
      </h2>
      <ul className="flex flex-col divide-y border-y">
        {games.map((game) => (
          <li
            key={game.slug}
            className={cn(
              "flex flex-col gap-2 py-5",
              game.status === "main" && "border-l-4 border-l-primary pl-4",
              game.status === "former" && "text-muted-foreground",
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3
                className={cn(
                  "font-bold",
                  game.status === "main" ? "text-fluid-xl" : "text-fluid-lg",
                )}
              >
                {game.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(`gameStatus.${game.status}`)}
              </p>
            </div>
            <p className="max-w-prose">{game.blurb}</p>
            {game.tags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label={game.name}>
                {game.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-md border px-2 py-0.5 text-xs font-medium"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
