import { uploadPartnerLogo } from "@/modules/mediakit";

export const dynamic = "force-dynamic";

// Partner logo upload from /admin/partners. Admin only, same-origin, body
// capped (checks in uploadPartnerLogo / readUploadForm: /api is outside the
// proxy). Always a JSON result with an error code, like the Server Actions.
export async function POST(request: Request, { params }: RouteContext<"/api/admin/partners/[id]/logo">) {
  const result = await uploadPartnerLogo(request, (await params).id);
  const status = result.ok ? 200 : result.error === "forbidden" ? 403 : result.error === "failed" ? 500 : 400;
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
