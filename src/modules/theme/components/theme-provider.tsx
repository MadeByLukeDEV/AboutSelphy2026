"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Class-based theming (matches globals.css's `.dark {}` block and the
// `dark` custom variant), system default, manual override persisted by
// next-themes in localStorage. Pass `nonce` once the CSP is in place:
// next-themes injects an inline script to apply the theme before paint.
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
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
