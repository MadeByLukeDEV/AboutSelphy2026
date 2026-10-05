"use server";

import { errorInfo } from "@/lib/log";
import { AuthorizationError, requireStaff } from "@/modules/auth";
import { tourIdSchema } from "./schema";
import { markTourSeen, resetTours } from "./service";

// The user id always comes from the session, never from the browser: a
// staff member can only change their own tour progress.

type Result = { ok: true } | { ok: false; error: "forbidden" | "invalid" | "failed" };

async function guideAction(run: (userId: string) => Promise<void>): Promise<Result> {
  let userId: string;
  try {
    userId = (await requireStaff()).user.id;
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  try {
    await run(userId);
    return { ok: true };
  } catch (error) {
    console.error("[guide] action failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** A tour was finished or skipped: don't start it by itself again. */
export async function markTourSeenAction(tourId: unknown) {
  const parsed = tourIdSchema.safeParse(tourId);
  if (!parsed.success) return { ok: false, error: "invalid" } satisfies Result;
  return guideAction((userId) => markTourSeen(userId, parsed.data));
}

export async function resetToursAction() {
  return guideAction((userId) => resetTours(userId));
}
