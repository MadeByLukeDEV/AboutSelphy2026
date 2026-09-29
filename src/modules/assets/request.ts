import "server-only";
import { siteUrl } from "@/lib/env";
import { MAX_UPLOAD_BYTES } from "./service";

// Reads an upload sent to an admin route handler (/api/admin/...). Uploads
// use route handlers instead of Server Actions so the Server Action body
// limit can stay at Next's 1 MB default for everything else, including the
// public inquiry form. Route handlers get no built-in origin check, so this
// does its own. Callers check the admin role *before* calling this.

/** Room for the other form fields and multipart boundaries. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

export type UploadForm =
  | { ok: true; form: FormData }
  | { ok: false; error: "forbidden" | "invalid" | "tooLarge" };

export async function readUploadForm(request: Request): Promise<UploadForm> {
  // Same-origin only (CSRF): browsers always send Origin on a cross-origin
  // POST, and on a same-origin fetch POST too.
  if (request.headers.get("origin") !== new URL(siteUrl()).origin) {
    return { ok: false, error: "forbidden" };
  }
  // Check the declared size before reading anything; a request without one
  // (chunked) is refused, since the body would be buffered unbounded.
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) return { ok: false, error: "invalid" };
  if (length > MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES) return { ok: false, error: "tooLarge" };
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return { ok: false, error: "invalid" };
  }
  try {
    return { ok: true, form: await request.formData() };
  } catch {
    return { ok: false, error: "invalid" };
  }
}
