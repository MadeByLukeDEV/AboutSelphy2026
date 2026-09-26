import type { Metadata } from "next";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/modules/theme";
import "./globals.css";

// 404 for URLs that match no route at all. There is no single root layout
// to build one from ([locale] is the root layout for public pages; /admin
// will get its own), so this renders its own <html>. It can't know the
// visitor's locale, so it's bilingual and links to "/", which the proxy
// redirects to the right language.
const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "404 — AboutSelphy",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <main className="flex flex-1 flex-col items-center justify-center gap-fluid px-gutter py-section text-center">
            <p className="text-fluid-5xl font-extrabold text-brand-text">
              404
            </p>
            <h1 className="text-fluid-2xl font-bold">
              Page not found
              <span
                lang="de"
                className="block text-fluid-lg font-medium text-muted-foreground"
              >
                Seite nicht gefunden
              </span>
            </h1>
            {/* "/" goes through the proxy, which picks the locale. */}
            <Link
              href="/"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground"
            >
              AboutSelphy
            </Link>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
