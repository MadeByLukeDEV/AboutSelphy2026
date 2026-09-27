import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { ADMIN_SECTIONS } from "@/components/admin/admin-sections";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("overview") };
}

export default async function AdminOverviewPage() {
  const session = await requireStaffPage("/admin");
  const t = await getTranslations("Admin");
  const sections = ADMIN_SECTIONS.filter(
    (section): section is Exclude<
      (typeof ADMIN_SECTIONS)[number],
      { key: "overview" }
    > => section.key !== "overview",
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-fluid-3xl font-extrabold tracking-tight">
          {t("overview.greeting", { name: session.user.name })}
        </h1>
        <p className="max-w-prose text-muted-foreground">
          {t("overview.intro")}
        </p>
      </header>

      <section aria-labelledby="sections-heading" className="flex flex-col gap-3">
        <h2 id="sections-heading" className="text-lg font-bold">
          {t("overview.sectionsHeading")}
        </h2>
        <ul className="divide-y rounded-xl border bg-background">
          {sections.map(({ key, icon: Icon, built }) => (
            <li key={key} className="flex items-start gap-4 px-4 py-4">
              <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-semibold">{t(`nav.${key}`)}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(`overview.sections.${key}`)}
                  </p>
                </div>
                {!built && (
                  <p className="shrink-0 text-sm text-muted-foreground">
                    {t("notBuilt")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
