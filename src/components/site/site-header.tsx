import { LocaleSwitcher, Link } from "@/modules/i18n";
import { ThemeToggle } from "@/modules/theme";

// Shared header for public pages. Page navigation joins it as more public
// pages ship (streams, schedule, media kit).
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 px-gutter py-4">
      <Link href="/" className="font-extrabold tracking-tight">
        AboutSelphy
      </Link>
      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
