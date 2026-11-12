# CampusPulse hardware capabilities — what is real, what is simulated

> Board in hand: **ESP32-D0WD-V3** (classic WROOM-32, 4 MB flash, 2.4 GHz only), CP2102 on **COM4**.
> Single badge build. Anything not listed as *Real* below is demoed with clearly labelled
> `source=simulated` data.

## 1. Inventory and verdict

| Part | Qty | Verdict for the smart-badge platform |
|---|---|---|
| ESP32 dev board | 1 | **Real** — badge MCU, Wi-Fi scan (location), HTTP to backend |
| 0.96" OLED (I²C, 128×64) | 1 | **Real** — badge screen, all pages |
| Tactile buttons + keycaps | 6 | **Real** — 1 used (page/SOS), 5 spare |
| Active buzzer | 1 | **Real** — SOS alarm on the badge |
| Passive buzzer | 1 | **Real** — soft confirmation tones |
| RGB LED | 1 | **Real** — status colour (green/amber/red) |
| DHT11 | 1 | **Real but coarse** — ±2 °C / ±5 %RH, 1 Hz max |
| Photoresistor module (AO + DO) | 1 | **Real, relative only** — uncalibrated, not lux |
| HC-SR501 PIR | 1 | **Real, motion only** — never headcount |
| IR obstacle module | 1 | **Real, proximity only** — cannot send or receive AC codes |
| 5 V 2-channel relay | 1 | **Real, low-voltage DC only** — never mains |
| 10 kΩ potentiometer | 1 | **Real** — manual setpoint / threshold demo |
| 830-hole breadboard, jumpers, resistors, LEDs | — | **Real** — assembly and indicators |
| Micro-USB cable | 1 | **Real** — power + flashing |

## 2. What this hardware can genuinely do

| Feature | Real? | How it is produced |
|---|---|---|
| Badge identity page (name, photo, TP number) | **Real UI**, fictional identity | OLED renders a 1-bit avatar bitmap + fixed demo profile from NVS |
| Page switching | **Real** | One tactile button, short press |
| SOS alert | **Real** | 5 s long press → HTTP POST → badge buzzer + backend alert |
| Which classroom the badge is in | **Real, coarse** | Wi-Fi scan of the two classroom APs; strongest known BSSID wins |
| Room presence / "is someone here" | **Real, coarse** | PIR hold window + IR proximity, reported as `occupied` / `unoccupied_suspected` |
| Relative light level | **Real, relative** | LDR analog → 0–100 index, no lux claim |
| Temperature / humidity | **Real, coarse** | DHT11 |
| Local status colour + tones | **Real** | RGB LED + buzzers |
| Low-voltage load switching (relay) | **Real** | Relay rated ≤ 5 V DC in this build |
| Backend, database, dashboard, alerts | **Real** | FastAPI + SQLite + Next.js console |

## 3. What this hardware cannot do (and how we fake it honestly)

| Not possible | Why | Demo substitute | Labelling |
|---|---|---|---|
| Reading a campus NFC/RFID card | No NFC reader, and campus card tech/keys are unknown | Demo badge IDs (`TP000000`…) are pre-seeded; badge identity is fixed in firmware | Console shows `SIMULATED` on every ID-derived row |
| Multiple badges in a room | Only one physical board | Fake badge roster with simulated Wi-Fi association per room | `SIMULATED` badge chips |
| Real attendance from card taps | No reader, and a badge in a room does not prove the holder is present | One-click roll call over simulated rosters | Banner: "based on simulated badge telemetry" |
| Sending AC infrared commands | IR obstacle module is a reflective sensor; no 38 kHz receiver/emitter pair | Console "borrow this card's IR" flow; the badge only displays which card is adjusting the AC | `SIMULATED control` + OLED line |
| Receiving AC remote codes | Same as above | Not attempted | — |
| Voice interaction (mic/speaker) | No I²S mic, no amplifier, no speaker | Out of scope | — |
| Calibrated lux | Photoresistor is uncalibrated, ADC is non-linear | Relative index + threshold | "relative light, not lux" |
| Counting people | PIR detects motion only | Occupancy boolean with confidence | "needs human confirmation" |
| CO₂ / PM2.5 | No sensor | Not shown, or simulated with a label | `SIMULATED` |
| Wi-Fi AP telemetry from the campus network | No authorised controller API | Simulated AP feed with the same fields IT would see | `SIMULATED` |
| Precise indoor positioning | RSSI is noisy and multi-path dependent | Two-AP nearest-AP classification only | Room confidence shown |
| Battery / multi-day runtime | No cell, no charger, no power-path design | Powered by USB; battery % is a fixed demo value | `SIMULATED battery` |
| Real student photos | Privacy — generating real likenesses is out of scope | Initials/abstract 1-bit avatar bitmap | — |
| Toilet occupancy from flushing/cameras | Privacy and no hardware | Opt-in star rating on the console | User-submitted, not sensor-derived |

## 4. Pin map (current firmware)

| Function | GPIO | Wiring |
|---|---|---|
| OLED SDA / SCL | 21 / 22 | I²C, address 0x3C |
| **Badge button (page / SOS)** | **14 → GND** | internal pull-up, short press = next page, **5 s hold = SOS** |
| Active buzzer (SOS) | 32 → GND | + leg to GPIO32 (or module: VCC=3V3, GND, I/O=32) |
| Passive buzzer (tones) | 33 → GND | PWM tones |
| RGB LED R / G / B | 16 / 17 / 19 | 220 Ω each, common cathode to GND |
| DHT11 DATA | 4 | 10 kΩ pull-up to 3V3 |
| Light sensor AO / DO | 34 / 23 | AO is ADC1, input-only |
| PIR OUT | 13 | **module VCC to VIN (5 V)**, output 3.3 V |
| IR obstacle OUT | 18 | LOW = obstacle |
| Relay IN1 | 25 | **module VCC to VIN (5 V)**; IN2 unused |
| Spare buttons | 26 / 27 / 35 / 36 / 39 | 35/36/39 are input-only → need external 10 kΩ pull-up |

Never connect mains to the relay. The IR obstacle module cannot control an air-conditioner.

## 5. Data provenance rules

1. Every reading carries `source` = `real` | `simulated`, written by the producer, never rewritten.
2. A simulated value never appears without a visible `SIMULATED` badge next to it.
3. Mixed charts must show a banner with the simulated share.
4. The AI assistant cites the device, metric, time range and source of everything it uses, and
   refuses questions about headcount or personal identity.
5. "Unoccupied" is always `unoccupied_suspected` and always needs human confirmation.
