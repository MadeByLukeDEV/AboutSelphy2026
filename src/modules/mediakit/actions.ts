"use server";

import { z } from "zod";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { UploadError } from "@/modules/assets";
import {
  addPackage,
  addPartner,
  editPackage,
  editPartner,
  removeLogo,
  removePackage,
  removePartner,
  reorderPackage,
  reorderPartner,
  uploadLogo,
  type AdminPackage,
  type AdminPartner,
} from "./admin-service";
import { packageInputSchema, partnerInputSchema } from "./schema";
import { errorInfo } from "@/lib/log";

// Server Actions are public POST endpoints: every one checks the admin role
// first, then validates its own arguments. Errors are codes only.

type ErrorCode = "forbidden" | "invalid" | "failed" | "noFile" | "tooLarge" | "notAnImage";
export type PartnersResult = { ok: true; partners: AdminPartner[] } | { ok: false; error: ErrorCode };
export type PackagesResult = { ok: true; packages: AdminPackage[] } | { ok: false; error: ErrorCode };

const idSchema = z.string().min(1).max(40);
const directionSchema = z.enum(["up", "down"]);

async function asAdmin<T>(
  change: () => { ok: false; error: "invalid" } | (() => Promise<T>),
): Promise<{ ok: true; value: T } | { ok: false; error: ErrorCode }> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const run = change();
  if (typeof run !== "function") return run;
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof UploadError) return { ok: false, error: error.code };
    console.error("[mediakit] admin change failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

const invalid = { ok: false, error: "invalid" } as const;

async function partners(change: Parameters<typeof asAdmin<AdminPartner[]>>[0]): Promise<PartnersResult> {
  const result = await asAdmin(change);
  return result.ok ? { ok: true, partners: result.value } : result;
}

async function packages(change: Parameters<typeof asAdmin<AdminPackage[]>>[0]): Promise<PackagesResult> {
  const result = await asAdmin(change);
  return result.ok ? { ok: true, packages: result.value } : result;
}

// ─── partners ────────────────────────────────────────────────────────────

export async function addPartnerAction(input: unknown) {
  return partners(() => {
    const parsed = partnerInputSchema.safeParse(input);
    return parsed.success ? () => addPartner(parsed.data) : invalid;
  });
}

export async function editPartnerAction(id: unknown, input: unknown) {
  return partners(() => {
    const pid = idSchema.safeParse(id);
    const parsed = partnerInputSchema.safeParse(input);
    return pid.success && parsed.success ? () => editPartner(pid.data, parsed.data) : invalid;
  });
}

export async function deletePartnerAction(id: unknown) {
  return partners(() => {
    const pid = idSchema.safeParse(id);
    return pid.success ? () => removePartner(pid.data) : invalid;
  });
}

export async function movePartnerAction(id: unknown, direction: unknown) {
  return partners(() => {
    const pid = idSchema.safeParse(id);
    const dir = directionSchema.safeParse(direction);
    return pid.success && dir.success ? () => reorderPartner(pid.data, dir.data) : invalid;
  });
}

export async function uploadPartnerLogoAction(formData: unknown) {
  return partners(() => {
    if (!(formData instanceof FormData)) return invalid;
    const pid = idSchema.safeParse(formData.get("partnerId"));
    // The file itself is checked by storeImage (size, real format, re-encode).
    return pid.success ? () => uploadLogo(pid.data, formData.get("file")) : invalid;
  });
}

export async function removePartnerLogoAction(id: unknown) {
  return partners(() => {
    const pid = idSchema.safeParse(id);
    return pid.success ? () => removeLogo(pid.data) : invalid;
  });
}

// ─── packages ────────────────────────────────────────────────────────────

export async function addPackageAction(input: unknown) {
  return packages(() => {
    const parsed = packageInputSchema.safeParse(input);
    return parsed.success ? () => addPackage(parsed.data) : invalid;
  });
}

export async function editPackageAction(id: unknown, input: unknown) {
  return packages(() => {
    const pid = idSchema.safeParse(id);
    const parsed = packageInputSchema.safeParse(input);
    return pid.success && parsed.success ? () => editPackage(pid.data, parsed.data) : invalid;
  });
}

export async function deletePackageAction(id: unknown) {
  return packages(() => {
    const pid = idSchema.safeParse(id);
    return pid.success ? () => removePackage(pid.data) : invalid;
  });
}

export async function movePackageAction(id: unknown, direction: unknown) {
  return packages(() => {
    const pid = idSchema.safeParse(id);
    const dir = directionSchema.safeParse(direction);
    return pid.success && dir.success ? () => reorderPackage(pid.data, dir.data) : invalid;
  });
}
