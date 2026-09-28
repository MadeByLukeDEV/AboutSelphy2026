"use server";

import { headers } from "next/headers";
import { hasLocale } from "next-intl";
import { AuthorizationError, requireStaff } from "@/modules/auth";
import { routing } from "@/modules/i18n/routing";
import { z } from "zod";
import {
  getInquiriesForAdmin,
  removeInquiry,
  setInquiryStatus,
  type AdminInquiries,
} from "./admin-service";
import { createInquiry } from "./repository";
import { allowInquiry, clientIp } from "./rate-limit";
import { INQUIRY_STATUSES, inquiryInputSchema } from "./schema";
import { isTurnstileConfigured, verifyTurnstile } from "./turnstile";

export type SubmitInquiryResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid" | "rateLimited" | "captcha" | "unavailable" | "failed";
    };

// The public inquiry form's endpoint -- anyone can call it, so everything is
// checked here: honeypot, input, per-IP rate limit, Turnstile (action +
// hostname), then store. Errors are codes; nothing internal is returned.
export async function submitInquiryAction(
  input: unknown,
  turnstileToken: unknown,
  honeypot: unknown,
  locale: unknown,
): Promise<SubmitInquiryResult> {
  // Bots fill every field. Pretend success so they don't adapt.
  if (typeof honeypot === "string" && honeypot.trim() !== "") return { ok: true };

  if (!isTurnstileConfigured()) return { ok: false, error: "unavailable" };

  const parsed = inquiryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const ip = clientIp(await headers());
  if (!(await allowInquiry(ip))) return { ok: false, error: "rateLimited" };

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "captcha" };
  }

  try {
    await createInquiry({
      ...parsed.data,
      locale:
        typeof locale === "string" && hasLocale(routing.locales, locale) ? locale : "en",
    });
    return { ok: true };
  } catch (error) {
    console.error("[inquiries] storing an inquiry failed", error);
    return { ok: false, error: "failed" };
  }
}

// ─── admin (staff) ───────────────────────────────────────────────────────

export type InquiriesResult =
  | { ok: true; data: AdminInquiries }
  | { ok: false; error: "forbidden" | "invalid" | "failed" };

const idSchema = z.string().min(1).max(40);

async function asStaff(
  change: () => { ok: false; error: "invalid" } | (() => Promise<AdminInquiries>),
): Promise<InquiriesResult> {
  try {
    await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const run = change();
  if (typeof run !== "function") return run;
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    console.error("[inquiries] admin change failed", error);
    return { ok: false, error: "failed" };
  }
}

const INVALID = { ok: false, error: "invalid" } as const;

export async function setInquiryStatusAction(id: unknown, status: unknown) {
  return asStaff(() => {
    const parsedId = idSchema.safeParse(id);
    const parsedStatus = z.enum(INQUIRY_STATUSES).safeParse(status);
    return parsedId.success && parsedStatus.success
      ? () => setInquiryStatus(parsedId.data, parsedStatus.data)
      : INVALID;
  });
}

export async function deleteInquiryAction(id: unknown) {
  return asStaff(() => {
    const parsedId = idSchema.safeParse(id);
    return parsedId.success ? () => removeInquiry(parsedId.data) : INVALID;
  });
}

export async function refreshInquiriesAction() {
  return asStaff(() => () => getInquiriesForAdmin());
}
