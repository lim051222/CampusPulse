"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { api } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { SourceChip } from "@/components/source-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLE_STYLE: Record<string, string> = {
  student: "border-sky-500/40 text-sky-300",
  lecturer: "border-violet-500/40 text-violet-300",
  staff: "border-emerald-500/40 text-emerald-300",
};

export default function BadgesPage() {
  const { data, error } = usePoll(api.badges, 8000);
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const all = data?.items ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (badge) => badge.name.toLowerCase().includes(q) || badge.badge_id.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Badges</h1>
          <p className="text-sm text-muted-foreground">
            Demo roster. Identities are fictional and every row is marked simulated.
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or TP number"
            className="w-64 pl-8"
          />
        </div>
      </header>

      {error && <p className="text-sm text-destructive">Backend error: {error}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">{items.length} badge(s)</CardTitle>
          <SourceChip source="simulated" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Badge</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Room (Wi-Fi estimate)</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((badge) => (
                <TableRow key={badge.badge_id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/badges/${badge.badge_id}`} className="underline">
                      {badge.badge_id}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">{badge.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] uppercase ${ROLE_STYLE[badge.role]}`}>
                      {badge.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {badge.room ?? "--"}
                    {badge.room_rssi !== null && (
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                        {badge.room_rssi} dBm
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs uppercase text-muted-foreground">
                    {badge.room_confidence ?? "--"}
                  </TableCell>
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
  );
}
