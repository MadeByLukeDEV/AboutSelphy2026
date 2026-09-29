import "server-only";
import { z } from "zod";
import { errorInfo } from "@/lib/log";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { readUploadForm, UploadError } from "@/modules/assets";
import type { GamesResult } from "./actions";
import { uploadCover } from "./admin-service";

const idSchema = z.string().min(1).max(40);

/**
 * POST /api/admin/games/[id]/cover, a form with "file" (admin only). A route
 * handler rather than a Server Action, so the action body limit stays at
 * 1 MB (see assets/request.ts). Auth first, then the id, then the body.
 */
export async function uploadGameCover(request: Request, id: string): Promise<GamesResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const gameId = idSchema.safeParse(id);
  if (!gameId.success) return { ok: false, error: "invalid" };
  const upload = await readUploadForm(request);
  if (!upload.ok) return upload;
  try {
    return { ok: true, games: await uploadCover(gameId.data, upload.form.get("file")) };
  } catch (error) {
    if (error instanceof UploadError) return { ok: false, error: error.code };
    console.error("[profile] cover upload failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
