#include "hal_sensors.h"
#include <DHT.h>

namespace {

DHT s_dht(PIN_DHT, DHT11);

uint32_t s_lastDhtMs      = 0;
uint32_t s_lastMotionMs   = 0;
uint32_t s_bootMs         = 0;
int      s_railCount      = 0;
bool     s_prevProximity  = false;
uint32_t s_passCount      = 0;

inline bool obstacle_detected() {
  const int level = digitalRead(PIN_IR_OBSTACLE);
  return IR_OBSTACLE_ACTIVE_LOW ? (level == LOW) : (level == HIGH);
}

}  // namespace

void sensors_init() {
  pinMode(PIN_LIGHT_DO, INPUT);
  pinMode(PIN_PIR, INPUT);
  // Pull-up so an unconnected module reads "no obstacle" instead of floating LOW.
  pinMode(PIN_IR_OBSTACLE, INPUT_PULLUP);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_LIGHT_AO, ADC_11db);

  s_dht.begin();
  s_bootMs       = millis();
  s_lastMotionMs = 0;
  s_prevProximity = obstacle_detected();
}

bool sensors_pir_ready() { return (millis() - s_bootMs) >= PIR_WARMUP_MS; }

void sensors_reset_activity() { s_passCount = 0; }

void sensors_sample() {
  const uint32_t now = millis();

  // ---- DHT11 (never faster than 2s; the read blocks ~25ms) ----
  if (now - s_lastDhtMs >= DHT_MIN_INTERVAL_MS) {
    s_lastDhtMs = now;
    const float t = s_dht.readTemperature();
    const float h = s_dht.readHumidity();

    if (isnan(t) || isnan(h)) {
      g_readings.dhtOk        = false;
      g_readings.temperatureC = NAN;
      g_readings.humidityPct  = NAN;
      fault_raise(FAULT_DHT_READ);
      fault_clear(FAULT_DHT_RANGE);
    } else if (t < 0.0f || t > 50.0f || h < 20.0f || h > 90.0f) {
      g_readings.dhtOk        = false;
      g_readings.temperatureC = NAN;
      g_readings.humidityPct  = NAN;
      fault_clear(FAULT_DHT_READ);
      fault_raise(FAULT_DHT_RANGE);
    } else {
      g_readings.dhtOk        = true;
      g_readings.temperatureC = t;
      g_readings.humidityPct  = h;
      fault_clear(FAULT_DHT_READ);
      fault_clear(FAULT_DHT_RANGE);
    }
  }

  // ---- light: analog (relative only) + digital threshold ----
#if LIGHT_AO_ENABLED
  const int raw = analogRead(PIN_LIGHT_AO);
  if (raw <= 0 || raw >= 4095) {
    if (s_railCount < LIGHT_RAIL_SAMPLES) ++s_railCount;
  } else {
    s_railCount = 0;
  }

  if (s_railCount >= LIGHT_RAIL_SAMPLES) {
    // Pin stuck on a rail: treat as "AO not wired" rather than reporting a bogus 0% or 100%.
    g_readings.lightAoOk   = false;
    g_readings.lightRaw    = -1;
    g_readings.lightMv     = -1;
    g_readings.lightRelPct = -1;
    fault_raise(FAULT_LIGHT_AO);
  } else {
    g_readings.lightAoOk   = true;
    g_readings.lightRaw    = raw;
    g_readings.lightMv     = static_cast<int>((static_cast<int64_t>(raw) * 3300) / 4095);
    g_readings.lightRelPct = static_cast<int>((static_cast<int64_t>(raw) * 100) / 4095);
    fault_clear(FAULT_LIGHT_AO);
  }
#else
  g_readings.lightAoOk   = false;
  g_readings.lightRaw    = -1;
  g_readings.lightMv     = -1;
  g_readings.lightRelPct = -1;
  fault_raise(FAULT_LIGHT_AO);
#endif

  g_readings.lightBright = (digitalRead(PIN_LIGHT_DO) == LOW);
  if (g_readings.lightAoOk) {
    g_readings.lightBright = g_readings.lightBright || (g_readings.lightRelPct > LIGHT_BRIGHT_PCT);
  }

  // ---- PIR occupancy (warm-up window is reported, not hidden) ----
  if (digitalRead(PIN_PIR) == HIGH) {
    s_lastMotionMs = now;
  }

  g_readings.pirReady = sensors_pir_ready();
  if (!g_readings.pirReady) {
    g_readings.occupied      = false;
    g_readings.occConfidence = 0.0f;
    fault_raise(FAULT_PIR_WARMUP);
  } else {
    fault_clear(FAULT_PIR_WARMUP);
    g_readings.occupied = (now - s_lastMotionMs) < PIR_HOLD_MS;
    g_readings.occConfidence = g_readings.occupied ? 0.9f : 0.4f;
  }

  // ---- IR obstacle module: count rising edges only ----
  const bool prox = obstacle_detected();
  if (prox && !s_prevProximity) {
    ++s_passCount;
  }
  s_prevProximity     = prox;
  g_readings.proximity = prox;
  g_readings.passCount = s_passCount;
}
