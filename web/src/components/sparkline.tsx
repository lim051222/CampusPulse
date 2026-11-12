"use client";

import { useMemo } from "react";

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Minimal dependency-free sparkline; avoids pulling a chart library for 60 points. */
export function Sparkline({
  values,
  height = 48,
  className = "text-primary",
}: {
  values: number[];
  height?: number;
  className?: string;
}) {
  const path = useMemo(() => {
    if (values.length < 2) return "";
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    const width = 100;
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - ((value - min) / span) * (height - 4) - 2;
        return `${index === 0 ? "M" : "L"}${round2(x)},${round2(y)}`;
      })
      .join(" ");
  }, [values, height]);

  if (!path) return <div className="h-12 rounded bg-muted/30" />;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={`h-12 w-full ${className}`}
      role="img"
      aria-label="trend"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
