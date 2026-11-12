"""Badge roster, SOS lifecycle and roll call."""

from __future__ import annotations

from collections import Counter
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Badge, BadgeState, RollCall, SosEvent
from .services import latest_readings
from .utils import api_error, iso, utcnow

router = APIRouter(tags=["badges"])

ROLES = ("student", "lecturer", "staff")


# --------------------------------------------------------------------------- roster
DEMO_ROSTER: list[tuple[str, str, str]] = [
    ("TP000000", "LIM QING YANG", "student"),
    ("TP000012", "MUHAMMAD IRFAN BIN SULAIMAN", "student"),
    ("TP000031", "TAN WEI LING", "student"),
    ("TP000044", "ARVIND RAJ A/L KUMAR", "student"),
    ("TP000057", "SITI KHADIJAH BINTI OMAR", "student"),
    ("TP000063", "LEE JUN HAO", "student"),
    ("TP000078", "FATIN AMIRA BINTI ZULKIFLI", "student"),
    ("TP000081", "DANIEL WONG KAH SENG", "student"),
    ("TP000095", "NURUL IZZAH BINTI HASSAN", "student"),
    ("TP000102", "DR. RAJESH MENON", "lecturer"),
    ("TP000118", "MS. CHONG LI FANG", "lecturer"),
    ("TP000124", "PROF. AHMAD FAIZAL BIN YUSOF", "lecturer"),
    ("TP000130", "PN. NORHAYATI BINTI SULAIMAN", "staff"),
    ("TP000141", "MR. KUMARAN A/L SIVAM", "staff"),
]

ROOM_ROTATION = ("Classroom 1", "Classroom 2", "unknown")


def ensure_roster(db: Session) -> None:
    existing = {row.id: row for row in db.scalars(select(Badge)).all()}
    now = utcnow()
    for index, (badge_id, name, role) in enumerate(DEMO_ROSTER):
        if badge_id in existing:
            # Keep the demo identity in sync with the code-defined roster.
            row = existing[badge_id]
            if row.source == "simulated" and row.name != name:
                row.name = name
            continue
        db.add(
            Badge(
                id=badge_id,
                name=name,
                role=role,
                avatar_seed=sum(ord(ch) for ch in badge_id) + index,
                source="simulated",
                created_at=now,
            )
        )
        # A believable starting position so the console is never empty.
        db.add(
            BadgeState(
                badge_id=badge_id,
                room=ROOM_ROTATION[index % len(ROOM_ROTATION)],
                room_rssi=-55 - (index % 25),
                room_confidence="high" if index % 3 == 0 else "medium",
                page="HOME",
                last_seen=now,
                source="simulated",
            )
        )
    db.commit()


# --------------------------------------------------------------------------- views
def _badge_view(badge: Badge, state: BadgeState | None) -> dict[str, Any]:
    return {
        "badge_id": badge.id,
        "name": badge.name,
        "role": badge.role,
        "avatar_seed": badge.avatar_seed,
        "source": badge.source,
        "room": state.room if state else None,
        "room_rssi": state.room_rssi if state else None,
        "room_confidence": state.room_confidence if state else None,
        "page": state.page if state else None,
        "last_seen": iso(state.last_seen) if state else None,
    }


def _sos_view(event: SosEvent) -> dict[str, Any]:
    return {
        "id": event.id,
        "badge_id": event.badge_id,
        "room": event.room,
        "raised_at": iso(event.raised_at),
        "status": event.status,
        "acked_at": iso(event.acked_at),
        "resolved_at": iso(event.resolved_at),
        "source": event.source,
    }


def create_sos(db: Session, badge_id: str, room: str | None, source: str) -> tuple[SosEvent, bool]:
    """Returns (event, created). Reuses an existing live SOS instead of duplicating."""
    active = db.scalars(
        select(SosEvent).where(SosEvent.badge_id == badge_id, SosEvent.status == "raised")
    ).first()
    if active is not None:
        return active, False

    event = SosEvent(
        id=str(uuid4()),
        badge_id=badge_id,
        room=room,
        raised_at=utcnow(),
        status="raised",
        source=source,
    )
    db.add(event)
    db.commit()
    return event, True


def live_sos_for(db: Session, badge_id: str) -> SosEvent | None:
    return db.scalars(
        select(SosEvent)
        .where(SosEvent.badge_id == badge_id, SosEvent.status.in_(("raised", "acknowledged")))
        .order_by(SosEvent.raised_at.desc())
    ).first()


# --------------------------------------------------------------------------- routes
@router.get("/api/v1/badges")
def list_badges(db: Session = Depends(get_db)):
    ensure_roster(db)
    states = {row.badge_id: row for row in db.scalars(select(BadgeState)).all()}
    items = [_badge_view(b, states.get(b.id)) for b in db.scalars(select(Badge).order_by(Badge.id)).all()]
    return {"items": items, "count": len(items), "source": "simulated"}


@router.get("/api/v1/badges/{badge_id}")
def get_badge(badge_id: str, db: Session = Depends(get_db)):
    ensure_roster(db)
    badge = db.get(Badge, badge_id)
    if badge is None:
        return api_error(404, "badge_not_found", badge_id=badge_id)

    state = db.get(BadgeState, badge_id)
    view = _badge_view(badge, state)
    view["latest"] = latest_readings(db, f"esp32-campuspulse") if badge_id == "TP000000" else {}
    view["sos"] = [
        _sos_view(e)
        for e in db.scalars(
            select(SosEvent).where(SosEvent.badge_id == badge_id).order_by(SosEvent.raised_at.desc()).limit(10)
        ).all()
    ]
    return view


@router.post("/api/v1/badges/{badge_id}/sos", status_code=201)
def raise_sos(badge_id: str, db: Session = Depends(get_db)):
    ensure_roster(db)
    badge = db.get(Badge, badge_id)
    if badge is None:
        return api_error(404, "badge_not_found", badge_id=badge_id)

    state = db.get(BadgeState, badge_id)
    event, created = create_sos(db, badge_id, state.room if state else None, "simulated")
    return {"created": created, "sos": _sos_view(event)}


@router.get("/api/v1/sos")
def list_sos(status: str | None = Query(default=None), limit: int = 50, db: Session = Depends(get_db)):
    capped = max(1, min(limit, 200))
    stmt = select(SosEvent).order_by(SosEvent.raised_at.desc()).limit(capped)
    if status:
        stmt = stmt.where(SosEvent.status == status)
    rows = db.scalars(stmt).all()
    return {"items": [_sos_view(e) for e in rows], "count": len(rows)}


@router.post("/api/v1/sos/{sos_id}/ack")
def ack_sos(sos_id: str, db: Session = Depends(get_db)):
    event = db.get(SosEvent, sos_id)
    if event is None:
        return api_error(404, "sos_not_found", sos_id=sos_id)
    if event.status != "raised":
        return api_error(409, "invalid_status", status=event.status)

    event.status = "acknowledged"
    event.acked_at = utcnow()
    db.commit()
    return _sos_view(event)


@router.post("/api/v1/sos/{sos_id}/resolve")
def resolve_sos(sos_id: str, db: Session = Depends(get_db)):
    event = db.get(SosEvent, sos_id)
    if event is None:
        return api_error(404, "sos_not_found", sos_id=sos_id)

    event.status = "resolved"
    event.resolved_at = utcnow()
    if event.acked_at is None:
        event.acked_at = event.resolved_at
    db.commit()
    return _sos_view(event)


# --------------------------------------------------------------------------- roll call
@router.post("/api/v1/attendance/rollcall", status_code=201)
def roll_call(room: str, db: Session = Depends(get_db)):
    ensure_roster(db)
    badges = db.scalars(select(Badge).order_by(Badge.id)).all()
    states = {row.badge_id: row for row in db.scalars(select(BadgeState)).all()}

    present = []
    absent = []
    for badge in badges:
        state = states.get(badge.id)
        entry = _badge_view(badge, state)
        if state is not None and state.room == room:
            present.append(entry)
        else:
            absent.append(entry)

    record = RollCall(
        id=str(uuid4()),
        room=room,
        triggered_at=utcnow(),
        present_json=present,
        absent_json=absent,
        source="simulated",
    )
    db.add(record)
    db.commit()

    return {
        "id": record.id,
        "room": room,
        "triggered_at": iso(record.triggered_at),
        "present": present,
        "absent": absent,
        "present_count": len(present),
        "absent_count": len(absent),
        "source": "simulated",
        "note": "Derived from simulated badge room telemetry; not proof of attendance.",
    }


@router.get("/api/v1/attendance/rollcalls")
def list_rollcalls(limit: int = 20, db: Session = Depends(get_db)):
    capped = max(1, min(limit, 100))
    rows = db.scalars(select(RollCall).order_by(RollCall.triggered_at.desc()).limit(capped)).all()
    items = []
    for row in rows:
        counts = Counter()
        counts["present"] = len(row.present_json or [])
        counts["absent"] = len(row.absent_json or [])
        items.append(
            {
                "id": row.id,
                "room": row.room,
                "triggered_at": iso(row.triggered_at),
                "present_count": counts["present"],
                "absent_count": counts["absent"],
                "source": row.source,
            }
        )
    return {"items": items, "count": len(items)}
