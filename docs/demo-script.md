# CampusPulse · 3-minute demo script

> Bring-up checklist before the room fills up: backend running, dashboard open, node powered,
> serial monitor attached, hotspot on **2.4 GHz**, `secrets.h` flashed with the laptop's LAN IP.

## 0:00 — 0:20 · Frame it

> "CampusPulse turns a smart campus badge and low-cost room sensors into campus operations data.
> Today I'm showing the hardware I actually have: one ESP32 node. Anything the hardware can't
> measure is clearly marked as simulated in the console."

Point at the dashboard header: `API OK` and `RULE-BASED AI` (or `LLM ENABLED`).

## 0:20 — 1:00 · Mode A · energy node

1. Long-press **MODE** until the OLED shows `ENERGY`.
2. Wave a hand over the PIR → relay clicks on, RGB goes dim blue, dashboard card updates within 5 s.
3. Cover the light sensor, uncover it, then walk away.
4. Say: "When the room is *suspected* empty and the light is still high for 10 minutes, the node
   buzzes and the dashboard raises a suggestion. It never turns anything off by itself."

Show the **Insights** panel: each suggestion carries the device, the time range and the
`需人工确认` badge.

## 1:00 — 1:20 · Mode B · occupancy lamp

1. Long-press **MODE** → `OCCUPANCY`.
2. Move a hand over the IR obstacle sensor → RGB goes green → yellow → red; short beep on occupancy.
3. Say: "Green free, amber someone nearby, red in use — a hallway indicator built from three cheap parts."

## 1:20 — 1:40 · Mode C · class countdown

1. Long-press **MODE** → `COUNTDOWN`.
2. Press **OK** to start; **UP** adds 5 minutes, **BACK** resets.
3. Say: "NTP time, no RTC needed. The 5-minute warning and the end alarm use different tones."

## 1:40 — 2:00 · Mode D · desk check-in (NFC substitute)

1. Long-press **MODE** → `CHECKIN`.
2. Enter a desk code (e.g. `12`) with UP/DOWN, **OK** to append digits, hold **OK** to submit.
3. Show the message on the OLED and the event landing in the backend.
4. Say: "This replaces the NFC reader I don't have — the flow is the same, the identifier is typed
   instead of tapped."

## 2:00 — 2:40 · Admin console

1. **Live devices**: temperature, humidity, relative light, occupancy, relay, faults, last seen.
2. **History**: switch 1h → 24h, switch metric.
3. **Simulated campus data**: enable `rooms` with seed 42, backfill 1 h.
   → New `SIMULATED` devices appear next to the real one.
   Say: "Other rooms have no sensors, so I flag them honestly. The dashboard refuses to hide the
   label, and the API rejects simulated rows pretending to be real."
4. Enable `wifi_aps` to show the IT-monitoring story with its authorisation note.

## 2:40 — 3:00 · AI + close

1. Ask: **"今天哪间教室有无人时还开灯的迹象？"**
   → The answer cites device, metric, time range and labels the source.
2. Ask: **"今天有多少学生进过厕所？"**
   → The assistant refuses and explains the capability boundary.
3. Close: "Every number on this screen knows where it came from — real or simulated — and every
   energy suggestion still ends with a human decision."

## Failure drills (rehearse these)

| Scenario | Expected behaviour |
|---|---|
| Unplug the hotspot for 2 minutes | OLED shows `OFFLINE`, node buffers up to 200 samples, dashboard marks the device offline after 30 s; on reconnect the backlog uploads in order |
| Press **MUTE** | Alarm silenced, auto re-arms within 15 minutes, the dashboard shows the mute command as `acked` |
| Click `relay off` in the dashboard | Command goes `pending` → `acked` within 5 s; relay opens immediately |
| Kill the backend | Node keeps sampling, buffer grows, dashboard shows the API error banner |

## Do not say

* "The room is empty" → say "no motion detected / suspected empty".
* "This controls the air-conditioner" → the IR module here cannot decode or transmit AC codes.
* "This is real AP data" → AP, NFC, restroom and other rooms are simulated in this build.
