"use server";

import { revalidateTag } from "next/cache";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import * as repo from "./repository";
import { legalInputSchema, type LegalInput } from "./schema";
import { LEGAL_CACHE_TAG } from "./service";

export type SaveLegalResult =
  | { ok: true; legal: LegalInput }
  | { ok: false; error: "forbidden" | "invalid" | "failed" };

// A public POST endpoint like every Server Action: admin check first, then
// its own validation (including the publish rules), error codes only.
export async function saveLegalAction(input: unknown): Promise<SaveLegalResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }

  const parsed = legalInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    await repo.upsertLegal(parsed.data);
    revalidateTag(LEGAL_CACHE_TAG, { expire: 0 });
    return { ok: true, legal: parsed.data };
  } catch (error) {
    console.error("[legal] saving failed", error instanceof Error ? error.name : typeof error);
    return { ok: false, error: "failed" };
  }
}
