#pragma once
#include <Arduino.h>
#include "config.h"

void ui_init();
bool ui_ready();

// ---------------------------------------------------------------- geometry contract (design D1)
// 128x64 panel, 6x8 font -> 21 chars per full row, 5 rows below the divider.
constexpr int16_t UI_W            = 128;
constexpr int16_t UI_H            = 64;
constexpr int16_t UI_DIVIDER_Y    = 10;
constexpr int16_t UI_ROW0_Y       = 13;
constexpr int16_t UI_ROW_H        = 10;
constexpr uint8_t UI_ROWS         = 5;
constexpr int16_t UI_CHAR_W       = 6;

constexpr int16_t UI_FULL_X       = 0;
constexpr uint8_t UI_FULL_CHARS   = 21;

constexpr int16_t UI_AVATAR_X     = 2;
constexpr int16_t UI_AVATAR_Y     = 13;
constexpr int16_t UI_AVATAR_SIZE  = 40;   // ends at y 52, so row 4 stays clear
constexpr int16_t UI_TEXT_X       = 46;
constexpr uint8_t UI_TEXT_CHARS   = 13;

constexpr int16_t ui_row_y(uint8_t index) { return UI_ROW0_Y + index * UI_ROW_H; }

static_assert(UI_TEXT_X + UI_TEXT_CHARS * UI_CHAR_W <= UI_W, "text column overflows the panel");
static_assert(UI_AVATAR_X + UI_AVATAR_SIZE < UI_TEXT_X, "avatar column overlaps the text column");
static_assert(UI_AVATAR_Y + UI_AVATAR_SIZE <= ui_row_y(4), "avatar overlaps the footer row");
static_assert(ui_row_y(UI_ROWS - 1) + 8 <= UI_H, "the fifth row is clipped");

void ui_frame_begin();
void ui_status(const char* left, const char* right);
void ui_row(uint8_t index, const String& text);                        // full width, x = 0
void ui_row_at(int16_t x, uint8_t index, const String& text);          // body text
void ui_row_center(uint8_t index, const String& text, uint8_t size);   // size 1 or 2
void ui_frame_end();

void ui_avatar(int16_t x, int16_t y, int16_t size, uint8_t variant);   // 1-bit demo portrait
void ui_divider(int16_t y);
void ui_bar(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t pct);
void ui_stars(int16_t x, int16_t y, uint8_t filled, uint8_t total);
void ui_marquee(uint8_t index, const String& text, uint32_t phase);    // scrolls if too long
void ui_marquee_at(int16_t x, uint8_t index, const String& text, uint8_t chars, uint32_t phase);
int16_t ui_text_width(const String& text);
