import { z } from "zod";

// Shared by the admin forms and the server actions (which re-validate).
// Limits match the DB columns. Error messages are i18n keys
// (Admin.partners.errors.*).

export const PARTNER_LIMITS = { name: 80, url: 300, code: 40, description: 300 } as const;
export const PACKAGE_LIMITS = { title: 80, description: 600, price: 1_000_000 } as const;

const text = (max: number) =>
  z.string().trim().min(1, { message: "required" }).max(max, { message: "tooLong" });

export const partnerInputSchema = z.object({
  name: text(PARTNER_LIMITS.name),
  // https only: the link is rendered on a public page (no javascript:,
  // data: or plain-http URLs). The DB has the same CHECK.
  url: z
    .string()
    .trim()
    .max(PARTNER_LIMITS.url, { message: "tooLong" })
    .startsWith("https://", { message: "invalidUrl" })
    .pipe(z.url({ protocol: /^https$/, message: "invalidUrl" }))
    // No "https://user:pass@host": it can make a link read as another site.
    .refine(
      (url) => {
        const parsed = new URL(url);
        return !parsed.username && !parsed.password;
      },
      { message: "invalidUrl" },
    ),
  code: z
    .string()
    .trim()
    .max(PARTNER_LIMITS.code, { message: "tooLong" })
    .regex(/^[\w-]*$/, { message: "invalidCode" }),
  descriptionEn: text(PARTNER_LIMITS.description),
  descriptionDe: text(PARTNER_LIMITS.description),
  visible: z.boolean(),
});

export type PartnerInput = z.infer<typeof partnerInputSchema>;

export const packageInputSchema = z.object({
  titleEn: text(PACKAGE_LIMITS.title),
  titleDe: text(PACKAGE_LIMITS.title),
  descriptionEn: text(PACKAGE_LIMITS.description),
  descriptionDe: text(PACKAGE_LIMITS.description),
  /** Whole euros; null = "price on request". */
  priceFrom: z
    .number({ message: "invalidPrice" })
    .int({ message: "invalidPrice" })
    .min(0, { message: "invalidPrice" })
    .max(PACKAGE_LIMITS.price, { message: "invalidPrice" })
    .nullable(),
  visible: z.boolean(),
});

export type PackageInput = z.infer<typeof packageInputSchema>;
