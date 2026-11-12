"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

const ORDER = ["system", "dark", "light"] as const;
type Mode = (typeof ORDER)[number];

const LABEL: Record<Mode, string> = {
  system: "Theme: follow system",
  dark: "Theme: dark",
  light: "Theme: light",
};

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid a hydration mismatch: the server cannot know the resolved theme.
  useEffect(() => setMounted(true), []);

  const current = (mounted ? (theme as Mode) : "system") ?? "system";
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  const cycle = () => {
    const index = ORDER.indexOf(current);
    setTheme(ORDER[(index + 1) % ORDER.length]);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={cycle}
      title={mounted && resolvedTheme ? `${LABEL[current]} (${resolvedTheme})` : LABEL[current]}
      aria-label={LABEL[current]}
      className="h-8 w-8"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
