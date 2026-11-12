#include "ui.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

namespace {

constexpr uint8_t SCREEN_W = 128;
constexpr uint8_t SCREEN_H = 64;
constexpr uint8_t OLED_ADDR = 0x3C;

Adafruit_SSD1306 s_display(SCREEN_W, SCREEN_H, &Wire, -1);
bool s_ready = false;

}  // namespace

void ui_init() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setClock(400000);

  s_ready = s_display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  if (!s_ready) {
    Serial.println("[ui] SSD1306 init failed - continuing headless");
    return;
  }
  s_display.setTextColor(SSD1306_WHITE);
  s_display.clearDisplay();
  s_display.display();
}

bool ui_ready() { return s_ready; }

void ui_frame_begin() {
  if (!s_ready) return;
  s_display.clearDisplay();
  s_display.setTextSize(1);
}

void ui_status(const char* left, const char* right) {
  if (!s_ready) return;
  s_display.setTextSize(1);
  s_display.setCursor(0, 0);
  s_display.print(left);
  const int16_t w = static_cast<int16_t>(strlen(right) * 6);
  s_display.setCursor(SCREEN_W - w, 0);
  s_display.print(right);
  s_display.drawLine(0, UI_DIVIDER_Y, SCREEN_W - 1, UI_DIVIDER_Y, SSD1306_WHITE);
}

void ui_row(uint8_t index, const String& text) {
  ui_row_at(UI_FULL_X, index, text);
}

void ui_row_at(int16_t x, uint8_t index, const String& text) {
  if (!s_ready) return;
  s_display.setTextSize(1);
  s_display.setCursor(x, ui_row_y(index));
  s_display.print(text);
}

int16_t ui_text_width(const String& text) {
  return static_cast<int16_t>(text.length()) * UI_CHAR_W;
}

void ui_row_center(uint8_t index, const String& text, uint8_t size) {
  if (!s_ready) return;
  s_display.setTextSize(size);
  int16_t x1 = 0, y1 = 0;
  uint16_t w = 0, h = 0;
  s_display.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
  const int16_t x = (SCREEN_W - static_cast<int16_t>(w)) / 2;
  if (x > 0) s_display.setCursor(x, ui_row_y(index));
  else        s_display.setCursor(0, ui_row_y(index));
  s_display.print(text);
}

void ui_frame_end() {
  if (!s_ready) return;
  s_display.display();
}

void ui_divider(int16_t y) {
  if (!s_ready) return;
  s_display.drawLine(0, y, SCREEN_W - 1, y, SSD1306_WHITE);
}

void ui_stars(int16_t x, int16_t y, uint8_t filled, uint8_t total) {
  if (!s_ready) return;
  const int16_t step = 14;
  for (uint8_t i = 0; i < total; ++i) {
    const int16_t cx = x + i * step;
    if (i < filled) {
      s_display.fillCircle(cx, y, 5, SSD1306_WHITE);
    } else {
      s_display.drawCircle(cx, y, 5, SSD1306_WHITE);
    }
  }
}

// Horizontal marquee for strings that do not fit the row width.
void ui_marquee_at(int16_t x, uint8_t index, const String& text, uint8_t chars, uint32_t phase) {
  if (!s_ready) return;

  const size_t window = chars;
  s_display.setTextSize(1);
  s_display.setCursor(x, ui_row_y(index));

  if (text.length() <= window) {
    s_display.print(text);
    return;
  }

  const size_t loopLen = text.length() + 3;
  const size_t offset  = phase % loopLen;
  String slice;
  slice.reserve(window);
  for (size_t i = 0; i < window; ++i) {
    const size_t pos = (offset + i) % loopLen;
    slice += (pos < text.length()) ? text[pos] : ' ';
  }
  s_display.print(slice);
}

void ui_marquee(uint8_t index, const String& text, uint32_t phase) {
  ui_marquee_at(UI_FULL_X, index, text, UI_FULL_CHARS, phase);
}

void ui_bar(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t pct) {
  if (!s_ready) return;
  if (pct > 100) pct = 100;
  s_display.drawRoundRect(x, y, w, h, h / 2, SSD1306_WHITE);
  const int16_t fill = static_cast<int16_t>((static_cast<int32_t>(w - 4) * pct) / 100);
  if (fill > 0) s_display.fillRoundRect(x + 2, y + 2, fill, h - 4, (h - 4) / 2, SSD1306_WHITE);
}

// Procedural 1-bit portrait. No real person is depicted; the shape only makes the
// badge read as an ID card at a glance.
void ui_avatar(int16_t x, int16_t y, int16_t size, uint8_t variant) {  if (!s_ready) return;

  s_display.drawRoundRect(x, y, size, size, 3, SSD1306_WHITE);

  const int16_t cx   = x + size / 2;
  const int16_t headR = static_cast<int16_t>(size * 0.20);
  const int16_t headY = y + static_cast<int16_t>(size * 0.34);

  s_display.fillCircle(cx, headY, headR, SSD1306_WHITE);

  const int16_t shW = static_cast<int16_t>(size * 0.66);
  const int16_t shH = static_cast<int16_t>(size * 0.34);
  s_display.fillRoundRect(cx - shW / 2, y + static_cast<int16_t>(size * 0.60),
                          shW, shH, static_cast<int16_t>(size * 0.14), SSD1306_WHITE);

  if (variant == 0) {
    // Student: glasses.
    s_display.drawLine(cx - headR, headY, cx + headR, headY, SSD1306_BLACK);
    s_display.drawRect(cx - headR + 1, headY - 3, 5, 4, SSD1306_BLACK);
    s_display.drawRect(cx + 2, headY - 3, 5, 4, SSD1306_BLACK);
  } else if (variant == 1) {
    // Lecturer: collar + tie.
    const int16_t ty = y + static_cast<int16_t>(size * 0.64);
    s_display.fillTriangle(cx - 4, ty, cx + 4, ty, cx, ty + 9, SSD1306_BLACK);
  } else {
    // Staff: cap brim.
    s_display.fillRect(cx - headR - 1, headY - headR - 2, headR * 2 + 2, 3, SSD1306_BLACK);
  }
}
