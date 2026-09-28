// Fixed, pointer-events-none decorative layer behind all page content: a
// faint grid plus a few large blurred brand-color orbs drifting slowly.
// Ported from the Social app, then rewritten as pure CSS (keyframes
// "orb-drift-*" in globals.css): a server component with no JavaScript, so
// it no longer pulls Motion into every page (Lighthouse, 2026-09-29).
// Orbs stay put under prefers-reduced-motion (globals.css).

const ORBS = [
  {
    className: "size-[clamp(16rem,50vw,32rem)] bg-primary/25 dark:bg-primary/15 top-[-15%] left-[-10%]",
    animation: "orb-drift-1 26s ease-in-out infinite",
  },
  {
    className: "size-[clamp(14rem,40vw,28rem)] bg-primary/15 dark:bg-primary/10 right-[-8%] bottom-[-15%]",
    animation: "orb-drift-2 32s ease-in-out infinite",
  },
  {
    className: "size-[clamp(10rem,25vw,18rem)] bg-primary/10 dark:bg-primary/10 top-[40%] left-[50%] -translate-1/2",
    animation: "orb-drift-3 22s ease-in-out infinite",
  },
];

export function AnimatedBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.15] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "clamp(2rem,5vw,3rem) clamp(2rem,5vw,3rem)",
        }}
      />
      {ORBS.map((orb) => (
        <div
          key={orb.animation}
          className={`absolute rounded-full blur-3xl will-change-transform ${orb.className}`}
          style={{ animation: orb.animation }}
        />
      ))}
    </div>
  );
}
