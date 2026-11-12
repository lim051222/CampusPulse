from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app import db as db_module
from app.models import Command
from app.utils import utcnow


@pytest.fixture()
def client(tmp_path):
    url = f"sqlite:///{(tmp_path / 'test.db').as_posix()}"
    app = create_app(url, start_sim_worker=False)
    with TestClient(app) as test_client:
        yield test_client


def envelope(seq: int = 1, **overrides) -> dict:
    payload = {
        "device_id": "esp32-test",
        "seq": seq,
        "fw_version": "0.1.0",
        "ts": utcnow().isoformat() + "Z",
        "uptime_ms": 1000,
        "source": "real",
        "mode": "energy",
        "readings": {
            "temperature_c": 24.5,
            "humidity_pct": 61,
            "light_rel_pct": 40,
            "occupancy": "occupied",
        },
        "faults": [],
    }
    payload.update(overrides)
    return payload


def test_ingest_is_idempotent(client: TestClient):
    # A retransmit is the byte-identical payload, so seq *and* timestamp match.
    payload = envelope(1)

    first = client.post("/api/v1/ingest", json=payload)
    assert first.status_code == 202
    assert first.json()["accepted"] == 1

    second = client.post("/api/v1/ingest", json=payload)
    assert second.status_code == 202
    body = second.json()
    assert body["accepted"] == 0
    assert body["duplicates"] == 1

    readings = client.get("/api/v1/readings", params={"device_id": "esp32-test"}).json()
    assert readings["count"] == 4


def test_seq_reset_after_reflash_is_not_deduped(client: TestClient):
    assert client.post("/api/v1/ingest", json=envelope(1)).json()["accepted"] == 1

    # A re-flashed board restarts at seq 1 with a new timestamp.
    reflashed = envelope(1, ts="2026-11-12T18:30:00Z")
    body = client.post("/api/v1/ingest", json=reflashed).json()
    assert body["accepted"] == 1
    assert body["duplicates"] == 0

    # ...and a true retransmit of that record is still deduplicated.
    again = client.post("/api/v1/ingest", json=reflashed).json()
    assert again["accepted"] == 0
    assert again["duplicates"] == 1


def test_ingest_rejects_missing_source(client: TestClient):
    payload = envelope(1)
    payload.pop("source")
    response = client.post("/api/v1/ingest", json=payload)
    assert response.status_code == 400
    assert response.json()["error"] == "validation_failed"


def test_ingest_batch_limit(client: TestClient):
    batch = [envelope(i) for i in range(101)]
    response = client.post("/api/v1/ingest", json=batch)
    assert response.status_code == 400
    assert response.json()["error"] == "batch_too_large"


def test_device_goes_offline_after_30s(client: TestClient):
    old_ts = (utcnow() - timedelta(seconds=90)).isoformat() + "Z"
    client.post("/api/v1/ingest", json=envelope(1, ts=old_ts))

    device = client.get("/api/v1/devices/esp32-test").json()
    assert device["status"] == "offline"
    assert device["latest"]["temperature_c"]["value_num"] == 24.5


def test_command_timeout_marks_failed(client: TestClient):
    client.post("/api/v1/ingest", json=envelope(1))
    created = client.post(
        "/api/v1/devices/esp32-test/command",
        json={"type": "set_mode", "args": {"mode": "occupancy"}},
    ).json()
    assert created["status"] == "pending"

    with db_module.session_factory()() as session:
        command = session.get(Command, created["id"])
        command.created_at = utcnow() - timedelta(seconds=600)
        session.commit()

    refreshed = client.get("/api/v1/devices/esp32-test/commands/history").json()["items"][0]
    assert refreshed["status"] == "failed"
    assert refreshed["error"] == "ack_timeout"


def test_set_mode_supersedes_older_pending(client: TestClient):
    first = client.post(
        "/api/v1/devices/esp32-test/command",
        json={"type": "set_mode", "args": {"mode": "occupancy"}},
    ).json()
    client.post(
        "/api/v1/devices/esp32-test/command",
        json={"type": "set_mode", "args": {"mode": "countdown"}},
    )

    history = client.get("/api/v1/devices/esp32-test/commands/history").json()["items"]
    by_id = {item["id"]: item for item in history}
    assert by_id[first["id"]]["status"] == "superseded"


def test_unacked_command_is_redelivered_after_grace(client: TestClient):
    client.post("/api/v1/ingest", json=envelope(1))
    created = client.post(
        "/api/v1/devices/esp32-test/command",
        json={"type": "mute_alarm", "args": {"minutes": 5}},
    ).json()

    dispatched = client.post("/api/v1/ingest", json=envelope(2)).json()["commands"]
    assert [c["id"] for c in dispatched] == [created["id"]]

    # Not re-offered immediately, so a slow-but-alive device is not spammed.
    assert client.get("/api/v1/devices/esp32-test/commands").json()["commands"] == []

    # After the grace period the same command is offered again (at-least-once delivery).
    with db_module.session_factory()() as session:
        command = session.get(Command, created["id"])
        command.dispatched_at = utcnow() - timedelta(seconds=30)
        session.commit()

    retried = client.get("/api/v1/devices/esp32-test/commands").json()["commands"]
    assert [c["id"] for c in retried] == [created["id"]]


def test_sos_lifecycle(client: TestClient):
    raised = client.post("/api/v1/badges/TP000000/sos").json()
    assert raised["created"] is True
    sos_id = raised["sos"]["id"]
    assert raised["sos"]["status"] == "raised"

    # A second raise reuses the live SOS instead of duplicating it.
    again = client.post("/api/v1/badges/TP000000/sos").json()
    assert again["created"] is False
    assert again["sos"]["id"] == sos_id

    acked = client.post(f"/api/v1/sos/{sos_id}/ack").json()
    assert acked["status"] == "acknowledged"
    assert acked["acked_at"] is not None

    resolved = client.post(f"/api/v1/sos/{sos_id}/resolve").json()
    assert resolved["status"] == "resolved"


def test_sos_from_ingest_is_reported_back(client: TestClient):
    payload = envelope(1, badge_id="TP000000", room="Classroom 1", room_rssi=-58, room_confidence="high")
    payload["event"] = {"kind": "sos"}
    response = client.post("/api/v1/ingest", json=payload).json()
    assert response["sos"]["status"] == "raised"

    sos_id = response["sos"]["id"]
    client.post(f"/api/v1/sos/{sos_id}/ack")

    follow_up = client.post("/api/v1/ingest", json=envelope(2, badge_id="TP000000")).json()
    assert follow_up["sos"]["status"] == "acknowledged"


def test_badge_state_upsert_and_rollcall(client: TestClient):
    payload = envelope(1, badge_id="TP000000", room="Classroom 1", room_rssi=-61, room_confidence="high")
    client.post("/api/v1/ingest", json=payload)

    badge = client.get("/api/v1/badges/TP000000").json()
    assert badge["room"] == "Classroom 1"
    assert badge["room_rssi"] == -61

    rollcall = client.post("/api/v1/attendance/rollcall", params={"room": "Classroom 1"}).json()
    present_ids = {b["badge_id"] for b in rollcall["present"]}
    absent_ids = {b["badge_id"] for b in rollcall["absent"]}
    assert "TP000000" in present_ids
    assert present_ids.isdisjoint(absent_ids)
    assert rollcall["present_count"] == len(present_ids)
    assert rollcall["source"] == "simulated"

    history = client.get("/api/v1/attendance/rollcalls").json()
    assert history["count"] == 1


def test_restroom_feedback_requires_enable_and_averages(client: TestClient):
    payload = {"restroom_id": "restroom-l2", "stars": 4}

    disabled = client.post("/api/v1/restroom/feedback", json=payload)
    assert disabled.status_code == 409
    assert disabled.json()["error"] == "feedback_disabled"

    client.post("/api/v1/restroom/settings", json={"restroom_id": "restroom-l2", "enabled": True})
    assert client.post("/api/v1/restroom/feedback", json=payload).status_code == 201
    assert client.post("/api/v1/restroom/feedback", json={"restroom_id": "restroom-l2", "stars": 2}).status_code == 201

    summary = client.get("/api/v1/restroom/summary", params={"restroom_id": "restroom-l2"}).json()
    assert summary["ratings"] == 2
    assert summary["average_stars"] == 3.0
    assert summary["source"] == "user_submitted"

    # Disabling stops new ratings but keeps the history.
    client.post("/api/v1/restroom/settings", json={"restroom_id": "restroom-l2", "enabled": False})
    assert client.post("/api/v1/restroom/feedback", json=payload).status_code == 409
    assert client.get("/api/v1/restroom/summary", params={"restroom_id": "restroom-l2"}).json()["ratings"] == 2


def test_restroom_rejects_out_of_range_stars(client: TestClient):
    client.post("/api/v1/restroom/settings", json={"restroom_id": "restroom-l2", "enabled": True})
    response = client.post("/api/v1/restroom/feedback", json={"restroom_id": "restroom-l2", "stars": 9})
    assert response.status_code == 422


def test_ac_command_bounds_and_empty_room_warning(client: TestClient):
    ok = client.post(
        "/api/v1/ac/command",
        json={"room": "Classroom 1", "delegate_badge": "TP000123", "target_c": 24},
    )
    assert ok.status_code == 201
    body = ok.json()
    assert body["target_c"] == 24
    assert body["source"] == "simulated"
    assert "no IR emitter" in body["note"]
    assert body["warning"] is not None or body["badges_in_room"] >= 0

    too_cold = client.post(
        "/api/v1/ac/command",
        json={"room": "Classroom 1", "delegate_badge": "TP000123", "target_c": 12},
    )
    assert too_cold.status_code == 422

    state = client.get("/api/v1/ac/state", params={"room": "Classroom 1"}).json()
    assert state["target_c"] == 24


def test_wifi_aps_and_series(client: TestClient):
    aps = client.get("/api/v1/wifi/aps").json()
    assert aps["count"] == 2
    assert all(ap["source"] == "simulated" for ap in aps["items"])

    series = client.get("/api/v1/wifi/series", params={"ap_id": "AP-C1-01", "hours": 1}).json()
    assert series["count"] > 0
    assert len({p["ts"] for p in series["points"]}) == series["count"]

    alerts = client.get("/api/v1/wifi/alerts").json()
    assert "items" in alerts


def test_lighting_summary_needs_recent_readings(client: TestClient):
    empty = client.get("/api/v1/lighting/summary").json()
    assert empty["count"] == 0
    assert empty["empty_reason"] == "no_recent_light_readings"

    client.post("/api/v1/ingest", json=envelope(1, badge_id="TP000000", room="Classroom 1"))
    summary = client.get("/api/v1/lighting/summary").json()
    assert summary["count"] == 1
    room = summary["rooms"][0]
    assert room["unit"] == "relative light index (not lux)"
    assert room["verdict"] in {"too_dark", "comfortable", "too_bright", "mixed"}


def test_lighting_counts_badges_not_samples(client: TestClient):
    for seq in (1, 2, 3):
        payload = envelope(seq, badge_id="TP000000", room="Classroom 1")
        client.post("/api/v1/ingest", json=payload)

    summary = client.get("/api/v1/lighting/summary").json()
    assert summary["count"] == 1
    room = summary["rooms"][0]
    # Three samples from one device are still one badge.
    assert room["badge_count"] == 1
    assert len(room["badges"]) == 1


def test_sim_sources_default_off(client: TestClient):
    body = client.get("/api/v1/sim").json()
    assert body["count"] == 4
    assert all(item["enabled"] is False for item in body["items"])


def test_sim_backfill_is_deterministic(tmp_path):
    def generate(name: str) -> list:
        url = f"sqlite:///{(tmp_path / name).as_posix()}"
        app = create_app(url, start_sim_worker=False)
        with TestClient(app) as test_client:
            test_client.post(
                "/api/v1/sim/rooms",
                json={"enabled": True, "seed": 42, "backfill_hours": 1, "rate_per_minute": 6},
            )
            readings = test_client.get(
                "/api/v1/readings",
                params={"device_id": "sim-room-b201", "metric": "temperature_c", "limit": 5000},
            ).json()["items"]
            return [(item["ts"], item["value_num"]) for item in readings]

    assert generate("a.db") == generate("b.db")


def test_sim_rejects_huge_backfill(client: TestClient):
    response = client.post(
        "/api/v1/sim/rooms",
        json={"enabled": True, "seed": 1, "backfill_hours": 72},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "backfill_window_too_large"


def test_sim_rejects_source_spoofing(client: TestClient):
    response = client.post(
        "/api/v1/sim/rooms",
        json={"enabled": True, "seed": 1, "source": "real"},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "source_spoof_rejected"


def test_ai_refuses_headcount_questions(client: TestClient):
    response = client.post("/api/v1/ai/ask", json={"question": "今天有多少学生进过厕所？都是谁？"})
    body = response.json()
    assert body["mode"] == "rule_based"
    assert body["notes"] == "capability_boundary"
    assert "人数" in body["answer"]


def test_ai_boundary_on_identity_question(client: TestClient):
    body = client.post(
        "/api/v1/ai/ask", json={"question": "哪个学生现在在 B-201？"}
    ).json()
    assert body["notes"] == "capability_boundary"
    assert body["citations"] == []


def test_ai_cites_simulated_sources(client: TestClient):
    client.post(
        "/api/v1/sim/rooms",
        json={"enabled": True, "seed": 7, "backfill_hours": 1, "rate_per_minute": 6},
    )
    body = client.post(
        "/api/v1/ai/ask", json={"question": "现在各房间的温度是多少？"}
    ).json()
    assert body["mode"] == "rule_based"
    assert "模拟" in body["answer"]
    assert any("simulated" in citation["sources"] for citation in body["citations"])


def test_ai_reports_missing_metric_instead_of_inventing(client: TestClient):
    client.post("/api/v1/ingest", json=envelope(1))
    body = client.post("/api/v1/ai/ask", json={"question": "现在的 CO2 是多少？"}).json()
    assert body["mode"] == "rule_based"
    assert "co2" not in body["answer"].lower() or "无数据" in body["answer"]
