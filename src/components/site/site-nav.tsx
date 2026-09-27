"use client";

import { Link, usePathname } from "@/modules/i18n";
import { cn } from "@/lib/utils";

// Page links in the header. Labels come from the server (props), so this
// client component adds nothing to the client message catalog.
export function SiteNav({
  label,
  items,
}: {
  label: string;
  items: Array<{ href: "/" | "/streams"; label: string }>;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label}>
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
