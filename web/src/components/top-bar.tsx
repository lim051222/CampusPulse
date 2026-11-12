"use client";

import { Activity } from "lucide-react";

import { api } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";

export function TopBar() {
  const health = usePoll(api.health, 10000);
  const online = Boolean(health.data) && !health.error;

  return (
    <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/85 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">APU Smart ID · operations console</span>
      </div>

      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={
            online
              ? "border-real/40 bg-real/10 text-real"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }
        >
          {online ? "API ONLINE" : "API OFFLINE"}
        </Badge>
        <Badge variant="outline" className="hidden border-simulated/40 bg-simulated/10 text-simulated sm:inline-flex">
          DEMO DATA
        </Badge>
        <ThemeToggle />
      </div>
    </div>
  );
}
