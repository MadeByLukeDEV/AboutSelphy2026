import "server-only";
import { prisma } from "@/lib/prisma";
import type { LegalInput } from "./schema";

// Prisma-only and private to the legal module. One row, id = 1.

export function findLegal() {
  return prisma.legalSettings.findUnique({ where: { id: 1 } });
}

export function upsertLegal(data: LegalInput) {
  return prisma.legalSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
}
