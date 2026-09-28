import "server-only";
import * as repo from "./repository";
import type { LegalInput } from "./schema";

/** Everything the admin form edits; empty values before the first save. */
export async function getLegalForEdit(): Promise<LegalInput> {
  const row = await repo.findLegal();
  return {
    operatorName: row?.operatorName ?? "",
    street: row?.street ?? "",
    postalCode: row?.postalCode ?? "",
    city: row?.city ?? "",
    country: row?.country ?? "",
    email: row?.email ?? "",
    phone: row?.phone ?? "",
    imprintExtraEn: row?.imprintExtraEn ?? "",
    imprintExtraDe: row?.imprintExtraDe ?? "",
    privacyEn: row?.privacyEn ?? "",
    privacyDe: row?.privacyDe ?? "",
    published: row?.published ?? false,
  };
}
