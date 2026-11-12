#pragma once
#include <Arduino.h>
#include "config.h"
#include "state.h"

// Build the telemetry envelope described in design.md D9.
String telemetry_build(const char* eventKind, const String& eventDetailJson,
                       uint32_t droppedCount = 0);

// "null" when NTP has not synchronised yet.
String telemetry_timestamp();

// Seconds left on the countdown in countdown mode (0 when idle).
void telemetry_set_countdown_state(bool running, uint32_t remainingMs);
