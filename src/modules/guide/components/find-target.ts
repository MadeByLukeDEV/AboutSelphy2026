/**
 * The first element matching `selector` that is actually visible: the admin
 * renders some things twice (desktop sidebar, mobile footer) and hides one.
 */
export function findTarget(selector: string): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden") return element;
  }
  return null;
}
