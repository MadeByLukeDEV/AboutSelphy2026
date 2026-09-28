import "server-only";
import type { InquiryBudget, InquiryStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Prisma-only and private to the inquiries module.

export function createInquiry(data: {
  company: string;
  contactName: string;
  email: string;
  budget: InquiryBudget;
  message: string;
  locale: string;
}) {
  return prisma.inquiry.create({ data, select: { id: true } });
}

export function findInquiries(status: InquiryStatus | null) {
  return prisma.inquiry.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function countByStatus() {
  return prisma.inquiry.groupBy({ by: ["status"], _count: true });
}

export const updateInquiryStatus = (id: string, status: InquiryStatus) =>
  prisma.inquiry.update({ where: { id }, data: { status } });

export const deleteInquiry = (id: string) =>
  prisma.inquiry.delete({ where: { id } });

/** GDPR retention: remove done/spam inquiries last changed before `before`. */
export function deleteOldClosed(before: Date) {
  return prisma.inquiry.deleteMany({
    where: { status: { in: ["done", "spam"] }, updatedAt: { lt: before } },
  });
}
