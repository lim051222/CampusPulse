"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";

import { api } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { SourceChip } from "@/components/source-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RollCallResult } from "@/lib/types";

const ROOMS = ["Classroom 1", "Classroom 2"];

export default function AttendancePage() {
  const [room, setRoom] = useState(ROOMS[0]);
  const [result, setResult] = useState<RollCallResult | null>(null);
  const [busy, setBusy] = useState(false);
  const history = usePoll(api.rollcalls, 15000);

  const runRollCall = async () => {
    setBusy(true);
    try {
      const res = await api.rollcall(room);
      setResult(res);
      toast.success(`${room}: ${res.present_count} present, ${res.absent_count} absent`);
      void history.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          One click per room. Presence comes from which classroom AP each badge reports as its
          strongest signal.
        </p>
      </header>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="py-3 text-xs text-amber-300">
          Results are derived from simulated badge telemetry. They are not proof of attendance and
          need human confirmation.
        </CardContent>
      </Card>

      <Tabs value={room} onValueChange={setRoom}>
        <TabsList>
          {ROOMS.map((name) => (
            <TabsTrigger key={name} value={name}>
              {name}
            </TabsTrigger>
          ))}
        </TabsList>

        {ROOMS.map((name) => (
          <TabsContent key={name} value={name} className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <Button onClick={() => void runRollCall()} disabled={busy}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Roll call for {name}
              </Button>
              {result?.room === name && (
                <span className="text-sm text-muted-foreground">
                  {result.present_count} present · {result.absent_count} absent ·{" "}
                  {result.triggered_at.slice(11, 19)}
                </span>
              )}
            </div>

            {result?.room === name && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">Present</CardTitle>
                    <SourceChip source={result.source} />
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Badge</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Signal</TableHead>
                          <TableHead className="text-right">Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.present.map((badge) => (
                          <TableRow key={badge.badge_id}>
                            <TableCell className="font-mono text-xs">{badge.badge_id}</TableCell>
                            <TableCell className="max-w-[180px] truncate">{badge.name}</TableCell>
                            <TableCell className="font-mono text-xs">{badge.room_rssi ?? "--"} dBm</TableCell>
                            <TableCell className="text-right">
                              <SourceChip source={badge.source} />
                            </TableCell>
                          </TableRow>
                        ))}
                        {result.present.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-sm text-muted-foreground">
                              No badge reports this room.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">Absent</CardTitle>
                    <Badge variant="outline">{result.absent_count}</Badge>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Badge</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Last room</TableHead>
                          <TableHead className="text-right">Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.absent.map((badge) => (
                          <TableRow key={badge.badge_id}>
                            <TableCell className="font-mono text-xs">{badge.badge_id}</TableCell>
                            <TableCell className="max-w-[180px] truncate">{badge.name}</TableCell>
                            <TableCell className="text-xs">{badge.room ?? "--"}</TableCell>
                            <TableCell className="text-right">
                              <SourceChip source={badge.source} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent roll calls</CardTitle>
        </CardHeader>
        <CardContent>
          {(history.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No roll call yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead className="text-right">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(history.data?.items ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.triggered_at.slice(11, 19)}</TableCell>
                    <TableCell>{row.room}</TableCell>
                    <TableCell>{row.present_count}</TableCell>
                    <TableCell>{row.absent_count}</TableCell>
                    <TableCell className="text-right">
                      <SourceChip source={row.source} />
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
