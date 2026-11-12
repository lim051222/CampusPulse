"""Domain helpers shared by the routers."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .models import Command, Device, Event, Reading, Telemetry
from .utils import iso, utcnow

OFFLINE_AFTER_S = 30
ACK_TIMEOUT_S = 300
# A command marked as dispatched but never ACKed is offered again after this grace period.
# Without it, one dropped HTTP response (weak Wi-Fi) strands the command until it fails.
REDISPATCH_AFTER_S = 8
SUPERSEDE_TYPES = {"set_mode"}
BRIGHT_PCT = 70.0
UNOCC_BRIGHT_ALERT_S = 600.0
MIN_INSIGHT_POINTS = 5


# --------------------------------------------------------------------------- commands
def dispatch_commands(db: Session, device_id: str) -> list[dict[str, Any]]:
    now = utcnow()
    retry_before = now - timedelta(seconds=REDISPATCH_AFTER_S)
    rows = db.scalars(
        select(Command)
        .where(
            Command.device_id == device_id,
            Command.status == "pending",
            or_(
                Command.dispatched_at.is_(None),
                Command.dispatched_at < retry_before,
            ),
        )
        .order_by(Command.created_at)
    ).all()
    out = []
    for cmd in rows:
        cmd.dispatched_at = now
        out.append({"id": cmd.id, "type": cmd.type, "args": cmd.args or {}})
    return out


def expire_commands(db: Session) -> None:
    cutoff = utcnow() - timedelta(seconds=ACK_TIMEOUT_S)
    rows = db.scalars(
        select(Command).where(Command.status == "pending", Command.created_at < cutoff)
    ).all()
    for cmd in rows:
        cmd.status = "failed"
        cmd.error = "ack_timeout"


def command_view(cmd: Command) -> dict[str, Any]:
    return {
        "id": cmd.id,
        "device_id": cmd.device_id,
        "type": cmd.type,
        "args": cmd.args or {},
        "status": cmd.status,
        "created_at": iso(cmd.created_at),
        "dispatched_at": iso(cmd.dispatched_at),
        "acked_at": iso(cmd.acked_at),
        "error": cmd.error,
    }


# --------------------------------------------------------------------------- devices
def latest_readings(db: Session, device_id: str) -> dict[str, Any]:
    rows = db.scalars(
        select(Reading)
        .where(Reading.device_id == device_id)
        .order_by(Reading.ts.desc())
        .limit(60)
    ).all()
    out: dict[str, Any] = {}
    for row in rows:
        if row.metric in out:
            continue
        out[row.metric] = {
            "value_num": row.value_num,
            "value_text": row.value_text,
            "ts": iso(row.ts),
            "source": row.source,
        }
    return out


def device_view(db: Session, device: Device, now: datetime | None = None) -> dict[str, Any]:
    now = now or utcnow()
    age = max((now - device.last_seen).total_seconds(), 0.0)

    last_telemetry = db.scalars(
        select(Telemetry)
        .where(Telemetry.device_id == device.id)
        .order_by(Telemetry.ts.desc())
        .limit(1)
    ).first()
    faults = list((last_telemetry.payload or {}).get("faults", [])) if last_telemetry else []

    return {
        "device_id": device.id,
        "name": device.name,
        "room": device.room,
        "fw_version": device.fw_version,
        "mode": device.mode,
        "source": device.source,
        "first_seen": iso(device.first_seen),
        "last_seen": iso(device.last_seen),
        "age_seconds": round(age, 1),
        "status": "online" if age <= OFFLINE_AFTER_S else "offline",
        "faults": faults,
        "latest": latest_readings(db, device.id),
    }


# --------------------------------------------------------------------------- insights
def build_insights(db: Session, device_id: str | None, hours: float = 24) -> dict[str, Any]:
    now = utcnow()
    start = now - timedelta(hours=hours)

    stmt = select(Reading).where(Reading.ts >= start, Reading.ts <= now)
    if device_id:
        stmt = stmt.where(Reading.device_id == device_id)
    rows = db.scalars(stmt.order_by(Reading.device_id, Reading.ts)).all()

    window = {"from": iso(start), "to": iso(now), "hours": hours}
    result: dict[str, Any] = {"window": window, "devices": [], "suggestions": [], "insights": []}

    if len(rows) < MIN_INSIGHT_POINTS:
        result["reason"] = "insufficient_data"
        return result

    per_dev: dict[str, dict[datetime, dict[str, tuple[float | None, str | None]]]] = defaultdict(dict)
    sources: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        per_dev[row.device_id].setdefault(row.ts, {})[row.metric] = (row.value_num, row.value_text)
        sources[row.device_id].add(row.source)

    alert_rows = db.scalars(
        select(Event).where(Event.ts >= start, Event.kind.in_(("faults", "alert")))
    ).all()
    alerts_by_dev: dict[str, int] = defaultdict(int)
    for ev in alert_rows:
        alerts_by_dev[ev.device_id] += 1

    for dev_id, samples in per_dev.items():
        times = sorted(samples)
        unocc_bright = 0.0
        first_ts: datetime | None = None
        last_ts: datetime | None = None

        for i, ts in enumerate(times):
            nxt = times[i + 1] if i + 1 < len(times) else None
            delta = (nxt - ts).total_seconds() if nxt else 0.0
            occ = samples[ts].get("occupancy")
            light = samples[ts].get("light_rel_pct")

            if (
                occ
                and occ[1] == "unoccupied_suspected"
                and light
                and light[0] is not None
                and light[0] > BRIGHT_PCT
                and 0 < delta <= 3600
            ):
                unocc_bright += delta
                if first_ts is None:
                    first_ts = ts
                last_ts = nxt

        result["devices"].append(
            {
                "device_id": dev_id,
                "data_points": len(times),
                "first_sample": iso(times[0]),
                "last_sample": iso(times[-1]),
                "sources": sorted(sources[dev_id]),
                "alerts": alerts_by_dev.get(dev_id, 0),
                "unoccupied_bright_seconds": round(unocc_bright, 1),
            }
        )

        if unocc_bright >= UNOCC_BRIGHT_ALERT_S:
            suggestion = {
                "device_id": dev_id,
                "kind": "lighting_review",
                "text": "建议确认是否需要关闭照明（无人在场但光照偏高，需人工确认）",
                "requires_human_confirmation": True,
                "basis": {
                    "from": iso(first_ts),
                    "to": iso(last_ts),
                    "seconds": round(unocc_bright, 1),
                    "occupancy": "unoccupied_suspected",
                    "light_rel_pct_above": BRIGHT_PCT,
                },
                "sources": sorted(sources[dev_id]),
            }
            result["suggestions"].append(suggestion)
            result["insights"].append(suggestion)

    return result
