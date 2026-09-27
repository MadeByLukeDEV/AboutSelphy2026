import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand/brand-mark";
import { loadBrandFont } from "@/lib/og-font";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS rounds the corners itself, so the mark is drawn square here.
export default async function AppleIcon() {
  return new ImageResponse(<BrandMark size={180} rounded={false} />, {
    ...size,
    fonts: [await loadBrandFont()],
  });
}
