"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";

import { api } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { Metric } from "@/components/metric";
import { SourceChip } from "@/components/source-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_VARIANT: Record<string, string> = {
  student: "border-sky-500/40 text-sky-300",
  lecturer: "border-violet-500/40 text-violet-300",
  staff: "border-emerald-500/40 text-emerald-300",
};

export default function BadgeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, error } = usePoll(() => api.badge(id), 8000);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load {id}: {error}
      </p>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Loading badge…</p>;
  }

  const temp = data.latest?.temperature_c;
  const light = data.latest?.light_rel_pct;

  return (
    <div className="space-y-6">
      <Link href="/badges" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All badges
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-6 py-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-lg border bg-muted/30">
            <UserRound className="h-12 w-12 text-muted-foreground" />
          </div>

          <div className="min-w-[220px] flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{data.name}</h1>
              <Badge variant="outline" className={`text-[10px] uppercase ${ROLE_VARIANT[data.role]}`}>
                {data.role}
              </Badge>
              <SourceChip source={data.source} />
            </div>
            <p className="font-mono text-sm text-muted-foreground">{data.badge_id}</p>
            <p className="text-xs text-muted-foreground">
              This is the same profile the OLED renders on the Home page.
            </p>
          </div>

          <div className="grid min-w-[260px] grid-cols-2 gap-4">
            <Metric label="Room" value={data.room ?? "unknown"} source={data.source} />
            <Metric
              label="Signal"
              value={data.room_rssi}
              source={data.source}
              unit=" dBm"
              hint={`confidence ${data.room_confidence ?? "unknown"}`}
            />
            <Metric label="Page" value={data.page ?? "--"} source={data.source} />
            <Metric label="Last seen" value={data.last_seen ? data.last_seen.slice(11, 19) : "--"} source={data.source} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest sensor values</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Metric
              label="Temperature"
              value={temp?.value_num ?? null}
              source={temp?.source ?? data.source}
              unit=" °C"
              digits={1}
            />
            <Metric
              label="Relative light"
              value={light?.value_num ?? null}
              source={light?.source ?? data.source}
              unit=" %"
              hint="relative index, not lux"
            />
            {!temp && !light && (
              <p className="col-span-2 text-sm text-muted-foreground">
                Only the physical badge reports sensor values; simulated roster badges show identity
                and room position only.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">SOS history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.sos.length === 0 && <p className="text-sm text-muted-foreground">No SOS recorded.</p>}
            {data.sos.map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-mono text-xs">{event.raised_at?.slice(11, 19)}</span>
                <span>{event.room ?? "--"}</span>
                <Badge variant={event.status === "raised" ? "destructive" : "outline"}>
                  {event.status.toUpperCase()}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
