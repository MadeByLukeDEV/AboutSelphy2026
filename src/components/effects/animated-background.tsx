"use client";

import { motion, useReducedMotion } from "motion/react";

const ORBS = [
  {
    className:
      "size-[clamp(16rem,50vw,32rem)] bg-primary/25 dark:bg-primary/15",
    style: { top: "-15%", left: "-10%" },
    animate: { x: ["0%", "25%", "0%"], y: ["0%", "20%", "0%"] },
    duration: 26,
  },
  {
    className:
      "size-[clamp(14rem,40vw,28rem)] bg-primary/15 dark:bg-primary/10",
    style: { bottom: "-15%", right: "-8%" },
    animate: { x: ["0%", "-20%", "0%"], y: ["0%", "-15%", "0%"] },
    duration: 32,
  },
  {
    className:
      "size-[clamp(10rem,25vw,18rem)] bg-primary/10 dark:bg-primary/10",
    style: { top: "40%", left: "50%", x: "-50%", y: "-50%" },
    animate: { x: ["-50%", "-30%", "-50%"], y: ["-50%", "-65%", "-50%"] },
    duration: 22,
  },
];

// Fixed, pointer-events-none decorative layer behind all page content: a
// faint grid plus a few large blurred brand-color orbs drifting slowly.
// Ported from the Social app. Orbs stay put under prefers-reduced-motion.
export function AnimatedBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-[0.15] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "clamp(2rem,5vw,3rem) clamp(2rem,5vw,3rem)",
        }}
      />
      {ORBS.map((orb, index) => (
        <motion.div
          key={index}
          className={`absolute rounded-full blur-3xl ${orb.className}`}
          style={orb.style}
          animate={reduceMotion ? undefined : orb.animate}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
