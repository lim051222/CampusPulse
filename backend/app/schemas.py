"""Request/response models."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

SourceLiteral = Literal["real", "simulated"]


class TelemetryEnvelope(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
    seq: int = Field(ge=0)
    fw_version: str | None = None
    ts: datetime | None = None
    uptime_ms: int | None = None
    source: SourceLiteral
    mode: str | None = None
    # badge additions (design D5) - all optional so v1 telemetry still validates
    badge_id: str | None = Field(default=None, max_length=16)
    room: str | None = Field(default=None, max_length=32)
    room_rssi: int | None = None
    room_confidence: str | None = None
    sos: str | None = None
    ac_delegate: dict[str, Any] | None = None
    dropped_count: int = Field(default=0, ge=0)
    readings: dict[str, Any] = Field(default_factory=dict)
    faults: list[str] = Field(default_factory=list)
    event: dict[str, Any] | None = None


class CommandRequest(BaseModel):
    type: str = Field(min_length=1, max_length=48)
    args: dict[str, Any] = Field(default_factory=dict)


class AckRequest(BaseModel):
    status: Literal["acked", "failed"] = "acked"
    error: str | None = Field(default=None, max_length=64)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


class SimToggleRequest(BaseModel):
    # `source` is accepted only so that an attempt to spoof it can be rejected explicitly.
    model_config = ConfigDict(extra="allow")

    enabled: bool = True
    seed: int = 42
    backfill_hours: float = Field(default=0, ge=0)
    rate_per_minute: int = Field(default=6, ge=1, le=120)
