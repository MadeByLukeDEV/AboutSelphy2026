// The admin tours (client-safe, no server imports). One short tour per
// page, started by itself the first time a staff member opens that page,
// replayable from the help panel. Texts live in the "Guide" messages:
// Guide.tours.<tour>.<step>.{title,body}.
//
// A step points at an element by CSS selector (data-tour attributes or a
// section's aria-labelledby). Steps whose element isn't on the page, or
// isn't visible (e.g. mobile/desktop variants), are skipped; a step without
// a target is shown centred.

export const TOUR_IDS = [
  "welcome",
  "about",
  "games",
  "schedule",
  "partners",
  "inquiries",
  "stats",
  "legal",
] as const;
export type TourId = (typeof TOUR_IDS)[number];

export type TourStep = {
  id: string;
  /** CSS selector of the element to highlight; none = centred card. */
  target?: string;
  /** Only shown to admins (moderators can't use what it points at). */
  adminOnly?: boolean;
};

export type Tour = {
  /** The admin page the tour belongs to. */
  path: string;
  /** Pages moderators only see as a notice get no tour for them. */
  adminOnly?: boolean;
  steps: TourStep[];
};

/** A section's heading row (its first child), so the highlight stays small. */
const sectionHead = (heading: string) => `section[aria-labelledby="${heading}"] > :first-child`;

export const TOURS: Record<TourId, Tour> = {
  welcome: {
    path: "/admin",
    steps: [
      { id: "hello" },
      { id: "nav", target: '[data-tour="nav"]' },
      { id: "sections", target: 'section[aria-labelledby="sections-heading"]' },
      { id: "viewSite", target: '[data-tour="view-site"]' },
      { id: "account", target: '[data-tour="account"]' },
      { id: "help", target: '[data-tour="help"]' },
    ],
  },
  schedule: {
    path: "/admin/schedule",
    steps: [
      { id: "upcoming", target: sectionHead("upcoming-heading") },
      { id: "add", target: '[data-tour="add-stream"]' },
      { id: "actions", target: '[data-tour="stream-actions"]' },
      { id: "weekly", target: sectionHead("weekly-heading") },
      { id: "categories", target: sectionHead("categories-heading") },
      { id: "discord", target: sectionHead("discord-heading") },
      { id: "discordEvents", target: sectionHead("discord-events-heading") },
      { id: "twitch", target: sectionHead("twitch-heading") },
    ],
  },
  inquiries: {
    path: "/admin/inquiries",
    steps: [
      { id: "filter", target: '[data-tour="inquiry-filter"]' },
      { id: "item", target: '[data-tour="inquiry-item"]' },
      { id: "status", target: '[data-tour="inquiry-status"]' },
      { id: "reply", target: '[data-tour="inquiry-reply"]' },
      { id: "privacy" },
    ],
  },
  stats: {
    path: "/admin/stats",
    steps: [
      { id: "live", target: 'section[aria-labelledby="live-heading"]' },
      { id: "numbers", target: sectionHead("numbers-heading") },
      { id: "twitch", target: sectionHead("twitch-heading") },
      { id: "youtube", target: sectionHead("youtube-analytics-heading") },
      { id: "runs", target: sectionHead("runs-heading") },
      { id: "config", target: sectionHead("config-heading"), adminOnly: true },
    ],
  },
  about: {
    path: "/admin/about",
    adminOnly: true,
    steps: [
      { id: "intro" },
      { id: "form", target: '[data-tour="profile-form"]' },
      { id: "viewPage", target: '[data-tour="view-page"]' },
    ],
  },
  games: {
    path: "/admin/games",
    adminOnly: true,
    steps: [{ id: "intro" }, { id: "list", target: '[data-tour="games-manager"]' }],
  },
  partners: {
    path: "/admin/partners",
    adminOnly: true,
    steps: [
      { id: "partners", target: 'section[aria-labelledby="partners-heading"] > h2' },
      { id: "packages", target: 'section[aria-labelledby="packages-heading"] > h2' },
    ],
  },
  legal: {
    path: "/admin/legal",
    adminOnly: true,
    steps: [{ id: "intro" }, { id: "form", target: '[data-tour="legal-form"]' }],
  },
};

/** The tour of the admin page at `pathname`, if there is one. */
export function tourForPath(pathname: string): TourId | null {
  const path = pathname.replace(/\/$/, "") || "/admin";
  const match = TOUR_IDS.find((id) => TOURS[id].path === path);
  return match ?? null;
}

/** The steps this role gets (admin-only steps and tours left out for moderators). */
export function stepsFor(tour: TourId, admin: boolean): TourStep[] {
  if (TOURS[tour].adminOnly && !admin) return [];
  return TOURS[tour].steps.filter((step) => admin || !step.adminOnly);
}
