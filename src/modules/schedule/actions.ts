"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { errorInfo } from "@/lib/log";
import { AuthorizationError, requireAdmin, requireStaff, type StaffSession } from "@/modules/auth";
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
  connectDiscord,
  disconnectDiscord,
  DiscordSetupError,
  getDiscordStatus,
  syncDiscordSchedule,
  updateDiscordSettings,
  type DiscordStatus,
  type DiscordSyncResult,
} from "./discord/service";
import { DiscordError } from "@/lib/platforms/discord";
import {
  disconnectTwitch,
  getTwitchStatus,
  syncTwitchSchedule,
  updateTwitchSettings,
  type TwitchStatus,
  type TwitchSyncResult,
} from "./twitch/service";
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

// ─── Discord ─────────────────────────────────────────────────────────────
// Connecting, disconnecting and settings are admin-only (the webhook is a
// credential); updating the message is allowed for all staff.

/**
 * ok: the change happened (status is fresh). A failed Discord post after a
 * successful change (e.g. connected, but rate-limited) comes as syncError.
 */
export type DiscordActionResult =
  | { ok: true; status: DiscordStatus; result?: string; syncError?: string }
  | { ok: false; error: string };

const webhookInputSchema = z.object({
  url: z.string().trim().min(1).max(300),
  locale: z.enum(["de", "en"]),
});
const discordSettingsSchema = z.object({
  locale: z.enum(["de", "en"]),
  autoUpdate: z.boolean(),
  weeklyPost: z.boolean(),
  /** A Discord role id (snowflake) or empty for no ping. */
  pingRoleId: z
    .string()
    .trim()
    .regex(/^(\d{17,20})?$/)
    .transform((id) => id || null),
});

async function discordAction(
  role: "admin" | "staff",
  run: (session: StaffSession) => Promise<DiscordSyncResult | null | void>,
): Promise<DiscordActionResult> {
  let session: StaffSession;
  try {
    session = role === "admin" ? await requireAdmin() : await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  try {
    const outcome = await run(session);
    const status = await getDiscordStatus();
    if (outcome === "devSkipped") return { ok: true, status, syncError: "devSkipped" };
    if (outcome && typeof outcome === "object") return { ok: true, status, syncError: outcome.error };
    return { ok: true, status, result: outcome ?? undefined };
  } catch (error) {
    if (error instanceof DiscordSetupError) return { ok: false, error: error.code };
    // Discord itself (rate limit, outage) during connect: its short code.
    if (error instanceof DiscordError) return { ok: false, error: error.code };
    console.error("[schedule/discord] action failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function connectDiscordAction(input: unknown) {
  const parsed = webhookInputSchema.safeParse(input);
  return discordAction("admin", async (session) => {
    if (!parsed.success) throw new DiscordSetupError("invalidUrl");
    return connectDiscord(parsed.data.url, parsed.data.locale, session.user.name ?? "");
  });
}

export async function disconnectDiscordAction() {
  return discordAction("admin", () => disconnectDiscord());
}

export async function saveDiscordSettingsAction(input: unknown) {
  const parsed = discordSettingsSchema.safeParse(input);
  return discordAction("admin", async () => {
    if (!parsed.success) throw new DiscordSetupError("invalid");
    return updateDiscordSettings(parsed.data);
  });
}

/** "Update now" (edit only) or "Post new message" (optionally pinging). */
export async function syncDiscordAction(input: unknown) {
  const parsed = z
    .union([z.object({ mode: z.literal("edit") }), z.object({ mode: z.literal("post"), ping: z.boolean() })])
    .safeParse(input);
  return discordAction("staff", async () => {
    if (!parsed.success) throw new DiscordSetupError("invalid");
    return syncDiscordSchedule(parsed.data);
  });
}

// ─── Twitch schedule ─────────────────────────────────────────────────────
// Connecting is the /api/twitch/* routes; settings and disconnect are admin
// actions, "Sync now" is for all staff.

export type TwitchActionResult =
  | { ok: true; status: TwitchStatus; syncError?: string; counts?: { created: number; updated: number; deleted: number } }
  | { ok: false; error: string };

const twitchSettingsSchema = z.object({ enabled: z.boolean(), titleLocale: z.enum(["de", "en"]) });

async function twitchAction(
  role: "admin" | "staff",
  run: () => Promise<TwitchSyncResult | "notConnected" | void>,
): Promise<TwitchActionResult> {
  try {
    if (role === "admin") await requireAdmin();
    else await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  try {
    const outcome = await run();
    const status = await getTwitchStatus();
    if (outcome === "devSkipped") return { ok: true, status, syncError: "devSkipped" };
    if (outcome && typeof outcome === "object") {
      const { error, ...counts } = outcome;
      return { ok: true, status, counts, ...(error ? { syncError: error } : {}) };
    }
    return { ok: true, status };
  } catch (error) {
    console.error("[schedule/twitch] action failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function saveTwitchSettingsAction(input: unknown) {
  const parsed = twitchSettingsSchema.safeParse(input);
  return twitchAction("admin", async () => {
    if (!parsed.success) throw new Error("invalid settings");
    return updateTwitchSettings(parsed.data);
  });
}

export async function disconnectTwitchAction() {
  return twitchAction("admin", () => disconnectTwitch());
}

export async function syncTwitchAction() {
  return twitchAction("staff", () => syncTwitchSchedule());
}
