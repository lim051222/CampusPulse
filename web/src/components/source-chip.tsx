import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<Source, { label: string; className: string; title: string }> = {
  real: {
    label: "REAL",
    className: "border-real/40 bg-real/10 text-real",
    title: "Measured by the physical badge",
  },
  simulated: {
    label: "SIMULATED",
    className: "border-simulated/40 bg-simulated/10 text-simulated",
    title: "Demo data - no hardware produced this value",
  },
  user_submitted: {
    label: "SUBMITTED",
    className: "border-submitted/40 bg-submitted/10 text-submitted",
    title: "Submitted by a person, not measured by a sensor",
  },
};

/** The only way a data source is rendered. Every value must carry one. */
export function SourceChip({ source }: { source: Source }) {
  const style = STYLES[source] ?? STYLES.simulated;
  return (
    <span
      title={style.title}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-wider",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}
