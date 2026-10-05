import "server-only";
import { env, siteUrl } from "@/lib/env";

/**
 * Whether this process may talk to Discord/Twitch for the schedule. Dev and
 * production share the database -- and with it the webhook and the Twitch
 * login -- so only the live site does: its own address must be an HTTPS
 * public host. NODE_ENV isn't enough: a local `pnpm build && pnpm start`
 * (Lighthouse, CSP checks) is "production" too, and would post, ping and
 * create duplicate Twitch segments next to the real server.
 * SCHEDULE_INTEGRATIONS_IN_DEV=true allows it locally, for testing on purpose.
 * (2026-10-05: a local cron run posted a real Discord message.)
 */
export function scheduleIntegrationsActive() {
  if (env().SCHEDULE_INTEGRATIONS_IN_DEV) return true;
  let url: URL;
  try {
    url = new URL(siteUrl());
  } catch {
    return false;
  }
  const host = url.hostname;
  const local =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "[::1]" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  return url.protocol === "https:" && !local;
}
