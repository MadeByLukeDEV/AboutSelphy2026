import { z } from "zod";

// Shared by the admin forms and the server actions. Error messages are i18n
// keys (Admin.schedule.errors.*).

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "invalidTime" });
const duration = z.coerce
  .number({ message: "invalidDuration" })
  .int({ message: "invalidDuration" })
  .min(15, { message: "invalidDuration" })
  .max(1440, { message: "invalidDuration" });
const optionalText = (max: number) =>
  z.string().trim().max(max, { message: "tooLong" });
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "invalidDate" })
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "invalidDate",
  });
const id = z.string().min(1).max(40);

/**
 * The only cover URLs accepted: Twitch box art, the one path
 * images.remotePatterns allows for it (the DB CHECK uses the same pattern).
 */
export const TWITCH_BOX_ART = /^https:\/\/static-cdn\.jtvnw\.net\/ttv-boxart\/[A-Za-z0-9_.%-]+$/;

/**
 * What is streamed: nothing, one of the Games, or a Twitch category found
 * by search (not added to the Games section). The Twitch fields come from
 * the search result; the server only accepts covers on Twitch's CDN.
 */
export const streamGameSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("game"), id }),
  z.object({
    kind: z.literal("twitch"),
    id: z.string().regex(/^\d{1,20}$/),
    name: z.string().trim().min(1).max(120),
    boxArtUrl: z
      .string()
      .max(300)
      .refine((url) => url === "" || TWITCH_BOX_ART.test(url)),
  }),
]);
export type StreamGame = z.infer<typeof streamGameSchema>;

/** Categories on one stream (ids of StreamCategory rows). */
const categoryIds = z.array(id).max(10).default([]);

const streamFields = {
  startTime: time,
  durationMinutes: duration,
  game: streamGameSchema,
  titleEn: optionalText(120),
  titleDe: optionalText(120),
  categoryIds,
};

/**
 * One "Add stream" form for both kinds: repeating weekly (a weekday) or
 * once (a date). The kind can't change when editing.
 */
export const streamInputSchema = z.discriminatedUnion("repeat", [
  z.object({
    repeat: z.literal("weekly"),
    weekday: z.coerce.number().int().min(1).max(7),
    active: z.boolean(),
    ...streamFields,
  }),
  z.object({
    repeat: z.literal("once"),
    date,
    noteEn: optionalText(200),
    noteDe: optionalText(200),
    ...streamFields,
  }),
]);
export type StreamInput = z.output<typeof streamInputSchema>;
export type StreamFormValues = z.input<typeof streamInputSchema>;

/** Cancel one occurrence: a weekly stream on a date, or a one-time stream. */
export const cancelInputSchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("weekly"), slotId: id, date }),
  z.object({ target: z.literal("once"), exceptionId: id }),
]).and(
  z.object({
    noteEn: optionalText(200),
    noteDe: optionalText(200),
  }),
);
export type CancelInput = z.output<typeof cancelInputSchema>;

/** Undo a cancellation (same targets). */
export const restoreInputSchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("weekly"), slotId: id, date }),
  z.object({ target: z.literal("once"), exceptionId: id }),
]);
export type RestoreInput = z.output<typeof restoreInputSchema>;

export const CATEGORY_COLORS = ["green", "blue", "violet", "amber", "rose", "slate"] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export const categoryInputSchema = z.object({
  nameEn: z.string().trim().min(1, { message: "required" }).max(40, { message: "tooLong" }),
  nameDe: z.string().trim().min(1, { message: "required" }).max(40, { message: "tooLong" }),
  color: z.enum(CATEGORY_COLORS),
});
export type CategoryInput = z.output<typeof categoryInputSchema>;

export const searchQuerySchema = z.string().trim().min(2).max(60);
