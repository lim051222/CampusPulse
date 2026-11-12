#include "state.h"
#include <Preferences.h>

Readings     g_readings;
RuntimeState g_rt;

static Preferences s_prefs;
static uint32_t    s_seq            = 0;
static uint32_t    s_seqReservedTo  = 0;

static const char* const MODE_NAMES[] = {"energy", "occupancy", "countdown", "checkin"};

const char* mode_name(Mode m) {
  const uint8_t i = static_cast<uint8_t>(m);
  return (i < static_cast<uint8_t>(Mode::Count)) ? MODE_NAMES[i] : MODE_NAMES[0];
}

bool mode_parse(const char* text, Mode& out) {
  if (!text) return false;
  for (uint8_t i = 0; i < static_cast<uint8_t>(Mode::Count); ++i) {
    if (strcmp(text, MODE_NAMES[i]) == 0) {
      out = static_cast<Mode>(i);
      return true;
    }
  }
  return false;
}

const char* fault_name(Fault f) {
  switch (f) {
    case FAULT_DHT_READ:        return "dht11_read_failed";
    case FAULT_DHT_RANGE:       return "dht11_out_of_range";
    case FAULT_LIGHT_AO:        return "light_ao_not_configured";
    case FAULT_PIR_WARMUP:      return "pir_warmup";
    case FAULT_NTP:             return "ntp_unsynced";
    case FAULT_RELAY_TIMEOUT:   return "relay_timeout";
    case FAULT_WIFI:            return "wifi_disconnected";
    case FAULT_BUFFER_OVERFLOW: return "buffer_overflow";
    case FAULT_CHECKIN_LOCK:    return "checkin_locked";
    case FAULT_RELAY_DENIED:    return "relay_not_allowed_in_mode";
    case FAULT_CHECKIN_FAILED:  return "checkin_failed";
    default:                    return "none";
  }
}

void state_init() {
  s_prefs.begin("campuspulse", false);

  Mode saved = Mode::Energy;
  if (mode_parse(s_prefs.getString("mode", "energy").c_str(), saved)) {
    g_rt.mode = saved;
  }

  const uint32_t interval = s_prefs.getULong("samp", SAMPLING_DEFAULT_MS);
  g_rt.samplingMs = constrain(interval, SAMPLING_MIN_MS, SAMPLING_MAX_MS);

  // Reserve seq in blocks of 1000 so flash is not written on every sample.
  s_seq           = s_prefs.getULong("seq", 0);
  s_seqReservedTo = s_seq + 1000;
  s_prefs.putULong("seq", s_seqReservedTo);
}

void state_save_mode(Mode m) {
  g_rt.mode = m;
  s_prefs.putString("mode", mode_name(m));
}

void state_save_sampling(uint32_t ms) {
  g_rt.samplingMs = constrain(ms, SAMPLING_MIN_MS, SAMPLING_MAX_MS);
  s_prefs.putULong("samp", g_rt.samplingMs);
}

void state_reset_defaults() {
  s_prefs.clear();
  delay(100);
  ESP.restart();
}

uint32_t state_next_seq() {
  ++s_seq;
  if (s_seq >= s_seqReservedTo) {
    s_seqReservedTo = s_seq + 1000;
    s_prefs.putULong("seq", s_seqReservedTo);
  }
  return s_seq;
}

void fault_raise(Fault f)   { g_rt.faults |= static_cast<uint16_t>(f); }
void fault_clear(Fault f)   { g_rt.faults &= static_cast<uint16_t>(~f); }
bool fault_is_set(Fault f)  { return (g_rt.faults & static_cast<uint16_t>(f)) != 0; }
void fault_clear_all()      { g_rt.faults = FAULT_NONE; }

const char* connectivity_tag() {
  if (!g_rt.wifiUp) return "OFFLINE";
  return g_rt.backendUp ? "ONLINE" : "NO-BACKEND";
}
