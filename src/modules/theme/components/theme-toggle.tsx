"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light theme" },
  { value: "dark", icon: Moon, label: "Dark theme" },
  { value: "system", icon: Monitor, label: "System theme" },
] as const;

function noopSubscribe() {
  return () => {};
}

// Avoid a hydration mismatch: the resolved theme is only known after
// next-themes' inline script runs on the client.
function useHasMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();

  return (
    <div className="flex gap-1">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <Button
          key={value}
          type="button"
          variant={mounted && theme === value ? "default" : "outline"}
          size="icon-sm"
          aria-label={label}
          onClick={() => setTheme(value)}
        >
          <Icon className="size-4" />
        </Button>
      ))}
    </div>
  );
}
