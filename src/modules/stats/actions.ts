"use server";

import { AuthorizationError, requireStaff } from "@/modules/auth";
import { runSync } from "./sync";

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
