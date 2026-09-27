import "server-only";
import { getMessages } from "next-intl/server";

type Messages = Awaited<ReturnType<typeof getMessages>>;
type Namespace = keyof Messages;

/**
 * Only the given top-level namespaces, for NextIntlClientProvider. Without
 * this every page ships the whole catalog (admin texts included) to the
 * browser. List the namespaces the layout's *client* components use --
 * server components translate on the server and need nothing here.
 */
export async function clientMessages(namespaces: readonly Namespace[]) {
  const all = await getMessages();
  return Object.fromEntries(
    namespaces.map((namespace) => [namespace, all[namespace]]),
  ) as Partial<Messages>;
}
