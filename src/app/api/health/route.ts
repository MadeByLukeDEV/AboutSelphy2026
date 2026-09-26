import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Dokploy health check. 200 when the app can reach its database, 503
// otherwise. The body never includes error details (logged server-side).
export async function GET() {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout after 3s")), 3000),
      ),
    ]);
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[health] database check failed:", error);
    return Response.json(
      { status: "error" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
