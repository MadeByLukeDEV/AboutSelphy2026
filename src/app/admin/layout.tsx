import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AdminNav } from "@/components/admin/admin-nav";
import { ThemeProvider, ThemeToggle } from "@/modules/theme";
import { requireStaffPage, SignOutButton } from "@/modules/auth";
import { siteUrl } from "@/lib/env";
import { clientMessages } from "@/modules/i18n/client-messages";
import { fontSans } from "../fonts";
import "../globals.css";

// Root layout of the staff area (separate from the public [locale] root
// layout): no locale prefix -- the locale comes from the NEXT_LOCALE cookie
// or Accept-Language (src/modules/i18n/request.ts). Never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("metaTitle"), template: "%s — Admin — AboutSelphy" },
    robots: { index: false, follow: false },
  };
}

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  // Second gate after the proxy (prefetches skip it): redirects to the
  // central login when signed out.
  const session = await requireStaffPage();
  const locale = await getLocale();
  const t = await getTranslations("Admin");
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${fontSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-muted/40">
        {/* Client components in /admin: nav, forms, sync button, theme. */}
        <NextIntlClientProvider
          messages={await clientMessages(["Admin", "ThemeToggle"])}
        >
          <ThemeProvider nonce={nonce}>
            <div className="flex min-h-dvh flex-col md:flex-row">
              <aside className="flex flex-col gap-4 border-b bg-background px-gutter py-4 md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-r md:border-b-0 md:px-4 md:py-6">
                <div className="flex items-center justify-between gap-2 md:px-3">
                  <p className="font-bold tracking-tight">{t("brand")}</p>
                  <a
                    href={siteUrl()}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {t("viewSite")}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </div>

                <AdminNav />

                <div className="hidden flex-col gap-3 border-t pt-4 md:mt-auto md:flex">
                  <div className="px-3">
                    <p className="truncate text-sm font-semibold">
                      {session.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`roles.${session.user.role}`)}
                    </p>
                  </div>
                  <ThemeToggle />
                  <SignOutButton />
                </div>
              </aside>

              <main className="flex-1 px-gutter py-fluid md:py-10">
                {children}
              </main>

              {/* Account controls move below the content on mobile. */}
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-background px-gutter py-4 md:hidden">
                <p className="text-sm">
                  <span className="font-semibold">{session.user.name}</span>{" "}
                  <span className="text-muted-foreground">
                    ({t(`roles.${session.user.role}`)})
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <SignOutButton />
                </div>
              </footer>
            </div>
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
