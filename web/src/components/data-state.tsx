"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingBlock({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={label}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function EmptyBlock({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {detail ? <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
        <div>
          <p className="text-sm font-medium text-destructive">Could not load this data</p>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}
