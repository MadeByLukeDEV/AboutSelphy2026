import { headers } from "next/headers";

type JsonLdValue = Record<string, unknown>;

// Structured data for search engines. The only sanctioned
// dangerouslySetInnerHTML in the app (see CLAUDE.md, Security): the JSON is
// serialized with every "<" escaped, so no value can close the <script>.
// The nonce isn't strictly required (ld+json isn't executed), but it keeps
// the CSP rule "every inline script carries the nonce" simple.
export async function JsonLd({ data }: { data: JsonLdValue | JsonLdValue[] }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
