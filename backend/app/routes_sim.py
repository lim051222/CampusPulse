"""Simulated subsystem endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .db import get_db
from .schemas import SimToggleRequest
from .sim_engine import enable, list_sources
from .utils import api_error

router = APIRouter(tags=["simulation"])


@router.get("/api/v1/sim")
def get_sim_sources(db: Session = Depends(get_db)):
    items = list_sources(db)
    return {"items": items, "count": len(items)}


@router.post("/api/v1/sim/{subsystem}")
def toggle_sim_subsystem(
    subsystem: str,
    body: SimToggleRequest,
    db: Session = Depends(get_db),
):
    declared = (body.model_extra or {}).get("source")
    if declared is not None and declared != "simulated":
        return api_error(400, "source_spoof_rejected", detail="the simulated channel always writes source=simulated")

    payload, error = enable(db, subsystem, body)
    if error == "unknown_subsystem":
        return api_error(404, error, subsystem=subsystem)
    if error:
        return api_error(400, error, limit_hours=24)
    return payload
