"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { errorInfo } from "@/lib/log";
import { AuthorizationError, requireStaff } from "@/modules/auth";
import type { Locale } from "@/modules/i18n";
import {
  cancelStream,
  removeCategory,
  removeException,
  removeSlot,
  restoreStream,
  saveCategory,
  saveStream,
  ScheduleRuleError,
  searchCategories,
  type AdminSchedule,
} from "./admin-service";
import {
  cancelInputSchema,
  categoryInputSchema,
  restoreInputSchema,
  searchQuerySchema,
  streamInputSchema,
} from "./schema";

// Staff (admins and moderators) may edit the schedule. Server Actions are
// public endpoints: auth first, then validation, then the change. Results
// carry the fresh schedule for the client state, or an error code.

export type ScheduleResult =
  | { ok: true; schedule: AdminSchedule }
  | {
      ok: false;
      error: "forbidden" | "invalid" | "failed" | "weekdayMismatch" | "unknownStream" | "pastDate";
    };

const INVALID = { ok: false, error: "invalid" } as const;
const idSchema = z.string().min(1).max(40);
const optionalId = (id: unknown) =>
  id === null ? ({ success: true, data: null } as const) : idSchema.safeParse(id);

async function staffCheck() {
  try {
    await requireStaff();
    return null;
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" } as const;
    throw error;
  }
}

async function asStaff(
  change: (locale: Locale) => typeof INVALID | (() => Promise<AdminSchedule>),
): Promise<ScheduleResult> {
  const denied = await staffCheck();
  if (denied) return denied;
  const run = change((await getLocale()) as Locale);
  if (typeof run !== "function") return run;
  try {
    return { ok: true, schedule: await run() };
  } catch (error) {
    if (error instanceof ScheduleRuleError) return { ok: false, error: error.code };
    console.error("[schedule] change failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Add (id null) or edit a weekly or one-time stream. */
export async function saveStreamAction(id: unknown, input: unknown) {
  return asStaff((locale) => {
    const parsedId = optionalId(id);
    const parsed = streamInputSchema.safeParse(input);
    return parsedId.success && parsed.success
      ? () => saveStream(locale, parsedId.data, parsed.data)
      : INVALID;
  });
}

export async function deleteSlotAction(id: unknown) {
  return asStaff((locale) => {
    const parsed = idSchema.safeParse(id);
    return parsed.success ? () => removeSlot(locale, parsed.data) : INVALID;
  });
}

/** Deletes a one-time stream for good (cancel keeps it listed instead). */
export async function deleteOnceAction(id: unknown) {
  return asStaff((locale) => {
    const parsed = idSchema.safeParse(id);
    return parsed.success ? () => removeException(locale, parsed.data) : INVALID;
  });
}

export async function cancelStreamAction(input: unknown) {
  return asStaff((locale) => {
    const parsed = cancelInputSchema.safeParse(input);
    return parsed.success ? () => cancelStream(locale, parsed.data) : INVALID;
  });
}

export async function restoreStreamAction(input: unknown) {
  return asStaff((locale) => {
    const parsed = restoreInputSchema.safeParse(input);
    return parsed.success ? () => restoreStream(locale, parsed.data) : INVALID;
  });
}

export async function saveCategoryAction(id: unknown, input: unknown) {
  return asStaff((locale) => {
    const parsedId = optionalId(id);
    const parsed = categoryInputSchema.safeParse(input);
    return parsedId.success && parsed.success
      ? () => saveCategory(locale, parsedId.data, parsed.data)
      : INVALID;
  });
}

export async function deleteCategoryAction(id: unknown) {
  return asStaff((locale) => {
    const parsed = idSchema.safeParse(id);
    return parsed.success ? () => removeCategory(locale, parsed.data) : INVALID;
  });
}

export type CategorySearchResult =
  | { ok: true; results: Array<{ id: string; name: string; boxArtUrl: string }> }
  | { ok: false; error: "forbidden" | "invalid" | "failed" };

/** Twitch category search for the game picker (staff only). */
export async function searchTwitchCategoriesAction(query: unknown): Promise<CategorySearchResult> {
  const denied = await staffCheck();
  if (denied) return denied;
  const parsed = searchQuerySchema.safeParse(query);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    return { ok: true, results: await searchCategories(parsed.data) };
  } catch (error) {
    console.error("[schedule] Twitch category search failed", errorInfo(error, { message: true }));
    return { ok: false, error: "failed" };
  }
}
