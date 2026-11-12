"""AI assistant endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .ai_service import answer_question, daily_summary
from .db import get_db
from .schemas import AskRequest

router = APIRouter(tags=["ai"])


@router.post("/api/v1/ai/ask")
def ask(body: AskRequest, db: Session = Depends(get_db)):
    return answer_question(db, body.question)


@router.get("/api/v1/ai/daily-summary")
def summary(db: Session = Depends(get_db)):
    return daily_summary(db)
