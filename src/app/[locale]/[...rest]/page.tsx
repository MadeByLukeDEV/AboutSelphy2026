import { notFound } from "next/navigation";

// Catches unknown paths under a valid locale (/de/whatever) so they get the
// localized [locale]/not-found.tsx instead of the bilingual global 404.
export default function CatchAllNotFound() {
  notFound();
}
