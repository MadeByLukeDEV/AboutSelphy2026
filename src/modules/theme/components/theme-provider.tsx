"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Class-based theming (matches globals.css's `.dark {}` block and the
// `dark` custom variant), system default, manual override persisted by
// next-themes in localStorage. Pass `nonce` once the CSP is in place:
// next-themes injects an inline script to apply the theme before paint.
// next-themes renders its pre-paint script as a React <script>. That runs
// from the server HTML (with the CSP nonce). When React creates the element
// on the client instead (after a render error, or a client-side remount), it
// never runs it and warns "Encountered a script tag while rendering React
// component". A non-JavaScript type in the browser marks it as a data block,
// which React doesn't warn about; the server keeps a runnable type. The
// differing attribute is fine: next-themes sets suppressHydrationWarning.
const SCRIPT_PROPS = {
  type: typeof window === "undefined" ? "text/javascript" : "application/json",
};

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={SCRIPT_PROPS}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
