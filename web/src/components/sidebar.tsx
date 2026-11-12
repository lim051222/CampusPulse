"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Building2,
  IdCard,
  Lightbulb,
  Star,
  Thermometer,
  Wifi,
} from "lucide-react";

import { cn } from "@/lib/utils";

const GROUPS: { label: string; items: { href: string; label: string; icon: typeof Activity }[] }[] = [
  {
    label: "Live",
    items: [
      { href: "/", label: "Overview", icon: Activity },
      { href: "/alerts", label: "Alerts", icon: AlertTriangle },
    ],
  },
  {
    label: "Campus",
    items: [
      { href: "/badges", label: "Badges", icon: BadgeCheck },
      { href: "/attendance", label: "Attendance", icon: Building2 },
      { href: "/restroom", label: "Restroom", icon: Star },
    ],
  },
  {
    label: "Facilities",
    items: [
      { href: "/aircon", label: "Air-conditioning", icon: Thermometer },
      { href: "/lighting", label: "Lighting", icon: Lightbulb },
      { href: "/wifi", label: "Wi-Fi", icon: Wifi },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2.5 border-b px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <IdCard className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">CampusPulse</p>
          <p className="truncate text-[11px] text-muted-foreground">Smart ID console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md py-2 pl-3 pr-2 text-sm transition-colors duration-150",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0 h-4 w-0.5 rounded-full bg-primary transition-opacity",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">One physical badge</p>
        <p>Every other identity and facility reading is labelled demo data.</p>
      </div>
    </aside>
  );
}
