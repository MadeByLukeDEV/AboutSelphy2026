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
/** Empty select value -> no game. */
const gameId = z
  .string()
  .max(40)
  .nullable()
  .transform((value) => value || null);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "invalidDate" })
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "invalidDate",
  });

export const slotInputSchema = z.object({
  weekday: z.coerce.number().int().min(1).max(7),
  startTime: time,
  durationMinutes: duration,
  gameId,
  titleEn: optionalText(120),
  titleDe: optionalText(120),
  active: z.boolean(),
});

export const cancellationInputSchema = z.object({
  slotId: z.string().min(1).max(40),
  date,
  noteEn: optionalText(200),
  noteDe: optionalText(200),
});

export const extraInputSchema = z.object({
  date,
  startTime: time,
  durationMinutes: duration,
  gameId,
  titleEn: optionalText(120),
  titleDe: optionalText(120),
  noteEn: optionalText(200),
  noteDe: optionalText(200),
});

export type SlotInput = z.output<typeof slotInputSchema>;
export type SlotFormValues = z.input<typeof slotInputSchema>;
export type CancellationInput = z.output<typeof cancellationInputSchema>;
export type ExtraInput = z.output<typeof extraInputSchema>;
export type ExtraFormValues = z.input<typeof extraInputSchema>;
