import {
  CalendarDays,
  Gamepad2,
  ChartNoAxesColumn,
  Handshake,
  Inbox,
  LayoutDashboard,
  UserRound,
  type LucideIcon,
} from "lucide-react";

// The admin area's sections, in nav order. `built: false` sections show in
// the nav (disabled) so staff can see what's coming; flip to true when the
// section's page lands.
export const ADMIN_SECTIONS = [
  { key: "overview", href: "/admin", icon: LayoutDashboard, built: true },
  { key: "about", href: "/admin/about", icon: UserRound, built: true },
  { key: "games", href: "/admin/games", icon: Gamepad2, built: true },
  { key: "schedule", href: "/admin/schedule", icon: CalendarDays, built: true },
  { key: "partners", href: "/admin/partners", icon: Handshake, built: false },
  { key: "inquiries", href: "/admin/inquiries", icon: Inbox, built: false },
  { key: "stats", href: "/admin/stats", icon: ChartNoAxesColumn, built: true },
] as const satisfies ReadonlyArray<{
  key: string;
  href: string;
  icon: LucideIcon;
  built: boolean;
}>;

export type AdminSectionKey = (typeof ADMIN_SECTIONS)[number]["key"];
