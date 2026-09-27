import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Brand font for next/og images (icons now, OG cards later). Satori can't
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
