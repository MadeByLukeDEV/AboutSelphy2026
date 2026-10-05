import { cn } from "@/lib/utils";
import type { CategoryColor } from "../schema";

// Stream category label ("Dixper enabled", "Sponsored", "Drops" ...).
// Tinted surface + dark text in light mode, light text in dark mode, so the
// label keeps AA contrast in both themes. Full class strings (not built from
// parts) so Tailwind sees them.
export const CATEGORY_STYLES: Record<CategoryColor, string> = {
  green: "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  blue: "border-sky-600/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  violet: "border-violet-600/30 bg-violet-500/10 text-violet-800 dark:text-violet-300",
  amber: "border-amber-600/30 bg-amber-500/10 text-amber-900 dark:text-amber-300",
  rose: "border-rose-600/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  slate: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export function CategoryChip({
  name,
  color,
  className,
}: {
  name: string;
  color: CategoryColor;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        CATEGORY_STYLES[color],
        className,
      )}
    >
      {name}
    </span>
  );
}
