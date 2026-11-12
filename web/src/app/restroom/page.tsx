"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { SourceChip } from "@/components/source-chip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const RESTROOM_ID = "restroom-l2";
const IDLE_SECONDS = 10;

export default function RestroomPage() {
  const summary = usePoll(() => api.restroom(RESTROOM_ID), 8000);
  const [stars, setStars] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<number | null>(null);
  const [abandoned, setAbandoned] = useState(0);
  const submittedRef = useRef(false);

  const enabled = summary.data?.enabled ?? false;

  const submit = useCallback(async (value: number) => {
    try {
      await api.submitRestroom(RESTROOM_ID, value);
      setLastSubmitted(value);
      toast.success(`Submitted ${value} star${value === 1 ? "" : "s"}`);
      void summary.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
    setStars(0);
    setCountdown(null);
  }, [summary]);

  // One tick per second; when it reaches zero the rating is submitted.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (!submittedRef.current) {
        submittedRef.current = true;
        void submit(stars).finally(() => {
          submittedRef.current = false;
        });
      }
      return;
    }
    const id = window.setTimeout(() => setCountdown((value) => (value === null ? null : value - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [countdown, stars, submit]);

  const handleStarClick = () => {
    if (!enabled) return;
    const next = (stars + 1) % 6; // 0..5 then back to 0
    setStars(next);
    setCountdown(IDLE_SECONDS); // every click restarts the countdown
  };

  const toggle = async (next: boolean) => {
    try {
      await api.setRestroomEnabled(RESTROOM_ID, next);
      toast.success(next ? "Feedback enabled" : "Feedback disabled");
      void summary.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Restroom feedback</h1>
        <p className="text-sm text-muted-foreground">
          Opt-in star rating. One button only: each press adds a star, five presses then wraps back
          to zero.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Rate this restroom</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              enabled
              <Switch checked={enabled} onCheckedChange={(value) => void toggle(value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={handleStarClick}
              disabled={!enabled}
              className="flex w-full flex-col items-center gap-3 rounded-lg border border-dashed py-8 transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex gap-2">
                {[1, 2, 3, 4, 5].map((index) => (
                  <Star
                    key={index}
                    className={
                      index <= stars
                        ? "h-9 w-9 fill-amber-400 text-amber-400"
                        : "h-9 w-9 text-muted-foreground"
                    }
                  />
                ))}
              </span>
              <span className="text-sm text-muted-foreground">
                {enabled ? "Tap to add a star (0 → 5 → 0)" : "Enable feedback to start rating"}
              </span>
            </button>

            <div className="flex items-center justify-between text-sm">
              <span className="font-mono">{stars} / 5 stars</span>
              {countdown !== null ? (
                <span className="font-mono text-amber-400">submitting in {countdown}s</span>
              ) : (
                <span className="text-muted-foreground">
                  {stars === 0 ? "No rating yet — no submission" : "Tap again or wait to submit"}
                </span>
              )}
            </div>

            {lastSubmitted !== null && (
              <p className="text-xs text-emerald-400">
                Last submission: {lastSubmitted} star{lastSubmitted === 1 ? "" : "s"}
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-3 text-xs text-muted-foreground">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAbandoned((value) => value + 1);
                  setStars(0);
                  setCountdown(null);
                  toast("Rating abandoned — nothing submitted");
                }}
              >
                Mark as abandoned
              </Button>
              <Button variant="outline" size="sm" onClick={() => void submit(0)} disabled={!enabled}>
                Submit 0 stars now
              </Button>
              <span className="self-center">abandoned this session: {abandoned}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Summary</CardTitle>
            <SourceChip source="user_submitted" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Average</p>
              <p className="font-mono text-3xl font-semibold">
                {summary.data?.average_stars ?? "--"}
                <span className="ml-1 text-sm text-muted-foreground">/ 5</span>
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{summary.data?.ratings ?? 0} rating(s)</p>
            <p className="text-xs text-muted-foreground">{summary.data?.note}</p>
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-300">
              These are student opinions, not sensor measurements. No camera, no identity, no
              personal tracking.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
