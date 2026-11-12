#pragma once
#include <Arduino.h>
#include "config.h"

void outputs_init();
void outputs_update();                       // call every OUTPUT_TASK_MS

void outputs_set_rgb(uint8_t r, uint8_t g, uint8_t b);
void outputs_rgb_off();

void outputs_relay_allow(bool allow);        // only energy mode sets true
bool outputs_relay_set(bool on);             // false when denied by interlock
bool outputs_relay_on();
uint32_t outputs_relay_on_ms();

void outputs_buzzer_active_pulse();          // <=500ms, respects mute
void outputs_buzzer_tone(uint16_t hz, uint16_t ms);
void outputs_all_quiet();
