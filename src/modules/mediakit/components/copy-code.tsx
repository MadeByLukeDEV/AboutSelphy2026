"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// A referral code with a copy button. Labels come in as props (no client
// message namespace). Without clipboard access the code stays selectable.
export function CopyCode({
  code,
  copyLabel,
  copiedLabel,
}: {
  code: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-lg border bg-background/60 py-1 pr-1 pl-3">
      <code className="min-w-0 font-sans font-bold tracking-wide break-all select-all">{code}</code>
      <button
        type="button"
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          copied && "text-brand-text",
        )}
        aria-label={copied ? copiedLabel : copyLabel}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // No clipboard permission: the code is still selectable.
          }
        }}
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </span>
  );
}
