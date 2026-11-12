"""Shared helpers: timestamps, API error envelopes."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi.responses import JSONResponse

UTC = timezone.utc


def utcnow() -> datetime:
    """Naive UTC - SQLite stores naive datetimes, comparisons stay consistent."""
    return datetime.now(UTC).replace(tzinfo=None)


def parse_ts(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).replace(tzinfo=None)


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def api_error(status_code: int, code: str, **extra) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": code, **extra})
