import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getGamesForEdit } from "@/modules/profile/admin-service";
import { GamesManager } from "@/modules/profile/components/games-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("games") };
}

// Admin-only editing (the game actions enforce the same rule server-side).
export default async function AdminGamesPage() {
  const session = await requireStaffPage("/admin/games");
  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-fluid-3xl font-extrabold tracking-tight">{t("nav.games")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("games.intro")}</p>
      </header>
      {isAdmin(session.user.role) ? (
        <div data-tour="games-manager">
          <GamesManager initial={await getGamesForEdit()} />
        </div>
      ) : (
        <p className="max-w-prose rounded-xl border bg-background p-4">{t("games.adminOnly")}</p>
      )}
    </div>
  );
}
