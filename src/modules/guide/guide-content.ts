import type { TourId } from "./tours";

// The help panel's topics per admin page (same ids as the tours). Texts:
// Guide.pages.<page>.{title,intro} and Guide.pages.<page>.topics.<topic>.
// {title,body}. Admin-only topics are shown to moderators too, marked, so
// they know what exists and whom to ask.

export type GuideTopic = { id: string; adminOnly?: boolean };

export const GUIDE_TOPICS: Record<TourId, GuideTopic[]> = {
  welcome: [{ id: "roles" }, { id: "live" }, { id: "help" }],
  schedule: [
    { id: "add" },
    { id: "cancel" },
    { id: "weekly" },
    { id: "categories" },
    { id: "mentions" },
    { id: "discord" },
    { id: "discordEvents" },
    { id: "twitch" },
    { id: "connect", adminOnly: true },
  ],
  inquiries: [{ id: "statuses" }, { id: "reply" }, { id: "privacy" }],
  stats: [{ id: "numbers" }, { id: "live" }, { id: "sync" }, { id: "youtube", adminOnly: true }],
  about: [{ id: "edit", adminOnly: true }],
  games: [{ id: "edit", adminOnly: true }, { id: "home", adminOnly: true }, { id: "covers", adminOnly: true }],
  partners: [{ id: "partners", adminOnly: true }, { id: "packages", adminOnly: true }],
  legal: [{ id: "status", adminOnly: true }],
};
