import "server-only";
import { prisma } from "@/lib/prisma";
import type { PackageInput, PartnerInput } from "./schema";

// Prisma-only and private to the mediakit module.

const order = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];

// ─── partners ────────────────────────────────────────────────────────────

export function findPartners(onlyVisible = false) {
  return prisma.partner.findMany({ where: onlyVisible ? { visible: true } : {}, orderBy: order });
}

export function findPartner(id: string) {
  return prisma.partner.findUnique({ where: { id } });
}

export async function createPartner(data: PartnerInput) {
  const last = await prisma.partner.aggregate({ _max: { sortOrder: true } });
  return prisma.partner.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
}

export function updatePartner(id: string, data: PartnerInput) {
  return prisma.partner.update({ where: { id }, data });
}

export function deletePartner(id: string) {
  return prisma.partner.delete({ where: { id } });
}

export function setPartnerLogo(id: string, logoId: string | null) {
  return prisma.partner.update({ where: { id }, data: { logoId } });
}

/** Moves one partner up/down and rewrites a clean 0..n order. */
export async function movePartner(id: string, direction: "up" | "down") {
  const ids = (await prisma.partner.findMany({ orderBy: order, select: { id: true } })).map((p) => p.id);
  const next = swap(ids, id, direction);
  if (next) {
    await prisma.$transaction(
      next.map((pid, index) => prisma.partner.update({ where: { id: pid }, data: { sortOrder: index } })),
    );
  }
}

// ─── packages ────────────────────────────────────────────────────────────

export function findPackages(onlyVisible = false) {
  return prisma.package.findMany({ where: onlyVisible ? { visible: true } : {}, orderBy: order });
}

export async function createPackage(data: PackageInput) {
  const last = await prisma.package.aggregate({ _max: { sortOrder: true } });
  return prisma.package.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
}

export function updatePackage(id: string, data: PackageInput) {
  return prisma.package.update({ where: { id }, data });
}

export function deletePackage(id: string) {
  return prisma.package.delete({ where: { id } });
}

export async function movePackage(id: string, direction: "up" | "down") {
  const ids = (await prisma.package.findMany({ orderBy: order, select: { id: true } })).map((p) => p.id);
  const next = swap(ids, id, direction);
  if (next) {
    await prisma.$transaction(
      next.map((pid, index) => prisma.package.update({ where: { id: pid }, data: { sortOrder: index } })),
    );
  }
}

function swap(ids: string[], id: string, direction: "up" | "down") {
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
