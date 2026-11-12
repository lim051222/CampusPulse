#pragma once
#include <Arduino.h>
#include "config.h"

// Single badge button on PIN_BTN_MODE: short press pages, 5 s hold raises SOS.
void button_init();
void button_update();              // call every BUTTON_SCAN_MS

bool     button_consume_press();   // true once per short press
bool     button_consume_sos();     // true once when the hold reaches SOS_HOLD_MS
bool     button_consume_release(uint32_t& heldMs);  // true once per release, with duration
uint32_t button_hold_ms();         // 0 when released
bool     button_down();
