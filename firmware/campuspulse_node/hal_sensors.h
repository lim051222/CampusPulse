#pragma once
#include <Arduino.h>
#include "config.h"
#include "state.h"

void sensors_init();
void sensors_sample();          // refresh g_readings (rate-limits DHT internally)
bool sensors_pir_ready();
void sensors_reset_activity();  // clears pass_count
