"use client";

import { useState } from "react";
import { AlertTriangle, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { SourceChip } from "@/components/source-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AlertsPage() {
  const sos = usePoll(api.sosList, 4000);
  const wifi = usePoll(api.wifiAlerts, 15000);
  const devices = usePoll(api.devices, 8000);
  const [busy, setBusy] = useState<string | null>(null);

  const raise = sos.data?.items ?? [];
  const open = raise.filter((event) => event.status === "raised");
  const deviceFaults = (devices.data?.items ?? []).flatMap((device) =>
    device.faults.map((fault) => ({ device: device.device_id, fault, source: device.source })),
  );

  const act = async (id: string, action: "ack" | "resolve") => {
    setBusy(id);
    try {
      if (action === "ack") await api.ackSos(id);
      else await api.resolveSos(id);
      toast.success(action === "ack" ? "SOS acknowledged" : "SOS resolved");
      void sos.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            SOS, network anomalies and device faults in one inbox.
          </p>
        </div>
        <Badge variant={open.length > 0 ? "destructive" : "outline"}>
          {open.length} open SOS
        </Badge>
      </header>

      <Card className={open.length > 0 ? "border-destructive/60" : undefined}>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" /> SOS
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Acknowledging stops the badge buzzer within one poll
          </span>
        </CardHeader>
        <CardContent>
          {raise.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No SOS recorded. Hold the badge button for 5 seconds to raise one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Raised</TableHead>
                  <TableHead>Badge</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {raise.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-xs">{event.raised_at.slice(11, 19)}</TableCell>
                    <TableCell className="font-mono text-xs">{event.badge_id}</TableCell>
                    <TableCell className="text-xs">{event.room ?? "--"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          event.status === "raised"
                            ? "destructive"
                            : event.status === "acknowledged"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {event.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={event.status !== "raised" || busy === event.id}
                        onClick={() => void act(event.id, "ack")}
                      >
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Acknowledge
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={event.status === "resolved" || busy === event.id}
                        onClick={() => void act(event.id, "resolve")}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" /> Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Wi-Fi anomalies</CardTitle>
            <SourceChip source="simulated" />
          </CardHeader>
          <CardContent className="space-y-2">
            {(wifi.data?.items ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No anomalies recorded.</p>
            )}
            {(wifi.data?.items ?? []).slice(0, 8).map((alert) => (
              <div key={alert.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-mono text-xs">{alert.started_at.slice(11, 16)}</span>
                <span className="text-xs">{alert.ap_id}</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {alert.kind.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Device faults</CardTitle>
            <SourceChip source="real" />
          </CardHeader>
          <CardContent className="space-y-2">
            {deviceFaults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active device faults.</p>
            ) : (
              deviceFaults.map((fault) => (
                <div
                  key={`${fault.device}-${fault.fault}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs">{fault.device}</span>
                  <span className="text-xs text-amber-300">{fault.fault}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
