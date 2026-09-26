import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

declare global {
  var _prisma: PrismaClient | undefined;
}

function createClient() {
  const { DATABASE_URL, DATABASE_SCHEMA } = env();
  const adapter = new PrismaPg(
    { connectionString: DATABASE_URL },
    { schema: DATABASE_SCHEMA },
  );
  return new PrismaClient({ adapter });
}

// Constructed lazily, on first real use, rather than at module load. Next.js
// imports this module (transitively, via any page that touches a module
// that touches Prisma) during `next build`'s page-data-collection step,
// which runs without DATABASE_URL in a Docker build -- eagerly constructing
// the client here would crash the build itself, not just a request. Same
// pattern as the Social app.
function getPrismaClient(): PrismaClient {
  if (!globalThis._prisma) {
    globalThis._prisma = createClient();
  }
  return globalThis._prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
