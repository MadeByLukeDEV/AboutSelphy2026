"use server";

import { z } from "zod";
import { AuthorizationError, requireStaff } from "@/modules/auth";
import {
  addExtra,
  cancelOccurrence,
  removeException,
  removeSlot,
  saveSlot,
  ScheduleRuleError,
  type AdminSchedule,
} from "./admin-service";
import {
  cancellationInputSchema,
  extraInputSchema,
  slotInputSchema,
} from "./schema";
import { errorInfo } from "@/lib/log";

// Staff (admins and moderators) may edit the schedule. Auth first, then
// validation, then the change; results carry the fresh schedule for the
// client state, or an error code.

export type ScheduleResult =
  | { ok: true; schedule: AdminSchedule }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "failed"
        | "weekdayMismatch"
        | "unknownSlot"
        | "pastDate";
    };

const INVALID = { ok: false, error: "invalid" } as const;
const idSchema = z.string().min(1).max(40);

async function asStaff(
  change: () => typeof INVALID | (() => Promise<AdminSchedule>),
): Promise<ScheduleResult> {
  try {
    await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const run = change();
  if (typeof run !== "function") return run;
  try {
    return { ok: true, schedule: await run() };
  } catch (error) {
    if (error instanceof ScheduleRuleError) return { ok: false, error: error.code };
    console.error("[schedule] change failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function saveSlotAction(id: unknown, input: unknown) {
  return asStaff(() => {
    const parsedId =
      id === null ? { success: true as const, data: null } : idSchema.safeParse(id);
    const parsed = slotInputSchema.safeParse(input);
    return parsedId.success && parsed.success
      ? () => saveSlot(parsedId.data, parsed.data)
      : INVALID;
  });
}

export async function deleteSlotAction(id: unknown) {
  return asStaff(() => {
    const parsed = idSchema.safeParse(id);
    return parsed.success ? () => removeSlot(parsed.data) : INVALID;
  });
}

export async function cancelOccurrenceAction(input: unknown) {
  return asStaff(() => {
    const parsed = cancellationInputSchema.safeParse(input);
    return parsed.success ? () => cancelOccurrence(parsed.data) : INVALID;
  });
}

export async function addExtraAction(input: unknown) {
  return asStaff(() => {
    const parsed = extraInputSchema.safeParse(input);
    return parsed.success ? () => addExtra(parsed.data) : INVALID;
  });
}

export async function deleteExceptionAction(id: unknown) {
  return asStaff(() => {
    const parsed = idSchema.safeParse(id);
    return parsed.success ? () => removeException(parsed.data) : INVALID;
  });
}
