"use server";

import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { saveProfile } from "./admin-service";
import { profileInputSchema, type ProfileInput } from "./schema";

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
