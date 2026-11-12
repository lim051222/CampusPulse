"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Building2,
  Lightbulb,
  Star,
  Thermometer,
  Wifi,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/badges", label: "Badges", icon: BadgeCheck },
  { href: "/attendance", label: "Attendance", icon: Building2 },
  { href: "/restroom", label: "Restroom", icon: Star },
  { href: "/aircon", label: "AC", icon: Thermometer },
  { href: "/lighting", label: "Lighting", icon: Lightbulb },
  { href: "/wifi", label: "Wi-Fi", icon: Wifi },
];

/** Below md the sidebar is hidden, so the same routes are reachable here. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b bg-background/80 px-2 py-1.5 md:hidden">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
              active
                ? "bg-primary/15 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
