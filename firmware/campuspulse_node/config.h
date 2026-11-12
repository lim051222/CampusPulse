#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------- local secrets (first, so they can override defaults)
// secrets.h is git-ignored; see secrets.h.example.
#if __has_include("secrets.h")
#include "secrets.h"
#else
#warning "secrets.h missing - using placeholder credentials, networking will not work"
#define WIFI_SSID     "change-me"
#define WIFI_PASSWORD "change-me"
#define API_BASE_URL  "http://127.0.0.1:8000"
#define DEVICE_ID     "esp32-campuspulse"
#define TZ_OFFSET_MIN 480
#endif

// Classroom AP -> room mapping (design D4). Fill the real BSSIDs in secrets.h.
#ifndef AP1_BSSID
#define AP1_BSSID "00:00:00:00:00:00"
#endif
#ifndef AP1_ROOM
#define AP1_ROOM "Classroom 1"
#endif
#ifndef AP2_BSSID
#define AP2_BSSID "00:00:00:00:00:00"
#endif
#ifndef AP2_ROOM
#define AP2_ROOM "Classroom 2"
#endif

// ---------------------------------------------------------------- identity
#define FW_VERSION "0.2.0"

// ---------------------------------------------------------------- badge profile (fictional demo identity)
// Override any of these from secrets.h if you want a different demo card.
#ifndef BADGE_NAME
#define BADGE_NAME  "LIM QING YANG"
#endif
#ifndef BADGE_ID
#define BADGE_ID    "TP000000"
#endif
#ifndef BADGE_ROLE
#define BADGE_ROLE  "STUDENT"
#endif
// 0 = student, 1 = lecturer, 2 = staff  (drives the avatar variant)
#ifndef BADGE_ROLE_ID
#define BADGE_ROLE_ID 0
#endif

// ---------------------------------------------------------------- pins (design D5)
// ESP32-D0WD-V3 (classic WROOM-32). 19 usable IO, all allocated.
#define PIN_I2C_SDA        21
#define PIN_I2C_SCL        22
#define PIN_DHT             4   // 10k pull-up to 3V3
#define PIN_LIGHT_AO       34   // ADC1_CH6, input only
#define PIN_LIGHT_DO       23
#define PIN_PIR            13   // module VCC on 5V (VIN), output is 3.3V
#define PIN_IR_OBSTACLE    18
#define PIN_RELAY          25   // IN1 only; IN2 left unconnected
#define PIN_BUZZER_ACTIVE  32
#define PIN_BUZZER_PASSIVE 33
#define PIN_RGB_R          16
#define PIN_RGB_G          17
#define PIN_RGB_B          19
#define PIN_BTN_MODE       14
#define PIN_BTN_OK         26
#define PIN_BTN_BACK       27
#define PIN_BTN_UP         35   // input only -> needs external 10k pull-up
#define PIN_BTN_DOWN       36   // input only -> needs external 10k pull-up
#define PIN_BTN_MUTE       39   // input only -> needs external 10k pull-up
#define PIN_BOOT            0   // hold 3s after boot = restore defaults

// ---------------------------------------------------------------- electrical assumptions
#define RELAY_ACTIVE_LOW       1   // verify with a multimeter (task 1.5)
#define IR_OBSTACLE_ACTIVE_LOW 1   // most modules output LOW on detection
#define LIGHT_AO_ENABLED       1
#define RGB_COMMON_CATHODE     1

// ---------------------------------------------------------------- timing
constexpr uint32_t SAMPLING_DEFAULT_MS = 5000;
constexpr uint32_t SAMPLING_MIN_MS     = 1000;
constexpr uint32_t SAMPLING_MAX_MS     = 300000;
constexpr uint32_t DHT_MIN_INTERVAL_MS = 2000;
constexpr uint32_t UI_REFRESH_MS       = 200;
constexpr uint32_t BUTTON_SCAN_MS      = 10;
constexpr uint32_t OUTPUT_TASK_MS      = 50;
constexpr uint32_t NET_TASK_MS         = 1000;
constexpr uint32_t HEARTBEAT_MS        = 5000;
constexpr uint32_t PIR_HOLD_MS         = 120000;
constexpr uint32_t PIR_WARMUP_MS       = 60000;
constexpr uint32_t RELAY_MAX_ON_MS     = 30UL * 60UL * 1000UL;
constexpr uint32_t ALERT_COOLDOWN_MS   = 60000;
constexpr uint32_t MUTE_MAX_MS         = 15UL * 60UL * 1000UL;
constexpr uint32_t BOOT_RESET_HOLD_MS  = 3000;
constexpr uint32_t CHECKIN_LOCK_MS     = 30000;
constexpr uint32_t COUNTDOWN_DEFAULT_MS = 45UL * 60UL * 1000UL;
constexpr uint32_t COUNTDOWN_WARN_MS    = 5UL * 60UL * 1000UL;
constexpr uint32_t UNOCC_BRIGHT_ALERT_MS = 10UL * 60UL * 1000UL;
constexpr uint32_t NTP_MIN_VALID_EPOCH = 1600000000UL;

// ---------------------------------------------------------------- limits
constexpr size_t   BUFFER_CAPACITY      = 200;   // RAM ring buffer, no PSRAM
constexpr int      LIGHT_BRIGHT_PCT     = 70;
constexpr int      LIGHT_RAIL_SAMPLES   = 5;
constexpr uint8_t  CHECKIN_MAX_FAILS    = 3;
constexpr uint8_t  CHECKIN_MIN_DIGITS   = 4;
constexpr uint8_t  CHECKIN_MAX_DIGITS   = 6;
constexpr long     CHECKIN_DESK_MIN     = 1;
constexpr long     CHECKIN_DESK_MAX     = 40;
constexpr uint8_t  BUTTON_DEBOUNCE_MS   = 30;
constexpr uint16_t BUTTON_LONGPRESS_MS  = 1000;
constexpr uint16_t ACTIVE_BUZZER_PULSE_MS = 500;
constexpr uint16_t BUZZER_ALERT_HZ      = 2000;

// ---------------------------------------------------------------- badge timing
constexpr uint16_t PAGE_MAX_PRESS_MS    = 1000;   // short press upper bound
constexpr uint16_t SOS_HOLD_MS          = 5000;   // hold this long to raise SOS
constexpr uint32_t SOS_ALARM_CAP_MS     = 10UL * 60UL * 1000UL;
constexpr uint32_t SOS_PULSE_PERIOD_MS  = 3000;
constexpr uint16_t SOS_PULSE_MS         = 200;
constexpr uint32_t SOS_DEDUPE_MS        = 15000;
constexpr uint32_t AC_DELEGATE_TTL_MS   = 2UL * 60UL * 1000UL;
constexpr uint32_t RESTROOM_IDLE_MS     = 10000;   // idle auto-submit
constexpr uint16_t RESTROOM_SKIP_HOLD_MS = 1500;   // hold to leave without rating
constexpr uint16_t SOS_OVERLAY_MS       = 2500;    // only show the SOS countdown late
constexpr uint16_t MARQUEE_STEP_MS      = 450;
constexpr uint32_t SCAN_PERIOD_MS       = 60000;
constexpr uint32_t SCAN_MIN_PERIOD_MS   = 30000;
constexpr int      ROOM_HYSTERESIS_DB   = 6;
constexpr int      ROOM_HIGH_MARGIN_DB  = 10;
constexpr int      ROOM_LOW_MARGIN_DB   = 4;
constexpr int      LIGHT_TOO_DARK       = 30;
constexpr int      LIGHT_TOO_BRIGHT     = 75;

// Print the full telemetry envelope on serial (verification / field debugging).
#ifndef SERIAL_TELEMETRY
#define SERIAL_TELEMETRY 1
#endif

// ---------------------------------------------------------------- wiring sanity
#if (PIN_BTN_UP == 34) || (PIN_BTN_DOWN == 34) || (PIN_BTN_MUTE == 34)
#error "GPIO34 is reserved for the light sensor analog input"
#endif
