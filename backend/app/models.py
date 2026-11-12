"""SQLAlchemy models - see design.md D8 (long-table readings)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    room: Mapped[str | None] = mapped_column(String(64), nullable=True)
    fw_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mode: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source: Mapped[str] = mapped_column(String(16), default="real", nullable=False)
    first_seen: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class Telemetry(Base):
    __tablename__ = "telemetry"
    __table_args__ = (
        # (device, seq, ts) rather than (device, seq): a re-flashed board restarts its
        # counter, but its samples carry new timestamps and must be stored.
        Index("uq_telemetry_device_seq_ts", "device_id", "seq", "ts", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class Reading(Base):
    __tablename__ = "readings"
    __table_args__ = (
        Index("ix_readings_device_metric_ts", "device_id", "metric", "ts"),
        Index("ix_readings_ts", "ts"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telemetry_id: Mapped[int | None] = mapped_column(
        ForeignKey("telemetry.id", ondelete="CASCADE"), nullable=True
    )
    device_id: Mapped[str] = mapped_column(String(64), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    metric: Mapped[str] = mapped_column(String(48), nullable=False)
    value_num: Mapped[float | None] = mapped_column(Float, nullable=True)
    value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(16), nullable=False)


class Command(Base):
    __tablename__ = "commands"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    device_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(48), nullable=False)
    args: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    acked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(String(64), nullable=True)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (Index("ix_events_ts", "ts"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    kind: Mapped[str] = mapped_column(String(48), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), default="info", nullable=False)
    detail: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)


class SimSource(Base):
    __tablename__ = "sim_sources"

    subsystem: Mapped[str] = mapped_column(String(32), primary_key=True)
    enabled: Mapped[bool] = mapped_column(default=False, nullable=False)
    seed: Mapped[int] = mapped_column(Integer, default=42, nullable=False)
    rate_per_minute: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    last_generated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class Badge(Base):
    """Demo badge roster. Identities are fictional (see docs/hardware-capabilities.md)."""

    __tablename__ = "badges"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)      # TP000000
    name: Mapped[str] = mapped_column(String(96), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)      # student|lecturer|staff
    avatar_seed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="simulated", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class BadgeState(Base):
    __tablename__ = "badge_state"

    badge_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    room: Mapped[str | None] = mapped_column(String(32), nullable=True)
    room_rssi: Mapped[int | None] = mapped_column(Integer, nullable=True)
    room_confidence: Mapped[str | None] = mapped_column(String(16), nullable=True)
    page: Mapped[str | None] = mapped_column(String(24), nullable=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)


class SosEvent(Base):
    __tablename__ = "sos_events"
    __table_args__ = (Index("ix_sos_badge_status", "badge_id", "status"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    badge_id: Mapped[str] = mapped_column(String(16), nullable=False)
    room: Mapped[str | None] = mapped_column(String(32), nullable=True)
    raised_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="raised", nullable=False)
    acked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    source: Mapped[str] = mapped_column(String(16), nullable=False)


class RollCall(Base):
    __tablename__ = "rollcalls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    room: Mapped[str] = mapped_column(String(32), nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    present_json: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)
    absent_json: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="simulated", nullable=False)


class RestroomSetting(Base):
    __tablename__ = "restroom_settings"

    restroom_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    enabled: Mapped[bool] = mapped_column(default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class RestroomFeedback(Base):
    __tablename__ = "restroom_feedback"
    __table_args__ = (Index("ix_feedback_restroom_ts", "restroom_id", "submitted_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    restroom_id: Mapped[str] = mapped_column(String(32), nullable=False)
    stars: Mapped[int] = mapped_column(Integer, nullable=False)
    abandoned: Mapped[bool] = mapped_column(default=False, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="user_submitted", nullable=False)


class AcCommand(Base):
    __tablename__ = "ac_commands"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    room: Mapped[str] = mapped_column(String(32), nullable=False)
    delegate_badge: Mapped[str] = mapped_column(String(16), nullable=False)
    target_c: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="simulated", nullable=False)


class WifiSample(Base):
    __tablename__ = "wifi_samples"
    __table_args__ = (
        UniqueConstraint("ap_id", "minute", name="uq_wifi_ap_minute"),
        Index("ix_wifi_minute", "minute"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ap_id: Mapped[str] = mapped_column(String(24), nullable=False)
    minute: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    online: Mapped[bool] = mapped_column(default=True, nullable=False)
    clients: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    loss_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    load_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="simulated", nullable=False)


class WifiEvent(Base):
    __tablename__ = "wifi_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    ap_id: Mapped[str] = mapped_column(String(24), nullable=False)
    kind: Mapped[str] = mapped_column(String(24), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), default="warning", nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    source: Mapped[str] = mapped_column(String(16), default="simulated", nullable=False)
