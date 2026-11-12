#include "telemetry.h"
#include <WiFi.h>
#include <time.h>
#include <sys/time.h>

#include "pages.h"

namespace {

String jnum(float v, uint8_t decimals = 2) {
  if (isnan(v) || isinf(v)) return String("null");
  char buf[24];
  snprintf(buf, sizeof(buf), "%.*f", static_cast<int>(decimals), static_cast<double>(v));
  return String(buf);
}

String jint(long v) { return (v < 0) ? String("null") : String(v); }

String jbool(bool v) { return v ? String("true") : String("false"); }

String jstr(const char* v) { return (v == nullptr) ? String("null") : String("\"") + v + "\""; }

}  // namespace

String telemetry_timestamp() {
  const time_t now = time(nullptr);
  if (now < static_cast<time_t>(NTP_MIN_VALID_EPOCH)) return String("null");
  struct tm tmv;
  gmtime_r(&now, &tmv);
  char buf[32];
  strftime(buf, sizeof(buf), "\"%Y-%m-%dT%H:%M:%SZ\"", &tmv);
  return String(buf);
}

void telemetry_set_countdown_state(bool running, uint32_t remainingMs) {
  (void)running;
  (void)remainingMs;
}

String telemetry_build(const char* eventKind, const String& eventDetailJson,
                       uint32_t droppedCount) {
  const Readings& r = g_readings;

  String j;
  j.reserve(900);

  j += F("{\"device_id\":");
  j += jstr(DEVICE_ID);
  j += F(",\"seq\":");
  j += String(state_next_seq());
  j += F(",\"fw_version\":");
  j += jstr(FW_VERSION);
  j += F(",\"ts\":");
  j += telemetry_timestamp();
  j += F(",\"uptime_ms\":");
  j += String(millis());
  j += F(",\"source\":\"real\",\"mode\":");
  j += jstr(mode_name(g_rt.mode));
  j += F(",\"badge_id\":");
  j += jstr(BADGE_ID);
  j += F(",\"room\":");
  j += jstr(g_rt.room);
  j += F(",\"room_rssi\":");
  j += String(g_rt.roomRssi);
  j += F(",\"room_confidence\":");
  j += jstr(g_rt.roomConfidence == 2 ? "high" : (g_rt.roomConfidence == 1 ? "medium" : "low"));
  j += F(",\"sos\":");
  j += jstr(pages_sos_state_name());
  if (pages_ac_active()) {
    j += F(",\"ac_delegate\":{\"card\":");
    j += jstr(pages_ac_card());
    j += F(",\"target_c\":");
    j += String(pages_ac_target());
    j += F("}");
  }
  j += F(",\"dropped_count\":");
  j += String(static_cast<unsigned long>(droppedCount));

  j += F(",\"readings\":{");
  j += F("\"temperature_c\":");  j += jnum(r.temperatureC, 1);
  j += F(",\"humidity_pct\":");  j += jnum(r.humidityPct, 0);
  j += F(",\"light_raw\":");     j += jint(r.lightRaw);
  j += F(",\"light_mv\":");      j += jint(r.lightMv);
  j += F(",\"light_rel_pct\":"); j += jint(r.lightRelPct);
  j += F(",\"light_state\":");   j += jstr(r.lightBright ? "bright" : "dark");
  j += F(",\"occupancy\":");
  j += jstr(r.pirReady ? (r.occupied ? "occupied" : "unoccupied_suspected") : "unknown");
  j += F(",\"occupancy_confidence\":"); j += jnum(r.occConfidence, 2);
  j += F(",\"proximity\":");     j += jbool(r.proximity);
  j += F(",\"pass_count\":");    j += String(static_cast<unsigned long>(r.passCount));
  j += F(",\"relay\":");         j += jstr(r.relayOn ? "on" : "off");
  j += F(",\"rssi_dbm\":");      j += String(WiFi.RSSI());
  j += F(",\"page\":");          j += jstr(pages_title());
  j += F("}");

  j += F(",\"faults\":[");
  bool first = true;
  for (uint8_t bit = 0; bit < 16; ++bit) {
    const uint16_t mask = static_cast<uint16_t>(1u << bit);
    if (mask == FAULT_NONE || !(g_rt.faults & mask)) continue;
    if (!first) j += ',';
    first = false;
    j += jstr(fault_name(static_cast<Fault>(mask)));
  }
  j += F("]");

  if (eventKind != nullptr && eventKind[0] != '\0') {
    j += F(",\"event\":{\"kind\":");
    j += jstr(eventKind);
    if (eventDetailJson.length() > 2) {
      j += F(",");
      j += eventDetailJson.substring(1, eventDetailJson.length() - 1);
    }
    j += F("}");
  }

  j += F("}");
  return j;
}
