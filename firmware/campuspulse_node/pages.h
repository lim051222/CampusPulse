#pragma once
#include <Arduino.h>
#include "config.h"
#include "state.h"

enum Page : uint8_t {
  PAGE_HOME = 0,
  PAGE_ATTENDANCE,
  PAGE_AIRCON,
  PAGE_LIGHTING,
  PAGE_RESTROOM,
  PAGE_SOS,
  PAGE_SYSTEM,
  PAGE_COUNT
};

enum class SosState : uint8_t { Idle, Sent, Acked, Expired };

void pages_init();
void pages_next();
void pages_show(uint8_t index);
uint8_t pages_current();
const char* pages_title();

void pages_tick();          // 50 ms: SOS escalation, expiry, AC delegation expiry
void pages_render();        // 200 ms
void pages_on_short_press();          // pages, except on the restroom page it adds a star
bool pages_consume_restroom_submit(); // true once after a rating was queued

const char* pages_restroom_last();    // "submitted:4" / "abandoned" / "disabled" / ""

void pages_raise_sos();                       // called by the button layer
void pages_on_sos_acknowledged();             // called when the backend acks
SosState pages_sos_state();
const char* pages_sos_state_name();           // "none" | "raised" | "acknowledged" | "expired"

void pages_set_ac_delegate(const char* card, int targetC);
void pages_clear_ac_delegate();
bool pages_ac_active();
const char* pages_ac_card();
int  pages_ac_target();

void pages_set_restroom_result(const char* result);
uint8_t pages_restroom_stars();
void pages_skip_restroom();
