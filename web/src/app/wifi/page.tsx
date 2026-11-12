"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

import { api } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { SourceChip } from "@/components/source-chip";
import { Sparkline } from "@/components/sparkline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WifiPoint } from "@/lib/types";

const RANGES = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
];

export default function WifiPage() {
  const aps = usePoll(api.wifiAps, 15000);
  const alerts = usePoll(api.wifiAlerts, 15000);
  const [hours, setHours] = useState(1);
  const [series, setSeries] = useState<Record<string, WifiPoint[]>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const list = aps.data?.items ?? [];
      const next: Record<string, WifiPoint[]> = {};
      for (const ap of list) {
        try {
          next[ap.ap_id] = (await api.wifiSeries(ap.ap_id, hours)).points;
        } catch {
          next[ap.ap_id] = [];
        }
      }
      if (!cancelled) setSeries(next);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [aps.data, hours]);

  const items = aps.data?.items ?? [];
  const openAlerts = (alerts.data?.items ?? []).filter((alert) => alert.resolved_at === null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Wi-Fi infrastructure</h1>
          <p className="text-sm text-muted-foreground">
            Same two APs that place badges in a classroom, viewed as an IT health surface.
          </p>
        </div>
        <Tabs value={String(hours)} onValueChange={(value) => setHours(Number(value))}>
          <TabsList>
            {RANGES.map((range) => (
              <TabsTrigger key={range.hours} value={String(range.hours)}>
                {range.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="py-3 text-xs text-amber-300">
          No campus controller API is authorised, so AP telemetry is simulated. The badge still uses
          the real BSSIDs for room classification.
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((ap) => {
          const points = series[ap.ap_id] ?? [];
          return (
            <Card key={ap.ap_id}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {ap.online ? (
                      <Wifi className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-destructive" />
                    )}
                    {ap.ap_id}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{ap.room}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={ap.online ? "outline" : "destructive"}>
                    {ap.online ? "ONLINE" : "OFFLINE"}
                  </Badge>
                  <SourceChip source={ap.source} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">Clients</p>
                    <p className="font-mono text-lg">{ap.clients}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">Latency</p>
                    <p className="font-mono text-lg">{ap.latency_ms} ms</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">Loss</p>
                    <p className="font-mono text-lg">{ap.loss_pct}%</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">Load</p>
                    <p className="font-mono text-lg">{ap.load_pct}%</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] uppercase text-muted-foreground">Clients · last {hours}h</p>
                  <Sparkline values={points.map((point) => point.clients)} className="text-sky-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase text-muted-foreground">Latency · last {hours}h</p>
                  <Sparkline values={points.map((point) => point.latency_ms)} className="text-amber-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase text-muted-foreground">Loss % · last {hours}h</p>
                  <Sparkline values={points.map((point) => point.loss_pct)} className="text-rose-400" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Network alerts</CardTitle>
          <Badge variant="outline">{openAlerts.length} open</Badge>
        </CardHeader>
        <CardContent>
          {(alerts.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No anomalies recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>AP</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-right">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(alerts.data?.items ?? []).slice(0, 15).map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-mono text-xs">{alert.started_at.slice(11, 19)}</TableCell>
                    <TableCell className="font-mono text-xs">{alert.ap_id}</TableCell>
                    <TableCell className="uppercase text-xs">{alert.kind.replace("_", " ")}</TableCell>
                    <TableCell>
                      <Badge variant={alert.severity === "critical" ? "destructive" : "outline"}>
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <SourceChip source={alert.source} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
