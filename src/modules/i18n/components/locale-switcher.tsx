"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "../navigation";
import { routing } from "../routing";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

// Plain links (not a server action + refresh like the Social app): each
// language is its own URL, so switching is navigation, and crawlers can
// follow them. next-intl remembers the choice in the NEXT_LOCALE cookie.
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("LocaleSwitcher");

  return (
    <nav aria-label={t("label")} className="flex gap-1">
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          hrefLang={l}
          aria-current={l === locale ? "true" : undefined}
          className={cn(
            buttonVariants({
              variant: l === locale ? "default" : "outline",
              size: "sm",
            }),
          )}
        >
          <span aria-hidden>{l.toUpperCase()}</span>
          <span className="sr-only">{t(l)}</span>
        </Link>
      ))}
    </nav>
  );
}
