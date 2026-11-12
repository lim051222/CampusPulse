#include "hal_button.h"

namespace {

int      s_raw       = HIGH;
int      s_stable    = HIGH;      // debounced level, LOW = pressed
uint32_t s_lastRawMs = 0;
uint32_t s_downAt    = 0;
bool     s_sosFired  = false;
bool     s_pressFlag = false;
bool     s_sosFlag   = false;
bool     s_releaseFlag = false;
uint32_t s_lastHoldMs  = 0;

}  // namespace

void button_init() {
  pinMode(PIN_BTN_MODE, INPUT_PULLUP);
  s_raw = s_stable = digitalRead(PIN_BTN_MODE);
  s_lastRawMs = millis();
  s_downAt = 0;
  s_sosFired = false;
  s_pressFlag = false;
  s_sosFlag = false;
}

void button_update() {
  const uint32_t now = millis();
  const int raw = digitalRead(PIN_BTN_MODE);

  if (raw != s_raw) {
    s_raw = raw;
    s_lastRawMs = now;
    return;
  }
  if (raw == s_stable || (now - s_lastRawMs) < BUTTON_DEBOUNCE_MS) return;

  s_stable = raw;

  if (s_stable == LOW) {
    s_downAt = now;
    s_sosFired = false;
    return;
  }

  // Released: a short press only counts if the SOS hold never fired.
  const uint32_t held = s_downAt == 0 ? 0 : (now - s_downAt);
  s_lastHoldMs = held;
  s_releaseFlag = true;
  if (!s_sosFired && held >= 40 && held < PAGE_MAX_PRESS_MS) {
    s_pressFlag = true;
  }
  s_downAt = 0;
  s_sosFired = false;
}

uint32_t button_hold_ms() {
  if (s_stable != LOW || s_downAt == 0) return 0;

  const uint32_t held = millis() - s_downAt;
  if (!s_sosFired && held >= SOS_HOLD_MS) {
    s_sosFired = true;
    s_sosFlag = true;
  }
  return held;
}

bool button_consume_press() {
  if (!s_pressFlag) return false;
  s_pressFlag = false;
  return true;
}

bool button_consume_sos() {
  button_hold_ms();  // make sure a completed hold is detected even if the UI did not poll
  if (!s_sosFlag) return false;
  s_sosFlag = false;
  return true;
}

bool button_consume_release(uint32_t& heldMs) {
  if (!s_releaseFlag) return false;
  s_releaseFlag = false;
  heldMs = s_lastHoldMs;
  return true;
}

bool button_down() { return s_stable == LOW; }
