import { ViewTransition, type ReactNode } from "react";

// Wraps a page's content so navigations fade it out and the new page in
// (React's <ViewTransition> + the browser's View Transitions API; CSS in
// globals.css, "motion" section). Must sit in each page, not a layout:
// layouts persist across navigations, so enter/exit would never fire.
//
// No left/right direction by nav order: pages render per request (CSP
// nonce), so a navigation usually commits in a later transition that no
// longer carries Link's transitionTypes -- direction would be random.
// Browsers without the API just switch pages instantly.
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}
