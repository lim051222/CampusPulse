"use client";

import { useEffect, useMemo, useState } from "react";
import { Snowflake, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { SourceChip } from "@/components/source-chip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { AcAdvice } from "@/lib/types";

const ROOMS = ["Classroom 1", "Classroom 2"];

export default function AirconPage() {
  const badges = usePoll(api.badges, 15000);
  const [room, setRoom] = useState(ROOMS[0]);
  const [badgeId, setBadgeId] = useState("TP000000");
  const [target, setTarget] = useState(24);
  const [advice, setAdvice] = useState<AcAdvice | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const state = usePoll(() => api.acState(room), 8000);

  useEffect(() => {
    if (state.data?.target_c) setTarget(state.data.target_c);
  }, [state.data?.target_c]);

  // Default the delegate to a badge that is actually in the selected room.
  const inRoom = useMemo(
    () => (badges.data?.items ?? []).filter((badge) => badge.room === room),
    [badges.data, room],
  );

  useEffect(() => {
    if (inRoom.length > 0 && !inRoom.some((badge) => badge.badge_id === badgeId)) {
      setBadgeId(inRoom[0].badge_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, inRoom.length]);

  const send = async () => {
    setBusy(true);
    try {
      const res = await api.acCommand(room, badgeId, target);
      setLastCommand(
        `${badgeId} → ${room} at ${res.target_c} °C${res.warning ? ` · ${res.warning}` : ""}`,
      );
      toast.success(`Simulated command stored for ${room}`);
      void state.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const askAi = async () => {
    setBusy(true);
    try {
      setAdvice(await api.acAdvise(room));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Air-conditioning</h1>
        <p className="text-sm text-muted-foreground">
          A badge acts as the IR medium. The hardware has no IR emitter, so this path is simulated
          end to end.
        </p>
      </header>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="py-3 text-xs text-amber-300">
          Simulated control: no infrared command is transmitted. The badge only displays which card
          is requesting the change.
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Delegate a badge</CardTitle>
            <SourceChip source="simulated" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Room</p>
              <Select value={room} onValueChange={(value) => value && setRoom(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROOMS.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Badge in this room ({inRoom.length})
              </p>
              <Select value={badgeId} onValueChange={(value) => value && setBadgeId(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {inRoom.map((badge) => (
                    <SelectItem key={badge.badge_id} value={badge.badge_id}>
                      {badge.badge_id} · {badge.name}
                    </SelectItem>
                  ))}
                  {inRoom.length === 0 && <SelectItem value="none">No badge in this room</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Target</p>
                <span className="font-mono text-sm">{target} °C</span>
              </div>
              <Slider
                value={[target]}
                min={16}
                max={30}
                step={1}
                onValueChange={(values) =>
                  setTarget(Array.isArray(values) ? values[0] : (values as number))
                }
              />
              <p className="text-xs text-muted-foreground">
                Allowed range 16–30 °C. Requests outside the range are rejected by the backend.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void send()} disabled={busy || inRoom.length === 0}>
                <Snowflake className="mr-2 h-4 w-4" /> Send simulated command
              </Button>
              <Button variant="outline" onClick={() => void askAi()} disabled={busy}>
                <Sparkles className="mr-2 h-4 w-4" /> Ask AI for a setpoint
              </Button>
            </div>

            {lastCommand && <p className="text-xs text-muted-foreground">{lastCommand}</p>}
            {state.data?.target_c && (
              <p className="text-sm">
                Current stored target for {room}:{" "}
                <span className="font-mono font-semibold">{state.data.target_c} °C</span>{" "}
                <span className="text-xs text-muted-foreground">
                  (delegated by {state.data.delegate_badge})
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">AI setpoint advice</CardTitle>
            {advice && <SourceChip source={advice.sources.includes("simulated") ? "simulated" : "real"} />}
          </CardHeader>
          <CardContent className="space-y-3">
            {!advice ? (
              <p className="text-sm text-muted-foreground">
                Ask the assistant to propose a setpoint from the measured room temperature.
              </p>
            ) : (
              <>
                <p className="font-mono text-3xl font-semibold">
                  {advice.target_c ?? "--"}
                  <span className="ml-1 text-sm text-muted-foreground">°C</span>
                </p>
                <p className="whitespace-pre-wrap text-sm">{advice.message}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>mode: {advice.mode}</span>
                  {advice.measured_c !== undefined && <span>measured: {advice.measured_c} °C</span>}
                  <span>needs confirmation</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What the badge shows</CardTitle>
        </CardHeader>
        <CardContent className="rounded-lg border bg-black p-6 font-mono text-sm text-emerald-300">
          <p>ROOM {target}.0 C</p>
          <p>TARGET {target} C</p>
          <p className="text-amber-300">{badgeId} IS</p>
          <p className="text-amber-300">ADJUSTING AC</p>
          <p className="text-[11px] text-muted-foreground">SIMULATED IR - NO EMITTER</p>
        </CardContent>
      </Card>
    </div>
  );
}
