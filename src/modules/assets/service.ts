import "server-only";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

// Uploaded images (game covers now, partner logos later). Every upload is
// treated as untrusted: size-capped, identified by its actual bytes (not
// the file name or the browser's MIME type), limited to raster formats --
// never SVG -- and re-encoded to WebP, which also drops EXIF/metadata.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Formats sharp detects from the file's magic bytes that we accept. */
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "gif"]);

/**
 * `cover` crops to exactly width x height; `inside` keeps the aspect ratio
 * and only shrinks to fit (logos, which must never be cropped).
 */
export type ImagePreset = { width: number; height: number; fit?: "cover" | "inside" };

/** Game covers: square, 2x the largest display size. */
export const COVER_PRESET: ImagePreset = { width: 400, height: 400 };

/** Partner logos: any shape, fitted into 400x200, transparency kept. */
export const LOGO_PRESET: ImagePreset = { width: 400, height: 200, fit: "inside" };

export class UploadError extends Error {
  constructor(readonly code: "noFile" | "tooLarge" | "notAnImage") {
    super(code);
    this.name = "UploadError";
  }
}

/** Validates and re-encodes an uploaded image, then stores it as an Asset. */
export async function storeImage(file: unknown, preset: ImagePreset) {
  if (!(file instanceof File) || file.size === 0) throw new UploadError("noFile");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("tooLarge");

  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  let size: { width: number; height: number };
  try {
    // limitInputPixels guards against decompression bombs; failOn rejects
    // truncated/corrupt files instead of rendering garbage.
    const image = sharp(input, { limitInputPixels: 40_000_000, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
      throw new UploadError("notAnImage");
    }
    const fit = preset.fit ?? "cover";
    const { data, info } = await image
      .rotate() // apply EXIF orientation before metadata is dropped
      .resize(preset.width, preset.height, {
        fit,
        ...(fit === "cover" ? { position: "attention" } : { withoutEnlargement: true }),
      })
      .webp({ quality: 85, alphaQuality: 100 })
      .toBuffer({ resolveWithObject: true });
    output = data;
    size = { width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof UploadError) throw error;
    // sharp throws for anything it can't decode (text files, SVG-as-png...).
    throw new UploadError("notAnImage");
  }

  return prisma.asset.create({
    data: {
      data: new Uint8Array(output),
      mimeType: "image/webp",
      width: size.width,
      height: size.height,
      bytes: output.length,
    },
    select: { id: true },
  });
}

export function deleteAsset(id: string) {
  return prisma.asset.delete({ where: { id } }).catch(() => undefined);
}

export function findAsset(id: string) {
  return prisma.asset.findUnique({
    where: { id },
    select: { data: true, mimeType: true, bytes: true },
  });
}

/** Public URL of an asset (served by src/app/api/media/[id]/route.ts). */
export function assetUrl(id: string) {
  return `/api/media/${id}`;
}
