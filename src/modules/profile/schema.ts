import { z } from "zod";

// Limits match the DB columns (displayName 80, taglines 200) plus a sane
// cap on the bio. Error messages are i18n keys (Admin.about.errors.*),
// translated by the form -- the same schema validates on the server.
export const PROFILE_LIMITS = {
  displayName: 80,
  tagline: 200,
  bio: 3000,
} as const;

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1, { message: "required" })
    .max(max, { message: "tooLong" });

export const profileInputSchema = z.object({
  displayName: text(PROFILE_LIMITS.displayName),
  taglineEn: text(PROFILE_LIMITS.tagline),
  taglineDe: text(PROFILE_LIMITS.tagline),
  bioEn: text(PROFILE_LIMITS.bio),
  bioDe: text(PROFILE_LIMITS.bio),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export const GAME_STATUSES = ["main", "regular", "new", "former"] as const;

export const GAME_LIMITS = { name: 80, blurb: 400, tag: 30, tags: 6 } as const;

export const gameInputSchema = z.object({
  name: text(GAME_LIMITS.name),
  status: z.enum(GAME_STATUSES, { message: "required" }),
  blurbEn: text(GAME_LIMITS.blurb),
  blurbDe: text(GAME_LIMITS.blurb),
  tags: z
    .array(z.string().trim().min(1).max(GAME_LIMITS.tag, { message: "tagTooLong" }))
    .max(GAME_LIMITS.tags, { message: "tooManyTags" }),
});

export type GameInput = z.infer<typeof gameInputSchema>;
