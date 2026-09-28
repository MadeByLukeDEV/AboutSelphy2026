import { findAsset } from "@/modules/assets";

// Serves uploaded images. Assets never change (a new upload gets a new id),
// so they're cached immutably. Only ever image/webp we produced ourselves
// (src/modules/assets) -- nosniff keeps browsers from guessing otherwise.

const ID = /^c[a-z0-9]{20,30}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ID.test(id)) return new Response("Not found", { status: 404 });

  const asset = await findAsset(id);
  if (!asset) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.bytes),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
