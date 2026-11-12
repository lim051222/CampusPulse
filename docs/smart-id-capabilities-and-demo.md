# CampusPulse — Smart ID Card: complete capability & demo guide

> Purpose: everything you need to build the pitch deck and run the live demo.
> One physical badge exists. Everything the badge cannot physically do is simulated **and labelled**
> in the UI. Never claim a simulated feature is real — the labelling is itself part of the pitch.

---

## 1. One-paragraph pitch

> CampusPulse turns a student ID card into a campus sensor and a campus interface. The card knows
> who you are, which classroom you are in, and whether you need help — and it lets a school admin
> act on that: attendance in one click, air-conditioning delegated through a student's card,
> lighting and Wi-Fi health in the same console, and a one-button SOS that rings on the card and
> on the dashboard at the same time. Everything the hardware cannot measure is clearly marked as
> simulated, so the demo never over-claims.

Short version for a slide subtitle:
> **Identity + safety + campus operations, from one card and one console.**

---

## 2. What the hardware actually is

| Item | Detail |
|---|---|
| MCU | ESP32-D0WD-V3 (classic WROOM-32, dual core 240 MHz, 4 MB flash, 2.4 GHz only) |
| Display | 0.96" OLED, 128×64, monochrome, I²C (address 0x3C) |
| Input | 1 tactile button (page / rate / SOS) |
| Output | Active buzzer (SOS alarm), passive buzzer (tones), RGB status LED |
| Sensors | DHT11 (temp/RH), photoresistor (relative light), HC-SR501 PIR (motion), IR obstacle (proximity) |
| Network | Wi-Fi 2.4 GHz → HTTP JSON to a local FastAPI backend |
| Power | USB only (no battery in this build) |
| Missing by design | NFC reader, IR emitter/receiver, microphone, speaker, camera, RTC, battery |

**Pins in use:** OLED 21/22 · button 14 (to GND) · active buzzer 32 (to GND) · passive buzzer 33 ·
RGB 16/17/19 · DHT11 4 · LDR AO 34 / DO 23 · PIR 13 · IR obstacle 18 · relay 25.

---

## 3. Capability matrix — what is real, what is demo

| # | Capability | Real or simulated | Evidence the audience can see |
|---|---|---|---|
| 1 | Badge identity (photo, name, TP number, role) | **UI real, identity fictional** | OLED Home page + console badge detail |
| 2 | Page navigation with one button | **Real** | Press → page changes on the OLED |
| 3 | SOS emergency alert | **Real** | 5 s hold → OLED countdown → buzzer → red alert in console → Acknowledge stops it |
| 4 | Classroom detection by Wi-Fi | **Real (coarse)** | Serial `[scan] ap1=-74 ap2=-69 -> Classroom 1`; console shows room + RSSI + confidence |
| 5 | Attendance roll call | **Simulated roster, real logic** | One click → present/absent lists with source chips |
| 6 | Restroom star rating | **Real user input** | Badge taps or console stars → 10 s idle → auto-submit → average updates |
| 7 | Air-conditioning via card | **Simulated control** | Pick a card + target; OLED prints "TP…… IS ADJUSTING AC"; console says no IR was sent |
| 8 | Wi-Fi infrastructure monitoring | **Simulated telemetry** | 2 AP cards, clients/latency/loss/load, anomaly list, 1h/24h/7d trends |
| 9 | Smart lighting verdict | **Real sensor, relative index** | Room verdict `TOO DARK / COMFORTABLE / TOO BRIGHT` with contributing badges |
| 10 | Energy suggestions (v1 node) | **Real readings** | "Unoccupied but bright ≥ 10 min" suggestion requiring confirmation |

---

## 4. The nine demos, in the order to present them

Each demo below is written as a slide block: **what you say → what you do → what they see**.

### Demo 1 — "This is a student card"
- **Say:** "The card is the identity layer. Same profile on the card and on the admin console."
- **Do:** show the OLED Home page: avatar, name, `TP000000`, `STUDENT`, demo notice.
- **See:** console → Badges → `TP000000` shows the identical name, ID and role.
- **Why it matters:** one identity source of truth, from card to cloud.

### Demo 2 — "One button, seven screens"
- **Say:** "No touchscreen, no app. One physical button cycles seven screens."
- **Do:** press repeatedly: Home → Attendance → Air-con → Lighting → Restroom → SOS → System.
- **See:** page name in the status bar; console telemetry field `page` follows live.
- **Why it matters:** a card has no keyboard; the whole UX fits on one button.

### Demo 3 — "SOS that actually escalates" ⭐ strongest demo
- **Say:** "Hold five seconds. The card counts down so you can cancel, then it alarms locally and
  on the dashboard at the same time. Only a human can clear it."
- **Do:** hold 5 s → buzzer pulses → open console `/alerts` → click **Acknowledge**.
- **See:** OLED `SOS SENT` → `ACKED`; console row goes `raised → acknowledged`; buzzer stops.
- **Edge cases worth mentioning:** works offline (queued, sent on reconnect), duplicate holds are
  ignored, local alarm stops after 10 minutes with `CALL SECURITY`.

### Demo 4 — "Where am I? Wi-Fi says Classroom 1"
- **Say:** "No GPS indoors. The card compares the two classroom access points; the stronger one
  is the room."
- **Do:** open console → Badges, or Attendance.
- **See:** `Classroom 1 · -69 dBm · confidence low/medium/high`, plus which AP won.
- **Why it matters:** room awareness with hardware you already own. 6 dB hysteresis stops flapping.

### Demo 5 — "Roll call in one click"
- **Say:** "Pick a room, one click, and you have present and absent — from card room telemetry."
- **Do:** console → Attendance → **Roll call for Classroom 1**.
- **See:** `5 present · 9 absent`, per-row source chips, and the roll call saved to history.
- **Honesty line (say it before they ask):** "Presence is derived from simulated badge telemetry;
  a card in a room is not proof the holder attended."

### Demo 6 — "Restroom feedback with one button" ⭐ best "small hardware, big idea" demo
- **Say:** "Students rate cleanliness with the same single button. Tap adds a star, five wraps to
  zero, ten seconds of silence submits automatically."
- **Do:** badge → Restroom page → tap 3 times → wait → `SENT 3 STARS`.
  Console → `/restroom` → average becomes 3.0.
- **Also demo on the console:** enable toggle, click the stars, watch the countdown restart on each
  click, and the "no click = abandoned" behaviour.
- **Why it matters:** opt-in, anonymous, no camera, no identity — a privacy-safe facility signal.

### Demo 7 — "Air-conditioning through a student's card"
- **Say:** "The card can act as the IR remote — but this prototype has no IR emitter, so the
  control path is simulated end to end. What is real is the delegation model."
- **Do:** console → Air-conditioning → pick a card in the room, set 24 °C, **Send**.
- **See:** console confirms and warns it is simulated; the OLED Air-con page prints
  `TP000123 IS ADJUSTING AC` for 2 minutes; **Ask AI** proposes a setpoint from the measured room
  temperature (rule-based when no model key is configured).
- **Why it matters:** you are demoing the *product concept* (who is allowed to control what)
  without pretending the hardware can do it.

### Demo 8 — "The same two APs, seen by IT"
- **Say:** "The access points that place the card in a room are also an infrastructure health
  surface: clients, latency, packet loss, load, anomalies."
- **Do:** console → Wi-Fi.
- **See:** AP cards with live numbers, three sparklines per AP for 1h/24h/7d, and an anomaly table
  (offline / latency > 100 ms / loss > 5 % / load > 80 %).
- **Honesty line:** "Real AP telemetry needs an authorised controller API from campus IT; this feed
  is simulated with the exact fields IT would get."

### Demo 9 — "Is this room too dark or too bright?"
- **Say:** "The card carries a light sensor. Combine several cards in a room and you get a verdict,
  not just a number."
- **Do:** console → Lighting.
- **See:** per-room median relative index, the contributing badges with their values, a
  `TOO DARK / COMFORTABLE / TOO BRIGHT / MIXED` verdict, and a recommendation that requires human
  confirmation.
- **Honesty line:** "Relative index, not calibrated lux. No light is switched automatically."

---

## 5. Architecture (one slide)

```
┌─────────────────────────────┐
│  Smart ID card (ESP32)      │
│  OLED · 1 button · buzzer   │
│  DHT11 · LDR · PIR · IR     │
└──────────┬──────────────────┘
           │  Wi-Fi 2.4 GHz · HTTP JSON (source=real)
           ▼
┌─────────────────────────────┐        ┌──────────────────────────┐
│  FastAPI backend            │◄───────┤  Simulated roster + APs   │
│  telemetry · SOS · rollcall │        │  (source=simulated)       │
│  restroom · AC · Wi-Fi      │        └──────────────────────────┘
│  SQLite                     │
└──────────┬──────────────────┘
           │ REST (same origin proxy)
           ▼
┌─────────────────────────────┐
│  Next.js 15 + shadcn/ui     │
│  8 routes · dark/light      │
│  every value carries source │
└─────────────────────────────┘
```

Talking point: **three layers, one contract** — the `source` field (`real` / `simulated` /
`user_submitted`) travels from the device through the API to the pixel, and the UI cannot render a
number without it.

---

## 6. Why the "honesty layer" is a feature, not a disclaimer

- Every reading carries `source`, written by the producer, never rewritten by the server.
- The API rejects simulated data pretending to be real (`source_spoof_rejected`).
- The console renders every value through one component that structurally requires a source chip.
- The AI assistant cites device, metric, time range and source for anything it says.
- Occupancy is always `unoccupied_suspected`, never "empty" — PIR detects motion, not people.

This answers the judge question *"how much of this is real?"* with a system, not an apology.

---

## 7. API surface (if a judge asks "what did you build?")

| Area | Endpoints |
|---|---|
| Ingest | `POST /api/v1/ingest` (batch ≤100, idempotent on device+seq, returns pending commands + live SOS) |
| Devices | `GET /api/v1/devices`, `/{id}`, `POST /{id}/command`, `GET /{id}/commands`, `POST /{id}/commands/{cid}/ack` |
| Badges | `GET /api/v1/badges`, `/{id}`, `POST /{id}/sos` |
| SOS | `GET /api/v1/sos`, `POST /api/v1/sos/{id}/ack`, `/resolve` |
| Attendance | `POST /api/v1/attendance/rollcall?room=…`, `GET /api/v1/attendance/rollcalls` |
| Restroom | `GET/POST /api/v1/restroom/settings`, `POST /api/v1/restroom/feedback`, `GET /api/v1/restroom/summary` |
| Air-con | `POST /api/v1/ac/command`, `GET /api/v1/ac/state`, `POST /api/v1/ac/advise` |
| Wi-Fi | `GET /api/v1/wifi/aps`, `/alerts`, `/series` |
| Lighting | `GET /api/v1/lighting/summary` |
| Insights / AI | `GET /api/v1/insights`, `POST /api/v1/ai/ask`, `GET /api/v1/ai/daily-summary` |
| Sim control | `GET /api/v1/sim`, `POST /api/v1/sim/{rooms|wifi_aps|nfc_attendance|restroom}` |

---

## 8. Suggested deck (12 slides)

| # | Slide | Take the content from |
|---|---|---|
| 1 | Title + one-line pitch | §1 |
| 2 | Problem: cards are passive, rooms are blind, admins guess | write from your own campus pain |
| 3 | Solution: one card, one console | §5 architecture |
| 4 | The card (hardware photo + BOM) | §2 |
| 5 | What the card does — 7 screens | Demo 1 + 2 |
| 6 | Safety: SOS end-to-end | Demo 3 ⭐ |
| 7 | Presence: Wi-Fi room + roll call | Demo 4 + 5 |
| 8 | Campus services: restroom + air-con | Demo 6 + 7 |
| 9 | Facilities: Wi-Fi health + lighting | Demo 8 + 9 |
| 10 | The honesty layer: real vs simulated | §6 |
| 11 | Architecture + tech stack | §5 + §7 |
| 12 | Roadmap: NFC, IR, battery, campus API | §9 |

---

## 9. Roadmap slide material (what is honestly next)

| Next step | Why it is not in this build |
|---|---|
| NFC reader (PN532) + campus card compatibility study | Card technology and door-access protocol are unknown; requires campus IT authorisation |
| IR emitter + receiver (VS1838B + 940 nm LED) | The current IR module is a reflective proximity sensor, not a remote |
| Battery + charger + power path | Needs real current measurement and a protection circuit; no cell in this build |
| Real AP telemetry | Requires an authorised Wi-Fi controller API |
| Multi-card fleet | Only one badge is built; the roster is simulated |
| Calibrated lux / CO₂ | Requires BH1750 / SCD40 class sensors |

---

## 10. Q&A rehearsal (the questions judges actually ask)

**"Is this real or fake?"**
> "Mixed, and the UI tells you which. The card's identity, button, SOS, room detection, light and
> temperature are real. Attendance rosters, AP telemetry, AC control and other rooms are simulated —
> every simulated value carries a chip, and the API refuses to relabel simulated as real."

**"Why would a student carry this?"**
> "Because it is their student card: door access, library, printing — plus classroom attendance and
> a panic button they already carry anyway."

**"Isn't this surveillance?"**
> "There is no camera, no microphone and no personal tracking. Restroom feedback is anonymous and
> opt-in; presence is a room-level Wi-Fi estimate, not a location history."

**"Why not just a phone app?"**
> "A phone dies, is often in a bag, and is not your identity credential. The card is always present,
> always powered by the door reader, and works for SOS without unlocking anything."

**"What's the business value?"**
> "Automated attendance saves teaching minutes; room-level occupancy and light data cut wasted
> HVAC and lighting; a one-button SOS improves response time; and the Wi-Fi view gives IT one
> dashboard instead of five tools."

**"What breaks first in production?"**
> "Wi-Fi room accuracy at the edge between two APs — which is why the console shows confidence and
> uses hysteresis rather than claiming precise positioning."

---

## 11. How to run the demo (checklist)

```powershell
# 1. Backend
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 2. Console
cd web
npm run dev          # http://localhost:3000

# 3. Badge: powered over USB, already flashed, reporting every 5 s
```

Before the pitch: confirm the console shows `API ONLINE`, the badge tile is `REAL / ONLINE`,
`/restroom` feedback is **enabled**, and the badge is on the Home page.

**Failure drills you can do live if something breaks:**
- Unplug the badge Wi-Fi → console marks it offline within 30 s; samples replay in order on reconnect.
- Kill the backend → badge keeps sampling and buffering; restart and it drains, no gaps.
- Press SOS with no backend → the card still alarms locally and queues the event.

---

## 12. Numbers you can quote

| Fact | Value |
|---|---|
| Firmware size | ~1.13 MB (86 % of the 1.25 MB app partition) |
| Static RAM use | 54 KB of 320 KB |
| Free heap while running | ~205 KB, flat over a 10-minute soak |
| Sampling interval | 5 s (configurable 1–300 s) |
| Offline buffer | 200 samples, ~17 minutes of autonomy |
| Backend tests | 23 passing (ingest idempotency, offline, SOS lifecycle, roll call, restroom, AC bounds, Wi-Fi, lighting) |
| Console routes | 9 (Overview, Badges, badge detail, Attendance, Restroom, Air-con, Wi-Fi, Lighting, Alerts) |
| Room hysteresis | 6 dB, confidence bands at 4 dB and 10 dB |
| Ratings auto-submit | 10 s idle, countdown restarts on every tap |
| SOS hold | 5 s with on-screen countdown, 10-minute local alarm cap |

---

*Companion documents: [hardware-capabilities.md](./hardware-capabilities.md) (what is real/simulated
in detail), [demo-script.md](./demo-script.md) (minute-by-minute run sheet).*
