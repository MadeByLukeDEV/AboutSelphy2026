import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getPackagesForEdit, getPartnersForEdit } from "@/modules/mediakit/admin-service";
import { PackagesManager } from "@/modules/mediakit/components/packages-manager";
import { PartnersManager } from "@/modules/mediakit/components/partners-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("partners") };
}

// Admin-only editing (the mediakit actions enforce the same rule).
export default async function AdminPartnersPage() {
  const session = await requireStaffPage("/admin/partners");
  const t = await getTranslations("Admin");

  if (!isAdmin(session.user.role)) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-fluid-3xl font-extrabold tracking-tight">{t("nav.partners")}</h1>
        <p className="max-w-prose rounded-xl border bg-background p-4">{t("partners.adminOnly")}</p>
      </div>
    );
  }

  const [partners, packages] = await Promise.all([getPartnersForEdit(), getPackagesForEdit()]);
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-fluid-3xl font-extrabold tracking-tight">{t("nav.partners")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("partners.intro")}</p>
      </header>
      <section aria-labelledby="partners-heading" className="flex flex-col gap-4">
        <h2 id="partners-heading" className="text-fluid-xl font-bold">{t("partners.heading")}</h2>
        <PartnersManager initial={partners} />
      </section>
      <section aria-labelledby="packages-heading" className="flex flex-col gap-4">
        <h2 id="packages-heading" className="text-fluid-xl font-bold">{t("packages.heading")}</h2>
        <PackagesManager initial={packages} />
      </section>
    </div>
  );
}
