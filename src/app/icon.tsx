import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand/brand-mark";
import { loadBrandFont } from "@/lib/og-font";

// Favicon (32) plus the 192/512 sizes the web manifest references, all
// from one file: /icon/32, /icon/192, /icon/512. These paths are excluded
// from the proxy matcher, or next-intl would redirect them to /en/icon/...
const SIZES = [32, 192, 512] as const;

export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return new ImageResponse(<BrandMark size={size} />, {
    width: size,
    height: size,
    fonts: [await loadBrandFont()],
  });
}
