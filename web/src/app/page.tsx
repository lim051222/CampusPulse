"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Radio, Users } from "lucide-react";

import { api } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { Metric } from "@/components/metric";
import { SourceChip } from "@/components/source-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OverviewPage() {
  const badges = usePoll(api.badges);
  const devices = usePoll(api.devices);
  const sos = usePoll(() => api.sosList("raised"));
  const wifi = usePoll(api.wifiAps, 15000);
  const lighting = usePoll(api.lighting, 15000);

  const items = badges.data?.items ?? [];
  const inRoom1 = items.filter((b) => b.room === "Classroom 1").length;
  const inRoom2 = items.filter((b) => b.room === "Classroom 2").length;
  const unplaced = items.filter((b) => !b.room || b.room === "unknown").length;
  const activeSos = sos.data?.items ?? [];
  const device = devices.data?.items?.[0];
  const anomalies = (wifi.data?.items ?? []).filter(
    (ap) => !ap.online || ap.latency_ms > 100 || ap.loss_pct > 5 || ap.load_pct > 80,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Live view of the badge fleet and the campus systems they feed.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Radio className="h-3.5 w-3.5" />
          {devices.error ? "API unreachable" : "API connected"}
        </div>
      </header>

      {activeSos.length > 0 && (
        <Card className="border-destructive/60 bg-destructive/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-semibold">
                {activeSos.length} active SOS{activeSos.length > 1 ? " alerts" : ""}
              </span>
            </div>
            <Link href="/alerts" className="flex items-center gap-1 text-sm underline">
              Open alerts <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Badges</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <span className="font-mono text-3xl font-semibold">{items.length}</span>
            <SourceChip source="simulated" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Classroom 1</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <span className="font-mono text-3xl font-semibold">{inRoom1}</span>
            <SourceChip source="simulated" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Classroom 2</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <span className="font-mono text-3xl font-semibold">{inRoom2}</span>
            <SourceChip source="simulated" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">No AP in range</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <span className="font-mono text-3xl font-semibold">{unplaced}</span>
            <SourceChip source="simulated" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Physical badge</CardTitle>
            {device && <SourceChip source={device.source} />}
          </CardHeader>
          <CardContent>
            {!device ? (
              <p className="text-sm text-muted-foreground">
                No hardware has reported yet. The console still demonstrates every flow with
                simulated data.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Status" value={device.status.toUpperCase()} source={device.source} />
                <Metric label="Room" value={device.room ?? "unknown"} source={device.source} />
                <Metric
                  label="Temperature"
                  value={device.latest.temperature_c?.value_num ?? null}
                  source={device.latest.temperature_c?.source ?? device.source}
                  unit=" °C"
                  digits={1}
                />
                <Metric
                  label="Relative light"
                  value={device.latest.light_rel_pct?.value_num ?? null}
                  source={device.latest.light_rel_pct?.source ?? device.source}
                  unit=" %"
                  hint="relative index, not lux"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Wi-Fi health</CardTitle>
            <SourceChip source="simulated" />
          </CardHeader>
          <CardContent className="space-y-2">
            {(wifi.data?.items ?? []).map((ap) => (
              <div key={ap.ap_id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{ap.ap_id}</span>
                <span className="flex items-center gap-2 font-mono text-xs">
                  <Badge variant={ap.online ? "outline" : "destructive"}>
                    {ap.online ? "ONLINE" : "OFFLINE"}
                  </Badge>
                  {ap.clients} clients · {ap.latency_ms} ms · {ap.loss_pct}%
                </span>
              </div>
            ))}
            {anomalies.length > 0 && (
              <p className="pt-2 text-xs text-amber-400">
                {anomalies.length} AP(s) outside thresholds
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Lighting verdicts</CardTitle>
            <SourceChip source="real" />
          </CardHeader>
          <CardContent>
            {(lighting.data?.rooms ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent light readings. {lighting.data?.empty_reason ?? ""}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {(lighting.data?.rooms ?? []).map((room) => (
                  <div key={room.room} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{room.room}</span>
                      <Badge variant="outline">{room.verdict.replace("_", " ").toUpperCase()}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      index {room.median_index} · {room.badge_count} badge(s) · spread {room.spread}
                    </p>
                    {room.recommendation && (
                      <p className="mt-1 text-xs text-amber-400">{room.recommendation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Roster snapshot
          </CardTitle>
          <Link href="/badges" className="text-xs underline">
            All badges
          </Link>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((badge) => (
            <Link
              key={badge.badge_id}
              href={`/badges/${badge.badge_id}`}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              <span className="truncate">{badge.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{badge.room ?? "--"}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
