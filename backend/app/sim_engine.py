"""Simulated campus data - deterministic, labelled `source=simulated`, off by default."""

from __future__ import annotations

import math
import random
import threading
import time
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import session_factory
from .models import Device, Event, Reading, SimSource
from .schemas import SimToggleRequest
from .utils import utcnow

SUBSYSTEMS = ("rooms", "wifi_aps", "nfc_attendance", "restroom")
MAX_BACKFILL_HOURS = 24
MAX_BACKFILL_TICKS = 600
DEFAULT_RATE_PER_MINUTE = 6

ROOMS = [
    ("sim-room-b201", "Room B-201", "B-201"),
    ("sim-room-b202", "Room B-202", "B-202"),
    ("sim-room-c310", "Room C-310", "C-310"),
]
APS = [
    ("sim-ap-b2-01", "AP-B2-01", "B2"),
    ("sim-ap-b2-02", "AP-B2-02", "B2"),
    ("sim-ap-c3-01", "AP-C3-01", "C3"),
]
NFC_DEVICE = ("sim-nfc-gate-1", "NFC Gate L2", "L2")
RESTROOM_DEVICE = ("sim-restroom-l2", "Restroom L2", "L2")


# --------------------------------------------------------------------------- helpers
def _stable_hash(text: str) -> int:
    return sum((i + 1) * ord(ch) for i, ch in enumerate(text))


def _rng(seed: int, subsystem: str, ts: datetime) -> random.Random:
    """Pure function of (seed, subsystem, minute) so equal inputs give equal output."""
    bucket = int(ts.replace(second=0, microsecond=0).timestamp() // 60)
    return random.Random((seed * 1_000_003) ^ (bucket * 31) ^ _stable_hash(subsystem))


def _upsert_sim_device(ctx: "_Ctx", device_id: str, name: str, room: str, now: datetime) -> None:
    touch = ctx.touch_at or now
    device = ctx.devices.get(device_id)
    if device is None:
        device = ctx.db.get(Device, device_id)
        if device is None:
            device = Device(
                id=device_id,
                name=name,
                room=room,
                fw_version="sim",
                source="simulated",
                first_seen=touch,
                last_seen=touch,
                meta={"simulated": True},
            )
            ctx.db.add(device)
        ctx.devices[device_id] = device
    if touch > device.last_seen:
        device.last_seen = touch


def _add_reading(ctx: "_Ctx", device_id: str, ts: datetime, metric: str, num, text) -> None:
    key = (device_id, metric)
    if key not in ctx.existing:
        rows = ctx.db.scalars(
            select(Reading.ts).where(Reading.device_id == device_id, Reading.metric == metric)
        ).all()
        ctx.existing[key] = set(rows)
    if ts in ctx.existing[key]:
        return
    ctx.existing[key].add(ts)
    ctx.db.add(
        Reading(
            device_id=device_id,
            ts=ts,
            metric=metric,
            value_num=None if num is None else float(num),
            value_text=text,
            source="simulated",
        )
    )


class _Ctx:
    """Per-generation-call cache so backfill does not re-query for every sample."""

    def __init__(self, db: Session, seed: int, touch_at: datetime | None = None) -> None:
        self.db = db
        self.seed = seed
        self.touch_at = touch_at
        self.devices: dict[str, Device] = {}
        self.existing: dict[tuple[str, str], set[datetime]] = {}


# --------------------------------------------------------------------------- generators
def _gen_rooms(ctx: "_Ctx", ts: datetime) -> None:
    seed = ctx.seed
    for device_id, name, room in ROOMS:
        _upsert_sim_device(ctx, device_id, name, room, ts)
        rng = _rng(seed, f"rooms:{device_id}", ts)
        hour = ts.hour + ts.minute / 60.0
        daylight = max(0.0, math.sin((hour - 6.0) / 12.0 * math.pi))
        occupied = 7 <= hour < 19 and rng.random() > 0.35

        temp = 23.5 + 2.2 * daylight + rng.uniform(-0.4, 0.4) + (0.8 if occupied else 0.0)
        humidity = 58.0 + 6.0 * (1.0 - daylight) + rng.uniform(-1.5, 1.5)
        light = 100.0 * daylight + (35.0 if occupied else 0.0) + rng.uniform(-5, 5)
        light = max(0.0, min(100.0, light))

        _add_reading(ctx, device_id, ts, "temperature_c", round(temp, 1), None)
        _add_reading(ctx, device_id, ts, "humidity_pct", round(humidity, 1), None)
        _add_reading(ctx, device_id, ts, "light_rel_pct", round(light, 1), None)
        _add_reading(
            ctx,
            device_id,
            ts,
            "occupancy",
            None,
            "occupied" if occupied else "unoccupied_suspected",
        )


def _gen_wifi_aps(ctx: "_Ctx", ts: datetime) -> None:
    seed = ctx.seed
    for device_id, name, room in APS:
        _upsert_sim_device(ctx, device_id, name, room, ts)
        rng = _rng(seed, f"wifi_aps:{device_id}", ts)
        online = 1.0 if rng.random() > 0.02 else 0.0
        clients = rng.randint(10, 60) if online else 0
        latency = rng.uniform(4.0, 30.0) if online else 0.0
        loss = 0.0 if online else 100.0
        if online and rng.random() < 0.1:
            latency *= 3
            loss = rng.uniform(1.0, 12.0)

        _add_reading(ctx, device_id, ts, "ap_online", online, "true" if online else "false")
        _add_reading(ctx, device_id, ts, "ap_clients", clients, None)
        _add_reading(ctx, device_id, ts, "ap_latency_ms", round(latency, 1), None)
        _add_reading(ctx, device_id, ts, "ap_loss_pct", round(loss, 2), None)


def _gen_nfc_attendance(ctx: "_Ctx", ts: datetime) -> None:
    device_id, name, room = NFC_DEVICE
    _upsert_sim_device(ctx, device_id, name, room, ts)
    rng = _rng(ctx.seed, "nfc_attendance", ts)
    if rng.random() > 0.55:
        return
    ctx.db.add(
        Event(
            device_id=device_id,
            ts=ts,
            kind="nfc_attendance",
            severity="info",
            detail={"phase": "entry" if rng.random() > 0.5 else "exit", "count": rng.randint(1, 4)},
            source="simulated",
        )
    )


def _gen_restroom(ctx: "_Ctx", ts: datetime) -> None:
    device_id, name, room = RESTROOM_DEVICE
    _upsert_sim_device(ctx, device_id, name, room, ts)
    rng = _rng(ctx.seed, "restroom", ts)
    occupied = rng.random() > 0.6
    passes = rng.randint(0, 3)

    _add_reading(
        ctx,
        device_id,
        ts,
        "occupancy",
        None,
        "occupied" if occupied else "unoccupied_suspected",
    )
    _add_reading(ctx, device_id, ts, "pass_count_per_interval", passes, None)


GENERATORS = {
    "rooms": _gen_rooms,
    "wifi_aps": _gen_wifi_aps,
    "nfc_attendance": _gen_nfc_attendance,
    "restroom": _gen_restroom,
}


# --------------------------------------------------------------------------- public API
def ensure_defaults(db: Session) -> None:
    existing = {row.subsystem for row in db.scalars(select(SimSource)).all()}
    for subsystem in SUBSYSTEMS:
        if subsystem not in existing:
            db.add(
                SimSource(
                    subsystem=subsystem,
                    enabled=False,
                    seed=42,
                    rate_per_minute=DEFAULT_RATE_PER_MINUTE,
                    meta={},
                )
            )
    db.commit()


def list_sources(db: Session) -> list[dict]:
    rows = {row.subsystem: row for row in db.scalars(select(SimSource)).all()}
    out = []
    for subsystem in SUBSYSTEMS:
        row = rows.get(subsystem)
        out.append(
            {
                "subsystem": subsystem,
                "enabled": bool(row and row.enabled),
                "seed": row.seed if row else 42,
                "rate_per_minute": row.rate_per_minute if row else DEFAULT_RATE_PER_MINUTE,
                "last_generated_at": None if not row or not row.last_generated_at else row.last_generated_at,
                "requires_authorisation": _authorisation_note(subsystem),
            }
        )
    return out


def _authorisation_note(subsystem: str) -> str:
    return {
        "rooms": "Other rooms have no sensor hardware; data is simulated.",
        "wifi_aps": "Real AP telemetry requires an authorised controller/log API from campus IT.",
        "nfc_attendance": "Real attendance requires campus card/NFC reader integration and consent.",
        "restroom": "Anonymous occupancy only; identity or personal tracking is not supported.",
    }[subsystem]


def enable(
    db: Session,
    subsystem: str,
    request: SimToggleRequest,
) -> tuple[dict | None, str | None]:
    if subsystem not in SUBSYSTEMS:
        return None, "unknown_subsystem"
    if request.backfill_hours > MAX_BACKFILL_HOURS:
        return None, "backfill_window_too_large"

    ensure_defaults(db)
    row = db.get(SimSource, subsystem)
    assert row is not None

    row.enabled = request.enabled
    row.seed = request.seed
    row.rate_per_minute = request.rate_per_minute

    if request.enabled and request.backfill_hours > 0:
        _backfill(db, subsystem, request.seed, request.rate_per_minute, request.backfill_hours)

    row.last_generated_at = utcnow()
    db.commit()

    return (
        {
            "subsystem": subsystem,
            "enabled": row.enabled,
            "seed": row.seed,
            "rate_per_minute": row.rate_per_minute,
            "backfilled_hours": request.backfill_hours,
            "source": "simulated",
        },
        None,
    )


def _backfill(db: Session, subsystem: str, seed: int, rate: int, hours: float) -> None:
    end = utcnow().replace(second=0, microsecond=0)
    start = end - timedelta(hours=hours)

    period_s = max(60.0 / max(rate, 1), 1.0)
    ticks = int((end - start).total_seconds() // period_s)
    if ticks > MAX_BACKFILL_TICKS:
        ticks = MAX_BACKFILL_TICKS
        period_s = max((end - start).total_seconds() / ticks, 1.0)

    generator = GENERATORS[subsystem]
    ctx = _Ctx(db, seed, touch_at=end)
    for i in range(ticks + 1):
        ts = start + timedelta(seconds=i * period_s)
        generator(ctx, ts)
    db.commit()


def generate_live_once(db: Session) -> int:
    """Append one sample per enabled subsystem when its period has elapsed."""
    now = utcnow()
    generated = 0

    for row in db.scalars(select(SimSource)).all():
        if not row.enabled:
            continue
        period = timedelta(seconds=60.0 / max(row.rate_per_minute, 1))
        if row.last_generated_at and (now - row.last_generated_at) < period:
            continue

        ts = now.replace(second=0, microsecond=0)
        GENERATORS[row.subsystem](_Ctx(db, row.seed, touch_at=now), ts)
        row.last_generated_at = now
        generated += 1

    if generated:
        db.commit()
    return generated


# --------------------------------------------------------------------------- background worker
class SimWorker:
    def __init__(self, interval_s: float = 5.0) -> None:
        self.interval_s = interval_s
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="sim-worker", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=3)

    def _run(self) -> None:
        factory = session_factory()
        while not self._stop.is_set():
            try:
                with factory() as db:
                    generate_live_once(db)
            except Exception:  # noqa: BLE001 - worker must never die
                pass
            time.sleep(self.interval_s)
