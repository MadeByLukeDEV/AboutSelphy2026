"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ADMIN_SECTIONS } from "./admin-sections";

// Vertical list in the desktop sidebar, a horizontally scrolling row on
// mobile. Unbuilt sections render as disabled text, not links.
export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations("Admin");

  return (
    <nav aria-label={t("navLabel")}>
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {ADMIN_SECTIONS.map(({ key, href, icon: Icon, built }) => {
          const active =
            href === "/admin" ? pathname === href : pathname.startsWith(href);
          const base =
            "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors";

          if (!built) {
            return (
              <li key={key}>
                <span
                  aria-disabled="true"
                  title={t("notBuilt")}
                  className={cn(base, "cursor-not-allowed text-muted-foreground/60")}
                >
                  <Icon className="size-4" aria-hidden />
                  {t(`nav.${key}`)}
                  <span className="sr-only">({t("notBuilt")})</span>
                </span>
              </li>
            );
          }

          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  base,
                  active
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(`nav.${key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
