import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware replacements for next/link and next/navigation. Use these
// (not the next/* ones) for internal links on public pages.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
