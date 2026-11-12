"""Energy / cleaning insight endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .db import get_db
from .services import build_insights

router = APIRouter(tags=["insights"])


@router.get("/api/v1/insights")
def get_insights(
    device_id: str | None = None,
    hours: float = Query(default=24, gt=0, le=24 * 7),
    db: Session = Depends(get_db),
):
    return build_insights(db, device_id, hours)
