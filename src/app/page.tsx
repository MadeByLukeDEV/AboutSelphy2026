import { ThemeToggle } from "@/modules/theme";

// Placeholder until the Home / About phase replaces it.
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-fluid px-gutter py-section text-center">
      <h1 className="text-fluid-5xl font-extrabold tracking-tight">
        About<span className="text-brand-text">Selphy</span>
      </h1>
      <p className="max-w-prose text-fluid-lg text-muted-foreground">
        Something new is being built here.
      </p>
      <ThemeToggle />
    </main>
  );
}
