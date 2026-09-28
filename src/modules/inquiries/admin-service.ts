import "server-only";
import type { InquiryStatus } from "@/generated/prisma/client";
import * as repo from "./repository";

// Staff reads and writes (uncached: the inbox must be current). Callers
// check authorization first (actions.ts / the admin page).

export type AdminInquiries = Awaited<ReturnType<typeof getInquiriesForAdmin>>;

export async function getInquiriesForAdmin() {
  const [inquiries, counts] = await Promise.all([
    repo.findInquiries(null),
    repo.countByStatus(),
  ]);
  return {
    inquiries: inquiries.map((inquiry) => ({
      id: inquiry.id,
      company: inquiry.company,
      contactName: inquiry.contactName,
      email: inquiry.email,
      budget: inquiry.budget,
      message: inquiry.message,
      locale: inquiry.locale,
      status: inquiry.status,
      createdAt: inquiry.createdAt.toISOString(),
    })),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Partial<
      Record<InquiryStatus, number>
    >,
  };
}

export async function setInquiryStatus(id: string, status: InquiryStatus) {
  await repo.updateInquiryStatus(id, status);
  return getInquiriesForAdmin();
}

export async function removeInquiry(id: string) {
  await repo.deleteInquiry(id);
  return getInquiriesForAdmin();
}

/** Retention (GDPR): done/spam inquiries untouched for 12 months are deleted. */
export async function purgeOldInquiries(): Promise<string> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  const { count } = await repo.deleteOldClosed(cutoff);
  return count ? `inquiries: ${count} old closed deleted` : "inquiries: nothing to purge";
}
