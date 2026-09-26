"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

const HOVER_TARGET_SELECTOR =
  'a, button, input, textarea, select, [role="button"], [data-cursor-hover]';

function noopSubscribe() {
  return () => {};
}

// Checked once on the client via useSyncExternalStore (not useState+useEffect
// -- the React Compiler's lint rule flags a direct setState call in an
// effect body as a same-render cascading update). Pointer type doesn't
// meaningfully change mid-session, so a one-time check is enough. Ported
// from the Social app.
function useIsFinePointer() {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.matchMedia("(pointer: fine)").matches,
    () => false
  );
}

// Ring-and-dot cursor that follows the pointer with spring physics and
// grows when hovering an interactive element. Only activates on
// fine-pointer (mouse/trackpad) devices -- touch devices keep their native
// behavior entirely, both here and via the `(pointer: fine)` scoping on the
// `cursor: none` rule in globals.css.
export function CustomCursor() {
  const enabled = useIsFinePointer();
  const [hovering, setHovering] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, { damping: 25, stiffness: 300, mass: 0.5 });
  const springY = useSpring(y, { damping: 25, stiffness: 300, mass: 0.5 });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    document.documentElement.classList.add("custom-cursor-active");

    function handleMove(event: PointerEvent) {
      x.set(event.clientX);
      y.set(event.clientY);
      const target = event.target as HTMLElement | null;
      setHovering(!!target?.closest(HOVER_TARGET_SELECTOR));
    }

    window.addEventListener("pointermove", handleMove);
    return () => {
      document.documentElement.classList.remove("custom-cursor-active");
      window.removeEventListener("pointermove", handleMove);
    };
  }, [enabled, x, y]);

  if (!enabled) {
    return null;
  }

  return (
    <motion.div
      className="pointer-events-none fixed top-0 left-0 z-100 -translate-x-1/2 -translate-y-1/2"
      style={{ x: springX, y: springY }}
    >
      <motion.div
        className="flex items-center justify-center rounded-full border-2 border-primary"
        animate={{
          width: hovering ? "2.5rem" : "1.75rem",
          height: hovering ? "2.5rem" : "1.75rem",
          opacity: hovering ? 0.9 : 0.5,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <motion.span
          className="rounded-full bg-primary"
          animate={{
            width: hovering ? "0.5rem" : "0.375rem",
            height: hovering ? "0.5rem" : "0.375rem",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
      </motion.div>
    </motion.div>
  );
}
