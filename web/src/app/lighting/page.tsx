"use client";

import { Lightbulb } from "lucide-react";

import { api } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { SourceChip } from "@/components/source-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const VERDICT_STYLE: Record<string, string> = {
  too_dark: "text-sky-300 border-sky-500/40",
  comfortable: "text-emerald-300 border-emerald-500/40",
  too_bright: "text-amber-300 border-amber-500/40",
  mixed: "text-violet-300 border-violet-500/40",
};

export default function LightingPage() {
  const { data, error } = usePoll(api.lighting, 8000);
  const rooms = data?.rooms ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Smart lighting</h1>
        <p className="text-sm text-muted-foreground">
          Per-room verdict from every badge reporting a light reading in that room.
        </p>
      </header>

      {error && <p className="text-sm text-destructive">Backend error: {error}</p>}

      {rooms.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No recent light readings. {data?.empty_reason ?? ""} The lighting verdict needs the
            photoresistor on a badge that is currently in a room.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rooms.map((room) => (
            <Card key={room.room}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-4 w-4" /> {room.room}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{room.unit}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className={VERDICT_STYLE[room.verdict]}>
                    {room.verdict.replace("_", " ").toUpperCase()}
                  </Badge>
                  <SourceChip source={room.source} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Median index</span>
                    <span className="font-mono text-lg font-semibold">{room.median_index}</span>
                  </div>
                  <Progress value={room.median_index} className="mt-2" />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    too dark &lt; 30 · comfortable 30–75 · too bright &gt; 75
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{room.badge_count} badge(s) reporting</span>
                  <span>spread {room.spread}</span>
                </div>

                <div className="space-y-1">
                  {room.badges.map((badge) => (
                    <div key={`${badge.device_id}-${badge.ts}`} className="flex items-center justify-between text-xs">
                      <span className="font-mono">{badge.device_id}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono">{badge.value ?? "--"}</span>
                        <SourceChip source={badge.source} />
                      </span>
                    </div>
                  ))}
                </div>

                {room.recommendation ? (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-300">
                    {room.recommendation}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-400">No action suggested.</p>
                )}

                <p className="text-[11px] text-muted-foreground">
                  Recommendations are advisory only: no light is switched automatically.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
