#pragma once
#include <Arduino.h>
#include "config.h"

void scan_init();
void scan_tick();          // call every NET_TASK_MS; starts/polls async scans

// Force a scan on the next tick (used at boot and after a page change).
void scan_request();

const char* scan_confidence_label();   // "high" / "medium" / "low"
