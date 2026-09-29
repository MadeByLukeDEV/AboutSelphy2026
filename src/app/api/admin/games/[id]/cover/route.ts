import { uploadGameCover } from "@/modules/profile";

export const dynamic = "force-dynamic";

// Game cover upload from /admin/games. Admin only, same-origin, body capped
// (checks in uploadGameCover / readUploadForm: /api is outside the proxy).
// Always a JSON result with an error code, like the Server Actions.
export async function POST(request: Request, { params }: RouteContext<"/api/admin/games/[id]/cover">) {
  const result = await uploadGameCover(request, (await params).id);
  const status = result.ok ? 200 : result.error === "forbidden" ? 403 : result.error === "failed" ? 500 : 400;
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
