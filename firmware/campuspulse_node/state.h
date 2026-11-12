#pragma once
#include <Arduino.h>
#include "config.h"

enum class Mode : uint8_t { Energy = 0, Occupancy, Countdown, Checkin, Count };

const char* mode_name(Mode m);
bool        mode_parse(const char* text, Mode& out);

enum Fault : uint16_t {
  FAULT_NONE             = 0,
  FAULT_DHT_READ         = 1u << 0,
  FAULT_DHT_RANGE        = 1u << 1,
  FAULT_LIGHT_AO         = 1u << 2,
  FAULT_PIR_WARMUP       = 1u << 3,
  FAULT_NTP              = 1u << 4,
  FAULT_RELAY_TIMEOUT    = 1u << 5,
  FAULT_WIFI             = 1u << 6,
  FAULT_BUFFER_OVERFLOW  = 1u << 7,
  FAULT_CHECKIN_LOCK     = 1u << 8,
  FAULT_RELAY_DENIED     = 1u << 9,
  FAULT_CHECKIN_FAILED   = 1u << 10,
};

const char* fault_name(Fault f);

struct Readings {
  bool  dhtOk        = false;
  float temperatureC = NAN;
  float humidityPct  = NAN;

  bool  lightAoOk    = false;
  int   lightRaw     = -1;
  int   lightMv      = -1;
  int   lightRelPct  = -1;
  bool  lightBright  = false;

  bool  pirReady     = false;
  bool  occupied     = false;
  float occConfidence = 0.0f;

  bool     proximity = false;
  uint32_t passCount = 0;

  bool relayOn = false;
};

struct RuntimeState {
  Mode     mode       = Mode::Energy;
  uint32_t samplingMs = SAMPLING_DEFAULT_MS;

  bool wifiUp    = false;
  bool backendUp = false;

  bool     relayAllowed = false;
  bool     muted        = false;
  uint32_t muteUntil    = 0;
  uint32_t lastAlertMs  = 0;

  uint16_t faults = FAULT_NONE;

  // Wi-Fi room classification (design D4)
  char    room[20]     = "unknown";
  int     roomRssi     = 0;
  uint8_t roomConfidence = 0;   // 0 = low, 1 = medium, 2 = high
  char    roomAp[20]   = "";
};

extern Readings     g_readings;
extern RuntimeState g_rt;

void state_init();                    // loads NVS-backed values
void state_save_mode(Mode m);
void state_save_sampling(uint32_t ms);
void state_reset_defaults();          // clears NVS and reboots

uint32_t state_next_seq();            // monotonic, persisted across reboots

void fault_raise(Fault f);
void fault_clear(Fault f);
bool fault_is_set(Fault f);
void fault_clear_all();

const char* connectivity_tag();       // "ONLINE" / "NO-BACKEND" / "OFFLINE"
