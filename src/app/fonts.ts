import { Plus_Jakarta_Sans } from "next/font/google";

// Shared by every root layout ([locale], admin, global-not-found). Named
// "--font-sans" directly so it plugs into globals.css's
// `--font-sans: var(--font-sans)` indirection. Only "latin": it already
// has the German umlauts and ß (U+00C0-00FF). "latin-ext" (ł, ő, č ...) was
// a second preloaded font file on every page that neither language needs;
// such letters, e.g. in a partner name, fall back to the system font.
export const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});
