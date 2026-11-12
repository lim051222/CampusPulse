"""Device registry, command dispatch and acknowledgement."""

from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Command, Device
from .schemas import AckRequest, CommandRequest
from .services import command_view, device_view, dispatch_commands, expire_commands
from .utils import api_error, utcnow

router = APIRouter(tags=["devices"])

ALLOWED_COMMANDS = {"set_mode", "mute_alarm", "force_relay_off", "set_sampling_interval"}
THREE_WAY_SUPERSEDE = {"set_mode"}


@router.get("/api/v1/devices")
def list_devices(db: Session = Depends(get_db)):
    expire_commands(db)
    db.commit()

    devices = db.scalars(select(Device).order_by(Device.id)).all()
    now = utcnow()
    items = [device_view(db, d, now) for d in devices]
    return {"items": items, "count": len(items)}


@router.get("/api/v1/devices/{device_id}")
def get_device(device_id: str, db: Session = Depends(get_db)):
    device = db.get(Device, device_id)
    if device is None:
        return api_error(404, "device_not_found", device_id=device_id)
    return device_view(db, device)


@router.post("/api/v1/devices/{device_id}/command", status_code=201)
def create_command(device_id: str, body: CommandRequest, db: Session = Depends(get_db)):
    if body.type not in ALLOWED_COMMANDS:
        return api_error(400, "unknown_command", allowed=sorted(ALLOWED_COMMANDS))

    if body.type in THREE_WAY_SUPERSEDE:
        older = db.scalars(
            select(Command).where(
                Command.device_id == device_id,
                Command.type == body.type,
                Command.status == "pending",
            )
        ).all()
        for cmd in older:
            cmd.status = "superseded"
            cmd.error = "superseded"

    command = Command(
        id=str(uuid4()),
        device_id=device_id,
        type=body.type,
        args=body.args or {},
        status="pending",
        created_at=utcnow(),
    )
    db.add(command)
    db.commit()
    return command_view(command)


@router.get("/api/v1/devices/{device_id}/commands")
def list_pending_commands(device_id: str, db: Session = Depends(get_db)):
    expire_commands(db)
    commands = dispatch_commands(db, device_id)
    db.commit()
    return {"commands": commands}


@router.post("/api/v1/devices/{device_id}/commands/{command_id}/ack")
def ack_command(
    device_id: str,
    command_id: str,
    body: AckRequest,
    db: Session = Depends(get_db),
):
    command = db.get(Command, command_id)
    if command is None or command.device_id != device_id:
        return api_error(404, "command_not_found", command_id=command_id)

    command.status = body.status
    command.acked_at = utcnow()
    command.error = body.error
    db.commit()
    return command_view(command)


@router.get("/api/v1/devices/{device_id}/commands/history")
def command_history(device_id: str, limit: int = 50, db: Session = Depends(get_db)):
    expire_commands(db)
    db.commit()

    capped = max(1, min(limit, 200))
    rows = db.scalars(
        select(Command)
        .where(Command.device_id == device_id)
        .order_by(Command.created_at.desc())
        .limit(capped)
    ).all()
    return {"items": [command_view(c) for c in rows], "count": len(rows)}
