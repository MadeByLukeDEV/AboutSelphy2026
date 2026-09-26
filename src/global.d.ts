import type { routing } from "@/modules/i18n/routing";
import type messages from "@/modules/i18n/messages/en.json";

// Typed locales and message keys: t("missing.key") is a type error.
// en.json is the reference catalog -- de.json must have the same keys
// (nothing checks that automatically).
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
