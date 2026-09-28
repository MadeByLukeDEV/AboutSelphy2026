import "server-only";
import { revalidateTag } from "next/cache";
import { assetUrl, deleteAsset, LOGO_PRESET, storeImage } from "@/modules/assets";
import * as repo from "./repository";
import type { PackageInput, PartnerInput } from "./schema";
import { MEDIAKIT_CACHE_TAG } from "./cache";

// Admin side of partners and packages. Callers (actions.ts) check the admin
// role and validate the input first. Every change clears the media kit
// cache and returns the fresh list for the client's state.

export type AdminPartner = PartnerInput & { id: string; logoUrl: string | null };
export type AdminPackage = PackageInput & { id: string };

function changed() {
  revalidateTag(MEDIAKIT_CACHE_TAG, { expire: 0 });
}

// ─── partners ────────────────────────────────────────────────────────────

export async function getPartnersForEdit(): Promise<AdminPartner[]> {
  return (await repo.findPartners()).map((p) => ({
    id: p.id,
    name: p.name,
    url: p.url,
    code: p.code,
    descriptionEn: p.descriptionEn,
    descriptionDe: p.descriptionDe,
    visible: p.visible,
    logoUrl: p.logoId ? assetUrl(p.logoId) : null,
  }));
}

async function partnersChanged() {
  changed();
  return getPartnersForEdit();
}

export async function addPartner(input: PartnerInput) {
  await repo.createPartner(input);
  return partnersChanged();
}

export async function editPartner(id: string, input: PartnerInput) {
  await repo.updatePartner(id, input);
  return partnersChanged();
}

export async function removePartner(id: string) {
  const partner = await repo.findPartner(id);
  if (partner) {
    await repo.deletePartner(id);
    if (partner.logoId) await deleteAsset(partner.logoId);
  }
  return partnersChanged();
}

export async function reorderPartner(id: string, direction: "up" | "down") {
  await repo.movePartner(id, direction);
  return partnersChanged();
}

/** Stores a new logo (validated + re-encoded) and drops the old one. */
export async function uploadLogo(id: string, file: unknown) {
  const partner = await repo.findPartner(id);
  if (!partner) throw new Error("partner not found");
  const asset = await storeImage(file, LOGO_PRESET);
  try {
    await repo.setPartnerLogo(id, asset.id);
  } catch (error) {
    // E.g. the partner was deleted meanwhile: don't leave the image behind.
    await deleteAsset(asset.id);
    throw error;
  }
  if (partner.logoId) await deleteAsset(partner.logoId);
  return partnersChanged();
}

export async function removeLogo(id: string) {
  const partner = await repo.findPartner(id);
  if (partner?.logoId) {
    await repo.setPartnerLogo(id, null);
    await deleteAsset(partner.logoId);
  }
  return partnersChanged();
}

// ─── packages ────────────────────────────────────────────────────────────

export async function getPackagesForEdit(): Promise<AdminPackage[]> {
  return (await repo.findPackages()).map((p) => ({
    id: p.id,
    titleEn: p.titleEn,
    titleDe: p.titleDe,
    descriptionEn: p.descriptionEn,
    descriptionDe: p.descriptionDe,
    priceFrom: p.priceFrom,
    visible: p.visible,
  }));
}

async function packagesChanged() {
  changed();
  return getPackagesForEdit();
}

export async function addPackage(input: PackageInput) {
  await repo.createPackage(input);
  return packagesChanged();
}

export async function editPackage(id: string, input: PackageInput) {
  await repo.updatePackage(id, input);
  return packagesChanged();
}

export async function removePackage(id: string) {
  await repo.deletePackage(id);
  return packagesChanged();
}

export async function reorderPackage(id: string, direction: "up" | "down") {
  await repo.movePackage(id, direction);
  return packagesChanged();
}
