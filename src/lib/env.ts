import "server-only";
import { z } from "zod";

// Server-side environment, validated once on first use. Lazy on purpose:
// `next build` in Docker runs without runtime env, so validating at module
// load would crash the build (same reason src/lib/prisma.ts is lazy).
// Add every new server env var here instead of reading process.env
// directly. Never put secrets in NEXT_PUBLIC_* -- those ship to the browser.
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DATABASE_SCHEMA: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/, "lowercase identifier")
    .default("main"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3002"),
});

const siteUrlSchema = schema.shape.NEXT_PUBLIC_SITE_URL;

// The public site URL alone (no trailing slash), for code that also runs at
// build time -- robots.txt, sitemap.xml, metadata -- where the rest of the
// server env (DATABASE_URL, ...) doesn't exist. NEXT_PUBLIC_SITE_URL is a
// Docker build arg for exactly this reason.
export function siteUrl(): string {
  return siteUrlSchema.parse(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "");
}

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      // Names and reasons only -- never echo the values (they're secrets).
      const problems = result.error.issues
        .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(`Invalid environment variables:\n${problems}`);
    }
    cached = result.data;
  }
  return cached;
}
