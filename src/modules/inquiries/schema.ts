import { z } from "zod";

// Public form input. Error messages are i18n keys (Inquiry.errors.*). The
// same schema runs in the browser (instant feedback) and in the action.

export const INQUIRY_BUDGETS = [
  "under_500",
  "from_500_to_2000",
  "from_2000_to_5000",
  "over_5000",
  "unsure",
] as const;

export const INQUIRY_STATUSES = ["new", "in_progress", "done", "spam"] as const;

export const INQUIRY_LIMITS = {
  company: 120,
  contactName: 100,
  email: 254,
  message: 3000,
} as const;

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, { message: min > 1 ? "tooShort" : "required" })
    .max(max, { message: "tooLong" });

export const inquiryInputSchema = z.object({
  company: text(1, INQUIRY_LIMITS.company),
  contactName: text(1, INQUIRY_LIMITS.contactName),
  email: z
    .string()
    .trim()
    .max(INQUIRY_LIMITS.email, { message: "tooLong" })
    .pipe(z.email({ message: "invalidEmail" })),
  budget: z.enum(INQUIRY_BUDGETS, { message: "required" }),
  message: text(20, INQUIRY_LIMITS.message),
});

export type InquiryInput = z.infer<typeof inquiryInputSchema>;
