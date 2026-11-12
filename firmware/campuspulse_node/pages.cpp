#include "pages.h"

#include <Preferences.h>
#include <time.h>

#include "hal_button.h"
#include "hal_outputs.h"
#include "hal_scan.h"
#include "net.h"
#include "ui.h"

namespace {

const char* const kTitles[PAGE_COUNT] = {
  "HOME", "ATTEND", "AIR-CON", "LIGHT", "RESTROOM", "SOS", "SYSTEM"
};

Preferences s_prefs;
uint8_t     s_page = PAGE_HOME;

SosState s_sos        = SosState::Idle;
uint32_t s_sosAtMs    = 0;
uint32_t s_sosDeadline = 0;
uint32_t s_lastPulseMs = 0;
uint32_t s_sosRaisedAt = 0;

char     s_acCard[16] = "";
int      s_acTarget   = 0;
uint32_t s_acUntil    = 0;

// ---- restroom rating (badge-side, one button) ----
uint8_t  s_stars        = 0;
bool     s_ratingActive = false;   // first tap has happened
uint32_t s_lastTapMs    = 0;
bool     s_submitReady  = false;   // a payload was queued for the network layer
char     s_lastResult[16] = "";
uint32_t s_showResultUntil = 0;

// ---------------------------------------------------------------- helpers
void wrap_two_lines(const char* text, char* line1, size_t l1, char* line2, size_t l2) {
  line1[0] = '\0';
  line2[0] = '\0';

  const size_t budget = UI_TEXT_CHARS;
  const char* space = nullptr;
  for (const char* p = text; *p; ++p) {
    if (*p == ' ' && static_cast<size_t>(p - text) <= budget) space = p;
  }
  if (space == nullptr || strlen(text) <= budget) {
    strncpy(line1, text, l1 - 1);
    line1[l1 - 1] = '\0';
    return;
  }
  const size_t n = static_cast<size_t>(space - text);
  const size_t copy = (n < l1 - 1) ? n : l1 - 1;
  memcpy(line1, text, copy);
  line1[copy] = '\0';

  strncpy(line2, space + 1, l2 - 1);
  line2[l2 - 1] = '\0';
}

const char* room_short() {
  if (strcmp(g_rt.room, "Classroom 1") == 0) return "C1";
  if (strcmp(g_rt.room, "Classroom 2") == 0) return "C2";
  return "--";
}

void status_bar() {
  char right[24];
  snprintf(right, sizeof(right), "%s %s", room_short(),
           g_rt.backendUp ? "NET" : (g_rt.wifiUp ? "AP" : "OFF"));
  ui_status(kTitles[s_page], right);
}

const char* light_verdict() {
  if (!g_readings.lightAoOk) return "NO LIGHT DATA";
  if (g_readings.lightRelPct < LIGHT_TOO_DARK) return "TOO DARK";
  if (g_readings.lightRelPct > LIGHT_TOO_BRIGHT) return "TOO BRIGHT";
  return "COMFORTABLE";
}

// ---------------------------------------------------------------- pages
void render_home() {
  ui_avatar(UI_AVATAR_X, UI_AVATAR_Y, UI_AVATAR_SIZE, BADGE_ROLE_ID);

  char l1[20];
  char l2[20];
  wrap_two_lines(BADGE_NAME, l1, sizeof(l1), l2, sizeof(l2));

  // Right column only: 13 characters per line. Rows fill from the top so a short
  // name does not leave a gap.
  uint8_t row = 0;
  if (strlen(BADGE_NAME) > static_cast<size_t>(UI_TEXT_CHARS) * 2) {
    ui_marquee_at(UI_TEXT_X, row++, String(BADGE_NAME), UI_TEXT_CHARS, millis() / MARQUEE_STEP_MS);
  } else {
    ui_row_at(UI_TEXT_X, row++, String(l1));
    if (l2[0] != '\0') ui_row_at(UI_TEXT_X, row++, String(l2));
  }

  ui_row_at(UI_TEXT_X, row++, String(BADGE_ID));
  ui_row_at(UI_TEXT_X, row++, String(BADGE_ROLE));
}

void render_restroom() {
  char line[32];

  ui_row(0, "RESTROOM L2");

  ui_stars(4, 30, s_stars, 5);
  snprintf(line, sizeof(line), "%u / 5 STARS", static_cast<unsigned>(s_stars));
  ui_row(2, line);

  if (s_showResultUntil != 0 && static_cast<int32_t>(millis() - s_showResultUntil) < 0) {
    ui_row(3, String(s_lastResult));
  } else if (!s_ratingActive) {
    ui_row(3, "TAP to rate");
  } else {
    const uint32_t left = (RESTROOM_IDLE_MS > (millis() - s_lastTapMs))
                              ? (RESTROOM_IDLE_MS - (millis() - s_lastTapMs)) / 1000
                              : 0;
    snprintf(line, sizeof(line), "SUBMIT IN %lus", static_cast<unsigned long>(left));
    ui_row(3, line);
  }

  ui_row(4, "HOLD 1.5s = SKIP");
}

void render_attendance() {
  const bool inRoom = strcmp(g_rt.room, "unknown") != 0;

  ui_marquee(0, String("ROOM   ") + g_rt.room, millis() / MARQUEE_STEP_MS);
  ui_row(1, String("STATUS ") + (inRoom ? "PRESENT" : "OUT OF ROOM"));
  ui_row(2, inRoom ? String("AP     ") + g_rt.roomAp + " " + String(g_rt.roomRssi) + "dBm"
                   : String("AP     none in range"));
  ui_row(3, inRoom ? String("CONF   ") + scan_confidence_label() : String("CONF   low"));
  ui_row(4, "Wi-Fi estimate, not GPS");
}

void render_aircon() {
  char line[32];

  if (g_readings.dhtOk) snprintf(line, sizeof(line), "ROOM   %.1f C", g_readings.temperatureC);
  else                  snprintf(line, sizeof(line), "ROOM   -- C");
  ui_row(0, line);

  if (s_acTarget > 0) snprintf(line, sizeof(line), "TARGET %d C", s_acTarget);
  else                snprintf(line, sizeof(line), "TARGET --");
  ui_row(1, line);

  if (pages_ac_active()) {
    ui_row(2, String(s_acCard) + " IS");
    ui_row(3, "ADJUSTING AC");
  } else {
    ui_row(2, "No card is adjusting");
    ui_row(3, "the air-conditioner");
  }
  ui_row(4, "SIMULATED IR - NO EMITTER");
}

void render_lighting() {
  char line[32];

  if (g_readings.lightAoOk) snprintf(line, sizeof(line), "LIGHT INDEX %d", g_readings.lightRelPct);
  else                      snprintf(line, sizeof(line), "LIGHT INDEX --");
  ui_row(0, line);

  ui_row_center(1, light_verdict(), 2);
  ui_bar(4, 40, 120, 10, g_readings.lightAoOk ? static_cast<uint8_t>(g_readings.lightRelPct) : 0);
  ui_row(4, "RELATIVE INDEX, NOT LUX");
}

void render_sos() {
  const uint32_t held = button_hold_ms();
  char line[32];

  switch (s_sos) {
    case SosState::Idle:
      if (held >= 1000) {
        snprintf(line, sizeof(line), "SOS IN %lu", static_cast<unsigned long>((SOS_HOLD_MS - held + 999) / 1000));
        ui_row_center(1, line, 2);
        ui_bar(4, 44, 120, 8, static_cast<uint8_t>((held * 100) / SOS_HOLD_MS));
        ui_row(4, "Release to cancel");
      } else {
        ui_row_center(1, "HOLD 5s", 2);
        ui_row(3, "FOR EMERGENCY SOS");
        ui_row(4, "Short press = next page");
      }
      break;

    case SosState::Sent:
      ui_row_center(1, "SOS SENT", 2);
      ui_row(3, String("ROOM   ") + g_rt.room);
      ui_row(4, g_rt.backendUp ? "Security notified" : "Queued - will retry");
      break;

    case SosState::Acked:
      ui_row_center(1, "ACKED", 2);
      ui_row(3, "Staff acknowledged");
      ui_row(4, "Hold 5s again for new SOS");
      break;

    case SosState::Expired:
      ui_row_center(1, "NO RESPONSE", 2);
      ui_row(3, "CALL CAMPUS SECURITY");
      ui_row(4, "Hold 5s to retry");
      break;
  }
}

void render_system() {
  char line[32];

  ui_row(0, String("FW     ") + FW_VERSION);
  ui_row(1, String("ROOM   ") + g_rt.room);
  snprintf(line, sizeof(line), "SIGNAL %d dBm %s", g_rt.roomRssi, scan_confidence_label());
  ui_row(2, line);
  snprintf(line, sizeof(line), "QUEUE  %u pending", static_cast<unsigned>(net_pending()));
  ui_row(3, line);
  snprintf(line, sizeof(line), "HEAP   %u KB", static_cast<unsigned>(ESP.getFreeHeap() / 1024));
  ui_row(4, line);
}

}  // namespace

// ---------------------------------------------------------------- public API
void pages_init() {
  s_prefs.begin("badge", false);
  uint8_t saved = s_prefs.getUChar("page", PAGE_HOME);
  s_page = (saved < PAGE_COUNT) ? saved : PAGE_HOME;
}

void pages_show(uint8_t index) {
  if (index >= PAGE_COUNT) return;
  s_page = index;
  s_prefs.putUChar("page", s_page);
}

void pages_next() {
  pages_show(static_cast<uint8_t>((s_page + 1) % PAGE_COUNT));
}

uint8_t pages_current() { return s_page; }
const char* pages_title() { return kTitles[s_page]; }

void pages_on_short_press() {
  if (s_page == PAGE_RESTROOM) {
    // On the restroom page a tap rates instead of paging; 0..5 then wraps to 0.
    s_stars = static_cast<uint8_t>((s_stars + 1) % 6);
    s_ratingActive = true;
    s_lastTapMs = millis();
    return;
  }
  pages_next();
}

bool pages_consume_restroom_submit() {
  if (!s_submitReady) return false;
  s_submitReady = false;
  return true;
}

const char* pages_restroom_last() { return s_lastResult; }

void pages_set_restroom_result(const char* result) {
  strncpy(s_lastResult, result, sizeof(s_lastResult) - 1);
  s_lastResult[sizeof(s_lastResult) - 1] = '\0';
  s_showResultUntil = millis() + 2500;
  s_stars = 0;
  s_ratingActive = false;
}

uint8_t pages_restroom_stars() { return s_stars; }

void pages_skip_restroom() {
  s_stars = 0;
  s_ratingActive = false;
  pages_next();
}

void pages_tick() {
  const uint32_t now = millis();

  // Restroom: idle timeout submits (or abandons when nothing was tapped).
  if (s_page == PAGE_RESTROOM && s_ratingActive && (now - s_lastTapMs) >= RESTROOM_IDLE_MS) {
    s_ratingActive = false;
    s_submitReady  = true;
  }

  if (s_sos == SosState::Sent) {
    if (now - s_lastPulseMs >= SOS_PULSE_PERIOD_MS) {
      s_lastPulseMs = now;
      outputs_buzzer_active_pulse();
      outputs_set_rgb(120, 0, 0);
    }
    if (static_cast<int32_t>(now - s_sosDeadline) >= 0) {
      s_sos = SosState::Expired;
      outputs_all_quiet();
      outputs_rgb_off();
    }
  }

  if (s_acUntil != 0 && static_cast<int32_t>(now - s_acUntil) >= 0) {
    pages_clear_ac_delegate();
  }
}

void pages_render() {
  ui_frame_begin();
  status_bar();
  ui_divider(10);

  // A hold in progress paints the countdown, but only once it is clearly a long hold
  // (the restroom page uses a 1.5 s hold to skip, the SOS needs 5 s).
  const uint32_t held = button_hold_ms();
  if (held >= SOS_OVERLAY_MS && s_sos == SosState::Idle) {
    char line[24];
    snprintf(line, sizeof(line), "SOS IN %lu",
             static_cast<unsigned long>((SOS_HOLD_MS - held + 999) / 1000));
    ui_row_center(1, line, 2);
    ui_bar(4, 44, 120, 8, static_cast<uint8_t>((held * 100) / SOS_HOLD_MS));
    ui_row(4, "Release to cancel");
    ui_frame_end();
    return;
  }

  switch (s_page) {
    case PAGE_HOME:       render_home();       break;
    case PAGE_ATTENDANCE: render_attendance(); break;
    case PAGE_AIRCON:     render_aircon();     break;
    case PAGE_LIGHTING:   render_lighting();   break;
    case PAGE_RESTROOM:   render_restroom();   break;
    case PAGE_SOS:        render_sos();        break;
    case PAGE_SYSTEM:     render_system();     break;
    default: break;
  }
  ui_frame_end();
}

void pages_raise_sos() {
  const uint32_t now = millis();

  // One SOS per badge at a time: ignore repeats while one is live.
  if (s_sos == SosState::Sent) return;
  if (s_sos == SosState::Acked && (now - s_sosRaisedAt) < SOS_DEDUPE_MS) return;

  s_sos          = SosState::Sent;
  s_sosAtMs      = now;
  s_sosRaisedAt  = now;
  s_sosDeadline  = now + SOS_ALARM_CAP_MS;
  s_lastPulseMs  = 0;

  pages_show(PAGE_SOS);
  outputs_buzzer_active_pulse();
  outputs_set_rgb(120, 0, 0);

  Serial.printf("[sos] raised room=%s\n", g_rt.room);
}

void pages_on_sos_acknowledged() {
  if (s_sos != SosState::Sent) return;
  s_sos = SosState::Acked;
  outputs_all_quiet();
  outputs_rgb_off();
  Serial.println("[sos] acknowledged by console");
}

SosState pages_sos_state() { return s_sos; }

const char* pages_sos_state_name() {
  switch (s_sos) {
    case SosState::Sent:   return "raised";
    case SosState::Acked:  return "acknowledged";
    case SosState::Expired:return "expired";
    default:               return "none";
  }
}

void pages_set_ac_delegate(const char* card, int targetC) {  strncpy(s_acCard, card ? card : "", sizeof(s_acCard) - 1);
  s_acCard[sizeof(s_acCard) - 1] = '\0';
  s_acTarget = targetC;
  s_acUntil  = millis() + AC_DELEGATE_TTL_MS;
  Serial.printf("[ac] delegate %s target=%d\n", s_acCard, s_acTarget);
}

void pages_clear_ac_delegate() {
  s_acCard[0] = '\0';
  s_acTarget  = 0;
  s_acUntil   = 0;
}

bool pages_ac_active() { return s_acCard[0] != '\0' && s_acUntil != 0; }
const char* pages_ac_card() { return s_acCard; }
int pages_ac_target() { return s_acTarget; }
