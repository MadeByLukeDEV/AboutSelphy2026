import { z } from "zod";

// Shared by the admin form and the server action (which re-validates).
// Error messages are i18n keys (Admin.legal.errors.*).

export const LEGAL_LIMITS = {
  operatorName: 120,
  street: 120,
  postalCode: 20,
  city: 80,
  country: 80,
  email: 254,
  phone: 40,
  imprintExtra: 4000,
  privacy: 30000,
} as const;

/** Drafts mark every spot that still needs real content with this. */
export const TODO_MARKER = "TODO:";

const text = (max: number) => z.string().trim().max(max, { message: "tooLong" });

export const legalInputSchema = z
  .object({
    operatorName: text(LEGAL_LIMITS.operatorName),
    street: text(LEGAL_LIMITS.street),
    postalCode: text(LEGAL_LIMITS.postalCode),
    city: text(LEGAL_LIMITS.city),
    country: text(LEGAL_LIMITS.country),
    email: text(LEGAL_LIMITS.email).refine((v) => v === "" || z.email().safeParse(v).success, {
      message: "invalidEmail",
    }),
    phone: text(LEGAL_LIMITS.phone).regex(/^[+\d\s()/-]*$/, { message: "invalidPhone" }),
    imprintExtraEn: text(LEGAL_LIMITS.imprintExtra),
    imprintExtraDe: text(LEGAL_LIMITS.imprintExtra),
    privacyEn: text(LEGAL_LIMITS.privacy),
    privacyDe: text(LEGAL_LIMITS.privacy),
    published: z.boolean(),
  })
  // Publishing needs everything the Impressum requires and a finished
  // privacy policy (no TODO markers left from the draft).
  .superRefine((value, ctx) => {
    if (!value.published) return;
    for (const field of ["operatorName", "street", "postalCode", "city", "country", "email"] as const) {
      if (!value[field]) ctx.addIssue({ code: "custom", path: [field], message: "requiredToPublish" });
    }
    for (const field of ["privacyEn", "privacyDe", "imprintExtraEn", "imprintExtraDe"] as const) {
      if (field.startsWith("privacy") && !value[field]) {
        ctx.addIssue({ code: "custom", path: [field], message: "requiredToPublish" });
      }
      if (value[field].includes(TODO_MARKER)) {
        ctx.addIssue({ code: "custom", path: [field], message: "todoLeft" });
      }
    }
  });

export type LegalInput = z.infer<typeof legalInputSchema>;
