import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { getScheduleForEdit } from "@/modules/schedule/admin-service";
import { ScheduleManager } from "@/modules/schedule/components/schedule-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("schedule") };
}

// Staff (admins and moderators) can edit the schedule; the actions enforce
// the same rule server-side.
export default async function AdminSchedulePage() {
  await requireStaffPage("/admin/schedule");
  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-fluid-3xl font-extrabold tracking-tight">{t("nav.schedule")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("schedule.intro")}</p>
      </header>
      <ScheduleManager initial={await getScheduleForEdit()} />
    </div>
  );
}
