"""Telemetry ingest + reading queries."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, Query
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import get_db
from .models import BadgeState, Device, Event, Reading, Telemetry
from .routes_badges import create_sos, ensure_roster, live_sos_for
from .schemas import TelemetryEnvelope
from .services import dispatch_commands
from .utils import api_error, iso, parse_ts, utcnow

router = APIRouter(tags=["telemetry"])

MAX_BATCH = 100
MAX_LIMIT = 5000


def _store_value(value: Any) -> tuple[float | None, str | None] | None:
    """Map one reading value onto the long-table (numeric, text) pair."""
    if value is None:
        return None  # null == "sensor gave nothing", the faults[] list explains why
    if isinstance(value, bool):
        return (1.0 if value else 0.0, "true" if value else "false")
    if isinstance(value, (int, float)):
        return (float(value), None)
    return (None, str(value))


def _upsert_device(db: Session, env: TelemetryEnvelope, ts) -> None:
    device = db.get(Device, env.device_id)
    if device is None:
        device = Device(
            id=env.device_id,
            first_seen=ts,
            last_seen=ts,
            source=env.source,
            meta={},
        )
        db.add(device)
    device.last_seen = ts
    if env.room:
        device.room = env.room
    if env.fw_version:
        device.fw_version = env.fw_version
    if env.mode:
        device.mode = env.mode


def _upsert_badge_state(db: Session, env: TelemetryEnvelope, ts) -> None:
    if not env.badge_id:
        return
    state = db.get(BadgeState, env.badge_id)
    page = None
    if isinstance(env.readings, dict):
        page = env.readings.get("page") or None
    if state is None:
        state = BadgeState(
            badge_id=env.badge_id,
            room=env.room,
            room_rssi=env.room_rssi,
            room_confidence=env.room_confidence,
            page=page,
            last_seen=ts,
            source=env.source,
        )
        db.add(state)
    else:
        state.room = env.room or state.room
        state.room_rssi = env.room_rssi if env.room_rssi is not None else state.room_rssi
        state.room_confidence = env.room_confidence or state.room_confidence
        state.page = page or state.page
        state.last_seen = ts
        state.source = env.source


@router.post("/api/v1/ingest", status_code=202)
def ingest(payload: Any = Body(...), db: Session = Depends(get_db)):
    items = payload if isinstance(payload, list) else [payload]
    if not items:
        return api_error(400, "empty_batch")
    if len(items) > MAX_BATCH:
        return api_error(400, "batch_too_large", limit=MAX_BATCH)

    envelopes: list[TelemetryEnvelope] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            return api_error(400, "validation_failed", detail=f"item {index} is not an object")
        if item.get("source") not in ("real", "simulated"):
            return api_error(400, "validation_failed", detail=f"item {index}: source must be real|simulated")
        try:
            envelopes.append(TelemetryEnvelope.model_validate(item))
        except ValidationError as exc:
            return api_error(400, "validation_failed", detail=exc.errors()[:3])

    accepted = 0
    duplicates = 0
    commands: list[dict[str, Any]] = []

    for env in envelopes:
        ts = parse_ts(env.ts) or utcnow()

        # Idempotency is (device, seq, ts): a retransmit repeats all three, while a
        # re-flashed board restarts seq at 1 with a fresh timestamp.
        existing = db.scalar(
            select(Telemetry.id).where(
                Telemetry.device_id == env.device_id,
                Telemetry.seq == env.seq,
                Telemetry.ts == ts,
            )
        )
        if existing is not None:
            duplicates += 1
            continue

        record = Telemetry(
            device_id=env.device_id,
            seq=env.seq,
            ts=ts,
            received_at=utcnow(),
            source=env.source,
            payload=env.model_dump(mode="json"),
        )

        try:
            with db.begin_nested():
                db.add(record)
                db.flush()
        except IntegrityError:
            duplicates += 1
            continue

        _upsert_device(db, env, ts)
        _upsert_badge_state(db, env, ts)

        if env.event and str(env.event.get("kind", "")) == "sos":
            ensure_roster(db)
            create_sos(
                db,
                env.badge_id or env.device_id,
                env.room,
                env.source,
            )

        for metric, value in (env.readings or {}).items():
            stored = _store_value(value)
            if stored is None:
                continue
            db.add(
                Reading(
                    telemetry_id=record.id,
                    device_id=env.device_id,
                    ts=ts,
                    metric=metric,
                    value_num=stored[0],
                    value_text=stored[1],
                    source=env.source,
                )
            )

        if env.faults:
            db.add(
                Event(
                    device_id=env.device_id,
                    ts=ts,
                    kind="faults",
                    severity="warning",
                    detail={"faults": env.faults},
                    source=env.source,
                )
            )

        if env.event:
            db.add(
                Event(
                    device_id=env.device_id,
                    ts=ts,
                    kind=str(env.event.get("kind", "event")),
                    severity=str(env.event.get("severity", "info")),
                    detail=env.event,
                    source=env.source,
                )
            )

        commands.extend(dispatch_commands(db, env.device_id))
        accepted += 1

    db.commit()

    sos_view = None
    for env in envelopes:
        live = live_sos_for(db, env.badge_id or env.device_id)
        if live is not None:
            sos_view = {"id": live.id, "status": live.status}
            break

    return {"accepted": accepted, "duplicates": duplicates, "commands": commands, "sos": sos_view}


@router.get("/api/v1/readings")
def list_readings(
    device_id: str | None = None,
    metric: str | None = None,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    limit: int = 500,
    db: Session = Depends(get_db),
):
    capped = max(1, min(limit, MAX_LIMIT))
    truncated = limit > MAX_LIMIT

    stmt = select(Reading)
    if device_id:
        stmt = stmt.where(Reading.device_id == device_id)
    if metric:
        stmt = stmt.where(Reading.metric == metric)

    start = parse_ts(from_)
    end = parse_ts(to)
    if start:
        stmt = stmt.where(Reading.ts >= start)
    if end:
        stmt = stmt.where(Reading.ts <= end)

    rows = db.scalars(stmt.order_by(Reading.ts.asc()).limit(capped + 1)).all()
    if len(rows) > capped:
        rows = rows[:capped]
        truncated = True

    items = [
        {
            "ts": iso(row.ts),
            "device_id": row.device_id,
            "metric": row.metric,
            "value_num": row.value_num,
            "value_text": row.value_text,
            "source": row.source,
        }
        for row in rows
    ]
    return {"items": items, "count": len(items), "truncated": truncated}
