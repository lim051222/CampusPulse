#include "hal_scan.h"
#include <WiFi.h>
#include "state.h"

namespace {

enum class ScanState : uint8_t { Idle, Running };

ScanState s_state      = ScanState::Idle;
uint32_t  s_nextScanAt = 0;
uint32_t  s_startedAt  = 0;
bool      s_force      = false;

int  s_bestRssi[2] = {0, 0};
bool s_seen[2]     = {false, false};

// Previous classification, kept for hysteresis.
char s_lastRoom[20] = "unknown";
int  s_lastRssi     = 0;

bool same_bssid(const String& a, const char* b) {
  return a.equalsIgnoreCase(b);
}

void apply_room(int index, int rssi, int otherRssi, uint8_t confidence) {
  const char* room = (index == 0) ? AP1_ROOM : AP2_ROOM;
  const char* ap   = (index == 0) ? "AP-1" : "AP-2";

  // Hysteresis: only move rooms when the challenger leads by the margin.
  if (strcmp(s_lastRoom, room) != 0 && strcmp(s_lastRoom, "unknown") != 0) {
    if (rssi - otherRssi < ROOM_HYSTERESIS_DB) {
      // Keep the previous room but refresh the RSSI/confidence evidence.
      g_rt.roomRssi       = s_lastRssi;
      g_rt.roomConfidence = confidence;
      return;
    }
  }

  strncpy(g_rt.room, room, sizeof(g_rt.room) - 1);
  g_rt.room[sizeof(g_rt.room) - 1] = '\0';
  strncpy(g_rt.roomAp, ap, sizeof(g_rt.roomAp) - 1);
  g_rt.roomAp[sizeof(g_rt.roomAp) - 1] = '\0';
  g_rt.roomRssi       = rssi;
  g_rt.roomConfidence = confidence;

  strncpy(s_lastRoom, room, sizeof(s_lastRoom) - 1);
  s_lastRoom[sizeof(s_lastRoom) - 1] = '\0';
  s_lastRssi = rssi;
}

void classify() {
  if (!s_seen[0] && !s_seen[1]) {
    strncpy(g_rt.room, "unknown", sizeof(g_rt.room) - 1);
    g_rt.room[sizeof(g_rt.room) - 1] = '\0';
    g_rt.roomAp[0]   = '\0';
    g_rt.roomRssi    = 0;
    g_rt.roomConfidence = 0;
    strncpy(s_lastRoom, "unknown", sizeof(s_lastRoom) - 1);
    return;
  }

  int index;
  int winner;
  int other;

  if (s_seen[0] && s_seen[1]) {
    index  = (s_bestRssi[0] >= s_bestRssi[1]) ? 0 : 1;
    winner = s_bestRssi[index];
    other  = s_bestRssi[index == 0 ? 1 : 0];
  } else {
    index  = s_seen[0] ? 0 : 1;
    winner = s_bestRssi[index];
    other  = -100;   // only one AP visible: treat the margin as large
  }

  const int margin = winner - other;
  uint8_t confidence = 0;
  if (margin >= ROOM_HIGH_MARGIN_DB)      confidence = 2;
  else if (margin >= ROOM_LOW_MARGIN_DB)  confidence = 1;
  else                                    confidence = 0;

  apply_room(index, winner, other, confidence);
}

}  // namespace

void scan_init() {
  s_state      = ScanState::Idle;
  s_nextScanAt = 0;
  s_force      = true;
  g_rt.roomConfidence = 0;
}

void scan_request() { s_force = true; }

const char* scan_confidence_label() {
  return g_rt.roomConfidence == 2 ? "high" : (g_rt.roomConfidence == 1 ? "medium" : "low");
}

void scan_tick() {
  const uint32_t now = millis();

  if (s_state == ScanState::Running) {
    const int found = WiFi.scanComplete();

    if (found == WIFI_SCAN_RUNNING) {
      if (now - s_startedAt > 4000) {   // never let a scan hang the demo
        WiFi.scanDelete();
        s_state = ScanState::Idle;
        s_nextScanAt = now + 15000;
      }
      return;
    }

    if (found == WIFI_SCAN_FAILED) {
      WiFi.scanDelete();
      s_state = ScanState::Idle;
      s_nextScanAt = now + 15000;
      return;
    }

    s_seen[0] = s_seen[1] = false;
    s_bestRssi[0] = s_bestRssi[1] = 0;

    for (int i = 0; i < found; ++i) {
      const String bssid = WiFi.BSSIDstr(i);
      const int    rssi  = WiFi.RSSI(i);

      if (same_bssid(bssid, AP1_BSSID)) {
        if (!s_seen[0] || rssi > s_bestRssi[0]) s_bestRssi[0] = rssi;
        s_seen[0] = true;
      }
      if (same_bssid(bssid, AP2_BSSID)) {
        if (!s_seen[1] || rssi > s_bestRssi[1]) s_bestRssi[1] = rssi;
        s_seen[1] = true;
      }
    }

    // Dump before scanDelete(): the results are gone afterwards.
    if (!s_seen[0] && !s_seen[1]) {
      Serial.printf("[scan] no configured AP matched (%d visible):\n", found);
      for (int i = 0; i < found && i < 8; ++i) {
        Serial.printf("       %-18s ch%2d %4d dBm  %s\n",
                      WiFi.BSSIDstr(i).c_str(), WiFi.channel(i), WiFi.RSSI(i),
                      WiFi.SSID(i).c_str());
      }
    }

    WiFi.scanDelete();
    classify();

    Serial.printf("[scan] found=%d ap1=%d(%d) ap2=%d(%d) -> %s rssi=%d conf=%s\n",
                  found, s_seen[0] ? 1 : 0, s_bestRssi[0],
                  s_seen[1] ? 1 : 0, s_bestRssi[1],
                  g_rt.room, g_rt.roomRssi, scan_confidence_label());

    s_state = ScanState::Idle;
    s_nextScanAt = now + SCAN_PERIOD_MS;
    return;
  }

  if (!s_force && static_cast<int32_t>(now - s_nextScanAt) < 0) return;
  s_force = false;

  // Only one scan at a time; the async variant returns immediately.
  WiFi.scanNetworks(true, true);
  s_startedAt = now;
  s_state = ScanState::Running;
}
