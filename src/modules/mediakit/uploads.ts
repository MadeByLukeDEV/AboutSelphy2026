import "server-only";
import { z } from "zod";
import { errorInfo } from "@/lib/log";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { readUploadForm, UploadError } from "@/modules/assets";
import type { PartnersResult } from "./actions";
import { uploadLogo } from "./admin-service";

const idSchema = z.string().min(1).max(40);

/**
 * POST /api/admin/partners/[id]/logo, a form with "file" (admin only). A
 * route handler rather than a Server Action, so the action body limit stays
 * at 1 MB (see assets/request.ts). Auth first, then the id, then the body.
 */
export async function uploadPartnerLogo(request: Request, id: string): Promise<PartnersResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const partnerId = idSchema.safeParse(id);
  if (!partnerId.success) return { ok: false, error: "invalid" };
  const upload = await readUploadForm(request);
  if (!upload.ok) return upload;
  try {
    return { ok: true, partners: await uploadLogo(partnerId.data, upload.form.get("file")) };
  } catch (error) {
    if (error instanceof UploadError) return { ok: false, error: error.code };
    console.error("[mediakit] logo upload failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
