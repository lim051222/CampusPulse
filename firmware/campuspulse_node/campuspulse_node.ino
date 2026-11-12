#include "config.h"
#include <ArduinoJson.h>

#include "state.h"
#include "scheduler.h"
#include "hal_button.h"
#include "hal_outputs.h"
#include "hal_sensors.h"
#include "hal_scan.h"
#include "net.h"
#include "ui.h"
#include "pages.h"
#include "telemetry.h"

namespace {

uint32_t s_nextSampleAt = 0;

void send_sos() {
  pages_raise_sos();

  const String detail = String("{\"room\":\"") + g_rt.room +
                        "\",\"rssi\":" + String(g_rt.roomRssi) + "}";
  net_enqueue_priority(telemetry_build("sos", detail));
}

void handle_command(const Command& cmd) {
  StaticJsonDocument<256> doc;

  if (cmd.type == "set_sampling_interval") {
    if (deserializeJson(doc, cmd.args) != DeserializationError::Ok) {
      net_ack(cmd.id, "failed", "invalid_args");
      return;
    }
    const long seconds = doc["seconds"] | -1;
    const long ms      = seconds * 1000L;
    if (seconds <= 0 || ms < static_cast<long>(SAMPLING_MIN_MS) || ms > static_cast<long>(SAMPLING_MAX_MS)) {
      net_ack(cmd.id, "failed", "invalid_interval");
      return;
    }
    state_save_sampling(static_cast<uint32_t>(ms));
    net_ack(cmd.id, "acked");
    return;
  }

  if (cmd.type == "mute_alarm") {
    long minutes = 5;
    if (cmd.args.length() && deserializeJson(doc, cmd.args) == DeserializationError::Ok) {
      minutes = doc["minutes"] | 5;
    }
    if (minutes < 1)  minutes = 1;
    if (minutes > 15) minutes = 15;
    g_rt.muted     = true;
    g_rt.muteUntil = millis() + static_cast<uint32_t>(minutes) * 60000UL;
    outputs_all_quiet();
    net_ack(cmd.id, "acked");
    return;
  }

  if (cmd.type == "force_relay_off") {
    outputs_relay_set(false);
    net_ack(cmd.id, "acked");
    return;
  }

  if (cmd.type == "ac_delegate") {
    if (deserializeJson(doc, cmd.args) != DeserializationError::Ok) {
      net_ack(cmd.id, "failed", "invalid_args");
      return;
    }
    const char* card = doc["card"] | "";
    const int target = doc["target_c"] | 0;
    if (target < 16 || target > 30) {
      net_ack(cmd.id, "failed", "invalid_temperature");
      return;
    }
    if (card[0] == '\0') {
      net_ack(cmd.id, "failed", "invalid_card");
      return;
    }
    pages_set_ac_delegate(card, target);
    net_ack(cmd.id, "acked");
    return;
  }

  if (cmd.type == "ac_release") {
    pages_clear_ac_delegate();
    net_ack(cmd.id, "acked");
    return;
  }

  if (cmd.type == "restroom_result") {
    if (deserializeJson(doc, cmd.args) != DeserializationError::Ok) {
      net_ack(cmd.id, "failed", "invalid_args");
      return;
    }
    const char* result = doc["result"] | "DONE";
    pages_set_restroom_result(result);
    net_ack(cmd.id, "acked");
    return;
  }

  net_ack(cmd.id, "failed", "unknown_command");
}

void task_buttons() {
  button_update();

  if (button_consume_sos()) {
    send_sos();
    return;
  }

  uint32_t heldMs = 0;
  if (button_consume_release(heldMs)) {
    // 1.5 s hold on the restroom page = leave without rating.
    if (pages_current() == PAGE_RESTROOM && heldMs >= RESTROOM_SKIP_HOLD_MS && heldMs < SOS_HOLD_MS) {
      pages_skip_restroom();
    }
  }

  if (button_consume_press()) {
    pages_on_short_press();
  }
}

void task_outputs() {
  outputs_update();
  pages_tick();

  // Restroom rating went idle: send it, show the result, then move on.
  if (pages_consume_restroom_submit()) {
    const uint8_t stars = pages_restroom_stars();
    const String body = String("{\"restroom_id\":\"restroom-l2\",\"stars\":") +
                        String(static_cast<unsigned>(stars)) + ",\"abandoned\":false}";
    net_enqueue_post("/api/v1/restroom/feedback", body);

    char result[16];
    snprintf(result, sizeof(result), "SENT %u STARS", static_cast<unsigned>(stars));
    pages_set_restroom_result(result);
  }

  Command cmd;
  while (net_pop_command(cmd)) {
    handle_command(cmd);
  }
}

void task_ui() {
  pages_render();
}

void task_sample() {
  const uint32_t now = millis();
  if (static_cast<int32_t>(now - s_nextSampleAt) < 0) return;
  s_nextSampleAt = now + g_rt.samplingMs;

  sensors_sample();

  const String payload = telemetry_build(nullptr, "");
#if SERIAL_TELEMETRY
  Serial.println(payload);
#endif
  net_enqueue(payload);
}

void task_net() {
  net_loop();
  scan_tick();
}

void task_heartbeat() {
  Serial.printf("[hb] page=%s room=%s rssi=%d sos=%s conn=%s heap=%u pending=%u\n",
                pages_title(), g_rt.room, g_rt.roomRssi, pages_sos_state_name(),
                connectivity_tag(),
                static_cast<unsigned>(ESP.getFreeHeap()),
                static_cast<unsigned>(net_pending()));
}

SchedTask g_tasks[] = {
  {task_buttons,   BUTTON_SCAN_MS, 0},
  {task_outputs,   OUTPUT_TASK_MS, 0},
  {task_ui,        UI_REFRESH_MS,  0},
  {task_sample,    100,            0},
  {task_net,       NET_TASK_MS,    0},
  {task_heartbeat, HEARTBEAT_MS,   0},
};

void splash() {
  ui_frame_begin();
  ui_status("CAMPUSPULSE", FW_VERSION);
  ui_avatar(UI_AVATAR_X, UI_AVATAR_Y, UI_AVATAR_SIZE, BADGE_ROLE_ID);
  ui_row_at(UI_TEXT_X, 0, BADGE_ID);
  ui_row_at(UI_TEXT_X, 1, BADGE_ROLE);
  ui_row(3, "Hold 5s = SOS");
  ui_row(4, "Press = next page");
  ui_frame_end();

  Serial.printf("[ui] grid rows=%u full=%u text=%u (text x=%d)\n",
                static_cast<unsigned>(UI_ROWS), static_cast<unsigned>(UI_FULL_CHARS),
                static_cast<unsigned>(UI_TEXT_CHARS), static_cast<int>(UI_TEXT_X));
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println(F("=== CampusPulse badge ==="));
  Serial.printf("fw=%s chip=%s id=%s\n", FW_VERSION, ESP.getChipModel(), BADGE_ID);

  state_init();
  sensors_init();
  outputs_init();
  outputs_relay_allow(false);   // the badge never drives the relay
  button_init();
  ui_init();
  pages_init();
  scan_init();

  splash();

  net_init();

  s_nextSampleAt = millis();
  Serial.printf("[boot] page=%s sampling=%lums\n",
                pages_title(), static_cast<unsigned long>(g_rt.samplingMs));
}

void loop() {
  SCHEDULER_RUN(g_tasks);
}
