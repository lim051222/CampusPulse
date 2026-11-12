"""Restroom feedback, simulated AC delegation, simulated Wi-Fi HVAC/AP health and lighting verdicts."""

from __future__ import annotations

import math
import random
from datetime import timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .ai_service import answer_question
from .db import get_db
from .models import (
    AcCommand,
    BadgeState,
    Device,
    Reading,
    RestroomFeedback,
    RestroomSetting,
    WifiEvent,
    WifiSample,
)
from .utils import api_error, iso, utcnow

router = APIRouter(tags=["campus"])

LIGHT_TOO_DARK = 30.0
LIGHT_TOO_BRIGHT = 75.0
LIGHT_MIXED_SPREAD = 40.0

APS = [
    {"ap_id": "AP-C1-01", "name": "AP Classroom 1", "room": "Classroom 1"},
    {"ap_id": "AP-C2-01", "name": "AP Classroom 2", "room": "Classroom 2"},
]

LATENCY_WARN_MS = 100.0
LOSS_WARN_PCT = 5.0
LOAD_WARN_PCT = 80.0


# --------------------------------------------------------------------------- schemas
class RestroomToggle(BaseModel):
    restroom_id: str = Field(min_length=1, max_length=32)
    enabled: bool


class RestroomRating(BaseModel):
    restroom_id: str = Field(min_length=1, max_length=32)
    stars: int = Field(ge=0, le=5)
    abandoned: bool = False


class AcRequest(BaseModel):
    room: str = Field(min_length=1, max_length=32)
    delegate_badge: str = Field(min_length=1, max_length=16)
    target_c: int = Field(ge=16, le=30)


class AcAdviceRequest(BaseModel):
    room: str = Field(min_length=1, max_length=32)


# --------------------------------------------------------------------------- restroom
def _ensure_setting(db: Session, restroom_id: str) -> RestroomSetting:
    row = db.get(RestroomSetting, restroom_id)
    if row is None:
        row = RestroomSetting(restroom_id=restroom_id, enabled=False, updated_at=utcnow())
        db.add(row)
        db.commit()
    return row


@router.get("/api/v1/restroom/settings")
def get_restroom_settings(db: Session = Depends(get_db)):
    rows = db.scalars(select(RestroomSetting)).all()
    return {
        "items": [
            {"restroom_id": r.restroom_id, "enabled": r.enabled, "updated_at": iso(r.updated_at)}
            for r in rows
        ]
    }


@router.post("/api/v1/restroom/settings")
def set_restroom_settings(body: RestroomToggle, db: Session = Depends(get_db)):
    row = _ensure_setting(db, body.restroom_id)
    row.enabled = body.enabled
    row.updated_at = utcnow()
    db.commit()
    return {"restroom_id": row.restroom_id, "enabled": row.enabled, "updated_at": iso(row.updated_at)}


@router.post("/api/v1/restroom/feedback", status_code=201)
def submit_feedback(body: RestroomRating, db: Session = Depends(get_db)):
    setting = _ensure_setting(db, body.restroom_id)
    if not setting.enabled:
        return api_error(409, "feedback_disabled", restroom_id=body.restroom_id)

    row = RestroomFeedback(
        restroom_id=body.restroom_id,
        stars=body.stars,
        abandoned=body.abandoned,
        submitted_at=utcnow(),
        source="user_submitted",
    )
    db.add(row)
    db.commit()
    return {
        "id": row.id,
        "restroom_id": row.restroom_id,
        "stars": row.stars,
        "abandoned": row.abandoned,
        "submitted_at": iso(row.submitted_at),
        "source": row.source,
    }


@router.get("/api/v1/restroom/summary")
def restroom_summary(restroom_id: str = "restroom-l2", db: Session = Depends(get_db)):
    rows = db.scalars(
        select(RestroomFeedback).where(
            RestroomFeedback.restroom_id == restroom_id,
            RestroomFeedback.abandoned.is_(False),
        )
    ).all()
    setting = db.get(RestroomSetting, restroom_id)
    average = round(sum(r.stars for r in rows) / len(rows), 2) if rows else None
    return {
        "restroom_id": restroom_id,
        "enabled": bool(setting.enabled) if setting else False,
        "ratings": len(rows),
        "average_stars": average,
        "abandoned_sessions": db.scalar(
            select(RestroomFeedback.id)
            .where(RestroomFeedback.restroom_id == restroom_id, RestroomFeedback.abandoned.is_(True))
            .limit(1)
        )
        is not None,
        "source": "user_submitted",
        "note": "Average of student-submitted star ratings, not a sensor measurement.",
    }


# --------------------------------------------------------------------------- AC
@router.post("/api/v1/ac/command", status_code=201)
def ac_command(body: AcRequest, db: Session = Depends(get_db)):
    if not (16 <= body.target_c <= 30):
        return api_error(400, "invalid_temperature", min=16, max=30)

    row = AcCommand(
        id=str(uuid4()),
        room=body.room,
        delegate_badge=body.delegate_badge,
        target_c=body.target_c,
        created_at=utcnow(),
        source="simulated",
    )
    db.add(row)
    db.commit()

    present = db.scalars(select(BadgeState).where(BadgeState.room == body.room)).all()
    return {
        "id": row.id,
        "room": row.room,
        "delegate_badge": row.delegate_badge,
        "target_c": row.target_c,
        "created_at": iso(row.created_at),
        "source": "simulated",
        "badges_in_room": len(present),
        "warning": None if present else "Room appears empty (no badge reporting this room).",
        "note": "Simulated control: this badge has no IR emitter, no command was transmitted.",
    }


@router.get("/api/v1/ac/state")
def ac_state(room: str = "Classroom 1", db: Session = Depends(get_db)):
    row = db.scalars(
        select(AcCommand).where(AcCommand.room == room).order_by(AcCommand.created_at.desc())
    ).first()
    if row is None:
        return {"room": room, "target_c": None, "delegate_badge": None, "source": "simulated"}
    return {
        "room": room,
        "target_c": row.target_c,
        "delegate_badge": row.delegate_badge,
        "created_at": iso(row.created_at),
        "source": "simulated",
    }


def _room_temperature(db: Session, room: str) -> tuple[float | None, list[str]]:
    states = db.scalars(select(BadgeState).where(BadgeState.room == room)).all()
    badge_ids = [s.badge_id for s in states]
    if not badge_ids:
        return None, []

    rows = db.scalars(
        select(Reading)
        .where(Reading.metric == "temperature_c", Reading.ts >= utcnow() - timedelta(hours=1))
        .order_by(Reading.ts.desc())
        .limit(50)
    ).all()
    values = [r.value_num for r in rows if r.value_num is not None]
    if not values:
        return None, badge_ids
    return round(sum(values) / len(values), 1), badge_ids


@router.post("/api/v1/ac/advise")
def ac_advise(body: AcAdviceRequest, db: Session = Depends(get_db)):
    temperature, badge_ids = _room_temperature(db, body.room)
    if temperature is None:
        return {
            "room": body.room,
            "target_c": None,
            "mode": "rule_based",
            "reason": "insufficient_data",
            "message": "No recent temperature readings for this room.",
            "requires_confirmation": True,
            "sources": ["simulated"] if badge_ids else [],
        }

    answer = answer_question(
        db, f"Room {body.room} is at {temperature} C. Suggest an air-conditioner setpoint in 16-30 C."
    )
    target = max(16, min(30, round(temperature - 5)))

    # The rule-based assistant answers in Chinese; the console is English-only, so only use
    # its text when a real model produced it.
    message = (
        answer["answer"]
        if answer["mode"] == "model"
        else (
            f"Measured {temperature} C in {body.room}. Suggested setpoint {target} C "
            f"(measured minus 5 C, clamped to 16-30 C)."
        )
    )

    return {
        "room": body.room,
        "measured_c": temperature,
        "target_c": target,
        "mode": answer["mode"],
        "message": message,
        "badges_considered": badge_ids,
        "requires_confirmation": True,
        "sources": ["real", "simulated"] if badge_ids else ["real"],
    }


# --------------------------------------------------------------------------- Wi-Fi AP health
def _ap_sample(ap_id: str, minute) -> dict:
    """Deterministic per-minute sample so the series is stable across requests."""
    bucket = int(minute.timestamp() // 60)
    rng = random.Random((bucket * 31) ^ sum(ord(c) for c in ap_id))
    online = rng.random() > 0.02
    clients = rng.randint(10, 60) if online else 0
    latency = rng.uniform(4.0, 30.0) if online else 0.0
    loss = 0.0 if online else 100.0
    load = min(95.0, clients * 1.6 + rng.uniform(-5, 5))

    # Occasional anomaly windows so the alert view has something to show.
    if online and rng.random() < 0.08:
        latency *= 4
        loss = rng.uniform(5.5, 14.0)
        load = min(99.0, load + 30)
    return {
        "online": online,
        "clients": clients,
        "latency_ms": round(latency, 1),
        "loss_pct": round(loss, 2),
        "load_pct": round(load, 1),
    }


def _sync_wifi(db: Session, minutes: int = 180) -> None:
    now = utcnow().replace(second=0, microsecond=0)
    existing = {
        (s.ap_id, s.minute)
        for s in db.scalars(
            select(WifiSample).where(WifiSample.minute >= now - timedelta(minutes=minutes))
        ).all()
    }
    for ap in APS:
        for i in range(minutes):
            minute = now - timedelta(minutes=i)
            if (ap["ap_id"], minute) in existing:
                continue
            sample = _ap_sample(ap["ap_id"], minute)
            db.add(WifiSample(ap_id=ap["ap_id"], minute=minute, source="simulated", **sample))

            kind = None
            if not sample["online"]:
                kind = "offline"
            elif sample["latency_ms"] > LATENCY_WARN_MS:
                kind = "latency"
            elif sample["loss_pct"] > LOSS_WARN_PCT:
                kind = "packet_loss"
            elif sample["load_pct"] > LOAD_WARN_PCT:
                kind = "load"

            if kind:
                db.add(
                    WifiEvent(
                        id=str(uuid4()),
                        ap_id=ap["ap_id"],
                        kind=kind,
                        severity="critical" if kind == "offline" else "warning",
                        started_at=minute,
                        source="simulated",
                    )
                )
    db.commit()


@router.get("/api/v1/wifi/aps")
def wifi_aps(db: Session = Depends(get_db)):
    _sync_wifi(db)
    now = utcnow().replace(second=0, microsecond=0)
    out = []
    for ap in APS:
        latest = db.scalars(
            select(WifiSample)
            .where(WifiSample.ap_id == ap["ap_id"])
            .order_by(WifiSample.minute.desc())
        ).first()
        if latest is None:
            continue
        out.append(
            {
                **ap,
                "online": latest.online,
                "clients": latest.clients,
                "latency_ms": latest.latency_ms,
                "loss_pct": latest.loss_pct,
                "load_pct": latest.load_pct,
                "minute": iso(latest.minute),
                "source": "simulated",
            }
        )
    return {"items": out, "count": len(out), "note": "No campus controller API is authorised; AP data is simulated."}


@router.get("/api/v1/wifi/alerts")
def wifi_alerts(limit: int = 40, db: Session = Depends(get_db)):
    _sync_wifi(db)
    rows = db.scalars(select(WifiEvent).order_by(WifiEvent.started_at.desc()).limit(limit)).all()
    return {
        "items": [
            {
                "id": e.id,
                "ap_id": e.ap_id,
                "kind": e.kind,
                "severity": e.severity,
                "started_at": iso(e.started_at),
                "resolved_at": iso(e.resolved_at),
                "source": e.source,
            }
            for e in rows
        ],
        "count": len(rows),
    }


@router.get("/api/v1/wifi/series")
def wifi_series(
    ap_id: str = "AP-C1-01",
    hours: float = Query(default=1, gt=0, le=168),
    db: Session = Depends(get_db),
):
    _sync_wifi(db)
    since = utcnow() - timedelta(hours=hours)
    rows = db.scalars(
        select(WifiSample)
        .where(WifiSample.ap_id == ap_id, WifiSample.minute >= since)
        .order_by(WifiSample.minute.asc())
    ).all()
    return {
        "ap_id": ap_id,
        "hours": hours,
        "points": [
            {
                "ts": iso(r.minute),
                "clients": r.clients,
                "latency_ms": r.latency_ms,
                "loss_pct": r.loss_pct,
                "load_pct": r.load_pct,
                "online": r.online,
            }
            for r in rows
        ],
        "count": len(rows),
        "source": "simulated",
    }


# --------------------------------------------------------------------------- lighting
def _median(values: list[float]) -> float:
    ordered = sorted(values)
    mid = len(ordered) // 2
    return ordered[mid] if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2


@router.get("/api/v1/lighting/summary")
def lighting_summary(db: Session = Depends(get_db)):
    since = utcnow() - timedelta(minutes=15)

    # One value per device (its latest), not one per sample: "badge_count" must mean
    # badges, otherwise a single chatty badge looks like a crowd.
    rows = db.scalars(
        select(Reading)
        .where(Reading.metric == "light_rel_pct", Reading.ts >= since)
        .order_by(Reading.ts.desc())
    ).all()

    devices = {device.id: device for device in db.scalars(select(Device)).all()}

    latest_by_device: dict[str, Reading] = {}
    for reading in rows:
        if reading.device_id in latest_by_device:
            continue
        latest_by_device[reading.device_id] = reading

    by_room: dict[str, list[dict]] = {}
    for device_id, reading in latest_by_device.items():
        device = devices.get(device_id)
        room = (device.room if device and device.room else None) or "unknown"
        by_room.setdefault(room, []).append(
            {
                "device_id": device_id,
                "value": reading.value_num,
                "ts": iso(reading.ts),
                "source": reading.source,
            }
        )

    rooms = []
    for room, samples in by_room.items():
        values = [s["value"] for s in samples if s["value"] is not None]
        if not values:
            continue
        median = round(_median(values), 1)
        spread = round(max(values) - min(values), 1)
        if median < LIGHT_TOO_DARK:
            verdict = "too_dark"
        elif median > LIGHT_TOO_BRIGHT:
            verdict = "too_bright"
        else:
            verdict = "comfortable"
        if spread > LIGHT_MIXED_SPREAD:
            verdict = "mixed"

        recommendation = None
        if verdict == "too_dark":
            recommendation = "Increase lighting — needs human confirmation."
        elif verdict == "too_bright":
            recommendation = "Reduce lighting or shade the room — needs human confirmation."

        rooms.append(
            {
                "room": room,
                "verdict": verdict,
                "median_index": median,
                "spread": spread,
                "badge_count": len(values),
                "badges": samples,
                "recommendation": recommendation,
                "requires_confirmation": True,
                "source": samples[0]["source"] if samples else "real",
                "unit": "relative light index (not lux)",
            }
        )

    return {"rooms": rooms, "count": len(rooms), "empty_reason": None if rooms else "no_recent_light_readings"}
