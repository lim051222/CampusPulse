# CampusPulse — Smart ID Card for APU

One physical **smart ID badge** (ESP32) plus a **school-admin console**: the badge is the identity,
the interface and the panic button; the console is where attendance, facilities and alerts are acted on.

Everything the hardware cannot genuinely measure is **simulated and labelled** in the UI — see
[docs/hardware-capabilities.md](./docs/hardware-capabilities.md) for the honest matrix.

- **Badge** — 7 English pages: Home (avatar, name, `TP000000`, role) · Attendance · Air-con · Lighting · Restroom · SOS · System
- **One button** — short press pages, **5 s hold = SOS** (buzzer + red alert on the console, cleared only by a human)
- **Room awareness** — compares the two classroom APs; strongest wins, with RSSI evidence and confidence
- **Console** — Next.js 15 + shadcn/ui, dark/light, 8 routes, every value carries a `REAL` / `SIMULATED` chip

---

## Repository layout

```
firmware/campuspulse_node/   ESP32 sketch (pages, sensors, net, SOS)
backend/                     FastAPI + SQLAlchemy + SQLite
web/                         Next.js 15 console (App Router + shadcn/ui)
docs/                        hardware matrix, demo/deck guide
```

> `openspec/` and `.github/skills/` are **git-ignored**: local planning artifacts and third-party
> agent skills are not part of the deliverable.

---

## Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11+ |
| Node.js | 20+ |
| arduino-cli | 1.x with the `esp32:esp32` core **3.x** |
| Hardware | ESP32-WROOM dev board, 0.96" I²C OLED, 1 tactile button, active buzzer; optional DHT11, LDR, PIR, IR obstacle |

---

## 1. Firmware (the badge)

```powershell
# one-time toolchain
arduino-cli core install esp32:esp32
arduino-cli lib install "DHT sensor library" "Adafruit GFX Library" "Adafruit SSD1306" "ArduinoJson"

# configure — this file is git-ignored, copy it locally
cd firmware/campuspulse_node
copy secrets.h.example secrets.h     # then edit SSID / password / API_BASE_URL / AP BSSIDs

# build + flash
arduino-cli compile --fqbn esp32:esp32:esp32 .
arduino-cli upload  --fqbn esp32:esp32:esp32 -p COM4 .
```

`secrets.h` needs:

```c
#define WIFI_SSID     "your-2.4ghz-ssid"     // the ESP32 cannot see 5 GHz
#define WIFI_PASSWORD "your-password"
#define API_BASE_URL  "http://192.168.x.x:8000"   // this laptop's LAN IP, no trailing slash
#define AP1_BSSID "C0:3A:55:DA:9C:00"        // classroom APs, from a scan of the badge
#define AP1_ROOM  "Classroom 1"
#define AP2_BSSID "C0:06:C3:3F:83:02"
#define AP2_ROOM  "Classroom 2"
```

To find the BSSIDs, flash once with the placeholders and read the serial log — the badge prints the
nearby 2.4 GHz access points when no configured AP matches.

**Wiring**

| Function | GPIO |
|---|---|
| OLED SDA / SCL | 21 / 22 |
| Button (to GND) | 14 |
| Active buzzer (+ to pin, − to GND) | 32 |
| DHT11 data | 4 |
| LDR AO / DO | 34 / 23 |
| PIR out | 13 |
| IR obstacle out | 18 |

The [relay on GPIO 25 is reserved](./docs/hardware-capabilities.md) but unused in the badge build.

---

## 2. Host the backend

### 2.1 Local (development)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows
# source .venv/bin/activate           # macOS / Linux

pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

```bash
# macOS / Linux
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- **`--host 0.0.0.0` is required** — the badge connects over Wi-Fi, so `127.0.0.1` is unreachable from it.
- Health check: <http://localhost:8000/healthz> · interactive docs: <http://localhost:8000/docs>
- Data lives in `backend/data/campuspulse.db` (git-ignored). Delete it to start from an empty demo.

### 2.2 Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `CAMPUSPULSE_DB` | `sqlite:///backend/data/campuspulse.db` | SQLAlchemy URL (Postgres works too) |
| `CAMPUSPULSE_CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | comma-separated allowed origins |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | unset | enables the model-backed assistant; without them the assistant runs rule-based |

### 2.3 Production (VPS, systemd + nginx)

```ini
# /etc/systemd/system/campuspulse-api.service
[Unit]
Description=CampusPulse API
After=network.target

[Service]
WorkingDirectory=/opt/campuspulse/backend
Environment="CAMPUSPULSE_DB=sqlite:////opt/campuspulse/backend/data/campuspulse.db"
Environment="CAMPUSPULSE_CORS_ORIGINS=https://console.example.com"
ExecStart=/opt/campuspulse/backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now campuspulse-api
```

```nginx
# /etc/nginx/sites-available/campuspulse
server {
  server_name api.example.com;
  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/campuspulse /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.example.com      # HTTPS
```

Behind a real domain, also give the badge an `https` `API_BASE_URL` and use `WiFiClientSecure`
in `net.cpp` (the current build speaks plain HTTP, which is why it targets a LAN IP).

---

## 3. Host the frontend

### 3.1 Development

```powershell
cd web
npm install
npm run dev          # http://localhost:3000
```

The console proxies `/api` and `/healthz` to the backend, so there is no CORS to configure:

```ts
// next.config.ts
const target = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";
```

Point it elsewhere with `API_PROXY_TARGET=http://192.168.31.192:8000 npm run dev` when the backend
runs on another machine.

### 3.2 Production

```powershell
cd web
npm ci
npm run build
npm start -- --port 3000 --hostname 0.0.0.0
```

| Option | How |
|---|---|
| **Node server (recommended)** | `npm run build && npm start` behind nginx; set `API_PROXY_TARGET` to the backend origin |
| **Vercel / Netlify** | import the repo, root directory `web`, add `API_PROXY_TARGET` = public API URL |
| **Same origin** | serve the console at `/` and reverse-proxy `/api/*` to FastAPI; no proxy rewrites needed |

```nginx
server {
  server_name console.example.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
  }
}
```

---

## 4. Make the badge reach the backend

1. The badge and the laptop must be on the **same 2.4 GHz network**.
2. Backend bound to `0.0.0.0`, port 8000 reachable:

   ```powershell
   netsh advfirewall firewall add rule name="CampusPulse API" dir=in action=allow protocol=TCP localport=8000
   ```

3. `API_BASE_URL` must be the laptop's **LAN IP** (`ipconfig`), not `localhost`.
4. Verify from another device: `http://<laptop-ip>:8000/healthz` should return `{"status":"ok"}`.

---

## 5. Demo

A full script — nine demos, the deck outline and Q&A prep — is in
[docs/smart-id-capabilities-and-demo.md](./docs/smart-id-capabilities-and-demo.md).

Minimal run:

1. Start the backend and the console (sections 2 and 3).
2. Power the badge; confirm the console shows it **ONLINE** with a `REAL` chip.
3. Press the button through the pages; hold 5 s for SOS; acknowledge it in **Alerts**.
4. Console → **Attendance** → roll call, and **Restroom** → enable feedback and rate from the badge.

---

## 6. Safety, privacy and honest limits

- The relay is for **low-voltage DC only** — never mains.
- PIR detects **motion**, not people: occupancy is always `unoccupied_suspected` and needs human confirmation.
- Light values are an **uncalibrated relative index**, never lux.
- There is **no camera, microphone or personal tracking**; restroom feedback is anonymous and opt-in.
- Attendance, other rooms, AP telemetry and AC control are **simulated** and marked as such.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Board spams `csum err` / `ets_main.c 384` and reboots | Corrupted flash. `python -m esptool --port COM4 erase-flash`, then upload again |
| Board silent on the port but the OLED is lit | Charge-only USB cable — use a data cable |
| Badge shows `OFFLINE` in the console | `API_BASE_URL` must be the LAN IP, backend on `0.0.0.0`, port 8000 open |
| Badge never appears after a re-flash | Its `seq` counter restarted; the API dedupes on `(device, seq, ts)`, so a fresh timestamp is accepted — check `GET /api/v1/devices` |
| `No such file` / odd 500s in the console | Running `next build` while `next dev` is serving clobbers `.next`; stop dev, delete `.next`, restart |
| Hydration mismatch mentioning `<html>` / `<body>` | A stray per-route `layout.tsx` rendering its own `<html>`; there must be exactly one root layout |
| Empty light readings | The LDR `AO` wire to GPIO 34 is loose (`light_ao_not_configured` fault) |
| Relay clicks at boot | Relay module is active-high → set `RELAY_ACTIVE_LOW 0` in `config.h` |

---

## 8. Tests

```bash
cd backend
python -m pytest            # 25 tests: ingest idempotency, seq reset, SOS lifecycle, roll call,
                            # restroom gating, AC bounds, Wi-Fi thresholds, lighting aggregation

cd web
npm run lint
npm run build
```
