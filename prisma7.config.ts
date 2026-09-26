// Loads .env.local first, then .env -- the same precedence Next.js uses, so
// the Prisma CLI sees the same DATABASE_URL as the app.
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: [".env.local", ".env"], quiet: true });

// DATABASE_URL stays a plain connection string (the running app passes the
// schema to the pg adapter instead, see src/lib/prisma.ts). The CLI needs it
// as a ?schema= parameter so migrations land in this app's schema, not in
// "public".
function withSchema(url: string | undefined): string | undefined {
  if (!url) return url;
  const parsed = new URL(url);
  if (!parsed.searchParams.has("schema")) {
    parsed.searchParams.set("schema", process.env.DATABASE_SCHEMA || "main");
  }
  return parsed.toString();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: withSchema(process.env["DATABASE_URL"]),
  },
});
