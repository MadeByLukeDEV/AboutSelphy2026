import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Brand font for next/og images and the media kit PDF. Satori can't
// use next/font and needs static (not variable) font files as bytes. The
// file is committed (SIL OFL 1.1, see src/assets/fonts/OFL.txt) so builds
// never fetch from Google Fonts -- Social's network fetch made its builds
// flaky. Icons render at build time, where src/ exists; an image route
// that renders at *request* time needs `COPY src/assets` in the
// Dockerfile runner stage first.
export async function loadBrandFont() {
  const data = await readFile(
    join(process.cwd(), "src/assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  );
  return {
    name: "Plus Jakarta Sans",
    data,
    weight: 800 as const,
    style: "normal" as const,
  };
}

const BRAND_WEIGHTS = [
  { weight: 400, file: "PlusJakartaSans-Regular.ttf" },
  { weight: 700, file: "PlusJakartaSans-Bold.ttf" },
  { weight: 800, file: "PlusJakartaSans-ExtraBold.ttf" },
] as const;

/** All committed weights, for request-time cards (next/og) and the PDF. */
export async function loadBrandFonts() {
  return Promise.all(
    BRAND_WEIGHTS.map(async ({ weight, file }) => ({
      name: "Plus Jakarta Sans",
      data: await readFile(join(process.cwd(), "src/assets/fonts", file)),
      weight,
      style: "normal" as const,
    })),
  );
}

/** Absolute path of a committed brand font file (for @react-pdf's Font.register). */
export function brandFontPath(weight: 400 | 700 | 800) {
  const entry = BRAND_WEIGHTS.find((w) => w.weight === weight)!;
  return join(process.cwd(), "src/assets/fonts", entry.file);
}
