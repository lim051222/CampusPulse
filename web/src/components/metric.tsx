import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SourceChip } from "@/components/source-chip";

interface MetricProps {
  label: string;
  value: number | string | null | undefined;
  source: Source;
  unit?: string;
  digits?: number;
  hint?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Every number in the console renders through here, so a value can never appear
 * without its provenance. `npm run lint` bans raw `toFixed()` elsewhere.
 */
export function Metric({
  label,
  value,
  source,
  unit = "",
  digits = 0,
  hint,
  size = "md",
}: MetricProps) {
  const empty = value === null || value === undefined || value === "";
  const text = empty
    ? "--"
    : typeof value === "number"
      ? `${value.toFixed(digits)}${unit}`
      : `${value}${unit}`;

  const valueSize = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "tabular font-mono leading-none",
            valueSize,
            empty ? "text-muted-foreground/70" : "font-semibold text-foreground",
          )}
        >
          {text}
        </span>
        <SourceChip source={source} />
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
