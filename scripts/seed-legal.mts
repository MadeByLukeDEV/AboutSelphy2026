/**
 * Seeds the privacy policy drafts (scripts/legal-drafts/privacy.*.md) into
 * LegalSettings. Insert-only: a language whose text already exists is left
 * alone, so it never overwrites edits made in /admin/legal. The drafts
 * contain TODO: markers, and the admin form won't publish until they're
 * replaced -- nothing seeded here is public.
 *
 * Run: pnpm db:seed-legal
 * (react-server condition: src/lib/prisma.ts imports "server-only".)
 */
import { readFile } from "node:fs/promises";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const { prisma } = await import("../src/lib/prisma.ts");

const draft = (lang: string) => readFile(new URL(`./legal-drafts/privacy.${lang}.md`, import.meta.url), "utf8");
const [en, de] = await Promise.all([draft("en"), draft("de")]);

const existing = await prisma.legalSettings.findUnique({ where: { id: 1 } });
if (!existing) {
  await prisma.legalSettings.create({ data: { id: 1, privacyEn: en, privacyDe: de } });
  console.log("created LegalSettings with both privacy drafts (unpublished)");
} else {
  const data = {
    ...(existing.privacyEn ? {} : { privacyEn: en }),
    ...(existing.privacyDe ? {} : { privacyDe: de }),
  };
  if (Object.keys(data).length) {
    await prisma.legalSettings.update({ where: { id: 1 }, data });
    console.log("filled empty privacy texts:", Object.keys(data).join(", "));
  } else {
    console.log("privacy texts already exist; nothing changed");
  }
}
await prisma.$disconnect();
