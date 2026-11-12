"""Database wiring. `configure()` is called by the app factory so tests can use their own file."""

from __future__ import annotations

from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .models import Base

_engine = None
_session_factory: sessionmaker | None = None


def configure(url: str):
    global _engine, _session_factory

    if url.startswith("sqlite:///"):
        db_path = Path(url.replace("sqlite:///", "", 1))
        db_path.parent.mkdir(parents=True, exist_ok=True)

    _engine = create_engine(
        url,
        connect_args={"check_same_thread": False} if url.startswith("sqlite") else {},
        future=True,
    )
    _session_factory = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False, future=True)
    Base.metadata.create_all(_engine)
    return _engine


def get_db() -> Iterator[Session]:
    assert _session_factory is not None, "database not configured"
    session = _session_factory()
    try:
        yield session
    finally:
        session.close()


def session_factory() -> sessionmaker:
    assert _session_factory is not None, "database not configured"
    return _session_factory
