import { Plus_Jakarta_Sans } from "next/font/google";

// Shared by every root layout ([locale], admin, global-not-found). Named
// "--font-sans" directly so it plugs into globals.css's
// `--font-sans: var(--font-sans)` indirection. latin-ext covers umlauts/ß.
export const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});
