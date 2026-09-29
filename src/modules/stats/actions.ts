"use server";

import { z } from "zod";
import { errorInfo } from "@/lib/log";
import { AuthorizationError, requireAdmin, requireStaff } from "@/modules/auth";
import { runSync } from "./sync";
import { disconnect, setShowDemographics } from "./youtube-analytics";

export type SyncNowResult =
  | { status: "ok" | "partial" | "skipped" }
  | { status: "forbidden" };

// "Sync now" in /admin/stats. Any staff member may trigger it: it only
// refreshes public numbers from the platforms, and a live sample taken too
// soon after the last one isn't counted (see sync.ts).
export async function syncNowAction(): Promise<SyncNowResult> {
  try {
    await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "forbidden" };
    throw error;
  }
  const result = await runSync("manual");
  if (result.skipped) return { status: "skipped" };
  return { status: result.ok ? "ok" : "partial" };
}

export type YoutubeAnalyticsResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "invalid" | "failed" };

/** Auth first (always), then validation, then the change. Admin only: it's the owner's grant. */
async function asAdmin(
  change: () => { ok: false; error: "invalid" } | (() => Promise<unknown>),
): Promise<YoutubeAnalyticsResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const run = change();
  if (typeof run !== "function") return run;
  try {
    await run();
    return { ok: true };
  } catch (error) {
    console.error("[stats] youtube analytics change failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function disconnectYoutubeAction(): Promise<YoutubeAnalyticsResult> {
  return asAdmin(() => disconnect);
}

export async function setShowDemographicsAction(show: unknown): Promise<YoutubeAnalyticsResult> {
  return asAdmin(() => {
    const parsed = z.boolean().safeParse(show);
    return parsed.success
      ? () => setShowDemographics(parsed.data)
      : { ok: false, error: "invalid" };
  });
}
