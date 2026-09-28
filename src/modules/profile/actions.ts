"use server";

import { z } from "zod";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { UploadError } from "@/modules/assets";
import {
  addGame,
  editGame,
  removeCover,
  removeGame,
  reorderGame,
  saveProfile,
  uploadCover,
  type AdminGame,
} from "./admin-service";
import { gameInputSchema, profileInputSchema, type ProfileInput } from "./schema";

export type SaveProfileResult =
  | { ok: true; profile: ProfileInput }
  | { ok: false; error: "forbidden" | "invalid" | "failed" };

// Server Actions are public POST endpoints: this re-checks the admin role
// and re-validates the input itself, whatever the form did. Errors come
// back as codes, never as messages from the DB or the stack.
export async function saveProfileAction(
  input: unknown,
): Promise<SaveProfileResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: "forbidden" };
    }
    throw error;
  }

  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }

  try {
    return { ok: true, profile: await saveProfile(parsed.data) };
  } catch (error) {
    console.error("[profile] saving the profile failed", error);
    return { ok: false, error: "failed" };
  }
}

// ─── games ───────────────────────────────────────────────────────────────

export type GamesResult =
  | { ok: true; games: AdminGame[] }
  | {
      ok: false;
      error: "forbidden" | "invalid" | "failed" | "noFile" | "tooLarge" | "notAnImage";
    };

const idSchema = z.string().min(1).max(40);

/** Auth first (always), then validation, then the change. */
async function asAdmin(
  change: () => { ok: false; error: "invalid" } | (() => Promise<AdminGame[]>),
): Promise<GamesResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const run = change();
  if (typeof run !== "function") return run;
  try {
    return { ok: true, games: await run() };
  } catch (error) {
    if (error instanceof UploadError) return { ok: false, error: error.code };
    console.error("[profile] game change failed", error);
    return { ok: false, error: "failed" };
  }
}

const INVALID = { ok: false, error: "invalid" } as const;

export async function addGameAction(input: unknown): Promise<GamesResult> {
  return asAdmin(() => {
    const parsed = gameInputSchema.safeParse(input);
    return parsed.success ? () => addGame(parsed.data) : INVALID;
  });
}

export async function editGameAction(id: unknown, input: unknown): Promise<GamesResult> {
  return asAdmin(() => {
    const parsedId = idSchema.safeParse(id);
    const parsed = gameInputSchema.safeParse(input);
    return parsedId.success && parsed.success
      ? () => editGame(parsedId.data, parsed.data)
      : INVALID;
  });
}

export async function deleteGameAction(id: unknown): Promise<GamesResult> {
  return asAdmin(() => {
    const parsedId = idSchema.safeParse(id);
    return parsedId.success ? () => removeGame(parsedId.data) : INVALID;
  });
}

export async function moveGameAction(id: unknown, direction: unknown): Promise<GamesResult> {
  return asAdmin(() => {
    const parsedId = idSchema.safeParse(id);
    const parsedDirection = z.enum(["up", "down"]).safeParse(direction);
    return parsedId.success && parsedDirection.success
      ? () => reorderGame(parsedId.data, parsedDirection.data)
      : INVALID;
  });
}

/** Upload a custom cover: FormData with "gameId" and "file" (admin only). */
export async function uploadGameCoverAction(formData: FormData): Promise<GamesResult> {
  return asAdmin(() => {
    const parsedId = idSchema.safeParse(formData.get("gameId"));
    return parsedId.success ? () => uploadCover(parsedId.data, formData.get("file")) : INVALID;
  });
}

export async function removeGameCoverAction(id: unknown): Promise<GamesResult> {
  return asAdmin(() => {
    const parsedId = idSchema.safeParse(id);
    return parsedId.success ? () => removeCover(parsedId.data) : INVALID;
  });
}
