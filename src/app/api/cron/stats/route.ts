import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { runSync } from "@/modules/stats";
import { purgeOldInquiries } from "@/modules/inquiries";

export const dynamic = "force-dynamic";

// Called every 5 minutes by a Dokploy schedule inside the container:
//   wget -qO- --post-data="" --header="Authorization: Bearer $CRON_SECRET" \
//     http://127.0.0.1:3000/api/cron/stats
// POST only, so crawlers/link previews can't trigger it. Fails closed:
// without CRON_SECRET every request is refused.

function authorized(header: string | null, secret: string) {
  const presented = header?.startsWith("Bearer ") ? header.slice(7) : "";
  // Hash both sides so the comparison is constant-time and length-safe.
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(secret).digest();
  return presented.length > 0 && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) {
    console.warn("[cron/stats] refused: CRON_SECRET is not set");
    return Response.json({ error: "not configured" }, { status: 503 });
  }
  if (!authorized(request.headers.get("authorization"), secret)) {
    console.warn("[cron/stats] refused: bad or missing bearer token");
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runSync("cron");
  // GDPR retention for sponsor inquiries rides along with the cron (cheap,
  // idempotent). A failure here never fails the stats sync.
  result.steps.push(
    await purgeOldInquiries().catch((error) => {
      console.error("[cron/stats] inquiry purge failed", error);
      return "inquiries: purge failed";
    }),
  );
  console.log(
    `[cron/stats] ${result.skipped ?? (result.ok ? "ok" : "partial failure")}: ${result.steps.join("; ")}`,
  );
  return Response.json(result, {
    status: result.ok ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
