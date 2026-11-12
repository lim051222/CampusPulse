#include "hal_outputs.h"
#include "state.h"

#if __has_include(<esp_arduino_version.h>)
#include <esp_arduino_version.h>
#endif
#ifndef ESP_ARDUINO_VERSION_MAJOR
#define ESP_ARDUINO_VERSION_MAJOR 2
#endif

namespace {

constexpr bool kRelayOffLevel = RELAY_ACTIVE_LOW ? HIGH : LOW;
constexpr bool kRelayOnLevel  = RELAY_ACTIVE_LOW ? LOW : HIGH;

bool     s_relayOn      = false;
uint32_t s_relayOnAt    = 0;
uint32_t s_activeUntil  = 0;
bool     s_activeHigh   = false;
uint32_t s_toneUntil    = 0;

inline uint8_t pctToDuty(uint8_t v) { return v; }  // 8-bit resolution

void pwmAttach(uint8_t pin) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(pin, 5000, 8);
#else
  const uint8_t ch = (pin == PIN_RGB_R) ? 0 : (pin == PIN_RGB_G) ? 1 : 2;
  ledcSetup(ch, 5000, 8);
  ledcAttachPin(pin, ch);
#endif
}

void pwmWrite(uint8_t pin, uint8_t value) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(pin, value);
#else
  const uint8_t ch = (pin == PIN_RGB_R) ? 0 : (pin == PIN_RGB_G) ? 1 : 2;
  ledcWrite(ch, value);
#endif
}

}  // namespace

void outputs_init() {
  // Write the inactive level BEFORE switching to OUTPUT so the relay never clicks at boot.
  digitalWrite(PIN_RELAY, kRelayOffLevel);
  pinMode(PIN_RELAY, OUTPUT);

  digitalWrite(PIN_BUZZER_ACTIVE, LOW);
  pinMode(PIN_BUZZER_ACTIVE, OUTPUT);

  digitalWrite(PIN_BUZZER_PASSIVE, LOW);
  pinMode(PIN_BUZZER_PASSIVE, OUTPUT);

  pinMode(PIN_RGB_R, OUTPUT);
  pinMode(PIN_RGB_G, OUTPUT);
  pinMode(PIN_RGB_B, OUTPUT);
  pwmAttach(PIN_RGB_R);
  pwmAttach(PIN_RGB_G);
  pwmAttach(PIN_RGB_B);
  outputs_rgb_off();

  s_relayOn = false;
}

void outputs_set_rgb(uint8_t r, uint8_t g, uint8_t b) {
  if (!RGB_COMMON_CATHODE) {
    r = static_cast<uint8_t>(255 - r);
    g = static_cast<uint8_t>(255 - g);
    b = static_cast<uint8_t>(255 - b);
  }
  pwmWrite(PIN_RGB_R, pctToDuty(r));
  pwmWrite(PIN_RGB_G, pctToDuty(g));
  pwmWrite(PIN_RGB_B, pctToDuty(b));
}

void outputs_rgb_off() { outputs_set_rgb(0, 0, 0); }

void outputs_relay_allow(bool allow) {
  g_rt.relayAllowed = allow;
  if (!allow && s_relayOn) {
    outputs_relay_set(false);
  }
}

bool outputs_relay_set(bool on) {
  if (on && !g_rt.relayAllowed) {
    fault_raise(FAULT_RELAY_DENIED);
    return false;
  }
  if (on && !s_relayOn) {
    s_relayOnAt = millis();
  }
  s_relayOn = on;
  digitalWrite(PIN_RELAY, on ? kRelayOnLevel : kRelayOffLevel);
  g_readings.relayOn = on;
  if (on) {
    fault_clear(FAULT_RELAY_TIMEOUT);
  }
  return true;
}

bool outputs_relay_on()      { return s_relayOn; }
uint32_t outputs_relay_on_ms() { return s_relayOn ? (millis() - s_relayOnAt) : 0; }

void outputs_buzzer_active_pulse() {
  if (g_rt.muted) return;
  digitalWrite(PIN_BUZZER_ACTIVE, HIGH);
  s_activeHigh  = true;
  s_activeUntil = millis() + ACTIVE_BUZZER_PULSE_MS;
}

void outputs_buzzer_tone(uint16_t hz, uint16_t ms) {
  if (g_rt.muted) return;
  tone(PIN_BUZZER_PASSIVE, hz);
  s_toneUntil = millis() + ms;
}

void outputs_all_quiet() {
  digitalWrite(PIN_BUZZER_ACTIVE, LOW);
  s_activeHigh = false;
  noTone(PIN_BUZZER_PASSIVE);
  s_toneUntil = 0;
}

void outputs_update() {
  const uint32_t now = millis();

  if (s_activeHigh && static_cast<int32_t>(now - s_activeUntil) >= 0) {
    digitalWrite(PIN_BUZZER_ACTIVE, LOW);
    s_activeHigh = false;
  }

  if (s_toneUntil != 0 && static_cast<int32_t>(now - s_toneUntil) >= 0) {
    noTone(PIN_BUZZER_PASSIVE);
    s_toneUntil = 0;
  }

  if (s_relayOn && (now - s_relayOnAt) >= RELAY_MAX_ON_MS) {
    outputs_relay_set(false);
    fault_raise(FAULT_RELAY_TIMEOUT);
  }

  if (g_rt.muted && static_cast<int32_t>(now - g_rt.muteUntil) >= 0) {
    g_rt.muted = false;  // never allow a permanent mute
  }
}
