// Client helper for the admin upload routes (/api/admin/.../cover|logo).
// They answer with the same { ok, ... } / { ok: false, error } shape as the
// Server Actions; a network failure or a non-JSON answer becomes "failed".
export async function postUpload<T>(url: string, body: FormData): Promise<T | { ok: false; error: "failed" }> {
  try {
    const res = await fetch(url, { method: "POST", body, credentials: "same-origin" });
    return (await res.json()) as T;
  } catch {
    return { ok: false, error: "failed" };
  }
}
