import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { getInquiriesForAdmin } from "@/modules/inquiries";
import { InquiriesManager } from "@/modules/inquiries/components/inquiries-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("inquiries") };
}

// Staff inbox for sponsor inquiries (personal data: staff only).
export default async function AdminInquiriesPage() {
  await requireStaffPage("/admin/inquiries");
  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-fluid-3xl font-extrabold tracking-tight">{t("nav.inquiries")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("inquiries.intro")}</p>
      </header>
      <InquiriesManager initial={await getInquiriesForAdmin()} />
    </div>
  );
}
