import { getTranslations } from "next-intl/server";
import { GameCover } from "@/modules/profile";
import type { MediaKit } from "../service";

// What the audience comes for, compact: sponsors check the fit at a glance.
// The full descriptions live on the home page.
export async function MediaKitGames({ games }: { games: MediaKit["games"] }) {
  const t = await getTranslations("MediaKit");
  const status = await getTranslations("Home.gameStatus");
  if (games.length === 0) return null;

  return (
    <section aria-labelledby="games-heading" className="flex flex-col gap-5">
      <h2 id="games-heading" className="text-fluid-2xl font-bold tracking-tight">
        {t("gamesHeading")}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {games.map((game) => (
          <li key={game.slug} className="flex items-center gap-3">
            <GameCover name={game.name} src={game.coverUrl} className="w-12" sizes="3rem" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{game.name}</span>
              <span className="text-sm text-muted-foreground">{status(game.status)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
