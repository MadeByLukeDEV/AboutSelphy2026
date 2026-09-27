import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { siteUrl } from "@/lib/env";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getProfileForEdit } from "@/modules/profile/admin-service";
import { ProfileForm } from "@/modules/profile/components/profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("about") };
}

// Moderators can open the page but not edit (the profile is the owner's);
// saveProfileAction enforces the same rule server-side.
export default async function AdminAboutPage() {
  const session = await requireStaffPage("/admin/about");
  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-fluid-3xl font-extrabold tracking-tight">
            {t("nav.about")}
          </h1>
          <p className="max-w-prose text-muted-foreground">{t("about.intro")}</p>
        </div>
        <a
          href={siteUrl()}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("about.viewPage")}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </header>

      {isAdmin(session.user.role) ? (
        <ProfileForm initial={await getProfileForEdit()} />
      ) : (
        <p className="max-w-prose rounded-xl border bg-background p-4">
          {t("about.adminOnly")}
        </p>
      )}
    </div>
  );
}
