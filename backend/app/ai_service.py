"""Grounded AI assistant: query-tool digest first, optional model second, rules always available."""

from __future__ import annotations

import json
from collections import Counter
from datetime import timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import Device, Event
from .services import build_insights, latest_readings, OFFLINE_AFTER_S
from .utils import iso, utcnow

SYSTEM_PROMPT = (
    "You are CampusPulse, an operations assistant for a university campus. "
    "Answer ONLY from the JSON data provided in the user message. "
    "Never invent devices, metrics, numbers or timestamps. "
    "If the data cannot answer the question, say the data is insufficient. "
    "Always cite the device id, metric and time range you used, and state whether the "
    "source is real or simulated. "
    "The system has no people counting and no personal identity data: PIR only detects "
    "motion and can only report 'occupied' or 'unoccupied_suspected'. "
    "When discussing occupancy, say the finding needs human confirmation."
)

BOUNDARY_MARKERS = (
    "多少人", "多少学生", "多少同学", "多少位", "几个学生", "几个人", "人数",
    "谁", "姓名", "名字", "身份", "哪个学生", "哪位学生", "哪位同学", "哪个同学",
    "student name", "which student", "which person",
    "how many people", "how many students", "who is", "who was", "identity",
    "headcount",
)


def build_digest(db: Session, hours: float = 24) -> dict:
    now = utcnow()
    insights = build_insights(db, None, hours)

    devices = []
    simulated = 0
    for device in db.scalars(select(Device).order_by(Device.id)).all():
        age = max((now - device.last_seen).total_seconds(), 0.0)
        if device.source == "simulated":
            simulated += 1
        devices.append(
            {
                "device_id": device.id,
                "name": device.name,
                "room": device.room,
                "mode": device.mode,
                "source": device.source,
                "status": "online" if age <= OFFLINE_AFTER_S else "offline",
                "last_seen": iso(device.last_seen),
                "latest": {
                    metric: {"value_num": v["value_num"], "value_text": v["value_text"], "source": v["source"]}
                    for metric, v in latest_readings(db, device.id).items()
                },
            }
        )

    events = db.scalars(select(Event).where(Event.ts >= now - timedelta(hours=hours))).all()
    event_counts = dict(Counter(event.kind for event in events))

    total = len(devices)
    return {
        "generated_at": iso(now),
        "window_hours": hours,
        "devices": devices,
        "device_count": total,
        "simulated_device_share": round(simulated / total, 3) if total else 0.0,
        "insights": {
            "devices": insights.get("devices", []),
            "suggestions": insights.get("suggestions", []),
            "reason": insights.get("reason"),
            "window": insights.get("window"),
        },
        "events": event_counts,
    }


def _citations(digest: dict) -> list[dict]:
    out = []
    for row in digest["insights"].get("devices", []):
        out.append(
            {
                "device_id": row["device_id"],
                "metrics": ["occupancy", "light_rel_pct"],
                "from": row["first_sample"],
                "to": row["last_sample"],
                "sources": row["sources"],
            }
        )
    if not out:
        for device in digest["devices"]:
            out.append(
                {
                    "device_id": device["device_id"],
                    "metrics": sorted(device["latest"].keys()),
                    "from": None,
                    "to": device["last_seen"],
                    "sources": [device["source"]],
                }
            )
    return out[:12]


def _boundary_answer(question: str) -> str | None:
    lowered = question.lower()
    if any(marker in lowered for marker in BOUNDARY_MARKERS):
        return (
            "无法回答：系统没有人数统计，也没有任何身份信息。"
            "现有的 PIR 只能判断“检测到移动 / 疑似空闲”，红外避障模块只能给出匿名通行计数，"
            "两者都不能推算人数或识别具体是谁。"
            "可用的替代结论只有：匿名占用趋势与对照明、空调的使用建议。"
        )
    return None


def _fmt(value: dict | None) -> str:
    if not value:
        return "无数据"
    if value.get("value_text") is not None and value.get("value_num") is None:
        return str(value["value_text"])
    return str(value.get("value_num"))


def _rule_answer(question: str, digest: dict) -> str:
    lowered = question.lower()
    devices = digest["devices"]
    lines: list[str] = []

    wants_temp = any(k in lowered for k in ("温度", "temperature", "热", "冷"))
    wants_hum = any(k in lowered for k in ("湿度", "humidity"))
    wants_light = any(k in lowered for k in ("光照", "光", "灯", "light"))
    wants_occ = any(k in lowered for k in ("占用", "有人", "空闲", "occupancy", "空"))
    wants_offline = any(k in lowered for k in ("离线", "offline", "掉线", "断线"))
    wants_sim = any(k in lowered for k in ("模拟", "simulated"))
    wants_energy = any(k in lowered for k in ("节能", "省电", "energy", "浪费", "建议"))

    if wants_offline:
        offline = [d for d in devices if d["status"] == "offline"]
        lines.append(f"当前离线设备 {len(devices) and len(offline) or 0} 台。")
        for d in offline:
            lines.append(f"- {d['device_id']}：最后上报 {d['last_seen']}")

    if wants_sim:
        lines.append(
            f"共 {digest['device_count']} 台设备，其中模拟设备占比 {digest['simulated_device_share'] * 100:.0f}%。"
        )
        for d in devices:
            if d["source"] == "simulated":
                lines.append(f"- {d['device_id']}（模拟）")

    if wants_temp or wants_hum or wants_light or wants_occ:
        lines.append(f"最近 {digest['window_hours']:.0f} 小时的最新读数：")
        for d in devices:
            parts = []
            if wants_temp:
                parts.append(f"温度 {_fmt(d['latest'].get('temperature_c'))}°C")
            if wants_hum:
                parts.append(f"湿度 {_fmt(d['latest'].get('humidity_pct'))}%")
            if wants_light:
                parts.append(f"相对光照 {_fmt(d['latest'].get('light_rel_pct'))}%")
            if wants_occ:
                parts.append(f"占用 {_fmt(d['latest'].get('occupancy'))}")
            if parts:
                tag = "（模拟）" if d["source"] == "simulated" else "（真实）"
                lines.append(f"- {d['device_id']}{tag}：" + "，".join(parts))

    suggestions = digest["insights"].get("suggestions") or []
    if wants_energy or not lines:
        if digest["insights"].get("reason") == "insufficient_data":
            lines.append("窗口内数据点不足 5 个，暂时无法生成节能建议。")
        elif suggestions:
            lines.append("节能建议（均需人工确认）：")
            for s in suggestions:
                basis = s["basis"]
                lines.append(
                    f"- {s['device_id']}：{s['text']} 依据 {basis['from']} ~ {basis['to']}，"
                    f"累计 {basis['seconds']:.0f} 秒“疑似空闲且光照偏高”。"
                )
        else:
            lines.append("当前没有满足条件的照明建议。")

    if not lines:
        lines.append(
            f"窗口内共有 {digest['device_count']} 台设备、"
            f"{sum(digest['events'].values())} 条事件记录。"
        )

    lines.append(
        "说明：以上结论基于库内数据；PIR 仅检测移动，"
        "“疑似空闲”不等于房间无人，任何节能动作都需要人工确认。"
    )
    return "\n".join(lines)


def _ask_model(question: str, digest: dict) -> str:
    url = f"{settings.ai_base_url}/chat/completions"
    payload = {
        "model": settings.ai_model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {"question": question, "campus_data": digest}, ensure_ascii=False
                ),
            },
        ],
    }
    response = httpx.post(
        url,
        headers={"Authorization": f"Bearer {settings.ai_api_key}"},
        json=payload,
        timeout=settings.ai_timeout_s,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"].strip()


def answer_question(db: Session, question: str) -> dict:
    digest = build_digest(db, hours=24)
    citations = _citations(digest)

    boundary = _boundary_answer(question)
    if boundary:
        return {
            "answer": boundary,
            "mode": "rule_based",
            "citations": [],
            "notes": "capability_boundary",
        }

    if settings.ai_enabled:
        try:
            text = _ask_model(question, digest)
            return {"answer": text, "mode": "model", "citations": citations, "notes": None}
        except Exception as exc:  # noqa: BLE001 - any model failure must degrade, not 500
            return {
                "answer": _rule_answer(question, digest),
                "mode": "rule_based",
                "citations": citations,
                "notes": f"fallback_reason={type(exc).__name__}",
            }

    return {
        "answer": _rule_answer(question, digest),
        "mode": "rule_based",
        "citations": citations,
        "notes": "LLM not configured (AI_BASE_URL / AI_API_KEY unset)",
    }


def daily_summary(db: Session) -> dict:
    now = utcnow()
    insights = build_insights(db, None, 24)

    alerts = db.scalars(
        select(Event).where(
            Event.ts >= now - timedelta(hours=24),
            Event.kind.in_(("faults", "alert")),
        )
    ).all()

    online = offline = 0
    simulated = 0
    sources: Counter[str] = Counter()
    for device in db.scalars(select(Device)).all():
        age = max((now - device.last_seen).total_seconds(), 0.0)
        if age <= OFFLINE_AFTER_S:
            online += 1
        else:
            offline += 1
        if device.source == "simulated":
            simulated += 1
        sources[device.source] += 1

    total = online + offline
    return {
        "as_of": iso(now),
        "windows_hours": 24,
        "alerts": len(alerts),
        "unoccupied_bright_seconds": sum(
            d["unoccupied_bright_seconds"] for d in insights.get("devices", [])
        ),
        "devices_online": online,
        "devices_offline": offline,
        "simulated_device_share": round(simulated / total, 3) if total else 0.0,
        "sources": dict(sources),
        "insufficient_data": insights.get("reason") == "insufficient_data",
        "notes": "Alerts and timings are computed from stored readings; simulated data is labelled.",
    }
