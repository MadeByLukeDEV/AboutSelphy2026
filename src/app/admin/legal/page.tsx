import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getLegalForEdit } from "@/modules/legal/admin-service";
import { LegalForm } from "@/modules/legal/components/legal-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("legal") };
}

// Admin-only editing (saveLegalAction enforces the same rule).
export default async function AdminLegalPage() {
  const session = await requireStaffPage("/admin/legal");
  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-fluid-3xl font-extrabold tracking-tight">{t("nav.legal")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("legal.intro")}</p>
      </header>
      {isAdmin(session.user.role) ? (
        <LegalForm initial={await getLegalForEdit()} />
      ) : (
        <p className="max-w-prose rounded-xl border bg-background p-4">{t("legal.adminOnly")}</p>
      )}
    </div>
  );
}
