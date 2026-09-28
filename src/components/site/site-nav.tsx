"use client";

import { ViewTransition } from "react";
import { Link, usePathname } from "@/modules/i18n";
import { cn } from "@/lib/utils";

// Page links in the header. Labels come from the server (props), so this
// client component adds nothing to the client message catalog.
//
// Motion: the active item's pill is one named view transition, so it glides
// to the new item on navigation.
export function SiteNav({
  label,
  items,
}: {
  label: string;
  items: Array<{ href: "/" | "/streams" | "/schedule" | "/mediakit"; label: string }>;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const current = items.findIndex((item) => isActive(item.href));

  return (
    <nav aria-label={label}>
      {/* Never wraps; scrolls sideways as a last resort on very narrow
          screens (the padding keeps focus rings from being clipped). */}
      <ul className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 py-1">
        {items.map((item, index) => {
          const active = index === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative isolate block rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-3",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <ViewTransition name="nav-pill">
                    <span aria-hidden className="absolute inset-0 -z-10 rounded-lg bg-muted" />
                  </ViewTransition>
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
